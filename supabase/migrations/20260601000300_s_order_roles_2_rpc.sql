-- =============================================================================
-- Migration S-ORDER-ROLES-2 (Sprint 6, 2026-06-01)
--
-- Logique métier serveur de la couche rôles workflow par-commande :
--   1. tenant_order_status_transitions (matrice transitions canoniques)
--   2. RPC assign_tenant_order_role
--   3. RPC revoke_tenant_order_role
--   4. RPC update_tenant_order_role_capabilities (TRANSACTION + audit
--      retroactif sur toutes les commandes ayant ce rôle assigné)
--   5. RPC transition_tenant_order_status (basée sur matrice extensible
--      vs ancienne RPC update_tenant_order_status qui est en matrice
--      enum dur — coexistent en MVP, migration progressive front)
--
-- Triggers défensifs AC6 reportés à Sprint 9 audit sécurité (belt-and-
-- suspenders, écriture directe déjà bloquée par RLS tenant_order_roles_
-- write_admin super_admin only).
--
-- Toutes RPCs SECURITY DEFINER pour passer outre policy RLS et garantir
-- l'audit dans tenant_order_role_events / tenant_order_status_events.
-- =============================================================================

-- ─── 0. Étendre CHECK event_type pour audit RPC ────────────────────────────
-- L'event_type 'role_event' n'est pas suffisant si on veut différencier
-- assignment vs revoke vs capability_updated vs direct_db_modification
-- (cf. trigger défensif Sprint 9). On garde la liste actuelle ; les RPC
-- de cette migration n'introduisent pas de nouveau event_type.

-- ─── 1. tenant_order_status_transitions ───────────────────────────────────
-- Matrice transitions par tenant. Self-service vs admin-required encodé
-- via required_capability (null = auto post-submitCart, sinon capability
-- requise sur le rôle assigné à la commande pour le user appelant).

create table if not exists public.tenant_order_status_transitions (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null references public.tenants(id) on delete cascade,
  from_status_code     text not null,
  to_status_code       text not null,
  /**
   * Capability requise pour effectuer la transition. null = transition
   * automatique (typiquement post-action système, ex draft→pending via
   * submitCart). Sinon, le user appelant doit avoir un rôle non-révoqué
   * sur la commande avec cette capability = true.
   */
  required_capability  text null,
  /**
   * Si true, le created_by de la commande (auteur) peut effectuer cette
   * transition même sans capability. Ex : draft → cancelled self-service
   * acheteur. Évite de devoir donner can_cancel à l'Acheteur preset.
   */
  self_service_creator boolean not null default false,
  archived_at          timestamptz null,
  created_at           timestamptz not null default now(),
  unique (tenant_id, from_status_code, to_status_code)
);
create index if not exists tenant_order_status_transitions_tenant_idx
  on public.tenant_order_status_transitions (tenant_id) where archived_at is null;

alter table public.tenant_order_status_transitions enable row level security;

drop policy if exists tenant_order_status_transitions_select on public.tenant_order_status_transitions;
create policy tenant_order_status_transitions_select on public.tenant_order_status_transitions
  for select using (
    public.is_super_admin()
    or tenant_id in (select public.current_user_tenant_ids())
  );

drop policy if exists tenant_order_status_transitions_write on public.tenant_order_status_transitions;
create policy tenant_order_status_transitions_write on public.tenant_order_status_transitions
  for all using (
    public.is_super_admin()
    or public.user_has_capability(tenant_id, 'can_manage_roles')
  ) with check (
    public.is_super_admin()
    or public.user_has_capability(tenant_id, 'can_manage_roles')
  );

-- Seed des transitions canoniques v1.1 (spec AC5)
-- Étendu sur le trigger tenants_seed_catalogs pour les nouveaux tenants.
create or replace function public.seed_tenant_status_transitions(p_tenant_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.tenant_order_status_transitions
    (tenant_id, from_status_code, to_status_code, required_capability, self_service_creator)
  values
    (p_tenant_id, 'draft',         'cancelled', 'can_cancel',   true),
    (p_tenant_id, 'draft',         'validated', 'can_validate', false),
    (p_tenant_id, 'validated',     'cancelled', 'can_cancel',   false),
    (p_tenant_id, 'validated',     'in_production', 'can_modify', false),
    (p_tenant_id, 'in_production', 'shipped',   'can_modify',   false),
    (p_tenant_id, 'in_production', 'cancelled', 'can_cancel',   false),
    (p_tenant_id, 'shipped',       'delivered', 'can_modify',   false),
    (p_tenant_id, 'delivered',     'invoiced',  'can_export',   false)
  on conflict (tenant_id, from_status_code, to_status_code) do nothing;
end;
$$;

-- Seed initial pour tenants existants
do $$
declare _t record;
begin
  for _t in select id from public.tenants loop
    perform public.seed_tenant_status_transitions(_t.id);
  end loop;
end $$;

-- Étendre le trigger tenants_seed_catalogs pour inclure aussi les transitions
create or replace function public.seed_tenant_catalogs()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- 5 role_definitions presets
  insert into public.tenant_role_definitions
    (tenant_id, name, description, capabilities, notify_policy, scope, ordering_index)
  values
    (new.id, 'Owner', 'Propriétaire du tenant — toutes les capabilities',
      '{"can_quote": true, "can_order": true, "can_invite": true, "can_validate": true, "can_cancel": true, "can_modify": true, "can_export": true, "can_manage_catalog": true, "can_manage_roles": true}'::jsonb,
      'chain_next', 'tenant', 10),
    (new.id, 'Admin', 'Administrateur tenant — toutes capabilities sauf gestion des rôles',
      '{"can_quote": true, "can_order": true, "can_invite": true, "can_validate": true, "can_cancel": true, "can_modify": true, "can_export": true, "can_manage_catalog": true, "can_manage_roles": false}'::jsonb,
      'chain_next', 'tenant', 20),
    (new.id, 'Acheteur', 'Passe des devis et commandes sur les boutiques autorisées',
      '{"can_quote": true, "can_order": true, "can_invite": false, "can_validate": false, "can_cancel": false, "can_modify": false, "can_export": false, "can_manage_catalog": false, "can_manage_roles": false}'::jsonb,
      'chain_next', 'tenant', 30),
    (new.id, 'Validateur', 'Valide les commandes draft → validated + actions intermédiaires',
      '{"can_quote": false, "can_order": false, "can_invite": false, "can_validate": true, "can_cancel": true, "can_modify": true, "can_export": true, "can_manage_catalog": false, "can_manage_roles": false}'::jsonb,
      'chain_next', 'tenant', 40),
    (new.id, 'Producteur', 'Met à jour le statut de production + exporte les commandes',
      '{"can_quote": false, "can_order": false, "can_invite": false, "can_validate": false, "can_cancel": false, "can_modify": true, "can_export": true, "can_manage_catalog": false, "can_manage_roles": false}'::jsonb,
      'chain_next', 'tenant', 50)
  on conflict (tenant_id, name) do nothing;

  -- 7 status_definitions
  insert into public.tenant_order_status_definitions
    (tenant_id, code, label, color, ordering_index, is_terminal)
  values
    (new.id, 'draft',         'Brouillon',     '#9ca3af', 10, false),
    (new.id, 'validated',     'Validée',       '#10b981', 20, false),
    (new.id, 'in_production', 'En production', '#3b82f6', 30, false),
    (new.id, 'shipped',       'Expédiée',      '#8b5cf6', 40, false),
    (new.id, 'delivered',     'Livrée',        '#059669', 50, true),
    (new.id, 'invoiced',      'Facturée',      '#0891b2', 60, true),
    (new.id, 'cancelled',     'Annulée',       '#ef4444', 70, true)
  on conflict (tenant_id, code) do nothing;

  -- Transitions canoniques
  perform public.seed_tenant_status_transitions(new.id);

  return new;
end;
$$;

-- ─── 2. RPC assign_tenant_order_role ──────────────────────────────────────
-- AC1 spec. SECURITY DEFINER pour passer outre RLS tenant_order_roles_write_admin.
-- Idempotent : si l'assignment existe déjà (UNIQUE), retourne l'id existant.

create or replace function public.assign_tenant_order_role(
  p_order_id           uuid,
  p_role_definition_id uuid,
  p_user_id            uuid
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  _caller          uuid := auth.uid();
  _order           record;
  _role            record;
  _is_admin_tenant boolean;
  _assignment_id   uuid;
  _capabilities    jsonb;
  _existing_id     uuid;
begin
  if _caller is null then
    raise exception 'Authentication required';
  end if;

  -- 1. Charge la commande
  select * into _order from public.tenant_orders where id = p_order_id;
  if _order is null then
    raise exception 'order_not_found: %', p_order_id;
  end if;

  -- 2. Vérifie que caller est admin du tenant qui possède la commande
  select exists (
    select 1 from public.tenant_members tm
    where tm.user_id = _caller
      and tm.tenant_id = _order.tenant_id
      and tm.role in ('owner', 'admin')
  ) into _is_admin_tenant;

  if not (_is_admin_tenant or public.is_super_admin()) then
    raise exception 'permission_denied: admin tenant requires';
  end if;

  -- 3. Vérifie que p_user_id est membre du tenant
  if not exists (
    select 1 from public.tenant_members tm
    where tm.user_id = p_user_id
      and tm.tenant_id = _order.tenant_id
  ) then
    raise exception 'user_not_member: % is not member of tenant %', p_user_id, _order.tenant_id;
  end if;

  -- 4. Vérifie que le rôle appartient au même tenant + scope cohérent
  select * into _role from public.tenant_role_definitions where id = p_role_definition_id;
  if _role is null then
    raise exception 'role_not_found: %', p_role_definition_id;
  end if;
  if _role.tenant_id <> _order.tenant_id then
    raise exception 'role_mismatch_tenant: role tenant % vs order tenant %', _role.tenant_id, _order.tenant_id;
  end if;
  if _role.scope = 'shop' and _role.scope_shop_id <> _order.shop_id then
    raise exception 'role_scope_mismatch: role scope shop % vs order shop %', _role.scope_shop_id, _order.shop_id;
  end if;

  -- 5. INSERT idempotent
  select id into _existing_id from public.tenant_order_roles
    where order_id = p_order_id
      and role_definition_id = p_role_definition_id
      and user_id = p_user_id;

  if _existing_id is not null then
    -- Reactivate if revoked
    update public.tenant_order_roles
      set revoked_at = null, revoked_by = null
      where id = _existing_id and revoked_at is not null;
    return _existing_id;
  end if;

  insert into public.tenant_order_roles (order_id, role_definition_id, user_id, assigned_by)
    values (p_order_id, p_role_definition_id, p_user_id, _caller)
    returning id into _assignment_id;

  -- 6. INSERT audit event
  _capabilities := _role.capabilities;
  insert into public.tenant_order_role_events
    (order_id, role_definition_id, user_id, event_type, actor_user_id, payload)
    values (
      p_order_id, p_role_definition_id, p_user_id, 'assigned', _caller,
      jsonb_build_object('role_name', _role.name, 'capabilities', _capabilities)
    );

  return _assignment_id;
end;
$$;

grant execute on function public.assign_tenant_order_role(uuid, uuid, uuid) to authenticated;

-- ─── 3. RPC revoke_tenant_order_role ──────────────────────────────────────
-- AC2 spec. Admin tenant OU user lui-même (auto-revoke).

create or replace function public.revoke_tenant_order_role(
  p_assignment_id uuid
)
returns timestamptz
language plpgsql security definer set search_path = public as $$
declare
  _caller          uuid := auth.uid();
  _assignment      record;
  _order           record;
  _is_admin_tenant boolean;
  _revoked_at      timestamptz;
begin
  if _caller is null then
    raise exception 'Authentication required';
  end if;

  select * into _assignment from public.tenant_order_roles where id = p_assignment_id;
  if _assignment is null then
    raise exception 'assignment_not_found: %', p_assignment_id;
  end if;

  -- Idempotent : déjà révoqué = no-op silencieux
  if _assignment.revoked_at is not null then
    return _assignment.revoked_at;
  end if;

  select * into _order from public.tenant_orders where id = _assignment.order_id;

  select exists (
    select 1 from public.tenant_members tm
    where tm.user_id = _caller
      and tm.tenant_id = _order.tenant_id
      and tm.role in ('owner', 'admin')
  ) into _is_admin_tenant;

  -- Autorisation : admin tenant OU user lui-même
  if not (_is_admin_tenant or _assignment.user_id = _caller or public.is_super_admin()) then
    raise exception 'permission_denied: admin tenant or self-revoke required';
  end if;

  _revoked_at := now();
  update public.tenant_order_roles
    set revoked_at = _revoked_at, revoked_by = _caller
    where id = p_assignment_id;

  insert into public.tenant_order_role_events
    (order_id, role_definition_id, user_id, event_type, actor_user_id, payload)
    values (
      _assignment.order_id, _assignment.role_definition_id, _assignment.user_id, 'revoked', _caller,
      jsonb_build_object('reason', 'manual', 'self_revoke', _assignment.user_id = _caller)
    );

  return _revoked_at;
end;
$$;

grant execute on function public.revoke_tenant_order_role(uuid) to authenticated;

-- ─── 4. RPC update_tenant_order_role_capabilities ─────────────────────────
-- AC3 spec. TRANSACTION (rollback auto si une étape échoue via raise).
-- Audit RÉTROACTIF : event 'capability_updated' INSERT pour CHAQUE
-- commande ayant ce rôle assigné non-révoqué.

create or replace function public.update_tenant_order_role_capabilities(
  p_role_definition_id uuid,
  p_capabilities       jsonb
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  _caller          uuid := auth.uid();
  _role            record;
  _is_admin_tenant boolean;
  _old_capabilities jsonb;
  _allowed_keys    text[] := array[
    'can_quote', 'can_order', 'can_invite',
    'can_validate', 'can_cancel', 'can_modify', 'can_export',
    'can_manage_catalog', 'can_manage_roles'
  ];
  _provided_keys   text[];
  _invalid_key     text;
begin
  if _caller is null then
    raise exception 'Authentication required';
  end if;

  select * into _role from public.tenant_role_definitions where id = p_role_definition_id;
  if _role is null then
    raise exception 'role_not_found: %', p_role_definition_id;
  end if;

  -- Vérif keys autorisées (defensive contre pollution jsonb)
  select array_agg(key) into _provided_keys from jsonb_object_keys(p_capabilities) as key;
  if _provided_keys is not null then
    foreach _invalid_key in array _provided_keys loop
      if not (_invalid_key = any(_allowed_keys)) then
        raise exception 'invalid_capabilities_keys: % not in allowed set', _invalid_key;
      end if;
    end loop;
  end if;

  -- Caller doit être admin du tenant
  select exists (
    select 1 from public.tenant_members tm
    where tm.user_id = _caller
      and tm.tenant_id = _role.tenant_id
      and tm.role in ('owner', 'admin')
  ) into _is_admin_tenant;

  if not (_is_admin_tenant or public.is_super_admin()) then
    raise exception 'permission_denied: admin tenant requires';
  end if;

  _old_capabilities := _role.capabilities;

  update public.tenant_role_definitions
    set capabilities = p_capabilities
    where id = p_role_definition_id;

  -- Audit rétroactif : 1 event par commande qui a ce rôle assigné non-révoqué
  insert into public.tenant_order_role_events
    (order_id, role_definition_id, user_id, event_type, actor_user_id, payload)
  select tor.order_id, tor.role_definition_id, tor.user_id, 'capability_updated', _caller,
         jsonb_build_object('old_capabilities', _old_capabilities, 'new_capabilities', p_capabilities)
  from public.tenant_order_roles tor
  where tor.role_definition_id = p_role_definition_id
    and tor.revoked_at is null;
end;
$$;

grant execute on function public.update_tenant_order_role_capabilities(uuid, jsonb) to authenticated;

-- ─── 5. RPC transition_tenant_order_status ────────────────────────────────
-- AC4 spec. Utilise tenant_order_status_transitions (matrice extensible)
-- + helper user_has_order_role pour valider capability.
-- Coexiste avec ancienne RPC update_tenant_order_status (matrice enum dur)
-- — migration progressive du front en S-ORDER-ROLES-3.

create or replace function public.transition_tenant_order_status(
  p_order_id        uuid,
  p_new_status_code text,
  p_reason          text default null
)
returns text
language plpgsql security definer set search_path = public as $$
declare
  _caller          uuid := auth.uid();
  _order           record;
  _transition      record;
  _new_status_def  record;
  _is_admin_tenant boolean;
  _is_creator      boolean;
  _has_capability  boolean := false;
  _old_status      text;
begin
  if _caller is null then
    raise exception 'Authentication required';
  end if;

  select * into _order from public.tenant_orders where id = p_order_id;
  if _order is null then
    raise exception 'order_not_found: %', p_order_id;
  end if;

  -- Vérifie que le statut cible existe dans la matrice tenant
  select * into _new_status_def from public.tenant_order_status_definitions
    where tenant_id = _order.tenant_id and code = p_new_status_code and archived_at is null;
  if _new_status_def is null then
    raise exception 'status_code_unknown: % not defined for tenant %', p_new_status_code, _order.tenant_id;
  end if;

  _old_status := _order.status::text;

  -- Vérifie que la transition est légale
  select * into _transition from public.tenant_order_status_transitions
    where tenant_id = _order.tenant_id
      and from_status_code = _old_status
      and to_status_code = p_new_status_code
      and archived_at is null;

  if _transition is null then
    raise exception 'transition_not_allowed: % -> % not in matrix for tenant', _old_status, p_new_status_code;
  end if;

  -- Autorisation
  _is_creator := (_order.created_by = _caller);
  select exists (
    select 1 from public.tenant_members tm
    where tm.user_id = _caller
      and tm.tenant_id = _order.tenant_id
      and tm.role in ('owner', 'admin')
  ) into _is_admin_tenant;

  if _transition.self_service_creator and _is_creator then
    -- OK : self-service auteur
    null;
  elsif _is_admin_tenant or public.is_super_admin() then
    -- OK : admin tenant ou super_admin passe outre
    null;
  elsif _transition.required_capability is not null then
    -- Sinon : capability requise sur un rôle assigné non-révoqué
    select public.user_has_order_role(p_order_id, _transition.required_capability) into _has_capability;
    if not _has_capability then
      raise exception 'permission_denied: capability % required for % -> %',
        _transition.required_capability, _old_status, p_new_status_code;
    end if;
  else
    raise exception 'permission_denied: transition requires admin tenant';
  end if;

  -- UPDATE statut + audit
  update public.tenant_orders
    set status = p_new_status_code::public.tenant_order_status,
        updated_at = now(),
        cancelled_at = case when p_new_status_code = 'cancelled' then now() else cancelled_at end
    where id = p_order_id;

  insert into public.tenant_order_status_events
    (order_id, actor_id, from_status, to_status, reason, metadata)
  values (
    p_order_id, _caller,
    _old_status::public.tenant_order_status,
    p_new_status_code::public.tenant_order_status,
    p_reason,
    jsonb_build_object(
      'via_rpc', 'transition_tenant_order_status',
      'is_admin_tenant', _is_admin_tenant,
      'is_creator', _is_creator,
      'capability_used', _transition.required_capability
    )
  );

  return p_new_status_code;
end;
$$;

grant execute on function public.transition_tenant_order_status(uuid, text, text) to authenticated;

-- ─── 6. Reload schema cache ──────────────────────────────────────────────
notify pgrst, 'reload schema';
