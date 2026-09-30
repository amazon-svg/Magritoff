alter table public.tenant_role_assignments
  drop constraint tenant_role_assignments_role_definition_id_fkey,
  add constraint tenant_role_assignments_role_definition_id_fkey
    foreign key (role_definition_id)
    references public.tenant_role_definitions(id)
    on delete cascade;

comment on constraint tenant_role_assignments_role_definition_id_fkey
  on public.tenant_role_assignments is
  'Les affectations restent lors d un archivage logique ; elles suivent la suppression physique du tenant.';
