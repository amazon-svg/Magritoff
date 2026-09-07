-- ============================================================================
-- E10.10b-1 — lecture des devis dans le portail client : chaine d autorisation
-- `commercial_quotes.customer_id -> customers -> customer_contacts ->
-- shop_customer_accounts` (fonctions security definer, PAS une policy RLS),
-- filtrage `show_discounts`, 404 indiscernable, isolation inter-tenant.
-- ----------------------------------------------------------------------------
-- Test COMPORTEMENTAL, execute par psql contre la base locale : l autorisation
-- et le filtrage vivent ENTIEREMENT dans `api_list_storefront_quotes()` /
-- `api_get_storefront_quote()` / `private.commercial_quote_totals()`
-- (migration 20260906170000) — une simple lecture de leur texte ne prouve pas
-- qu elles se comportent correctement sous appel reel.
--
-- Scenarios :
--   1. Un compte AVEC interlocuteur voit UNIQUEMENT les devis sent/accepted/
--      rejected/converted de SON client, jamais `draft`, jamais ceux d un
--      AUTRE client meme du meme tenant.
--   2. Un compte SANS interlocuteur (customer_contact_id null, E10.5 CA3)
--      recoit une liste VIDE — jamais une exception.
--   3. `p_status = 'draft'` (valeur hors enumeration StorefrontQuoteStatus)
--      rend une liste vide, jamais une erreur ni le brouillon.
--   4. `api_get_storefront_quote` rend le detail complet (totaux, lignes)
--      pour un devis visible, et EXACTEMENT le meme `null` sur les quatre
--      causes indiscernables : identifiant inconnu, devis d un autre client,
--      devis d un autre tenant, devis encore `draft`.
--   5. `show_discounts = false` : lines_subtotal/global_discount/
--      effective_discount_rate valent null (devis ET lignes), net_total/
--      vat_*/total_incl_tax restent renseignes.
--   6. Remise GLOBALE (`global_discount_rate`) : meme arithmetique que
--      `computeQuoteTotals()` (TypeScript, quote-totals.ts) — sous-total,
--      net_total, remise deduite.
--   7. Un jeton de session invalide (inexistant) ne fait la liste vide,
--      jamais une exception — la garde d authentification reelle est posee
--      PAR LA FACADE (`resolvePrincipal`, 401), pas par la fonction SQL.
--   8. `private.commercial_quote_totals` n est executable ni par `anon` ni
--      par `authenticated` : fonction PRIVEE, jamais appelee autrement que
--      DEPUIS les deux fonctions api_* ci-dessus.
--   9. `api_list_storefront_quotes`/`api_get_storefront_quote` sont bien
--      executables par `anon` — le role reel sous lequel une session boutique
--      s execute en production (aucun JWT Magrit).
--
-- Lancer : pnpm test:storefront:sql (necessite Supabase local demarre).
-- ============================================================================

begin;

create temporary table e10_10b_1_context (
  tenant_a uuid not null,
  tenant_b uuid not null,
  shop_a uuid not null,
  shop_b uuid not null,
  customer_a1 uuid not null,
  customer_a2 uuid not null,
  customer_b uuid not null,
  project_a1 uuid not null,
  project_a2 uuid not null,
  project_b uuid not null,
  contact_a1 uuid not null,
  contact_a2 uuid not null,
  token_a1 text not null,
  token_a2 text not null,
  token_no_contact text not null,
  quote_draft uuid not null,
  quote_sent uuid not null,
  quote_accepted uuid not null,
  quote_rejected uuid not null,
  quote_converted uuid not null,
  quote_hidden_discounts uuid not null,
  quote_global_discount uuid not null,
  quote_a2_sent uuid not null,
  quote_b_sent uuid not null
);

-- Les scenarios 1 et 3 s executent sous `set local role anon` (role reel
-- d une session boutique en production) : sans ce grant, la table temporaire
-- (creee sous `postgres`) serait illisible sous ce role restreint — meme
-- raisonnement que `grant select ... to authenticated` dans
-- gescom-e10-3-commercial-quotes.sql.
grant select on e10_10b_1_context to anon;

do $$
declare
  v_actor uuid;
  v_tenant_a uuid;
  v_tenant_b uuid;
  v_shop_a uuid;
  v_shop_b uuid;
  v_customer_a1 uuid;
  v_customer_a2 uuid;
  v_customer_b uuid;
  v_project_a1 uuid;
  v_project_a2 uuid;
  v_project_b uuid;
  v_contact_a1 uuid;
  v_contact_a2 uuid;
  v_account_a1 uuid;
  v_account_a2 uuid;
  v_account_no_contact uuid;
  v_token_a1 text;
  v_token_a2 text;
  v_token_no_contact text;
  v_quote_draft uuid;
  v_quote_sent uuid;
  v_quote_accepted uuid;
  v_quote_rejected uuid;
  v_quote_converted uuid;
  v_quote_hidden uuid;
  v_quote_global_discount uuid;
  v_quote_a2_sent uuid;
  v_quote_b_sent uuid;
begin
  select id into v_actor from auth.users where email is not null order by created_at limit 1;
  if v_actor is null then raise exception 'Utilisateur Auth requis pour le scenario E10.10b-1'; end if;

  insert into public.tenants (slug, name) values ('e10-10b-1-tenant-a', 'E10.10b-1 Tenant A') returning id into v_tenant_a;
  insert into public.tenants (slug, name) values ('e10-10b-1-tenant-b', 'E10.10b-1 Tenant B') returning id into v_tenant_b;
  insert into public.tenant_members (tenant_id, user_id, role, access_scope, allowed_shop_ids)
    values (v_tenant_a, v_actor, 'admin', 'magrit_full', '{}');

  insert into public.shops (owner_user_id, tenant_id, name, slug) values (v_actor, v_tenant_a, 'E10.10b-1 Boutique A', 'e10-10b-1-boutique-a') returning id into v_shop_a;
  insert into public.shops (owner_user_id, tenant_id, name, slug) values (v_actor, v_tenant_b, 'E10.10b-1 Boutique B', 'e10-10b-1-boutique-b') returning id into v_shop_b;

  insert into public.customers (tenant_id, type, company_name, siret)
    values (v_tenant_a, 'company', 'E10.10b-1 Client A1', '73282932000074') returning id into v_customer_a1;
  insert into public.customers (tenant_id, type, company_name, siret)
    values (v_tenant_a, 'company', 'E10.10b-1 Client A2', '11111111100006') returning id into v_customer_a2;
  insert into public.customers (tenant_id, type, company_name, siret)
    values (v_tenant_b, 'company', 'E10.10b-1 Client B', '22222222200005') returning id into v_customer_b;

  insert into public.customer_contacts (customer_id, first_name, last_name, email)
    values (v_customer_a1, 'Contact', 'A1', 'contact.a1.e10-10b-1@example.test') returning id into v_contact_a1;
  insert into public.customer_contacts (customer_id, first_name, last_name, email)
    values (v_customer_a2, 'Contact', 'A2', 'contact.a2.e10-10b-1@example.test') returning id into v_contact_a2;

  insert into public.projects (tenant_id, customer_id, name) values (v_tenant_a, v_customer_a1, 'Projet A1') returning id into v_project_a1;
  insert into public.projects (tenant_id, customer_id, name) values (v_tenant_a, v_customer_a2, 'Projet A2') returning id into v_project_a2;
  insert into public.projects (tenant_id, customer_id, name) values (v_tenant_b, v_customer_b, 'Projet B') returning id into v_project_b;

  -- ── Comptes boutique : AVEC interlocuteur (a1, a2), SANS interlocuteur ────
  insert into public.shop_customer_accounts (shop_id, email, full_name, status, activated_at, customer_contact_id)
    values (v_shop_a, 'account.a1.e10-10b-1@example.test', 'Compte A1', 'active', now(), v_contact_a1)
    returning id into v_account_a1;
  insert into public.shop_customer_accounts (shop_id, email, full_name, status, activated_at, customer_contact_id)
    values (v_shop_a, 'account.a2.e10-10b-1@example.test', 'Compte A2', 'active', now(), v_contact_a2)
    returning id into v_account_a2;
  insert into public.shop_customer_accounts (shop_id, email, full_name, status, activated_at)
    values (v_shop_a, 'account.no-contact.e10-10b-1@example.test', 'Compte sans interlocuteur', 'active', now())
    returning id into v_account_no_contact;

  select encode(extensions.gen_random_bytes(32), 'hex') into v_token_a1;
  insert into private.shop_customer_sessions (shop_customer_account_id, shop_id, token_hash, expires_at)
    values (v_account_a1, v_shop_a, extensions.digest(convert_to(v_token_a1, 'UTF8'), 'sha256'), now() + interval '1 hour');

  select encode(extensions.gen_random_bytes(32), 'hex') into v_token_a2;
  insert into private.shop_customer_sessions (shop_customer_account_id, shop_id, token_hash, expires_at)
    values (v_account_a2, v_shop_a, extensions.digest(convert_to(v_token_a2, 'UTF8'), 'sha256'), now() + interval '1 hour');

  select encode(extensions.gen_random_bytes(32), 'hex') into v_token_no_contact;
  insert into private.shop_customer_sessions (shop_customer_account_id, shop_id, token_hash, expires_at)
    values (v_account_no_contact, v_shop_a, extensions.digest(convert_to(v_token_no_contact, 'UTF8'), 'sha256'), now() + interval '1 hour');

  -- ── Devis du client A1 : les cinq statuts, un seul jamais visible (draft) ─
  -- ── Chaque devis est CREE 'draft' (seul etat qui accepte l insertion de
  -- lignes, trigger `commercial_quote_lines_require_draft_quote`, E10.9),
  -- PUIS bascule vers son statut final par un UPDATE isole portant
  -- l echappatoire `magrit.quote_transition` (E10.10a,
  -- `commercial_quotes_require_draft_before_write`) — exactement le chemin
  -- que emprunterait `api_send_commercial_quote()` en production. Aucune
  -- valeur portee par la ligne de devis ne depend du statut : seule la
  -- colonne `status` elle-meme est protegee par ce trigger tant qu elle NE
  -- CHANGE PAS sur une ligne encore 'draft'.
  insert into public.commercial_quotes (tenant_id, customer_id, project_id, number, status, valid_until, show_discounts)
    values (v_tenant_a, v_customer_a1, v_project_a1, 'DEV-2026-90001', 'draft', null, true)
    returning id into v_quote_draft;
  insert into public.commercial_quote_lines (quote_id, project_item_id, origin, label, quantity, position, production_price, public_price, customer_price, applied_margin_rate, sale_price, discount_rate, breakdown)
    values (v_quote_draft, null, 'free', 'Ligne brouillon', 1, 0, 500.00, 1000.00, 1000.00, 1.0000, 1000.00, 0.0000, '[{"post":"total","cost":"500.00","margin_rate":"1.0000","price":"1000.00","source":"prix_marche"}]'::jsonb);
  -- reste 'draft' : aucune transition.

  -- sent : valid_until DEPASSEE (2020-01-01) -> expired = true.
  insert into public.commercial_quotes (tenant_id, customer_id, project_id, number, status, valid_until, show_discounts)
    values (v_tenant_a, v_customer_a1, v_project_a1, 'DEV-2026-90002', 'draft', '2020-01-01', true)
    returning id into v_quote_sent;
  insert into public.commercial_quote_lines (quote_id, project_item_id, origin, label, quantity, position, production_price, public_price, customer_price, applied_margin_rate, sale_price, discount_rate, breakdown)
    values (v_quote_sent, null, 'free', 'Flyers A5', 500, 0, 500.00, 1000.00, 1000.00, 1.0000, 950.00, 0.0500, '[{"post":"total","cost":"500.00","margin_rate":"1.0000","price":"1000.00","source":"prix_marche"}]'::jsonb);
  perform set_config('magrit.quote_transition', 'true', true);
  update public.commercial_quotes set status = 'sent', sent_at = now() - interval '3 days' where id = v_quote_sent;

  -- accepted : valid_until LOINTAINE (2099) -> expired = false.
  insert into public.commercial_quotes (tenant_id, customer_id, project_id, number, status, valid_until, show_discounts)
    values (v_tenant_a, v_customer_a1, v_project_a1, 'DEV-2026-90003', 'draft', '2099-01-01', true)
    returning id into v_quote_accepted;
  insert into public.commercial_quote_lines (quote_id, project_item_id, origin, label, quantity, position, production_price, public_price, customer_price, applied_margin_rate, sale_price, discount_rate, breakdown)
    values (v_quote_accepted, null, 'free', 'Cartes de visite', 1000, 0, 100.00, 200.00, 200.00, 1.0000, 200.00, 0.0000, '[{"post":"total","cost":"100.00","margin_rate":"1.0000","price":"200.00","source":"prix_marche"}]'::jsonb);
  perform set_config('magrit.quote_transition', 'true', true);
  update public.commercial_quotes set status = 'sent', sent_at = now() - interval '2 days' where id = v_quote_accepted;
  perform set_config('magrit.quote_transition', 'true', true);
  update public.commercial_quotes set status = 'accepted' where id = v_quote_accepted;

  insert into public.commercial_quotes (tenant_id, customer_id, project_id, number, status, valid_until, show_discounts)
    values (v_tenant_a, v_customer_a1, v_project_a1, 'DEV-2026-90004', 'draft', null, true)
    returning id into v_quote_rejected;
  insert into public.commercial_quote_lines (quote_id, project_item_id, origin, label, quantity, position, production_price, public_price, customer_price, applied_margin_rate, sale_price, discount_rate, breakdown)
    values (v_quote_rejected, null, 'free', 'Banderole', 1, 0, 100.00, 200.00, 200.00, 1.0000, 200.00, 0.0000, '[{"post":"total","cost":"100.00","margin_rate":"1.0000","price":"200.00","source":"prix_marche"}]'::jsonb);
  perform set_config('magrit.quote_transition', 'true', true);
  update public.commercial_quotes set status = 'sent', sent_at = now() - interval '4 days' where id = v_quote_rejected;
  perform set_config('magrit.quote_transition', 'true', true);
  update public.commercial_quotes set status = 'rejected' where id = v_quote_rejected;

  insert into public.commercial_quotes (tenant_id, customer_id, project_id, number, status, valid_until, show_discounts)
    values (v_tenant_a, v_customer_a1, v_project_a1, 'DEV-2026-90005', 'draft', null, true)
    returning id into v_quote_converted;
  insert into public.commercial_quote_lines (quote_id, project_item_id, origin, label, quantity, position, production_price, public_price, customer_price, applied_margin_rate, sale_price, discount_rate, breakdown)
    values (v_quote_converted, null, 'free', 'Affiches', 1, 0, 100.00, 200.00, 200.00, 1.0000, 200.00, 0.0000, '[{"post":"total","cost":"100.00","margin_rate":"1.0000","price":"200.00","source":"prix_marche"}]'::jsonb);
  perform set_config('magrit.quote_transition', 'true', true);
  update public.commercial_quotes set status = 'sent', sent_at = now() - interval '5 days' where id = v_quote_converted;
  perform set_config('magrit.quote_transition', 'true', true);
  update public.commercial_quotes set status = 'converted' where id = v_quote_converted;

  -- ── show_discounts = false ───────────────────────────────────────────────
  insert into public.commercial_quotes (tenant_id, customer_id, project_id, number, status, valid_until, show_discounts)
    values (v_tenant_a, v_customer_a1, v_project_a1, 'DEV-2026-90006', 'draft', null, false)
    returning id into v_quote_hidden;
  insert into public.commercial_quote_lines (quote_id, project_item_id, origin, label, quantity, position, production_price, public_price, customer_price, applied_margin_rate, sale_price, discount_rate, breakdown)
    values (v_quote_hidden, null, 'free', 'Depliants', 1, 0, 400.00, 800.00, 800.00, 1.0000, 760.00, 0.0500, '[{"post":"total","cost":"400.00","margin_rate":"1.0000","price":"800.00","source":"prix_marche"}]'::jsonb);
  perform set_config('magrit.quote_transition', 'true', true);
  update public.commercial_quotes set status = 'sent', sent_at = now() - interval '1 day' where id = v_quote_hidden;

  -- ── Remise GLOBALE (global_discount_rate = 10 %) ─────────────────────────
  insert into public.commercial_quotes (tenant_id, customer_id, project_id, number, status, valid_until, show_discounts, global_discount_rate)
    values (v_tenant_a, v_customer_a1, v_project_a1, 'DEV-2026-90007', 'draft', null, true, 0.1000)
    returning id into v_quote_global_discount;
  insert into public.commercial_quote_lines (quote_id, project_item_id, origin, label, quantity, position, production_price, public_price, customer_price, applied_margin_rate, sale_price, discount_rate, breakdown)
    values (v_quote_global_discount, null, 'free', 'Catalogue', 1, 0, 250.00, 500.00, 500.00, 1.0000, 500.00, 0.0000, '[{"post":"total","cost":"250.00","margin_rate":"1.0000","price":"500.00","source":"prix_marche"}]'::jsonb);
  perform set_config('magrit.quote_transition', 'true', true);
  update public.commercial_quotes set status = 'sent', sent_at = now() where id = v_quote_global_discount;

  -- ── Devis d un AUTRE client, meme tenant (jamais visible du compte A1) ───
  insert into public.commercial_quotes (tenant_id, customer_id, project_id, number, status, valid_until, show_discounts)
    values (v_tenant_a, v_customer_a2, v_project_a2, 'DEV-2026-90008', 'draft', null, true)
    returning id into v_quote_a2_sent;
  insert into public.commercial_quote_lines (quote_id, project_item_id, origin, label, quantity, position, production_price, public_price, customer_price, applied_margin_rate, sale_price, discount_rate, breakdown)
    values (v_quote_a2_sent, null, 'free', 'Devis client A2', 1, 0, 100.00, 200.00, 200.00, 1.0000, 200.00, 0.0000, '[{"post":"total","cost":"100.00","margin_rate":"1.0000","price":"200.00","source":"prix_marche"}]'::jsonb);
  perform set_config('magrit.quote_transition', 'true', true);
  update public.commercial_quotes set status = 'sent', sent_at = now() where id = v_quote_a2_sent;

  -- ── Devis d un AUTRE tenant (isolation inter-tenant) ─────────────────────
  insert into public.commercial_quotes (tenant_id, customer_id, project_id, number, status, valid_until, show_discounts)
    values (v_tenant_b, v_customer_b, v_project_b, 'DEV-2026-90009', 'draft', null, true)
    returning id into v_quote_b_sent;
  insert into public.commercial_quote_lines (quote_id, project_item_id, origin, label, quantity, position, production_price, public_price, customer_price, applied_margin_rate, sale_price, discount_rate, breakdown)
    values (v_quote_b_sent, null, 'free', 'Devis tenant B', 1, 0, 100.00, 200.00, 200.00, 1.0000, 200.00, 0.0000, '[{"post":"total","cost":"100.00","margin_rate":"1.0000","price":"200.00","source":"prix_marche"}]'::jsonb);
  perform set_config('magrit.quote_transition', 'true', true);
  update public.commercial_quotes set status = 'sent', sent_at = now() where id = v_quote_b_sent;

  insert into e10_10b_1_context (
    tenant_a, tenant_b, shop_a, shop_b, customer_a1, customer_a2, customer_b,
    project_a1, project_a2, project_b, contact_a1, contact_a2,
    token_a1, token_a2, token_no_contact,
    quote_draft, quote_sent, quote_accepted, quote_rejected, quote_converted,
    quote_hidden_discounts, quote_global_discount, quote_a2_sent, quote_b_sent
  ) values (
    v_tenant_a, v_tenant_b, v_shop_a, v_shop_b, v_customer_a1, v_customer_a2, v_customer_b,
    v_project_a1, v_project_a2, v_project_b, v_contact_a1, v_contact_a2,
    v_token_a1, v_token_a2, v_token_no_contact,
    v_quote_draft, v_quote_sent, v_quote_accepted, v_quote_rejected, v_quote_converted,
    v_quote_hidden, v_quote_global_discount, v_quote_a2_sent, v_quote_b_sent
  );
end;
$$;

-- ── 1. Un compte AVEC interlocuteur : ses devis envoyes, jamais draft, ─────
--      jamais ceux d un autre client meme tenant. Execute sous `anon`
--      (scenario 9) : role reel d une session boutique en production.
set local role anon;

do $$
declare
  v_token_a1 text;
  v_quote_draft uuid;
  v_quote_sent uuid;
  v_quote_accepted uuid;
  v_quote_rejected uuid;
  v_quote_converted uuid;
  v_quote_global_discount uuid;
  v_ids uuid[];
begin
  select token_a1, quote_draft, quote_sent, quote_accepted, quote_rejected, quote_converted, quote_global_discount
    into v_token_a1, v_quote_draft, v_quote_sent, v_quote_accepted, v_quote_rejected, v_quote_converted, v_quote_global_discount
  from e10_10b_1_context;

  select array_agg(id) into v_ids from public.api_list_storefront_quotes(v_token_a1, null, 50, null, null);

  if v_quote_draft = any(v_ids) then
    raise exception 'Un devis draft est apparu dans la liste storefront';
  end if;
  if not (v_quote_sent = any(v_ids) and v_quote_accepted = any(v_ids)
      and v_quote_rejected = any(v_ids) and v_quote_converted = any(v_ids)
      and v_quote_global_discount = any(v_ids)) then
    raise exception 'Un devis envoye du client A1 est absent de sa propre liste storefront';
  end if;
  -- 5 devis "envoyes" + le devis a remises masquees (scenario 5) = 6.
  if array_length(v_ids, 1) <> 6 then
    raise exception 'Nombre de devis visibles inattendu pour le compte A1 : % (attendu 6)', array_length(v_ids, 1);
  end if;
end;
$$;

-- ── 2. Compte SANS interlocuteur : liste vide, jamais une exception (CA7) ──
do $$
declare
  v_token text;
  v_count integer;
begin
  select token_no_contact into v_token from e10_10b_1_context;
  select count(*) into v_count from public.api_list_storefront_quotes(v_token, null, 50, null, null);
  if v_count <> 0 then
    raise exception 'Un compte sans interlocuteur voit % devis, attendu 0 (CA7)', v_count;
  end if;
end;
$$;

-- ── 3. p_status = 'draft' : liste vide, jamais une erreur ni le brouillon ──
do $$
declare
  v_token text;
  v_count integer;
begin
  select token_a1 into v_token from e10_10b_1_context;
  select count(*) into v_count from public.api_list_storefront_quotes(v_token, 'draft', 50, null, null);
  if v_count <> 0 then
    raise exception 'Le filtre status=draft rend % lignes, attendu 0 — draft n existe pas de ce cote du contrat', v_count;
  end if;
end;
$$;

-- ── Compte A2 : voit UNIQUEMENT son propre devis, jamais celui du client A1 ─
do $$
declare
  v_token_a2 text;
  v_quote_a2_sent uuid;
  v_quote_sent uuid;
  v_ids uuid[];
begin
  select token_a2, quote_a2_sent, quote_sent into v_token_a2, v_quote_a2_sent, v_quote_sent from e10_10b_1_context;
  select array_agg(id) into v_ids from public.api_list_storefront_quotes(v_token_a2, null, 50, null, null);

  if array_length(v_ids, 1) <> 1 or v_ids[1] <> v_quote_a2_sent then
    raise exception 'Le compte A2 ne voit pas exactement son propre devis (ids=%)', v_ids;
  end if;
  if v_quote_sent = any(v_ids) then
    raise exception 'Le compte A2 voit un devis du client A1 — fuite inter-client au sein du meme tenant';
  end if;
end;
$$;

-- ── 4. getStorefrontQuote : detail complet, expired, 404 x4 indiscernable ──
do $$
declare
  v_token_a1 text;
  v_token_a2 text;
  v_token_no_contact text;
  v_quote_draft uuid;
  v_quote_sent uuid;
  v_quote_a2_sent uuid;
  v_quote_b_sent uuid;
  v_detail jsonb;
  v_unknown_id uuid := gen_random_uuid();
begin
  select token_a1, token_a2, token_no_contact, quote_draft, quote_sent, quote_a2_sent, quote_b_sent
    into v_token_a1, v_token_a2, v_token_no_contact, v_quote_draft, v_quote_sent, v_quote_a2_sent, v_quote_b_sent
  from e10_10b_1_context;

  v_detail := public.api_get_storefront_quote(v_token_a1, v_quote_sent);
  if v_detail is null then raise exception 'Le devis sent visible du client A1 rend null'; end if;
  if v_detail->>'status' <> 'sent' then raise exception 'status inattendu : %', v_detail->>'status'; end if;
  if v_detail->>'number' <> 'DEV-2026-90002' then raise exception 'number inattendu : %', v_detail->>'number'; end if;
  if (v_detail->>'expired')::boolean is not true then
    raise exception 'expired doit etre true (valid_until 2020-01-01 depasse), rendu %', v_detail->>'expired';
  end if;
  if jsonb_array_length(v_detail->'lines') <> 1 then raise exception 'nombre de lignes inattendu'; end if;
  if (v_detail->'lines'->0->>'price') <> '950.00' then
    raise exception 'price de ligne inattendu : %', v_detail->'lines'->0->>'price';
  end if;
  if (v_detail->'totals'->>'net_total') <> '950.00' then
    raise exception 'net_total inattendu : %', v_detail->'totals'->>'net_total';
  end if;
  if (v_detail->'totals'->>'vat_amount') <> '190.00' then
    raise exception 'vat_amount inattendu (TVA 20%% metropole_fr par defaut) : %', v_detail->'totals'->>'vat_amount';
  end if;
  if (v_detail->'totals'->>'total_incl_tax') <> '1140.00' then
    raise exception 'total_incl_tax inattendu : %', v_detail->'totals'->>'total_incl_tax';
  end if;

  -- 4 causes, LE MEME null indiscernable.
  if public.api_get_storefront_quote(v_token_a1, v_quote_draft) is not null then
    raise exception 'Un devis draft est lisible via getStorefrontQuote';
  end if;
  if public.api_get_storefront_quote(v_token_a1, v_quote_a2_sent) is not null then
    raise exception 'Le compte A1 lit un devis du client A2 (meme tenant) via getStorefrontQuote';
  end if;
  if public.api_get_storefront_quote(v_token_a2, v_quote_sent) is not null then
    raise exception 'Le compte A2 lit un devis du client A1 via getStorefrontQuote';
  end if;
  if public.api_get_storefront_quote(v_token_a1, v_quote_b_sent) is not null then
    raise exception 'Le compte A1 (tenant A) lit un devis du tenant B — isolation inter-tenant rompue';
  end if;
  if public.api_get_storefront_quote(v_token_a1, v_unknown_id) is not null then
    raise exception 'Un identifiant de devis inconnu rend autre chose que null';
  end if;
  -- Session invalide (jeton inexistant) : null, PAS une exception.
  if public.api_get_storefront_quote('ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff', v_quote_sent) is not null then
    raise exception 'Un jeton de session invalide rend autre chose que null';
  end if;
end;
$$;

-- ── 5. show_discounts = false : filtre EN BASE, jamais un champ transmis ──
do $$
declare
  v_token_a1 text;
  v_quote_hidden uuid;
  v_detail jsonb;
  v_line jsonb;
begin
  select token_a1, quote_hidden_discounts into v_token_a1, v_quote_hidden from e10_10b_1_context;
  v_detail := public.api_get_storefront_quote(v_token_a1, v_quote_hidden);
  if v_detail is null then raise exception 'Le devis a remises masquees rend null'; end if;

  if v_detail->'totals'->'lines_subtotal' <> 'null'::jsonb then
    raise exception 'lines_subtotal doit etre null quand show_discounts=false, rendu %', v_detail->'totals'->'lines_subtotal';
  end if;
  if v_detail->'totals'->'global_discount' <> 'null'::jsonb then
    raise exception 'global_discount doit etre null quand show_discounts=false';
  end if;
  if v_detail->'totals'->'effective_discount_rate' <> 'null'::jsonb then
    raise exception 'effective_discount_rate doit etre null quand show_discounts=false';
  end if;
  if v_detail->'totals'->>'net_total' is null then
    raise exception 'net_total doit rester renseigne meme quand show_discounts=false';
  end if;
  if (v_detail->'totals'->>'net_total') <> '760.00' then
    raise exception 'net_total inattendu (remises masquees) : %', v_detail->'totals'->>'net_total';
  end if;

  v_line := v_detail->'lines'->0;
  if v_line->'price_before_discount' <> 'null'::jsonb then
    raise exception 'price_before_discount doit etre null quand show_discounts=false';
  end if;
  if v_line->'discount_rate' <> 'null'::jsonb then
    raise exception 'discount_rate de ligne doit etre null quand show_discounts=false';
  end if;
  if v_line->>'price' <> '760.00' then
    raise exception 'price de ligne doit rester renseigne : %', v_line->>'price';
  end if;
end;
$$;

-- ── 6. Remise globale (global_discount_rate = 10%%) : meme arithmetique ───
--      que computeQuoteTotals() (TypeScript, quote-totals.ts) : sous-total
--      500.00 -> net_total 450.00 -> remise deduite 50.00 (10.00%%).
do $$
declare
  v_token_a1 text;
  v_quote_global_discount uuid;
  v_detail jsonb;
begin
  select token_a1, quote_global_discount into v_token_a1, v_quote_global_discount from e10_10b_1_context;
  v_detail := public.api_get_storefront_quote(v_token_a1, v_quote_global_discount);
  if v_detail is null then raise exception 'Le devis a remise globale rend null'; end if;

  if (v_detail->'totals'->>'lines_subtotal') <> '500.00' then
    raise exception 'lines_subtotal inattendu : %', v_detail->'totals'->>'lines_subtotal';
  end if;
  if (v_detail->'totals'->>'net_total') <> '450.00' then
    raise exception 'net_total inattendu (remise globale 10%%) : %', v_detail->'totals'->>'net_total';
  end if;
  if (v_detail->'totals'->>'global_discount') <> '50.00' then
    raise exception 'global_discount inattendu : %', v_detail->'totals'->>'global_discount';
  end if;
  if (v_detail->'totals'->>'effective_discount_rate') <> '0.1000' then
    raise exception 'effective_discount_rate inattendu : %', v_detail->'totals'->>'effective_discount_rate';
  end if;
end;
$$;

reset role;

-- ── 8. Fonction PRIVEE `private.commercial_quote_totals` : ni anon ni ─────
--      authenticated ne peuvent l executer directement.
do $$
declare
  v_quote_sent uuid;
  v_rejected boolean := false;
begin
  select quote_sent into v_quote_sent from e10_10b_1_context;

  set local role anon;
  begin
    perform * from private.commercial_quote_totals(v_quote_sent);
  exception
    when insufficient_privilege then v_rejected := true;
  end;
  reset role;
  if not v_rejected then
    raise exception 'private.commercial_quote_totals est executable par anon — fonction censee etre PRIVEE';
  end if;
end;
$$;

do $$
declare
  v_quote_sent uuid;
  v_rejected boolean := false;
begin
  select quote_sent into v_quote_sent from e10_10b_1_context;

  set local role authenticated;
  begin
    perform * from private.commercial_quote_totals(v_quote_sent);
  exception
    when insufficient_privilege then v_rejected := true;
  end;
  reset role;
  if not v_rejected then
    raise exception 'private.commercial_quote_totals est executable par authenticated — fonction censee etre PRIVEE';
  end if;
end;
$$;

rollback;
