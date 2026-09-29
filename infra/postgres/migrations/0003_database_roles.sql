do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'magrit_migrator') then
    create role magrit_migrator nologin nosuperuser nocreatedb nocreaterole noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'magrit_api') then
    create role magrit_api nologin nosuperuser nocreatedb nocreaterole noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'magrit_worker') then
    create role magrit_worker nologin nosuperuser nocreatedb nocreaterole noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'magrit_readonly') then
    create role magrit_readonly nologin nosuperuser nocreatedb nocreaterole noinherit;
  end if;
end
$$;

grant usage on schema public, magrit to magrit_api, magrit_worker, magrit_readonly;
grant execute on function magrit.current_user_id() to magrit_api, magrit_worker;
grant execute on function magrit.current_tenant_id() to magrit_api, magrit_worker;

grant select, insert, update, delete on table public.conversations to magrit_api;
grant select, insert, update, delete on table public.conversations to magrit_worker;
grant select on table public.conversations to magrit_readonly;

alter default privileges in schema public
  grant select, insert, update, delete on tables to magrit_api;
alter default privileges in schema public
  grant select, insert, update, delete on tables to magrit_worker;
alter default privileges in schema public
  grant select on tables to magrit_readonly;
alter default privileges in schema public
  grant usage, select on sequences to magrit_api, magrit_worker;

comment on role magrit_api is 'Droits runtime de l API Magrit, soumis a la RLS.';
comment on role magrit_worker is 'Droits des traitements asynchrones Magrit.';
comment on role magrit_readonly is 'Diagnostic en lecture seule, soumis a la RLS.';
comment on role magrit_migrator is 'Role cible du compte appliquant les migrations.';
