alter table public.project_item_files
  add constraint project_item_files_tenant_delete_cascade
  foreign key (tenant_id) references public.tenants(id) on delete cascade;

comment on constraint project_item_files_tenant_delete_cascade on public.project_item_files is
  'Supprime les associations avant les metadonnees de fichiers lors du retrait complet d un tenant.';
