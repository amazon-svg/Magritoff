create function magrit.provision_local_auth_identity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, authn, magrit
as $$
declare
  app_user_id uuid;
begin
  select id into app_user_id
    from public.app_users
   where email_normalized=lower(btrim(new.email))
   for update;

  if app_user_id is null then
    begin
      app_user_id := new.id::uuid;
    exception when invalid_text_representation then
      raise exception using errcode='22023',message='local_auth_user_id_must_be_uuid';
    end;
    insert into public.app_users (id,email_normalized,display_name)
    values (app_user_id,lower(btrim(new.email)),new.name);
  else
    new.id := app_user_id::text;
  end if;

  -- Le lien d invitation envoyé à cette adresse constitue ici la preuve de
  -- possession. Le hook HTTP vérifie le jeton avant que Better Auth n'insère.
  new."emailVerified" := true;

  insert into public.user_identities (
    app_user_id,provider_type,provider_id,issuer,subject
  ) values (
    app_user_id,'local','better-auth','urn:magrit:local',new.id
  ) on conflict (issuer,subject) do nothing;

  return new;
end
$$;

create trigger authn_user_provision_magrit_identity
before insert on authn."user"
for each row execute function magrit.provision_local_auth_identity();

revoke all on function magrit.provision_local_auth_identity() from public;

comment on function magrit.provision_local_auth_identity() is
  'Provisionne atomiquement app_users et l identite locale lors d une creation Better Auth autorisee par invitation.';
