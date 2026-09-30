drop policy notification_templates_select on public.notification_templates;
create policy notification_templates_select on public.notification_templates for select to magrit_api
  using(tenant_id=magrit.current_tenant_id());

drop policy notification_logs_api_select on public.notification_logs;
create policy notification_logs_api_select on public.notification_logs for select to magrit_api
  using(tenant_id=magrit.current_tenant_id());

comment on policy notification_templates_select on public.notification_templates is
  'Isolation par tenant issu du principal vérifié par le middleware Node ; les ports de lecture ne dépendent plus d une session fournisseur.';
