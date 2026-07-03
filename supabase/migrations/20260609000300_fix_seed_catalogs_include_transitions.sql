-- =============================================================================
-- Migration S-ORDER-ROLES-3-UI T2-ter fix (2026-06-09)
--
-- Régression introduite par 20260609000100 : le CREATE OR REPLACE de
-- seed_tenant_catalogs() a perdu l'appel à seed_tenant_status_transitions()
-- ajouté Sprint 6 (migration 20260601000300 ligne 146). Conséquence : un
-- nouveau tenant créé entre 20260609000100 et ce fix N'AURAIT PAS reçu
-- la matrice de transitions canoniques v1.1 (8 transitions), ce qui
-- aurait cassé le RPC transition_tenant_order_status pour ce tenant.
--
-- Audit prod 2026-06-09 entre les 2 migrations : 0 tenant créé donc
-- 0 dommage en prod (16/16 tenants ont leurs transitions). Patch
-- préventif pour futurs créations.
--
-- Pattern correct : ce fichier est la source de vérité de
-- seed_tenant_catalogs() — toute évolution future doit partir d'ici
-- et inclure les 3 blocs (role_definitions + status_definitions +
-- seed_tenant_status_transitions).
-- =============================================================================

create or replace function public.seed_tenant_catalogs()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- ─── 5 role_definitions presets ────────────────────────────────────────
  -- Admin a can_manage_roles=true depuis migration 20260609000100 (option A
  -- Arnaud : 99% PME B2B sans nuance Owner/Admin sur configuration workflow).
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

  -- ─── 8 transitions canoniques v1.1 (CORRECTIF — perdu par migration
  --     20260609000100, restauré ici) ───────────────────────────────────
  perform public.seed_tenant_status_transitions(new.id);

  return new;
end;
$$;

notify pgrst, 'reload schema';
