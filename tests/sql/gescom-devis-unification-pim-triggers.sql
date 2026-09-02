-- ============================================================================
-- Unification des devis — retrait de `pim_candidates.source_quote_id`
-- (migration `20260902000400_gescom_devis_unification_drop_legacy_quotes`) :
-- non-regression des DEUX triggers d ingestion PIM boutique qui referencaient
-- cette colonne EN DUR dans leur corps.
-- ----------------------------------------------------------------------------
-- Correction qa-review (BLOQUANT B1) : un simple `alter table ... drop
-- column` ne met pas a jour le corps d une fonction plpgsql qui la
-- reference dans un `insert ... values (...)`. Sans le `create or replace
-- function` ajoute dans la migration (retrait de `source_quote_id` de la
-- clause INSERT, AVANT le `drop column`), le PREMIER insert dans
-- `tenant_order_items` (n importe quelle commande boutique, n importe quel
-- tenant, base partagee) aurait fait echouer le trigger avec
-- `ERROR 42703: column "source_quote_id" of relation "pim_candidates" does
-- not exist`, et donc toute la transaction de commande.
--
-- Ce test est COMPORTEMENTAL (execute par psql contre la base locale, apres
-- application de la migration) : un `toContain()` sur le texte de la
-- migration ne peut pas prouver qu une fonction plpgsql compile et s execute
-- reellement sans erreur au premier appel.
--
-- Scenarios :
--   1. INSERT dans `public.tenant_order_items` -> le trigger
--      `trg_enqueue_pim_tenant_order_item` (fonction
--      `enqueue_pim_candidates_on_tenant_order_item`) s execute SANS ERREUR
--      et produit exactement une ligne dans `public.pim_candidates`.
--   2. INSERT dans `public.shop_orders` -> le trigger
--      `trg_enqueue_pim_shop_order` (fonction
--      `enqueue_pim_candidates_on_shop_order`) s execute SANS ERREUR et
--      produit exactement une ligne dans `public.pim_candidates` par element
--      du panier JSONB `items`.
--
-- Lancer : pnpm test:storefront:sql (necessite Supabase local demarre).
-- ============================================================================

begin;

do $$
declare
  v_actor uuid;
  v_tenant uuid;
  v_shop uuid;
  v_order uuid;
  v_shop_order uuid;
  v_candidate_count_tenant_item integer;
  v_candidate_count_shop_order integer;
  v_suggested_kind text;
  v_suggested_gamme text;
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
    raise exception 'Un utilisateur Auth non super-admin est requis pour ce scenario';
  end if;

  insert into public.tenants (slug, name)
    values ('devis-unif-pim-triggers', 'Devis unification - PIM triggers')
    returning id into v_tenant;

  insert into public.tenant_members (tenant_id, user_id, role, access_scope, allowed_shop_ids)
  values (v_tenant, v_actor, 'admin', 'magrit_full', '{}');

  insert into public.shops (owner_user_id, tenant_id, name, slug)
    values (v_actor, v_tenant, 'Boutique PIM triggers', 'devis-unif-pim-triggers-shop')
    returning id into v_shop;

  -- ── 1. tenant_order_items -> enqueue_pim_candidates_on_tenant_order_item ──
  insert into public.tenant_orders (tenant_id, shop_id, created_by, status, total_ht)
    values (v_tenant, v_shop, v_actor, 'draft', 50.00)
    returning id into v_order;

  -- Ce seul INSERT est le scenario exact qui aurait casse la prise de
  -- commande sur TOUS les tenants avant le correctif qa-review B1 : s il
  -- leve `ERROR 42703: column "source_quote_id" ...`, ce bloc entier
  -- s interrompt et le test echoue (ON_ERROR_STOP=1 dans le runner).
  insert into public.tenant_order_items (
    order_id, product_id, product_label, clariprint_options,
    quantity, unit_price_ht, line_total_ht
  ) values (
    v_order, gen_random_uuid(), 'Flyer A5 test PIM',
    '{"kind": "flyer", "gamme_slug": "flyers"}'::jsonb,
    100, 0.50, 50.00
  );

  select count(*) into v_candidate_count_tenant_item
    from public.pim_candidates
   where source_tenant_id = v_tenant and source_user_id = v_actor;
  if v_candidate_count_tenant_item <> 1 then
    raise exception
      'Attendu exactement 1 ligne pim_candidates apres insert tenant_order_items, obtenu %',
      v_candidate_count_tenant_item;
  end if;

  select suggested_kind, suggested_gamme into v_suggested_kind, v_suggested_gamme
    from public.pim_candidates
   where source_tenant_id = v_tenant and source_user_id = v_actor;
  if v_suggested_kind is distinct from 'flyer' or v_suggested_gamme is distinct from 'flyers' then
    raise exception
      'Le candidat PIM issu de tenant_order_items ne reprend pas le raw_config attendu (kind=%, gamme=%)',
      v_suggested_kind, v_suggested_gamme;
  end if;

  -- ── 2. shop_orders -> enqueue_pim_candidates_on_shop_order ────────────────
  -- Meme fonction, meme risque (elle referencait aussi source_quote_id) :
  -- verifiee separement car montee sur une table distincte.
  insert into public.shop_orders (
    shop_id, customer_name, customer_email, items, total_ht, total_ttc
  ) values (
    v_shop, 'Client test PIM', 'client-pim-triggers@example.test',
    jsonb_build_array(
      jsonb_build_object(
        'product_id', 'lib-non-uuid-product',
        'name', 'Carte de visite test PIM',
        'kind', 'business_card',
        'gamme_slug', 'cartes-de-visite',
        'quantity_ex', 500,
        'price_ht', '12.30'
      )
    ),
    12.30, 14.76
  )
  returning id into v_shop_order;

  -- NB : `product_id` n est pas un UUID valide ('lib-...', cas produit
  -- library, cf. le commentaire "bug #4d" dans la fonction) : le lookup
  -- `shop_products` est saute, la fonction retombe sur son
  -- `jsonb_build_object` de secours qui ne reprend QUE `name`/`quantity`/
  -- `price_ht` de l item source (`kind`/`gamme_slug` n y sont pas propages
  -- — comportement existant de la fonction, hors perimetre de ce correctif).
  -- On identifie donc la ligne par `raw_config->>'name'`, pas par
  -- `suggested_kind` (qui reste `null` dans ce cas precis).
  select count(*) into v_candidate_count_shop_order
    from public.pim_candidates
   where source_tenant_id = v_tenant and source_user_id = v_actor
     and raw_config->>'name' = 'Carte de visite test PIM';
  if v_candidate_count_shop_order <> 1 then
    raise exception
      'Attendu exactement 1 ligne pim_candidates apres insert shop_orders, obtenu %',
      v_candidate_count_shop_order;
  end if;
end;
$$;

rollback;
