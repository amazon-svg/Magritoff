-- ============================================================================
-- E10.16 — ecran de detail d une commande : les DEUX colonnes ajoutees par ce
-- lot sur `commercial_orders` (`customer_contact_id`, `expected_delivery_
-- date`) et la recopie de l interlocuteur A LA CONVERSION. Contrat :
-- openapi/magrit-core.v1.yaml, docs/api/CONVENTIONS.md §8.17.
-- ----------------------------------------------------------------------------
-- Test COMPORTEMENTAL, execute par psql contre la base locale : la recopie
-- vit ENTIEREMENT dans `api_convert_commercial_quote` (migration
-- 20260909010000) — une lecture de son texte ne prouve pas qu elle se
-- comporte correctement sous appel reel (meme lecon que E10.9/E10.12/E10.13/
-- E10.14).
--
-- Scenarios :
--   1. Fixtures : tenant A (interlocuteur X resolu, interlocuteur Y non
--      utilise), UN compte boutique DECIDE (customer_contact_id = X), UN
--      compte boutique AUTO-INSCRIT/LEGACY (customer_contact_id NULL), trois
--      devis prets a convertir (sent/accepted-decide/accepted-legacy).
--   2. Conversion depuis un devis SENT (jamais decide au portail) :
--      customer_contact_id NULL sur la commande — aucune branche
--      conditionnelle necessaire pour l obtenir (cas le plus frequent,
--      contrat §0 verification n°2).
--   3. Conversion depuis un devis ACCEPTED, decide par le compte boutique
--      LIE a l interlocuteur X : customer_contact_id = X — la chaine de
--      derivation decided_by_account_id -> shop_customer_accounts.
--      customer_contact_id -> customer_contacts EST reellement exercee.
--   4. Conversion depuis un devis ACCEPTED, decide par le compte AUTO-
--      INSCRIT/LEGACY (customer_contact_id NULL cote compte) :
--      customer_contact_id NULL sur la commande, MEME SI decided_by_
--      account_id n est PAS null — le pointeur intermediaire est vide, la
--      chaine s arrete la sans erreur.
--   5. `expected_delivery_date` : NULL sur les TROIS commandes ci-dessus —
--      aucun ecrivain dans ce lot (reserve (h) du contrat).
--   6. `on delete set null` NE HEURTE PAS l immuabilite : supprimer l
--      interlocuteur X (customer_contacts) met a NULL customer_contact_id
--      sur la commande qui le referencait, SANS lever `order.immutable` —
--      preuve que `commercial_orders_immutable()` (INTOUCHEE par ce lot,
--      consigne du contrat) ne bloque pas cette colonne.
--   7. Mutabilite EN BASE n est PAS un chemin d ECRITURE ouvert : sous role
--      `authenticated`, un admin du tenant proprietaire ne peut PAS modifier
--      customer_contact_id par un UPDATE PostgREST direct (aucune policy RLS
--      d ecriture sur `commercial_orders` — 0 ligne affectee, valeur
--      inchangee).
--   8. Isolation inter-tenant : la RLS de lecture deja posee par E10.12
--      (`commercial_orders_select`) couvre ces deux colonnes SANS
--      modification (RLS est posee par LIGNE, pas par colonne) — verifie
--      qu un membre du tenant B ne lit ni customer_contact_id ni
--      expected_delivery_date d une commande du tenant A.
--
-- Lancer : pnpm test:storefront:sql (necessite Supabase local demarre).
-- ============================================================================

begin;

create temporary table e10_16_context (
  actor_admin       uuid not null,
  actor_b           uuid not null,
  tenant_a          uuid not null,
  tenant_b          uuid not null,
  customer_a        uuid not null,
  contact_x         uuid not null,
  contact_y         uuid not null,
  shop_a            uuid not null,
  account_decided   uuid not null,
  account_legacy    uuid not null,
  quote_sent        uuid not null,
  quote_accepted_x  uuid not null,
  quote_accepted_legacy uuid not null
);

-- Publie l id de la commande issue du scenario 3, consommee par le scenario
-- 6 (delete cascade sur l interlocuteur X) — creee ICI, au niveau superieur,
-- comme `e10_16_context` ci-dessus (une DDL emise depuis un bloc `do $$`
-- fonctionne, mais la creer au meme niveau que le reste du contexte est plus
-- lisible).
create temporary table e10_16_order_x (order_id uuid);

-- ── 1. Fixtures ─────────────────────────────────────────────────────────────
do $$
declare
  v_actor_admin uuid := gen_random_uuid();
  v_actor_b uuid := gen_random_uuid();
  v_tenant_a uuid;
  v_tenant_b uuid;
  v_customer_a uuid;
  v_contact_x uuid;
  v_contact_y uuid;
  v_shop_a uuid;
  v_account_decided uuid;
  v_account_legacy uuid;
  v_project_a uuid;
  v_quote_sent uuid;
  v_quote_accepted_x uuid;
  v_quote_accepted_legacy uuid;
begin
  insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
    values
      (v_actor_admin, 'e10-16-admin@example.test', 'x', now(), now(), now(), 'authenticated', 'authenticated'),
      (v_actor_b, 'e10-16-actor-b@example.test', 'x', now(), now(), now(), 'authenticated', 'authenticated');

  insert into public.tenants (slug, name) values ('e10-16-tenant-a', 'E10.16 Tenant A') returning id into v_tenant_a;
  insert into public.tenants (slug, name) values ('e10-16-tenant-b', 'E10.16 Tenant B') returning id into v_tenant_b;

  insert into public.tenant_members (tenant_id, user_id, role, access_scope, allowed_shop_ids)
    values (v_tenant_a, v_actor_admin, 'admin', 'magrit_full', '{}');
  insert into public.tenant_members (tenant_id, user_id, role, access_scope, allowed_shop_ids)
    values (v_tenant_b, v_actor_b, 'admin', 'magrit_full', '{}');

  insert into public.customers (tenant_id, type, company_name, siret)
    values (v_tenant_a, 'company', 'E10.16 Client A', '73282932000074') returning id into v_customer_a;

  insert into public.customer_contacts (customer_id, first_name, last_name, email)
    values (v_customer_a, 'Interlocuteur', 'X', 'contact.x.e10-16@example.test') returning id into v_contact_x;
  insert into public.customer_contacts (customer_id, first_name, last_name, email)
    values (v_customer_a, 'Interlocuteur', 'Y', 'contact.y.e10-16@example.test') returning id into v_contact_y;

  insert into public.shops (tenant_id, owner_user_id, name, slug)
    values (v_tenant_a, v_actor_admin, 'Boutique E10.16', 'e10-16-boutique') returning id into v_shop_a;

  -- Compte boutique DECIDE : lie a l interlocuteur X (E10.5).
  insert into public.shop_customer_accounts (shop_id, email, full_name, status, activated_at, customer_contact_id)
    values (v_shop_a, 'compte.decide.e10-16@example.test', 'Compte decide', 'active', now(), v_contact_x)
    returning id into v_account_decided;

  -- Compte boutique AUTO-INSCRIT/LEGACY : customer_contact_id NULL (E10.5,
  -- « NULL pour un compte auto-inscrit ou legacy, sans lien de gestion »).
  insert into public.shop_customer_accounts (shop_id, email, full_name, status, activated_at, customer_contact_id)
    values (v_shop_a, 'compte.legacy.e10-16@example.test', 'Compte legacy', 'active', now(), null)
    returning id into v_account_legacy;

  insert into public.projects (tenant_id, customer_id, name)
    values (v_tenant_a, v_customer_a, 'Projet E10.16') returning id into v_project_a;

  -- ── Devis SENT (jamais decide au portail, scenario 2) ───────────────────
  insert into public.commercial_quotes (tenant_id, customer_id, project_id, number, status, valid_until, show_discounts)
    values (v_tenant_a, v_customer_a, v_project_a, 'DEV-2026-96001', 'draft', '2099-01-01', true)
    returning id into v_quote_sent;
  insert into public.commercial_quote_lines (quote_id, project_item_id, origin, label, quantity, position, production_price, public_price, customer_price, applied_margin_rate, sale_price, discount_rate, breakdown)
    values (v_quote_sent, null, 'free', 'Flyers E10.16 A', 500, 0, 100.00, 200.00, 200.00, 1.0000, 190.00, 0.0500, '[{"post":"total","cost":"100.00","margin_rate":"1.0000","price":"200.00","source":"prix_marche"}]'::jsonb);
  perform set_config('magrit.quote_transition', 'true', true);
  update public.commercial_quotes set status = 'sent', sent_at = now() - interval '1 day' where id = v_quote_sent;

  -- ── Devis ACCEPTED, decide par le compte DECIDE -> interlocuteur X
  --    (scenario 3) ───────────────────────────────────────────────────────
  insert into public.commercial_quotes (tenant_id, customer_id, project_id, number, status, valid_until, show_discounts)
    values (v_tenant_a, v_customer_a, v_project_a, 'DEV-2026-96002', 'draft', '2099-01-01', true)
    returning id into v_quote_accepted_x;
  insert into public.commercial_quote_lines (quote_id, project_item_id, origin, label, quantity, position, production_price, public_price, customer_price, applied_margin_rate, sale_price, discount_rate, breakdown)
    values (v_quote_accepted_x, null, 'free', 'Flyers E10.16 B', 500, 0, 100.00, 200.00, 200.00, 1.0000, 200.00, 0.0000, '[{"post":"total","cost":"100.00","margin_rate":"1.0000","price":"200.00","source":"prix_marche"}]'::jsonb);
  perform set_config('magrit.quote_transition', 'true', true);
  update public.commercial_quotes set status = 'sent', sent_at = now() - interval '2 days' where id = v_quote_accepted_x;
  perform set_config('magrit.quote_transition', 'true', true);
  update public.commercial_quotes set status = 'accepted', decided_at = now(), decided_by_account_id = v_account_decided where id = v_quote_accepted_x;

  -- ── Devis ACCEPTED, decide par le compte LEGACY (scenario 4) ────────────
  insert into public.commercial_quotes (tenant_id, customer_id, project_id, number, status, valid_until, show_discounts)
    values (v_tenant_a, v_customer_a, v_project_a, 'DEV-2026-96003', 'draft', '2099-01-01', true)
    returning id into v_quote_accepted_legacy;
  insert into public.commercial_quote_lines (quote_id, project_item_id, origin, label, quantity, position, production_price, public_price, customer_price, applied_margin_rate, sale_price, discount_rate, breakdown)
    values (v_quote_accepted_legacy, null, 'free', 'Flyers E10.16 C', 500, 0, 100.00, 200.00, 200.00, 1.0000, 200.00, 0.0000, '[{"post":"total","cost":"100.00","margin_rate":"1.0000","price":"200.00","source":"prix_marche"}]'::jsonb);
  perform set_config('magrit.quote_transition', 'true', true);
  update public.commercial_quotes set status = 'sent', sent_at = now() - interval '3 days' where id = v_quote_accepted_legacy;
  perform set_config('magrit.quote_transition', 'true', true);
  update public.commercial_quotes set status = 'accepted', decided_at = now(), decided_by_account_id = v_account_legacy where id = v_quote_accepted_legacy;

  perform set_config('magrit.quote_transition', '', true);
  perform set_config('magrit.change_set_id', '', true);

  insert into e10_16_context (
    actor_admin, actor_b, tenant_a, tenant_b, customer_a, contact_x, contact_y, shop_a,
    account_decided, account_legacy, quote_sent, quote_accepted_x, quote_accepted_legacy
  ) values (
    v_actor_admin, v_actor_b, v_tenant_a, v_tenant_b, v_customer_a, v_contact_x, v_contact_y, v_shop_a,
    v_account_decided, v_account_legacy, v_quote_sent, v_quote_accepted_x, v_quote_accepted_legacy
  );
end;
$$;

-- ── 2., 5. Conversion depuis SENT : customer_contact_id NULL, expected_
--    delivery_date NULL ──────────────────────────────────────────────────
do $$
declare
  v_tenant_a uuid;
  v_actor_admin uuid;
  v_quote_sent uuid;
  v_order_id uuid;
  v_contact uuid;
  v_delivery date;
begin
  select tenant_a, actor_admin, quote_sent into v_tenant_a, v_actor_admin, v_quote_sent from e10_16_context;

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_admin::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_order_id := public.api_convert_commercial_quote(v_tenant_a, v_quote_sent);
  reset role;

  select customer_contact_id, expected_delivery_date into v_contact, v_delivery
    from public.commercial_orders where id = v_order_id;

  if v_contact is not null then
    raise exception 'devis SENT (jamais decide) : customer_contact_id inattendu % (attendu NULL)', v_contact;
  end if;
  if v_delivery is not null then
    raise exception 'devis SENT : expected_delivery_date inattendue % (attendu NULL, aucun ecrivain dans ce lot)', v_delivery;
  end if;
end;
$$;

-- ── 3. Conversion depuis ACCEPTED (compte DECIDE) : customer_contact_id =
--    interlocuteur X — la chaine de derivation EST exercee ────────────────
do $$
declare
  v_tenant_a uuid;
  v_actor_admin uuid;
  v_quote_accepted_x uuid;
  v_contact_x uuid;
  v_order_id uuid;
  v_contact uuid;
  v_delivery date;
begin
  select tenant_a, actor_admin, quote_accepted_x, contact_x
    into v_tenant_a, v_actor_admin, v_quote_accepted_x, v_contact_x
    from e10_16_context;

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_admin::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_order_id := public.api_convert_commercial_quote(v_tenant_a, v_quote_accepted_x);
  reset role;

  select customer_contact_id, expected_delivery_date into v_contact, v_delivery
    from public.commercial_orders where id = v_order_id;

  if v_contact is distinct from v_contact_x then
    raise exception 'devis ACCEPTED (compte decide) : customer_contact_id inattendu % (attendu l interlocuteur X, %)', v_contact, v_contact_x;
  end if;
  if v_delivery is not null then
    raise exception 'devis ACCEPTED (compte decide) : expected_delivery_date inattendue % (attendu NULL)', v_delivery;
  end if;

  insert into e10_16_order_x (order_id) values (v_order_id);
end;
$$;

-- ── 4. Conversion depuis ACCEPTED (compte LEGACY) : customer_contact_id
--    NULL MEME SI decided_by_account_id n est PAS null — le pointeur
--    intermediaire (shop_customer_accounts.customer_contact_id) est vide ──
do $$
declare
  v_tenant_a uuid;
  v_actor_admin uuid;
  v_quote_accepted_legacy uuid;
  v_order_id uuid;
  v_contact uuid;
  v_delivery date;
  v_decided_by uuid;
begin
  select tenant_a, actor_admin, quote_accepted_legacy
    into v_tenant_a, v_actor_admin, v_quote_accepted_legacy
    from e10_16_context;

  select decided_by_account_id into v_decided_by from public.commercial_quotes where id = v_quote_accepted_legacy;
  if v_decided_by is null then
    raise exception 'fixture de scenario invalide : decided_by_account_id est deja NULL avant conversion';
  end if;

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_admin::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_order_id := public.api_convert_commercial_quote(v_tenant_a, v_quote_accepted_legacy);
  reset role;

  select customer_contact_id, expected_delivery_date into v_contact, v_delivery
    from public.commercial_orders where id = v_order_id;

  if v_contact is not null then
    raise exception 'devis ACCEPTED (compte legacy) : customer_contact_id inattendu % (attendu NULL, le compte n a lui-meme aucun interlocuteur)', v_contact;
  end if;
  if v_delivery is not null then
    raise exception 'devis ACCEPTED (compte legacy) : expected_delivery_date inattendue % (attendu NULL)', v_delivery;
  end if;
end;
$$;

-- ── 6. `on delete set null` ne heurte PAS l immuabilite ────────────────────
do $$
declare
  v_contact_x uuid;
  v_order_id uuid;
  v_contact_after uuid;
begin
  select contact_x into v_contact_x from e10_16_context;
  select order_id into v_order_id from e10_16_order_x;

  -- Suppression EN TANT QUE postgres (super-utilisateur local) : la garde de
  -- suppression d un interlocuteur (E10.4, si elle existe) est une regle de
  -- FACADE, hors de portee d un test SQL pur qui exerce directement la
  -- cascade FK — meme raisonnement que le scenario 10 d E10.14 pour la cle
  -- de service.
  delete from public.customer_contacts where id = v_contact_x;

  select customer_contact_id into v_contact_after from public.commercial_orders where id = v_order_id;
  if v_contact_after is not null then
    raise exception 'on delete set null n a pas opere : customer_contact_id vaut encore % apres suppression de l interlocuteur', v_contact_after;
  end if;
end;
$$;

drop table e10_16_order_x;

-- ── 7. Mutabilite EN BASE n est PAS un chemin d ecriture — UPDATE direct
--    refuse (RLS : aucune policy d ecriture sur commercial_orders) ────────
do $$
declare
  v_tenant_a uuid;
  v_actor_admin uuid;
  v_quote_accepted_legacy uuid;
  v_order_id uuid;
  v_new_contact uuid;
  v_before uuid;
  v_after uuid;
begin
  select tenant_a, actor_admin, quote_accepted_legacy
    into v_tenant_a, v_actor_admin, v_quote_accepted_legacy
    from e10_16_context;

  select id into v_order_id from public.commercial_orders where quote_id = v_quote_accepted_legacy;
  select customer_contact_id into v_before from public.commercial_orders where id = v_order_id;

  insert into public.customer_contacts (customer_id, first_name, last_name, email)
    values ((select customer_a from e10_16_context), 'Interlocuteur', 'Z', 'contact.z.e10-16@example.test')
    returning id into v_new_contact;

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_admin::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.commercial_orders set customer_contact_id = v_new_contact where id = v_order_id;
  reset role;

  select customer_contact_id into v_after from public.commercial_orders where id = v_order_id;
  if v_after is distinct from v_before then
    raise exception 'un admin du tenant proprietaire a pu ecrire directement customer_contact_id (RLS d ecriture ouverte a tort) : % -> %', v_before, v_after;
  end if;
end;
$$;

-- ── 8. Isolation inter-tenant en LECTURE — RLS posee par LIGNE, deja
--    couvre les deux colonnes neuves SANS modification ───────────────────
do $$
declare
  v_actor_b uuid;
  v_quote_accepted_x uuid;
  v_order_id uuid;
  v_visible integer;
begin
  select actor_b, quote_accepted_x into v_actor_b, v_quote_accepted_x from e10_16_context;
  select id into v_order_id from public.commercial_orders where quote_id = v_quote_accepted_x;

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_b::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into v_visible
    from public.commercial_orders
   where id = v_order_id;
  reset role;

  if v_visible <> 0 then
    raise exception 'le tenant B lit % ligne(s) d une commande du tenant A (commercial_orders_select rompue par les colonnes E10.16)', v_visible;
  end if;
end;
$$;

rollback;
