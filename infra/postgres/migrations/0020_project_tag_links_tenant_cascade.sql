alter table public.project_tag_links
  add constraint project_tag_links_tenant_delete_cascade
  foreign key (tenant_id) references public.tenants(id) on delete cascade;

comment on constraint project_tag_links_tenant_delete_cascade on public.project_tag_links is
  'Supprime les liens avant les tags lors du retrait complet d un tenant, sans affaiblir le RESTRICT sur la suppression directe d un tag utilise.';
