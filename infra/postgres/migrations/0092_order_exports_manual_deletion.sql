-- Un utilisateur peut retirer ses propres exports termines. Les demandes en
-- cours restent protegees afin que le worker ne produise jamais un objet sans
-- ligne de suivi.

create or replace function magrit.commercial_order_exports_guard()
returns trigger language plpgsql as $$
begin
  if tg_op='DELETE' then
    if not exists(select 1 from public.tenants where id=old.tenant_id) then return old; end if;
    if old.status in('ready','failed','expired')
      and old.tenant_id=magrit.current_tenant_id()
      and old.requested_by=magrit.current_user_id() then
      return old;
    end if;
    raise exception using errcode='42501',message='commercial_order_exports_immutable';
  end if;
  if new.id is distinct from old.id or new.tenant_id is distinct from old.tenant_id
    or new.format is distinct from old.format or new.granularity is distinct from old.granularity
    or new.filters is distinct from old.filters or new.layout_version is distinct from old.layout_version
    or(new.requested_by is distinct from old.requested_by
      and not(old.requested_by is not null and new.requested_by is null))
    or new.requested_by_label is distinct from old.requested_by_label
    or new.requested_at is distinct from old.requested_at then
    raise exception using errcode='42501',message='commercial_order_exports_immutable';
  end if;
  if old.status='expired' and new.status is distinct from 'expired'
    or old.status='failed' and new.status is distinct from 'failed'
    or old.status='ready' and new.status not in('ready','expired') then
    raise exception using errcode='42501',message='commercial_order_exports_status_terminal';
  end if;
  return new;
end $$;

create policy commercial_order_exports_delete on public.commercial_order_exports
  for delete to magrit_api
  using(
    tenant_id=magrit.current_tenant_id()
    and requested_by=magrit.current_user_id()
    and status in('ready','failed','expired')
    and magrit.actor_has_capability(tenant_id,'can_export_orders')
  );

grant delete on public.commercial_order_exports to magrit_api;
