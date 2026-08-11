-- Explicit API grants for projects using the post-2026 default privileges.
-- RLS remains the authorization boundary on every public table.

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete
  on all tables in schema public
  to anon, authenticated;

grant usage, select
  on all sequences in schema public
  to anon, authenticated;

alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to anon, authenticated;

alter default privileges for role postgres in schema public
  grant usage, select on sequences to anon, authenticated;

notify pgrst, 'reload schema';
