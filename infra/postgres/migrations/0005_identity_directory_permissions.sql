-- La migration 0003 accordait temporairement le CRUD par defaut aux futures
-- tables de l'API. L'annuaire d'identite est une frontiere de securite : le
-- runtime HTTP ne doit pouvoir que le consulter pendant l'authentification.
revoke insert, update, delete, truncate, references, trigger
  on table public.app_users, public.user_identities, public.tenants, public.tenant_members
  from magrit_api;

grant select
  on table public.app_users, public.user_identities, public.tenants, public.tenant_members
  to magrit_api;
