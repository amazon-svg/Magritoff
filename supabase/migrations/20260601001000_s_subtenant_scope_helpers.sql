-- =============================================================================
-- Migration S-SUBTENANT-SCOPE (Sprint 8, 2026-06-01)
--
-- Usage A formalisé (filiale imprimeur multi-sites). L'infra existe déjà
-- (parent_tenant_id + trigger 2 niveaux + createSubTenant RPC + héritage
-- TenantContext). Cette migration ajoute :
--   - 3 helpers SQL (member_direct / member_inherited / get_user_subtenants)
--   - RPC move_user_between_subtenants (déplacement atomique entre filiales
--     du même parent par admin parent)
--   - View v_subtenant_kpis (KPIs consolidés HQ : nb commandes + CA HT mois)
--
-- Pas de migration DB schéma (parent_tenant_id existant suffit, post-arbitrage
-- Arnaud Q2 : pas d'enum sub_tenant_type, post-élagage Usage B).
-- =============================================================================

-- ─── 1. Helper is_subtenant_member_direct(tenant_id) ─────────────────────
-- True si user authn est membre direct de ce tenant (root ou subtenant).
create or replace function public.is_subtenant_member_direct(p_tenant_id uuid)
returns boolean
language sql stable security invoker set search_path = public as $$
  select exists (
    select 1 from public.tenant_members
    where tenant_id = p_tenant_id
      and user_id = auth.uid()
  );
$$;
grant execute on function public.is_subtenant_member_direct(uuid) to authenticated;

-- ─── 2. Helper is_subtenant_member_inherited(tenant_id) ──────────────────
-- True si tenant_id est un subtenant et user authn est owner/admin/member
-- du parent (héritage descendant, cf. Q1 Arnaud "héritage total automatique").
-- 'partner' n'hérite pas (cohérent avec règle actuelle TenantContext).
create or replace function public.is_subtenant_member_inherited(p_tenant_id uuid)
returns boolean
language sql stable security invoker set search_path = public as $$
  select exists (
    select 1
    from public.tenants t
    inner join public.tenant_members tm on tm.tenant_id = t.parent_tenant_id
    where t.id = p_tenant_id
      and t.parent_tenant_id is not null
      and tm.user_id = auth.uid()
      and tm.role in ('owner', 'admin', 'member')
  );
$$;
grant execute on function public.is_subtenant_member_inherited(uuid) to authenticated;

-- ─── 3. Helper get_user_subtenants(parent_tenant_id) ─────────────────────
-- Liste des sous-tenants accessibles à l'user authn, sous un parent donné.
-- Inclut sub-tenants membre direct + sub-tenants hérités via parent.
create or replace function public.get_user_subtenants(p_parent_tenant_id uuid)
returns setof public.tenants
language sql stable security invoker set search_path = public as $$
  select t.*
  from public.tenants t
  where t.parent_tenant_id = p_parent_tenant_id
    and (
      public.is_subtenant_member_direct(t.id)
      or public.is_subtenant_member_inherited(t.id)
    )
  order by t.name;
$$;
grant execute on function public.get_user_subtenants(uuid) to authenticated;

-- ─── 4. RPC move_user_between_subtenants ─────────────────────────────────
-- AC2 : déplacement atomique d'un user entre 2 filiales du même parent
-- par un admin du parent. Vérif que les 2 cibles ont le même parent.
create or replace function public.move_user_between_subtenants(
  p_user_id uuid,
  p_from_tenant_id uuid,
  p_to_tenant_id uuid
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  _caller         uuid := auth.uid();
  _parent_from    uuid;
  _parent_to      uuid;
begin
  if _caller is null then
    raise exception 'Authentication required';
  end if;

  -- Charge les 2 parents
  select parent_tenant_id into _parent_from from public.tenants where id = p_from_tenant_id;
  select parent_tenant_id into _parent_to from public.tenants where id = p_to_tenant_id;

  if _parent_from is null or _parent_to is null then
    raise exception 'subtenant_required: both tenants must be subtenants (parent_tenant_id NOT NULL)';
  end if;

  if _parent_from <> _parent_to then
    raise exception 'parent_mismatch: from parent % vs to parent %', _parent_from, _parent_to;
  end if;

  -- Vérif caller admin du parent commun (ou super_admin)
  if not (
    public.is_super_admin()
    or exists (
      select 1 from public.tenant_members tm
      where tm.tenant_id = _parent_from
        and tm.user_id = _caller
        and tm.role in ('owner', 'admin')
    )
  ) then
    raise exception 'permission_denied: only parent admin can move users between subtenants';
  end if;

  -- Atomique : delete then insert
  delete from public.tenant_members
    where tenant_id = p_from_tenant_id and user_id = p_user_id;
  insert into public.tenant_members (tenant_id, user_id, role)
    values (p_to_tenant_id, p_user_id, 'member')
    on conflict (tenant_id, user_id) do nothing;
end;
$$;
grant execute on function public.move_user_between_subtenants(uuid, uuid, uuid) to authenticated;

-- ─── 5. RPC get_subtenant_kpis(parent_tenant_id) ─────────────────────────
-- AC3 : KPIs consolidés HQ par sous-tenant (nb commandes + CA HT du mois
-- courant). 1 query agrégée pour éviter N+1 côté front.
create or replace function public.get_subtenant_kpis(p_parent_tenant_id uuid)
returns table (
  tenant_id          uuid,
  tenant_name        text,
  tenant_slug        text,
  created_at         timestamptz,
  member_count       bigint,
  month_order_count  bigint,
  month_ca_ht        numeric
)
language sql stable security invoker set search_path = public as $$
  select
    t.id as tenant_id,
    t.name::text as tenant_name,
    t.slug::text as tenant_slug,
    t.created_at,
    (select count(*) from public.tenant_members tm where tm.tenant_id = t.id) as member_count,
    (select count(*) from public.tenant_orders o
       where o.tenant_id = t.id and o.created_at >= date_trunc('month', now())) as month_order_count,
    (select coalesce(sum(o.total_ht), 0) from public.tenant_orders o
       where o.tenant_id = t.id and o.created_at >= date_trunc('month', now())) as month_ca_ht
  from public.get_user_subtenants(p_parent_tenant_id) t
  order by t.name;
$$;
grant execute on function public.get_subtenant_kpis(uuid) to authenticated;

notify pgrst, 'reload schema';
