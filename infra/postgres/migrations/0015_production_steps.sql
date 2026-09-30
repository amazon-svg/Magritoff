create or replace function magrit.actor_has_capability(
  requested_tenant_id uuid,
  requested_capability text
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, magrit
as $$
  select coalesce(
    exists (
      select 1 from public.user_preferences p
       where p.user_id = magrit.current_user_id() and p.is_admin
    )
    or exists (
      select 1 from public.tenant_members m
       where m.user_id = magrit.current_user_id()
         and m.tenant_id = requested_tenant_id
         and m.role in ('owner', 'admin')
    ),
    false
  ) and requested_capability in (
    'can_manage_pricing',
    'can_manage_notifications',
    'can_manage_production_steps'
  )
$$;

create table public.production_steps (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  label text not null check (btrim(label) <> '' and char_length(label) <= 60),
  position integer not null check (position >= 0),
  color text not null check (color in ('slate', 'blue', 'green', 'amber', 'red', 'violet')),
  is_terminal boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint production_steps_position_unique
    unique (tenant_id, position) deferrable initially immediate
);

create unique index production_steps_tenant_label_uidx
  on public.production_steps (tenant_id, btrim(lower(label)));

create function magrit.production_steps_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end
$$;

create trigger production_steps_set_updated_at
  before update on public.production_steps
  for each row execute function magrit.production_steps_set_updated_at();

alter table public.production_steps enable row level security;
alter table public.production_steps force row level security;

create policy production_steps_select on public.production_steps
  for select using (tenant_id = magrit.current_tenant_id());

create policy production_steps_write on public.production_steps
  for all
  using (
    tenant_id = magrit.current_tenant_id()
    and magrit.actor_has_capability(tenant_id, 'can_manage_production_steps')
  )
  with check (
    tenant_id = magrit.current_tenant_id()
    and magrit.actor_has_capability(tenant_id, 'can_manage_production_steps')
  );

create function magrit.seed_production_steps()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, magrit
as $$
begin
  insert into public.production_steps (tenant_id, label, position, color, is_terminal)
  values
    (new.id, 'Fichier reçu', 0, 'slate', false),
    (new.id, 'PAO', 1, 'blue', false),
    (new.id, 'Fichier validé', 2, 'violet', false),
    (new.id, 'En cours de production', 3, 'amber', false),
    (new.id, 'En cours d''expédition', 4, 'red', false),
    (new.id, 'Livré', 5, 'green', true);
  return new;
end
$$;

create trigger tenants_seed_production_steps
  after insert on public.tenants
  for each row execute function magrit.seed_production_steps();

insert into public.production_steps (tenant_id, label, position, color, is_terminal)
select tenant.id, standard.label, standard.position, standard.color, standard.is_terminal
  from public.tenants tenant
  cross join (values
    ('Fichier reçu', 0, 'slate', false),
    ('PAO', 1, 'blue', false),
    ('Fichier validé', 2, 'violet', false),
    ('En cours de production', 3, 'amber', false),
    ('En cours d''expédition', 4, 'red', false),
    ('Livré', 5, 'green', true)
  ) as standard(label, position, color, is_terminal)
 where not exists (
   select 1 from public.production_steps existing where existing.tenant_id = tenant.id
 );

create function magrit.create_production_step(
  requested_tenant_id uuid,
  requested_label text,
  requested_color text,
  requested_is_terminal boolean
)
returns public.production_steps
language plpgsql
security definer
set search_path = pg_catalog, public, magrit
as $$
declare
  step_count integer;
  created public.production_steps;
begin
  if requested_tenant_id is distinct from magrit.current_tenant_id()
     or not magrit.actor_has_capability(requested_tenant_id, 'can_manage_production_steps') then
    raise exception 'permission_denied: can_manage_production_steps required';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('production_steps:' || requested_tenant_id::text, 0));
  select count(*) into step_count from public.production_steps where tenant_id = requested_tenant_id;
  if step_count >= 50 then
    raise exception 'production_step.limit_reached: tenant has 50 steps';
  end if;
  insert into public.production_steps (tenant_id, label, position, color, is_terminal)
  values (requested_tenant_id, requested_label, step_count, requested_color, requested_is_terminal)
  returning * into created;
  return created;
end
$$;

create function magrit.delete_production_step(requested_tenant_id uuid, requested_step_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, magrit
as $$
declare
  deleted_position integer;
begin
  if requested_tenant_id is distinct from magrit.current_tenant_id()
     or not magrit.actor_has_capability(requested_tenant_id, 'can_manage_production_steps') then
    raise exception 'permission_denied: can_manage_production_steps required';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('production_steps:' || requested_tenant_id::text, 0));
  begin
    delete from public.production_steps
     where tenant_id = requested_tenant_id and id = requested_step_id
     returning position into deleted_position;
  exception when foreign_key_violation then
    raise exception 'production_step.in_use: step is referenced';
  end;
  if deleted_position is null then
    raise exception 'production_step.not_found: step not found';
  end if;
  update public.production_steps
     set position = position - 1
   where tenant_id = requested_tenant_id and position > deleted_position;
end
$$;

create function magrit.reorder_production_steps(requested_tenant_id uuid, requested_step_ids uuid[])
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, magrit
as $$
declare
  requested_count integer := coalesce(array_length(requested_step_ids, 1), 0);
  existing_count integer;
begin
  if requested_tenant_id is distinct from magrit.current_tenant_id()
     or not magrit.actor_has_capability(requested_tenant_id, 'can_manage_production_steps') then
    raise exception 'permission_denied: can_manage_production_steps required';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('production_steps:' || requested_tenant_id::text, 0));
  set constraints production_steps_position_unique deferred;
  select count(*) into existing_count from public.production_steps where tenant_id = requested_tenant_id;
  if requested_count <> existing_count
     or requested_count <> (select count(distinct id) from unnest(requested_step_ids) as id)
     or requested_count <> (
       select count(*) from unnest(requested_step_ids) as requested(id)
        where exists (
          select 1 from public.production_steps step
           where step.id = requested.id and step.tenant_id = requested_tenant_id
        )
     ) then
    raise exception 'production_step.positions_mismatch: incomplete step set';
  end if;
  with wanted as (
    select id, ordinality - 1 as new_position
      from unnest(requested_step_ids) with ordinality as item(id, ordinality)
  )
  update public.production_steps step
     set position = wanted.new_position
    from wanted
   where step.id = wanted.id and step.tenant_id = requested_tenant_id;
end
$$;

revoke all on table public.production_steps from public;
revoke all on function magrit.create_production_step(uuid, text, text, boolean) from public;
revoke all on function magrit.delete_production_step(uuid, uuid) from public;
revoke all on function magrit.reorder_production_steps(uuid, uuid[]) from public;
grant select, insert, update, delete on table public.production_steps to magrit_api;
grant execute on function magrit.create_production_step(uuid, text, text, boolean) to magrit_api;
grant execute on function magrit.delete_production_step(uuid, uuid) to magrit_api;
grant execute on function magrit.reorder_production_steps(uuid, uuid[]) to magrit_api;

comment on table public.production_steps is
  'Referentiel ordonne des etapes de production, portable et isole par tenant.';
