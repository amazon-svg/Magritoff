-- =============================================================================
-- Migration S-ORDER-ROLES-1 patch (Sprint 6, 2026-06-01)
--
-- Ajoute un trigger AFTER INSERT ON tenants qui seed automatiquement :
--   - Les 5 role_definitions preset (Owner/Admin/Acheteur/Validateur/Producteur)
--     [completion Phase A qui ne seedait que les tenants existants à l apply]
--   - Les 7 status_definitions canoniques (draft/validated/in_production/
--     shipped/delivered/invoiced/cancelled)
--
-- Sans ce trigger, tout nouveau tenant créé via createTenant() applicatif
-- ou autre voie démarre avec un catalog rôles + statuts VIDE → UI cassée.
--
-- Trigger idempotent via ON CONFLICT DO NOTHING (rejouable safe sur tenants
-- existants pour back-compat, n écrit que les rows manquants).
-- =============================================================================

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
      new.id, 'Admin', 'Administrateur tenant — toutes capabilities sauf gestion des rôles',
      '{"can_quote": true, "can_order": true, "can_invite": true, "can_validate": true, "can_cancel": true, "can_modify": true, "can_export": true, "can_manage_catalog": true, "can_manage_roles": false}'::jsonb,
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

-- Drop ancien trigger éventuel (idempotence) puis create
drop trigger if exists tenants_seed_catalogs on public.tenants;
create trigger tenants_seed_catalogs
  after insert on public.tenants
  for each row execute function public.seed_tenant_catalogs();

notify pgrst, 'reload schema';
