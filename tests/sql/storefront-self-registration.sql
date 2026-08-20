begin;

create temporary table um9_registration_context (
  open_slug text not null,
  closed_slug text not null,
  open_shop_id uuid not null,
  issued_account_id uuid,
  issued_token text
);

grant select, update on um9_registration_context to anon;

do $$
declare
  v_actor uuid;
  v_tenant uuid;
  v_open_shop uuid;
begin
  select id into v_actor from auth.users where email is not null order by created_at limit 1;
  if v_actor is null then raise exception 'Utilisateur Auth requis pour le scénario UM9.1'; end if;

  insert into public.tenants (slug, name)
  values ('um9-self-registration', 'UM9 Self Registration') returning id into v_tenant;
  insert into public.shops (owner_user_id, tenant_id, slug, name, active, access_mode)
  values (v_actor, v_tenant, 'um9-self-registration-open', 'UM9 Open', true, 'self_signup')
  returning id into v_open_shop;
  insert into public.shops (owner_user_id, tenant_id, slug, name, active, access_mode)
  values (v_actor, v_tenant, 'um9-self-registration-closed', 'UM9 Closed', true, 'invite_only');

  insert into um9_registration_context (open_slug, closed_slug, open_shop_id)
  values ('um9-self-registration-open', 'um9-self-registration-closed', v_open_shop);

  if not has_function_privilege('anon', 'public.api_register_shop_customer(text,text,text,text)', 'EXECUTE') then
    raise exception 'Le rôle anon ne peut pas auto-inscrire un compte';
  end if;
  if has_function_privilege('authenticated', 'public.self_register_shop_buyer(uuid)', 'EXECUTE') then
    raise exception 'L ancien parcours tenant_member est encore exécutable';
  end if;
end;
$$;

set local role anon;

do $$
declare
  v_registration record;
  v_count integer;
begin
  select * into v_registration
    from public.api_register_shop_customer(
      (select open_slug from um9_registration_context),
      ' CLIENT@Example.COM ',
      ' Client Exemple ',
      'mot-de-passe-solide'
    );
  if v_registration.account_id is null or v_registration.opaque_token is null then
    raise exception 'Compte ou session UM9.1 non créé';
  end if;
  if v_registration.email <> 'client@example.com'
     or v_registration.full_name <> 'Client Exemple'
     or v_registration.account_status <> 'active' then
    raise exception 'Profil UM9.1 non normalisé : %', row_to_json(v_registration);
  end if;
  update um9_registration_context
     set issued_account_id = v_registration.account_id,
         issued_token = v_registration.opaque_token;

  select count(*) into v_count
    from public.api_register_shop_customer(
      (select open_slug from um9_registration_context),
      'client@example.com', 'Duplicata', 'autre-mot-de-passe'
    );
  if v_count <> 0 then raise exception 'Un email existant révèle ou recrée un compte'; end if;

  select count(*) into v_count
    from public.api_register_shop_customer(
      (select closed_slug from um9_registration_context),
      'prive@example.com', 'Compte Privé', 'mot-de-passe-solide'
    );
  if v_count <> 0 then raise exception 'Une boutique invite_only accepte l auto-inscription'; end if;
end;
$$;

reset role;

do $$
declare
  v_count integer;
begin
  select count(*) into v_count
    from public.shop_customer_accounts a
   where a.shop_id = (select open_shop_id from um9_registration_context)
     and a.normalized_email = 'client@example.com'
     and a.created_by_magrit_user_id is null
     and a.auth_subject_id is null
     and a.status = 'active';
  if v_count <> 1 then raise exception 'Le compte boutique isolé est incohérent'; end if;

  select count(*) into v_count
    from private.shop_customer_credentials c
   where c.shop_customer_account_id = (select issued_account_id from um9_registration_context);
  if v_count <> 1 then raise exception 'Le credential privé UM9.1 est absent'; end if;

  select count(*) into v_count
    from public.api_resolve_shop_customer_session((select issued_token from um9_registration_context));
  if v_count <> 1 then raise exception 'La session UM9.1 n est pas résolue'; end if;

  select count(*) into v_count
    from public.tenant_members tm
   where tm.tenant_id = (
     select s.tenant_id from public.shops s
      where s.id = (select open_shop_id from um9_registration_context)
   ) and tm.access_scope = 'shop_only';
  if v_count <> 0 then raise exception 'L auto-inscription a recréé un tenant_member shop_only'; end if;
end;
$$;

rollback;
