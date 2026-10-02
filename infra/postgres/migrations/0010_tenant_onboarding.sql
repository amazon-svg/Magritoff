alter table public.tenants
  add column siren text,
  add column siren_data jsonb,
  add column verified boolean not null default false,
  add column verified_at timestamptz,
  add column tax_regime text not null default 'metropole_fr',
  add constraint tenants_siren_data_object check (
    siren_data is null or jsonb_typeof(siren_data) = 'object'
  ),
  add constraint tenants_tax_regime_check check (
    tax_regime in ('metropole_fr', 'dom_tom', 'franchise_tva', 'export_eu', 'export_world')
  );

create unique index tenants_siren_unique_idx
  on public.tenants (siren)
  where siren is not null;

create table public.tenant_gamme_subscriptions (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  gamme_slug text not null,
  display_order integer not null default 0,
  active boolean not null default true,
  added_by uuid references public.app_users(id) on delete set null,
  added_at timestamptz not null default now(),
  primary key (tenant_id, gamme_slug),
  constraint tenant_gamme_slug_length check (char_length(gamme_slug) between 1 and 160)
);

create index tenant_gamme_subscriptions_tenant_idx
  on public.tenant_gamme_subscriptions (tenant_id);

create function magrit.create_root_tenant(
  requested_slug text,
  requested_name text,
  requested_siren text,
  requested_siren_data jsonb,
  requested_gamme_slugs text[]
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, magrit
as $$
declare
  actor_id uuid := magrit.current_user_id();
  created_tenant_id uuid;
begin
  if actor_id is null then
    return null;
  end if;

  insert into public.tenants (
    slug, name, plan, siren, siren_data, verified, verified_at
  ) values (
    requested_slug,
    requested_name,
    'freemium',
    requested_siren,
    requested_siren_data,
    requested_siren is not null,
    case when requested_siren is not null then now() else null end
  )
  returning id into created_tenant_id;

  insert into public.tenant_members (tenant_id, user_id, role)
  values (created_tenant_id, actor_id, 'admin');

  insert into public.user_preferences (user_id, last_tenant_id)
  values (actor_id, created_tenant_id)
  on conflict (user_id) do update
    set last_tenant_id = excluded.last_tenant_id,
        updated_at = now();

  insert into public.tenant_gamme_subscriptions (
    tenant_id, gamme_slug, added_by
  )
  select created_tenant_id, selected.slug, actor_id
    from (
      select distinct btrim(slug) as slug
        from unnest(coalesce(requested_gamme_slugs, array[]::text[])) as slug
    ) selected
   where selected.slug <> '';

  return created_tenant_id;
end
$$;

revoke all on table public.tenant_gamme_subscriptions
  from public, magrit_api, magrit_worker, magrit_readonly;
revoke all on function magrit.create_root_tenant(text, text, text, jsonb, text[])
  from public;
grant execute on function magrit.create_root_tenant(text, text, text, jsonb, text[])
  to magrit_api;

comment on function magrit.create_root_tenant(text, text, text, jsonb, text[]) is
  'Onboarding atomique : tenant racine, administrateur, preferences et gammes.';
