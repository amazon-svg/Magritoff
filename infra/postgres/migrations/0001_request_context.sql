create schema if not exists magrit;

comment on schema magrit is
  'Primitives PostgreSQL portables appartenant a l application Magrit.';

create or replace function magrit.current_user_id()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('magrit.user_id', true), '')::uuid
$$;

create or replace function magrit.current_tenant_id()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('magrit.tenant_id', true), '')::uuid
$$;

comment on function magrit.current_user_id() is
  'Identifiant utilisateur pose localement par l API pour la transaction courante.';

comment on function magrit.current_tenant_id() is
  'Identifiant tenant pose localement par l API pour la transaction courante.';

revoke all on schema magrit from public;
revoke all on function magrit.current_user_id() from public;
revoke all on function magrit.current_tenant_id() from public;
