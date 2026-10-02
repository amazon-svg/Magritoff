create table public.tenant_slug_history (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  old_slug text not null,
  new_slug text not null,
  changed_by uuid references public.app_users(id) on delete set null,
  changed_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '90 days')
);

create index tenant_slug_history_old_slug_idx
  on public.tenant_slug_history (old_slug, changed_at desc);
create index tenant_slug_history_tenant_idx
  on public.tenant_slug_history (tenant_id);

create function magrit.archive_tenant_slug_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, magrit
as $$
begin
  if new.slug is distinct from old.slug then
    insert into public.tenant_slug_history (
      tenant_id, old_slug, new_slug, changed_by
    ) values (
      old.id, old.slug, new.slug, magrit.current_user_id()
    );
  end if;
  return new;
end
$$;

create trigger tenant_archive_slug_change
  after update of slug on public.tenants
  for each row execute function magrit.archive_tenant_slug_change();

create function magrit.update_tenant_settings(
  requested_tenant_id uuid,
  requested_name text,
  requested_slug text,
  requested_plan text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, magrit
as $$
declare
  actor_id uuid := magrit.current_user_id();
  actor_is_super_admin boolean;
  actor_can_manage boolean;
begin
  if actor_id is null then
    return false;
  end if;

  select coalesce(p.is_admin, false)
    into actor_is_super_admin
    from public.user_preferences p
   where p.user_id = actor_id;
  actor_is_super_admin := coalesce(actor_is_super_admin, false);

  select actor_is_super_admin or exists (
    select 1
      from public.tenant_members m
     where m.tenant_id = requested_tenant_id
       and m.user_id = actor_id
       and m.role in ('owner', 'admin')
  ) into actor_can_manage;

  if not actor_can_manage or (requested_slug is not null and not actor_is_super_admin) then
    return false;
  end if;

  update public.tenants
     set name = coalesce(requested_name, name),
         slug = coalesce(requested_slug, slug),
         plan = coalesce(requested_plan, plan),
         updated_at = now()
   where id = requested_tenant_id;

  return found;
end
$$;

revoke all on table public.tenant_slug_history from public, magrit_api, magrit_worker;
grant select on table public.tenant_slug_history to magrit_api;

revoke all on function magrit.archive_tenant_slug_change() from public;
revoke all on function magrit.update_tenant_settings(uuid, text, text, text) from public;
grant execute on function magrit.update_tenant_settings(uuid, text, text, text) to magrit_api;

comment on function magrit.update_tenant_settings(uuid, text, text, text) is
  'Mutation tenant bornee : admin pour nom/plan, super-admin pour le slug.';
