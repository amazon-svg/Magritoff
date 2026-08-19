-- Restore the standard server-side data privileges expected by Supabase
-- clients created with SUPABASE_SERVICE_ROLE_KEY.
--
-- service_role remains a server-only credential and bypasses RLS. These grants
-- do not expose it to the browser and do not grant access to the private schema.

grant usage on schema public to service_role;

grant select, insert, update, delete
  on all tables in schema public
  to service_role;

grant usage, select
  on all sequences in schema public
  to service_role;

alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to service_role;

alter default privileges for role postgres in schema public
  grant usage, select on sequences to service_role;

notify pgrst, 'reload schema';
