-- UM1 — les nouveaux espaces reçoivent directement les deux options produit,
-- sans recréer le catalogue historique Owner/Admin/Acheteur/Validateur/Producteur.

insert into public.tenant_role_definitions
  (tenant_id, name, description, capabilities, ordering_index, notify_policy, scope, system_key, identity_context)
select tenant.id, 'Boutiques', 'Créer des boutiques et administrer les siennes',
       '{"can_manage_shops": true}'::jsonb, 10, 'none', 'tenant', 'option_shops', 'magrit'
  from public.tenants tenant
 where not exists (
   select 1 from public.tenant_role_definitions definition
    where definition.tenant_id = tenant.id and definition.system_key = 'option_shops'
 );

insert into public.tenant_role_definitions
  (tenant_id, name, description, capabilities, ordering_index, notify_policy, scope, system_key, identity_context)
select tenant.id, 'Commandes',
       'Administrer les commandes : valider, modifier, gérer les statuts, exporter, annuler',
       '{"can_validate": true, "can_modify": true, "can_cancel": true, "can_export": true}'::jsonb,
       20, 'none', 'tenant', 'option_orders', 'magrit'
  from public.tenants tenant
 where not exists (
   select 1 from public.tenant_role_definitions definition
    where definition.tenant_id = tenant.id and definition.system_key = 'option_orders'
 );

update public.tenant_role_assignments assignment
   set revoked_at = now(), revoked_by = null
  from public.tenant_role_definitions definition,
       public.tenant_members member
 where assignment.role_definition_id = definition.id
   and assignment.user_id = member.user_id
   and member.tenant_id = definition.tenant_id
   and member.access_scope = 'magrit_full'
   and definition.identity_context = 'magrit'
   and definition.system_key is null
   and assignment.revoked_at is null;

update public.tenant_role_definitions
   set archived_at = coalesce(archived_at, now())
 where identity_context = 'magrit'
   and system_key is null;

create or replace function public.seed_tenant_catalogs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.tenant_role_definitions
    (tenant_id, name, description, capabilities, notify_policy, scope,
     ordering_index, system_key, identity_context)
  values
    (new.id, 'Boutiques', 'Créer des boutiques et administrer les siennes',
     '{"can_manage_shops": true}'::jsonb, 'none', 'tenant', 10, 'option_shops', 'magrit'),
    (new.id, 'Commandes',
     'Administrer les commandes : valider, modifier, gérer les statuts, exporter, annuler',
     '{"can_validate": true, "can_modify": true, "can_cancel": true, "can_export": true}'::jsonb,
     'none', 'tenant', 20, 'option_orders', 'magrit')
  on conflict (tenant_id, system_key) where system_key is not null do nothing;

  insert into public.tenant_order_status_definitions
    (tenant_id, code, label, color, ordering_index, is_terminal)
  values
    (new.id, 'draft', 'Brouillon', '#9ca3af', 10, false),
    (new.id, 'validated', 'Validée', '#10b981', 20, false),
    (new.id, 'in_production', 'En production', '#3b82f6', 30, false),
    (new.id, 'shipped', 'Expédiée', '#8b5cf6', 40, false),
    (new.id, 'delivered', 'Livrée', '#059669', 50, true),
    (new.id, 'invoiced', 'Facturée', '#0891b2', 60, true),
    (new.id, 'cancelled', 'Annulée', '#ef4444', 70, true)
  on conflict (tenant_id, code) do nothing;

  perform public.seed_tenant_status_transitions(new.id);
  return new;
end;
$$;

notify pgrst, 'reload schema';
