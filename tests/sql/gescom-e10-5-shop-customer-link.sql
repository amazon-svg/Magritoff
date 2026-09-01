-- ============================================================================
-- E10.5 — dissociation comptes Magrit / comptes clients boutique.
-- ----------------------------------------------------------------------------
-- Test COMPORTEMENTAL, execute par psql contre la base locale : les
-- contraintes exercees ici (index unique partiel croisant deux colonnes,
-- triggers d exclusivite entre deux tables, coherence inter-tenant) ne
-- peuvent pas etre prouvees par une simple lecture du texte de la migration.
--
-- Scenarios :
--   1. (CA3) Un interlocuteur ne peut avoir qu un seul compte boutique par
--      boutique : un second lien (shop_id, customer_contact_id) est refuse.
--   2. (CA3) Le meme interlocuteur PEUT avoir un compte dans une AUTRE
--      boutique du meme tenant (controle positif : l unicite est bien
--      partielle par boutique, pas globale par interlocuteur).
--   3. Coherence inter-tenant : lier un interlocuteur du tenant A a une
--      boutique du tenant B est refuse (trigger, pas seulement la RLS).
--   4. (CA5) Exclusivite dans les deux sens : un `auth_subject_id` deja
--      membre interne (tenant_members) ne peut pas devenir un compte
--      shop_customer_accounts, et inversement.
--   5. (CA4) `current_user_is_shop_customer()` distingue un compte client
--      boutique d un membre interne ordinaire.
--
-- Lancer : pnpm test:storefront:sql (necessite Supabase local demarre).
-- ============================================================================

begin;

create temporary table e10_5_shop_access_context (
  actor_id uuid not null,
  tenant_a uuid not null,
  shop_a1 uuid not null,
  shop_a2 uuid not null,
  customer_a uuid not null,
  contact_a uuid not null,
  free_auth_user_id uuid not null
);

do $$
declare
  v_actor uuid;
  v_free_user uuid;
  v_tenant_a uuid;
  v_shop_a1 uuid;
  v_shop_a2 uuid;
  v_customer_a uuid;
  v_contact_a uuid;
begin
  select u.id into v_actor
    from auth.users u
   where not exists (
     select 1
       from public.tenant_members tm
       join public.tenants t on t.id = tm.tenant_id
      where tm.user_id = u.id
        and t.is_system_tenant = true
        and tm.role in ('owner', 'admin')
   )
   order by u.created_at
   limit 1;

  if v_actor is null then
    raise exception 'Un utilisateur Auth non super-admin est requis pour le scenario E10.5';
  end if;

  select u.id into v_free_user
    from auth.users u
   where u.id <> v_actor
   order by u.created_at
   limit 1;

  if v_free_user is null then
    raise exception 'Un second utilisateur Auth (sans lien) est requis pour le scenario E10.5';
  end if;

  insert into public.tenants (slug, name)
    values ('e10-5-shop-access-a', 'E10.5 Shop Access Tenant A')
    returning id into v_tenant_a;

  insert into public.tenant_members (tenant_id, user_id, role, access_scope, allowed_shop_ids)
  values (v_tenant_a, v_actor, 'admin', 'magrit_full', '{}');

  insert into public.shops (tenant_id, name, slug)
    values (v_tenant_a, 'Boutique A1', 'e10-5-boutique-a1')
    returning id into v_shop_a1;
  insert into public.shops (tenant_id, name, slug)
    values (v_tenant_a, 'Boutique A2', 'e10-5-boutique-a2')
    returning id into v_shop_a2;

  insert into public.customers (tenant_id, type, company_name, siret)
    values (v_tenant_a, 'company', 'E10.5 Client A', '73282932000074')
    returning id into v_customer_a;

  insert into public.customer_contacts (customer_id, first_name, last_name, email)
    values (v_customer_a, 'Contact', 'E10.5', 'contact.e10-5@example.test')
    returning id into v_contact_a;

  insert into e10_5_shop_access_context (
    actor_id, tenant_a, shop_a1, shop_a2, customer_a, contact_a, free_auth_user_id
  ) values (v_actor, v_tenant_a, v_shop_a1, v_shop_a2, v_customer_a, v_contact_a, v_free_user);
end;
$$;

-- ── 1. et 2. Unicite partielle (shop_id, customer_contact_id) ──────────────
do $$
declare
  v_shop_a1 uuid;
  v_shop_a2 uuid;
  v_contact_a uuid;
  v_rejected boolean := false;
begin
  select shop_a1, shop_a2, contact_a into v_shop_a1, v_shop_a2, v_contact_a
    from e10_5_shop_access_context;

  insert into public.shop_customer_accounts (shop_id, email, full_name, status, customer_contact_id)
  values (v_shop_a1, 'contact.e10-5@example.test', 'Contact E10.5', 'invited', v_contact_a);

  -- 1. Un second compte pour LE MEME interlocuteur, DANS LA MEME boutique,
  -- avec un email different (l unicite d email par boutique existait deja ;
  -- celle qui compte ici porte sur (shop_id, customer_contact_id)).
  begin
    insert into public.shop_customer_accounts (shop_id, email, full_name, status, customer_contact_id)
    values (v_shop_a1, 'contact.e10-5.bis@example.test', 'Contact E10.5 bis', 'invited', v_contact_a);
  exception
    when unique_violation then v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'Un interlocuteur a pu obtenir un second compte dans la meme boutique';
  end if;

  -- 2. Controle positif : la MEME interlocuteur peut avoir un compte dans une
  -- AUTRE boutique du meme tenant — l unicite est bien partielle par
  -- boutique, pas globale par interlocuteur.
  insert into public.shop_customer_accounts (shop_id, email, full_name, status, customer_contact_id)
  values (v_shop_a2, 'contact.e10-5@example.test', 'Contact E10.5', 'invited', v_contact_a);
end;
$$;

-- ── 3. Coherence inter-tenant (trigger, pas seulement RLS) ─────────────────
do $$
declare
  v_contact_a uuid;
  v_other_tenant uuid;
  v_other_shop uuid;
  v_rejected boolean := false;
begin
  select contact_a into v_contact_a from e10_5_shop_access_context;

  insert into public.tenants (slug, name) values ('e10-5-shop-access-b', 'E10.5 Shop Access Tenant B')
    returning id into v_other_tenant;
  insert into public.shops (tenant_id, name, slug)
    values (v_other_tenant, 'Boutique B', 'e10-5-boutique-b')
    returning id into v_other_shop;

  begin
    insert into public.shop_customer_accounts (shop_id, email, full_name, status, customer_contact_id)
    values (v_other_shop, 'contact.e10-5.cross@example.test', 'Contact E10.5', 'invited', v_contact_a);
  exception
    when others then
      if sqlerrm like 'shop_customer_contact_tenant_mismatch%' then
        v_rejected := true;
      else
        raise;
      end if;
  end;
  if not v_rejected then
    raise exception 'Un interlocuteur du tenant A a pu etre lie a une boutique d un autre tenant';
  end if;
end;
$$;

-- ── 4. Exclusivite CA5, dans les deux sens ─────────────────────────────────
do $$
declare
  v_actor uuid;
  v_free_user uuid;
  v_shop_a1 uuid;
  v_tenant_a uuid;
  v_rejected boolean := false;
begin
  select actor_id, free_auth_user_id, shop_a1, tenant_a
    into v_actor, v_free_user, v_shop_a1, v_tenant_a
    from e10_5_shop_access_context;

  -- 4a. `v_actor` est deja membre interne (tenant_members) : il ne peut pas
  -- devenir un compte shop_customer_accounts (auth_subject_id renseigne).
  begin
    insert into public.shop_customer_accounts (shop_id, email, full_name, status, auth_subject_id)
    values (v_shop_a1, 'membre-interne@example.test', 'Membre interne', 'active', v_actor);
  exception
    when others then
      if sqlerrm like 'identity_exclusivity_violation%' then
        v_rejected := true;
      else
        raise;
      end if;
  end;
  if not v_rejected then
    raise exception 'Un membre interne a pu devenir un compte client boutique (auth_subject_id partage)';
  end if;

  -- 4b. `v_free_user` devient d abord un compte client boutique...
  insert into public.shop_customer_accounts (shop_id, email, full_name, status, auth_subject_id)
  values (v_shop_a1, 'client-boutique@example.test', 'Client boutique', 'active', v_free_user);

  -- ... et ne peut alors pas etre ajoute comme membre interne du tenant.
  v_rejected := false;
  begin
    insert into public.tenant_members (tenant_id, user_id, role, access_scope, allowed_shop_ids)
    values (v_tenant_a, v_free_user, 'member', 'magrit_full', '{}');
  exception
    when others then
      if sqlerrm like 'identity_exclusivity_violation%' then
        v_rejected := true;
      else
        raise;
      end if;
  end;
  if not v_rejected then
    raise exception 'Un compte client boutique a pu devenir membre interne du tenant';
  end if;
end;
$$;

-- ── 5. current_user_is_shop_customer() ─────────────────────────────────────
set local role authenticated;

do $$
declare
  v_free_user uuid;
  v_actor uuid;
  v_is_shop_customer boolean;
begin
  select free_auth_user_id, actor_id into v_free_user, v_actor from e10_5_shop_access_context;

  perform set_config('request.jwt.claim.sub', v_free_user::text, true);
  select public.current_user_is_shop_customer() into v_is_shop_customer;
  if v_is_shop_customer is not true then
    raise exception 'current_user_is_shop_customer() ne reconnait pas un compte client boutique';
  end if;

  perform set_config('request.jwt.claim.sub', v_actor::text, true);
  select public.current_user_is_shop_customer() into v_is_shop_customer;
  if v_is_shop_customer is not false then
    raise exception 'current_user_is_shop_customer() confond un membre interne avec un compte client boutique';
  end if;
end;
$$;

reset role;

rollback;
