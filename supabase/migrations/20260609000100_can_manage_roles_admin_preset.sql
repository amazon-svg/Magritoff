-- =============================================================================
-- Migration S-ORDER-ROLES-3-UI T2-ter (Sprint 6+, 2026-06-09)
--
-- Donne `can_manage_roles=true` au preset Admin (par défaut faux dans Sprint 6
-- seed trigger). Décision Arnaud 2026-06-09 (option A) : 99% des PME B2B
-- n'ont pas la nuance Owner/Admin. L'admin tenant configure le workflow.
--
-- 3 actions :
--   1. UPDATE rétroactif des tenants existants — bascule capabilities
--      ->'can_manage_roles' à true pour tous les presets name='Admin' non
--      archivés. Idempotent : ne touche pas les rows qui sont déjà à true.
--   2. CREATE OR REPLACE seed_tenant_catalogs() — futurs tenants auront
--      Admin avec can_manage_roles=true dès la création.
--   3. Back-fill du tenant smoke-tenant-sono0aaf (et tout autre tenant
--      sans presets) en appelant le bloc seed inline (avec ON CONFLICT
--      DO NOTHING, idempotent).
--
-- Audit prod 2026-06-09 :
--   - 16 tenants total
--   - 15 ont le preset Admin (cible UPDATE)
--   - 1 tenant orphelin sans presets : smoke-tenant-sono0aaf (back-fill)
--   - 1 user (Arnaud Owner) avec can_manage_roles avant migration
--   - Cible post-migration : tous les users avec rôle Admin actif gagnent
--     can_manage_roles. Smoke test SQL après migration pour confirmer.
-- =============================================================================

-- ─── 1. UPDATE rétroactif preset Admin sur tenants existants ─────────────
update public.tenant_role_definitions
   set capabilities = jsonb_set(capabilities, '{can_manage_roles}', 'true'::jsonb, true)
 where name = 'Admin'
   and archived_at is null
   and coalesce((capabilities->>'can_manage_roles')::boolean, false) is distinct from true;

-- ─── 2. Refonte seed_tenant_catalogs() pour futurs tenants ───────────────
-- Reprise verbatim du seed Sprint 6 (20260601000200) avec UNE seule différence :
-- le preset Admin passe can_manage_roles à true. Les 4 autres presets et les
-- 7 status_definitions restent identiques.
create or replace function public.seed_tenant_catalogs()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- ─── 5 role_definitions presets ────────────────────────────────────────
  insert into public.tenant_role_definitions
    (tenant_id, name, description, capabilities, notify_policy, scope, ordering_index)
  values
    (
      new.id, 'Owner', 'Propriétaire du tenant — toutes les capabilities',
      '{"can_quote": true, "can_order": true, "can_invite": true, "can_validate": true, "can_cancel": true, "can_modify": true, "can_export": true, "can_manage_catalog": true, "can_manage_roles": true}'::jsonb,
      'chain_next', 'tenant', 10
    ),
    (
      new.id, 'Admin', 'Administrateur tenant — toutes capabilities, gestion des rôles incluse',
      '{"can_quote": true, "can_order": true, "can_invite": true, "can_validate": true, "can_cancel": true, "can_modify": true, "can_export": true, "can_manage_catalog": true, "can_manage_roles": true}'::jsonb,
      'chain_next', 'tenant', 20
    ),
    (
      new.id, 'Acheteur', 'Passe des devis et commandes sur les boutiques autorisées',
      '{"can_quote": true, "can_order": true, "can_invite": false, "can_validate": false, "can_cancel": false, "can_modify": false, "can_export": false, "can_manage_catalog": false, "can_manage_roles": false}'::jsonb,
      'chain_next', 'tenant', 30
    ),
    (
      new.id, 'Validateur', 'Valide les commandes draft → validated + actions intermédiaires',
      '{"can_quote": false, "can_order": false, "can_invite": false, "can_validate": true, "can_cancel": true, "can_modify": true, "can_export": true, "can_manage_catalog": false, "can_manage_roles": false}'::jsonb,
      'chain_next', 'tenant', 40
    ),
    (
      new.id, 'Producteur', 'Met à jour le statut de production + exporte les commandes',
      '{"can_quote": false, "can_order": false, "can_invite": false, "can_validate": false, "can_cancel": false, "can_modify": true, "can_export": true, "can_manage_catalog": false, "can_manage_roles": false}'::jsonb,
      'chain_next', 'tenant', 50
    )
  on conflict (tenant_id, name) do nothing;

  -- ─── 7 status_definitions canoniques ──────────────────────────────────
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

  return new;
end;
$$;

-- Le trigger existe déjà (créé Sprint 6), CREATE OR REPLACE FUNCTION suffit.
-- Reload schema cache PostgREST signalé en fin de migration.

-- ─── 3. Back-fill tenants sans presets (orphelins pré-trigger) ────────────
-- Tout tenant qui n'a aucun des 5 presets Owner/Admin/Acheteur/Validateur/
-- Producteur reçoit le seed complet. ON CONFLICT (tenant_id, name) DO NOTHING
-- garantit l'idempotence.
do $$
declare
  orphan_tenant record;
begin
  for orphan_tenant in
    select t.id from public.tenants t
     where not exists (
       select 1 from public.tenant_role_definitions rd
        where rd.tenant_id = t.id
          and rd.name in ('Owner', 'Admin', 'Acheteur', 'Validateur', 'Producteur')
     )
  loop
    insert into public.tenant_role_definitions
      (tenant_id, name, description, capabilities, notify_policy, scope, ordering_index)
    values
      (orphan_tenant.id, 'Owner', 'Propriétaire du tenant — toutes les capabilities',
       '{"can_quote": true, "can_order": true, "can_invite": true, "can_validate": true, "can_cancel": true, "can_modify": true, "can_export": true, "can_manage_catalog": true, "can_manage_roles": true}'::jsonb,
       'chain_next', 'tenant', 10),
      (orphan_tenant.id, 'Admin', 'Administrateur tenant — toutes capabilities, gestion des rôles incluse',
       '{"can_quote": true, "can_order": true, "can_invite": true, "can_validate": true, "can_cancel": true, "can_modify": true, "can_export": true, "can_manage_catalog": true, "can_manage_roles": true}'::jsonb,
       'chain_next', 'tenant', 20),
      (orphan_tenant.id, 'Acheteur', 'Passe des devis et commandes sur les boutiques autorisées',
       '{"can_quote": true, "can_order": true, "can_invite": false, "can_validate": false, "can_cancel": false, "can_modify": false, "can_export": false, "can_manage_catalog": false, "can_manage_roles": false}'::jsonb,
       'chain_next', 'tenant', 30),
      (orphan_tenant.id, 'Validateur', 'Valide les commandes draft → validated + actions intermédiaires',
       '{"can_quote": false, "can_order": false, "can_invite": false, "can_validate": true, "can_cancel": true, "can_modify": true, "can_export": true, "can_manage_catalog": false, "can_manage_roles": false}'::jsonb,
       'chain_next', 'tenant', 40),
      (orphan_tenant.id, 'Producteur', 'Met à jour le statut de production + exporte les commandes',
       '{"can_quote": false, "can_order": false, "can_invite": false, "can_validate": false, "can_cancel": false, "can_modify": true, "can_export": true, "can_manage_catalog": false, "can_manage_roles": false}'::jsonb,
       'chain_next', 'tenant', 50)
    on conflict (tenant_id, name) do nothing;

    insert into public.tenant_order_status_definitions
      (tenant_id, code, label, color, ordering_index, is_terminal)
    values
      (orphan_tenant.id, 'draft',         'Brouillon',     '#9ca3af', 10, false),
      (orphan_tenant.id, 'validated',     'Validée',       '#10b981', 20, false),
      (orphan_tenant.id, 'in_production', 'En production', '#3b82f6', 30, false),
      (orphan_tenant.id, 'shipped',       'Expédiée',      '#8b5cf6', 40, false),
      (orphan_tenant.id, 'delivered',     'Livrée',        '#059669', 50, true),
      (orphan_tenant.id, 'invoiced',      'Facturée',      '#0891b2', 60, true),
      (orphan_tenant.id, 'cancelled',     'Annulée',       '#ef4444', 70, true)
    on conflict (tenant_id, code) do nothing;
  end loop;
end $$;

-- ─── 4. Reload schema cache PostgREST ────────────────────────────────────
notify pgrst, 'reload schema';
