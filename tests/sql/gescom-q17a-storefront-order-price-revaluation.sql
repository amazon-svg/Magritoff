-- Q17-a — le serveur recalcule le prix des lignes de catalogue
-- (docs/api/CONVENTIONS.md §8.25 point 12 (j)).
--
-- Onze cas, un `do $$ ... $$` par cas, dans l ordre du tableau du point
-- 12 (j). Chaque bloc est independant (son propre tenant/boutique/compte),
-- pour pouvoir etre rejoue seul en cas d echec de revue. Toute la migration
-- de test est faite ici en SQL brut, contre les RPC, jamais via TypeScript :
-- c est la seule maniere de prouver que la garde est SQL et non navigateur
-- (leçon m5, §8.3 — un test serveur ne prouverait que le cablage).

begin;

-- ── Cas 1 — session boutique valide, produit de catalogue a 12,00 EUR,
--    api_create_storefront_order avec unit_price_ht = 0 → refus price_changed
do $$
declare
  v_owner uuid := gen_random_uuid();
  v_tenant uuid;
  v_shop uuid;
  v_account uuid;
  v_token text := encode(extensions.gen_random_bytes(32), 'hex');
  v_product uuid;
  v_result jsonb;
  v_rejected boolean := false;
begin
  insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
    values (v_owner, 'q17a-case1-owner@example.test', 'x', now(), now(), now(), 'authenticated', 'authenticated');
  insert into public.tenants (slug, name) values ('q17a-case1', 'Q17a Case1') returning id into v_tenant;
  insert into public.shops (owner_user_id, tenant_id, slug, name) values (v_owner, v_tenant, 'q17a-case1-shop', 'Q17a Shop')
    returning id into v_shop;
  insert into public.product_library (user_id, tenant_id, name, price_ht, active)
    values (v_owner, v_tenant, 'Flyers A5', 12.00, true) returning id into v_product;
  update public.shops set library_ids = array[]::uuid[] where id = v_shop;
  insert into public.shop_products (shop_id, tenant_id, product_id, name, price_ht)
    values (v_shop, v_tenant, v_product, 'Flyers A5', 12.00);
  insert into public.shop_customer_accounts (shop_id, email, full_name, status, activated_at)
    values (v_shop, 'buyer-case1@example.com', 'Buyer', 'active', now()) returning id into v_account;
  insert into private.shop_customer_sessions (shop_customer_account_id, shop_id, token_hash, expires_at)
    values (v_account, v_shop, extensions.digest(convert_to(v_token, 'UTF8'), 'sha256'), now() + interval '1 hour');

  begin
    select public.api_create_storefront_order(
      v_token, v_shop, 'EUR', '',
      jsonb_build_array(jsonb_build_object(
        'product_id', v_product, 'product_label', 'Flyers A5',
        'clariprint_options', '{}'::jsonb, 'quantity', 2, 'unit_price_ht', 0
      )),
      'q17a-case1-create'
    ) into v_result;
  exception
    when others then
      if sqlerrm like 'price_changed:%' then
        v_rejected := true;
      else
        raise;
      end if;
  end;

  if not v_rejected then
    raise exception 'Cas 1 : un prix falsifie a 0 a ete accepte (attendu : refus price_changed)';
  end if;
end;
$$;

-- ── Cas 2 — brouillon cree a 12,00, api_update_order_draft_for_identity a
--    0,01 → refus price_changed
do $$
declare
  v_owner uuid := gen_random_uuid();
  v_tenant uuid;
  v_shop uuid;
  v_account uuid;
  v_token text := encode(extensions.gen_random_bytes(32), 'hex');
  v_product uuid;
  v_result jsonb;
  v_order_id uuid;
  v_item_id uuid;
  v_rejected boolean := false;
begin
  insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
    values (v_owner, 'q17a-case2-owner@example.test', 'x', now(), now(), now(), 'authenticated', 'authenticated');
  insert into public.tenants (slug, name) values ('q17a-case2', 'Q17a Case2') returning id into v_tenant;
  insert into public.shops (owner_user_id, tenant_id, slug, name) values (v_owner, v_tenant, 'q17a-case2-shop', 'Q17a Shop')
    returning id into v_shop;
  insert into public.product_library (user_id, tenant_id, name, price_ht, active)
    values (v_owner, v_tenant, 'Cartes de visite', 12.00, true) returning id into v_product;
  insert into public.shop_products (shop_id, tenant_id, product_id, name, price_ht)
    values (v_shop, v_tenant, v_product, 'Cartes de visite', 12.00);
  insert into public.shop_customer_accounts (shop_id, email, full_name, status, activated_at)
    values (v_shop, 'buyer-case2@example.com', 'Buyer', 'active', now()) returning id into v_account;
  insert into private.shop_customer_sessions (shop_customer_account_id, shop_id, token_hash, expires_at)
    values (v_account, v_shop, extensions.digest(convert_to(v_token, 'UTF8'), 'sha256'), now() + interval '1 hour');

  select public.api_create_storefront_order(
    v_token, v_shop, 'EUR', '',
    jsonb_build_array(jsonb_build_object(
      'product_id', v_product, 'product_label', 'Cartes de visite',
      'clariprint_options', '{}'::jsonb, 'quantity', 1, 'unit_price_ht', 12.00
    )),
    'q17a-case2-create'
  ) into v_result;
  v_order_id := (v_result->>'order_id')::uuid;
  select id into v_item_id from public.tenant_order_items where order_id = v_order_id limit 1;

  begin
    perform public.api_update_order_draft_for_identity(
      v_order_id,
      jsonb_build_array(jsonb_build_object(
        'id', v_item_id, 'product_label', 'Cartes de visite', 'quantity', 1, 'unit_price_ht', 0.01
      )),
      'q17a-case2-update',
      v_token
    );
  exception
    when others then
      if sqlerrm like 'price_changed:%' then
        v_rejected := true;
      else
        raise;
      end if;
  end;

  if not v_rejected then
    raise exception 'Cas 2 : la modification du brouillon a 0,01 a ete acceptee (attendu : refus price_changed)';
  end if;
end;
$$;

-- ── Cas 3 — product_id d un produit de la bibliotheque d un AUTRE espace →
--    422 product_not_in_shop
do $$
declare
  v_owner_a uuid := gen_random_uuid();
  v_owner_b uuid := gen_random_uuid();
  v_tenant_a uuid;
  v_tenant_b uuid;
  v_shop_a uuid;
  v_product_b uuid;
  v_account uuid;
  v_token text := encode(extensions.gen_random_bytes(32), 'hex');
  v_rejected boolean := false;
begin
  insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
    values
      (v_owner_a, 'q17a-case3-owner-a@example.test', 'x', now(), now(), now(), 'authenticated', 'authenticated'),
      (v_owner_b, 'q17a-case3-owner-b@example.test', 'x', now(), now(), now(), 'authenticated', 'authenticated');
  insert into public.tenants (slug, name) values ('q17a-case3-a', 'Q17a Case3 A') returning id into v_tenant_a;
  insert into public.tenants (slug, name) values ('q17a-case3-b', 'Q17a Case3 B') returning id into v_tenant_b;
  insert into public.shops (owner_user_id, tenant_id, slug, name) values (v_owner_a, v_tenant_a, 'q17a-case3-shop-a', 'Shop A')
    returning id into v_shop_a;
  insert into public.shops (owner_user_id, tenant_id, slug, name) values (v_owner_b, v_tenant_b, 'q17a-case3-shop-b', 'Shop B');
  -- Produit de la bibliotheque de l ESPACE B, jamais rattache a la boutique
  -- de l espace A (ni shop_products, ni library_ids, ni pim_gamme_slugs).
  insert into public.product_library (user_id, tenant_id, name, price_ht, active)
    values (v_owner_b, v_tenant_b, 'Produit Espace B', 30.00, true) returning id into v_product_b;
  insert into public.shop_customer_accounts (shop_id, email, full_name, status, activated_at)
    values (v_shop_a, 'buyer-case3@example.com', 'Buyer', 'active', now()) returning id into v_account;
  insert into private.shop_customer_sessions (shop_customer_account_id, shop_id, token_hash, expires_at)
    values (v_account, v_shop_a, extensions.digest(convert_to(v_token, 'UTF8'), 'sha256'), now() + interval '1 hour');

  begin
    perform public.api_create_storefront_order(
      v_token, v_shop_a, 'EUR', '',
      jsonb_build_array(jsonb_build_object(
        'product_id', v_product_b, 'product_label', 'Produit Espace B',
        'clariprint_options', '{}'::jsonb, 'quantity', 1, 'unit_price_ht', 30.00
      )),
      'q17a-case3-create'
    );
  exception
    when others then
      if sqlerrm like 'product_not_in_shop:%' then
        v_rejected := true;
      else
        raise;
      end if;
  end;

  if not v_rejected then
    raise exception 'Cas 3 : une commande a ete creee avec un produit hors catalogue de la boutique (attendu : 422 product_not_in_shop)';
  end if;
end;
$$;

-- ── Cas 4 — hierarchie (b), quatre lignes dans la MEME commande : override,
--    shop_products, product_library dans le perimetre, 0 partout
do $$
declare
  v_owner uuid := gen_random_uuid();
  v_tenant uuid;
  v_shop uuid;
  v_account uuid;
  v_token text := encode(extensions.gen_random_bytes(32), 'hex');
  v_library uuid;
  v_product_override uuid;
  v_product_manual uuid;
  v_product_linked uuid;
  v_product_zero uuid;
  v_result jsonb;
  v_order_id uuid;
  v_origin_override text;
  v_origin_manual text;
  v_origin_linked text;
  v_origin_zero text;
  v_price_override numeric;
  v_price_manual numeric;
  v_price_linked numeric;
begin
  insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
    values (v_owner, 'q17a-case4-owner@example.test', 'x', now(), now(), now(), 'authenticated', 'authenticated');
  insert into public.tenants (slug, name) values ('q17a-case4', 'Q17a Case4') returning id into v_tenant;
  insert into public.shops (owner_user_id, tenant_id, slug, name) values (v_owner, v_tenant, 'q17a-case4-shop', 'Q17a Shop')
    returning id into v_shop;
  insert into public.libraries (user_id, name) values (v_owner, 'Q17a Case4 Library') returning id into v_library;
  update public.shops set library_ids = array[v_library] where id = v_shop;

  -- Rang 1 : override shop_product_pricing, PLUS FORT que le prix
  -- product_library ET que shop_products (aucune ligne shop_products ici).
  insert into public.product_library (user_id, tenant_id, name, price_ht, active, library_id)
    values (v_owner, v_tenant, 'Produit override', 100.00, true, v_library) returning id into v_product_override;
  insert into public.shop_product_pricing (shop_id, library_product_id, price_ht_override, tenant_id)
    values (v_shop, v_product_override, 42.00, v_tenant);

  -- Rang 2 : shop_products.price_ht de CETTE boutique (prime sur le prix de
  -- product_library, meme si celui-ci differe).
  insert into public.product_library (user_id, tenant_id, name, price_ht, active, library_id)
    values (v_owner, v_tenant, 'Produit manuel', 999.00, true, v_library) returning id into v_product_manual;
  insert into public.shop_products (shop_id, tenant_id, product_id, name, price_ht)
    values (v_shop, v_tenant, v_product_manual, 'Produit manuel', 18.50);

  -- Rang 3 : product_library.price_ht, produit dans le perimetre (library_id
  -- de la boutique), sans ligne shop_products ni override.
  insert into public.product_library (user_id, tenant_id, name, price_ht, active, library_id)
    values (v_owner, v_tenant, 'Produit lie', 25.00, true, v_library) returning id into v_product_linked;

  -- Rang 4 : 0 partout → aucun prix ferme, jamais "0 EUR verifie".
  insert into public.product_library (user_id, tenant_id, name, price_ht, active, library_id)
    values (v_owner, v_tenant, 'Produit sans prix', 0, true, v_library) returning id into v_product_zero;

  insert into public.shop_customer_accounts (shop_id, email, full_name, status, activated_at)
    values (v_shop, 'buyer-case4@example.com', 'Buyer', 'active', now()) returning id into v_account;
  insert into private.shop_customer_sessions (shop_customer_account_id, shop_id, token_hash, expires_at)
    values (v_account, v_shop, extensions.digest(convert_to(v_token, 'UTF8'), 'sha256'), now() + interval '1 hour');

  select public.api_create_storefront_order(
    v_token, v_shop, 'EUR', '',
    jsonb_build_array(
      jsonb_build_object('product_id', v_product_override, 'product_label', 'Produit override', 'clariprint_options', '{}'::jsonb, 'quantity', 1, 'unit_price_ht', 42.00),
      jsonb_build_object('product_id', v_product_manual, 'product_label', 'Produit manuel', 'clariprint_options', '{}'::jsonb, 'quantity', 1, 'unit_price_ht', 18.50),
      jsonb_build_object('product_id', v_product_linked, 'product_label', 'Produit lie', 'clariprint_options', '{}'::jsonb, 'quantity', 1, 'unit_price_ht', 25.00),
      jsonb_build_object('product_id', v_product_zero, 'product_label', 'Produit sans prix', 'clariprint_options', '{}'::jsonb, 'quantity', 1, 'unit_price_ht', 0)
    ),
    'q17a-case4-create'
  ) into v_result;
  v_order_id := (v_result->>'order_id')::uuid;

  select price_origin, unit_price_ht into v_origin_override, v_price_override
    from public.tenant_order_items where order_id = v_order_id and product_id = v_product_override;
  select price_origin, unit_price_ht into v_origin_manual, v_price_manual
    from public.tenant_order_items where order_id = v_order_id and product_id = v_product_manual;
  select price_origin, unit_price_ht into v_origin_linked, v_price_linked
    from public.tenant_order_items where order_id = v_order_id and product_id = v_product_linked;
  select price_origin into v_origin_zero
    from public.tenant_order_items where order_id = v_order_id and product_id = v_product_zero;

  if v_origin_override <> 'catalog' or v_price_override <> 42.00 then
    raise exception 'Cas 4 (rang 1, override) : origin=%, prix=% (attendu catalog / 42.00)', v_origin_override, v_price_override;
  end if;
  if v_origin_manual <> 'catalog' or v_price_manual <> 18.50 then
    raise exception 'Cas 4 (rang 2, shop_products) : origin=%, prix=% (attendu catalog / 18.50)', v_origin_manual, v_price_manual;
  end if;
  if v_origin_linked <> 'catalog' or v_price_linked <> 25.00 then
    raise exception 'Cas 4 (rang 3, product_library) : origin=%, prix=% (attendu catalog / 25.00)', v_origin_linked, v_price_linked;
  end if;
  if v_origin_zero <> 'client_unverified' then
    raise exception 'Cas 4 (rang 4, zero partout) : origin=% (attendu client_unverified, jamais "0 EUR verifie")', v_origin_zero;
  end if;
end;
$$;

-- ── Cas 5 — ligne dont le clariprint_options DIFFERE de la config du
--    catalogue → client_unverified, prix recu conserve
do $$
declare
  v_owner uuid := gen_random_uuid();
  v_tenant uuid;
  v_shop uuid;
  v_account uuid;
  v_token text := encode(extensions.gen_random_bytes(32), 'hex');
  v_product uuid;
  v_result jsonb;
  v_order_id uuid;
  v_origin text;
  v_price numeric;
begin
  insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
    values (v_owner, 'q17a-case5-owner@example.test', 'x', now(), now(), now(), 'authenticated', 'authenticated');
  insert into public.tenants (slug, name) values ('q17a-case5', 'Q17a Case5') returning id into v_tenant;
  insert into public.shops (owner_user_id, tenant_id, slug, name) values (v_owner, v_tenant, 'q17a-case5-shop', 'Q17a Shop')
    returning id into v_shop;
  insert into public.product_library (user_id, tenant_id, name, price_ht, active, config)
    values (v_owner, v_tenant, 'Affiche', 15.00, true, '{"format":"A2"}'::jsonb) returning id into v_product;
  insert into public.shop_products (shop_id, tenant_id, product_id, name, price_ht, config)
    values (v_shop, v_tenant, v_product, 'Affiche', 15.00, '{"format":"A2"}'::jsonb);
  insert into public.shop_customer_accounts (shop_id, email, full_name, status, activated_at)
    values (v_shop, 'buyer-case5@example.com', 'Buyer', 'active', now()) returning id into v_account;
  insert into private.shop_customer_sessions (shop_customer_account_id, shop_id, token_hash, expires_at)
    values (v_account, v_shop, extensions.digest(convert_to(v_token, 'UTF8'), 'sha256'), now() + interval '1 hour');

  -- L acheteur commande le meme produit mais avec un format DIFFERENT
  -- (configuration libre) au prix qu il veut : 999,99. Le serveur doit
  -- ACCEPTER (aucun prix ferme a verifier) et marquer client_unverified.
  select public.api_create_storefront_order(
    v_token, v_shop, 'EUR', '',
    jsonb_build_array(jsonb_build_object(
      'product_id', v_product, 'product_label', 'Affiche',
      'clariprint_options', '{"format":"A0"}'::jsonb, 'quantity', 1, 'unit_price_ht', 999.99
    )),
    'q17a-case5-create'
  ) into v_result;
  v_order_id := (v_result->>'order_id')::uuid;

  select price_origin, unit_price_ht into v_origin, v_price
    from public.tenant_order_items where order_id = v_order_id;

  if v_origin <> 'client_unverified' then
    raise exception 'Cas 5 : origin=% (attendu client_unverified pour une configuration differente du catalogue)', v_origin;
  end if;
  if v_price <> 999.99 then
    raise exception 'Cas 5 : prix recu non conserve (%), attendu 999.99', v_price;
  end if;
end;
$$;

-- ── Cas 6 et 7 — immuabilite des lignes hors brouillon, non-regression
--    sur le brouillon
do $$
declare
  v_owner uuid := gen_random_uuid();
  v_tenant uuid;
  v_shop uuid;
  v_account uuid;
  v_token text := encode(extensions.gen_random_bytes(32), 'hex');
  v_product uuid;
  v_result jsonb;
  v_order_id uuid;
  v_item_id uuid;
  v_rejected boolean := false;
  v_price_after_update numeric;
begin
  insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
    values (v_owner, 'q17a-case67-owner@example.test', 'x', now(), now(), now(), 'authenticated', 'authenticated');
  insert into public.tenants (slug, name) values ('q17a-case67', 'Q17a Case67') returning id into v_tenant;
  insert into public.shops (owner_user_id, tenant_id, slug, name) values (v_owner, v_tenant, 'q17a-case67-shop', 'Q17a Shop')
    returning id into v_shop;
  insert into public.shop_customer_accounts (shop_id, email, full_name, status, activated_at)
    values (v_shop, 'buyer-case67@example.com', 'Buyer', 'active', now()) returning id into v_account;
  insert into private.shop_customer_sessions (shop_customer_account_id, shop_id, token_hash, expires_at)
    values (v_account, v_shop, extensions.digest(convert_to(v_token, 'UTF8'), 'sha256'), now() + interval '1 hour');

  select public.api_create_storefront_order(
    v_token, v_shop, 'EUR', '',
    jsonb_build_array(jsonb_build_object(
      'product_id', null, 'product_label', 'Produit libre',
      'clariprint_options', '{}'::jsonb, 'quantity', 1, 'unit_price_ht', 10.00
    )),
    'q17a-case67-create'
  ) into v_result;
  v_order_id := (v_result->>'order_id')::uuid;
  select id into v_item_id from public.tenant_order_items where order_id = v_order_id limit 1;

  -- Cas 7 — la commande est encore `draft` : un UPDATE direct par la RPC
  -- (via api_update_order_draft_for_identity) doit encore passer.
  perform public.api_update_order_draft_for_identity(
    v_order_id,
    jsonb_build_array(jsonb_build_object('id', v_item_id, 'product_label', 'Produit libre', 'quantity', 1, 'unit_price_ht', 11.00)),
    'q17a-case67-update',
    v_token
  );
  -- Assertion deliberee : verifie que la ligne a REELLEMENT change de valeur,
  -- pas seulement que l appel n a pas leve. Un trigger `before update` qui
  -- renverrait `old` sur la branche autorisee laisserait passer l appel SANS
  -- ecrire la nouvelle valeur (defaut trouve a l execution de ce lot).
  select unit_price_ht into v_price_after_update from public.tenant_order_items where id = v_item_id;
  if v_price_after_update <> 11.00 then
    raise exception 'Cas 7 : la modification du brouillon n a pas ete ecrite (prix relu %, attendu 11.00) — le trigger d immuabilite renvoie-t-il "old" au lieu de "new" sur la branche autorisee ?', v_price_after_update;
  end if;

  -- La commande passe `validated` par un update DIRECT du statut (raccourci
  -- de test : le passage par la RPC de transition est couvert aux cas
  -- 8 a 11).
  update public.tenant_orders set status = 'validated' where id = v_order_id;

  -- Cas 6 — un UPDATE direct sur tenant_order_items d une commande
  -- `validated` (contournement PostgREST direct, pas par une RPC) doit
  -- lever.
  begin
    update public.tenant_order_items set unit_price_ht = 0.01 where id = v_item_id;
  exception
    when others then
      if sqlerrm like 'order_item.immutable:%' then
        v_rejected := true;
      else
        raise;
      end if;
  end;

  if not v_rejected then
    raise exception 'Cas 6 : une ligne de commande validee a pu etre modifiee par ecriture directe (attendu : order_item.immutable)';
  end if;
end;
$$;

-- ── Cas 8, 9, 10, 11 — la transition draft -> validated
do $$
declare
  v_owner uuid := gen_random_uuid();
  v_admin uuid := gen_random_uuid();
  v_tenant uuid;
  v_shop uuid;
  v_account uuid;
  v_token text := encode(extensions.gen_random_bytes(32), 'hex');
  v_product uuid;
  v_result jsonb;
  v_order_id_unverified uuid;
  v_order_id_legacy uuid;
  v_order_id_moved uuid;
  v_item_id uuid;
  v_rejected boolean := false;
  v_event_count integer;
  v_event_actor uuid;
begin
  insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
    values
      (v_owner, 'q17a-case891011-owner@example.test', 'x', now(), now(), now(), 'authenticated', 'authenticated'),
      (v_admin, 'q17a-case891011-admin@example.test', 'x', now(), now(), now(), 'authenticated', 'authenticated');
  insert into public.tenants (slug, name) values ('q17a-case891011', 'Q17a Case891011') returning id into v_tenant;
  insert into public.tenant_members (tenant_id, user_id, role, access_scope, allowed_shop_ids)
    values (v_tenant, v_admin, 'admin', 'magrit_full', '{}');
  insert into public.shops (owner_user_id, tenant_id, slug, name) values (v_owner, v_tenant, 'q17a-case891011-shop', 'Q17a Shop')
    returning id into v_shop;
  insert into public.product_library (user_id, tenant_id, name, price_ht, active)
    values (v_owner, v_tenant, 'Depliant', 12.00, true) returning id into v_product;
  insert into public.shop_products (shop_id, tenant_id, product_id, name, price_ht)
    values (v_shop, v_tenant, v_product, 'Depliant', 12.00);
  insert into public.shop_customer_accounts (shop_id, email, full_name, status, activated_at)
    values (v_shop, 'buyer-case891011@example.com', 'Buyer', 'active', now()) returning id into v_account;
  insert into private.shop_customer_sessions (shop_customer_account_id, shop_id, token_hash, expires_at)
    values (v_account, v_shop, extensions.digest(convert_to(v_token, 'UTF8'), 'sha256'), now() + interval '1 hour');

  perform set_config('request.jwt.claims', json_build_object('sub', v_admin::text, 'role', 'authenticated')::text, true);

  -- ── Commande A : une ligne `client_unverified` (produit configure, prix
  --    libre) — sert les cas 8 et 9.
  select public.api_create_storefront_order(
    v_token, v_shop, 'EUR', '',
    jsonb_build_array(jsonb_build_object(
      'product_id', v_product, 'product_label', 'Depliant',
      'clariprint_options', '{"format":"A3"}'::jsonb, 'quantity', 1, 'unit_price_ht', 500.00
    )),
    'q17a-case8-create'
  ) into v_result;
  v_order_id_unverified := (v_result->>'order_id')::uuid;

  -- Cas 8 — draft -> validated SANS acquittement → refus unverified_prices.
  begin
    perform public.transition_tenant_order_status(v_order_id_unverified, 'validated', null, false);
  exception
    when others then
      if sqlerrm like 'unverified_prices:%' then
        v_rejected := true;
      else
        raise;
      end if;
  end;
  if not v_rejected then
    raise exception 'Cas 8 : une commande avec une ligne client_unverified a ete validee sans acquittement (attendu : refus unverified_prices)';
  end if;

  -- Cas 9 — la meme, AVEC acquittement → passe, et l evenement nomme l acteur.
  perform public.transition_tenant_order_status(v_order_id_unverified, 'validated', null, true);
  select count(*) into v_event_count
    from public.tenant_order_status_events
   where order_id = v_order_id_unverified and to_status = 'validated';
  select actor_id into v_event_actor
    from public.tenant_order_status_events
   where order_id = v_order_id_unverified and to_status = 'validated'
   limit 1;
  if v_event_count <> 1 then
    raise exception 'Cas 9 : % evenement(s) de transition ecrit(s) (attendu 1)', v_event_count;
  end if;
  if v_event_actor is distinct from v_admin then
    raise exception 'Cas 9 : l evenement de transition ne nomme pas l acteur (attendu %)', v_admin;
  end if;

  -- ── Commande B : ligne `legacy` (reprise de la migration) — sert le cas 10.
  select public.api_create_storefront_order(
    v_token, v_shop, 'EUR', '',
    jsonb_build_array(jsonb_build_object(
      'product_id', null, 'product_label', 'Ligne anterieure',
      'clariprint_options', '{}'::jsonb, 'quantity', 1, 'unit_price_ht', 5.00
    )),
    'q17a-case10-create'
  ) into v_result;
  v_order_id_legacy := (v_result->>'order_id')::uuid;
  update public.tenant_order_items set price_origin = 'legacy' where order_id = v_order_id_legacy;
  update public.tenant_orders set has_unverified_prices = false where id = v_order_id_legacy;

  -- Cas 10 — draft -> validated d une commande dont les lignes sont
  -- `legacy` → passe SANS acquittement.
  perform public.transition_tenant_order_status(v_order_id_legacy, 'validated', null, false);

  -- ── Commande C : ligne `catalog`, prix catalogue deplace APRES la
  --    creation — sert le cas 11.
  select public.api_create_storefront_order(
    v_token, v_shop, 'EUR', '',
    jsonb_build_array(jsonb_build_object(
      'product_id', v_product, 'product_label', 'Depliant',
      'clariprint_options', '{}'::jsonb, 'quantity', 1, 'unit_price_ht', 12.00
    )),
    'q17a-case11-create'
  ) into v_result;
  v_order_id_moved := (v_result->>'order_id')::uuid;

  -- L atelier change le prix catalogue APRES la creation de la commande.
  update public.shop_products set price_ht = 20.00 where shop_id = v_shop and product_id = v_product;

  v_rejected := false;
  begin
    perform public.transition_tenant_order_status(v_order_id_moved, 'validated', null, false);
  exception
    when others then
      if sqlerrm like 'price_changed:%' then
        v_rejected := true;
      else
        raise;
      end if;
  end;
  if not v_rejected then
    raise exception 'Cas 11 : une commande a ete validee alors que le prix catalogue avait bouge depuis sa creation (attendu : refus price_changed)';
  end if;

  reset role;
  perform set_config('request.jwt.claims', null, true);
end;
$$;

-- ── Cas 12 (mutation M2) — AUCUNE tolérance : un écart de 0,50 (loin sous
--    une hypothétique tolérance « < 1 ») doit refuser exactement comme un
--    écart grossier. Aucun des cas 1 à 11 ne distingue « aucune tolérance »
--    d une tolérance large : tous leurs écarts dépassent 1 EUR. Ce cas
--    existe pour que M2 (élargir l égalité en tolérance, `< 0.01` -> `< 1`)
--    fasse échouer un test, comme l exige le tableau des mutations
--    (point 12 (j)).
do $$
declare
  v_owner uuid := gen_random_uuid();
  v_tenant uuid;
  v_shop uuid;
  v_account uuid;
  v_token text := encode(extensions.gen_random_bytes(32), 'hex');
  v_product uuid;
  v_rejected boolean := false;
begin
  insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
    values (v_owner, 'q17a-case12-owner@example.test', 'x', now(), now(), now(), 'authenticated', 'authenticated');
  insert into public.tenants (slug, name) values ('q17a-case12', 'Q17a Case12') returning id into v_tenant;
  insert into public.shops (owner_user_id, tenant_id, slug, name) values (v_owner, v_tenant, 'q17a-case12-shop', 'Q17a Shop')
    returning id into v_shop;
  insert into public.product_library (user_id, tenant_id, name, price_ht, active)
    values (v_owner, v_tenant, 'Marque-pages', 12.00, true) returning id into v_product;
  insert into public.shop_products (shop_id, tenant_id, product_id, name, price_ht)
    values (v_shop, v_tenant, v_product, 'Marque-pages', 12.00);
  insert into public.shop_customer_accounts (shop_id, email, full_name, status, activated_at)
    values (v_shop, 'buyer-case12@example.com', 'Buyer', 'active', now()) returning id into v_account;
  insert into private.shop_customer_sessions (shop_customer_account_id, shop_id, token_hash, expires_at)
    values (v_account, v_shop, extensions.digest(convert_to(v_token, 'UTF8'), 'sha256'), now() + interval '1 hour');

  begin
    perform public.api_create_storefront_order(
      v_token, v_shop, 'EUR', '',
      jsonb_build_array(jsonb_build_object(
        'product_id', v_product, 'product_label', 'Marque-pages',
        'clariprint_options', '{}'::jsonb, 'quantity', 1, 'unit_price_ht', 11.50
      )),
      'q17a-case12-create'
    );
  exception
    when others then
      if sqlerrm like 'price_changed:%' then
        v_rejected := true;
      else
        raise;
      end if;
  end;

  if not v_rejected then
    raise exception 'Cas 12 : un ecart de 0,50 EUR (11,50 soumis contre 12,00 en catalogue) a ete accepte (attendu : refus price_changed, AUCUNE tolerance)';
  end if;
end;
$$;

-- ── Cas 13 (mutation M8, volet minuterie) — le trigger d immuabilite est
--    BEFORE, jamais AFTER : un trigger AFTER ne peut plus empecher la
--    lecture intermediaire pour un GRAND nombre de lignes (verrou/latence),
--    et surtout la convention du depot (commercial_order_lines) est BEFORE.
--    Assertion structurelle sur le catalogue systeme, pas comportementale :
--    lever une exception dans un trigger AFTER abandonne quand meme la
--    transaction sur un UPDATE simple, donc un test qui ne regarderait que
--    le comportement ne distinguerait pas les deux timings.
do $$
declare
  v_timing text;
begin
  select action_timing into v_timing
    from information_schema.triggers
   where event_object_schema = 'public'
     and event_object_table = 'tenant_order_items'
     and trigger_name = 'tenant_order_items_immutable_after_draft'
   limit 1;
  if v_timing is distinct from 'BEFORE' then
    raise exception 'Cas 13 : tenant_order_items_immutable_after_draft a pour timing % (attendu BEFORE)', v_timing;
  end if;
end;
$$;

rollback;
