-- ============================================================================
-- E10.9 — remises granulaires par ligne de devis et tracabilite d audit :
-- garde d etat brouillon, granularite de l audit (une entree PAR CHAMP
-- change), append-only, isolation RLS inter-tenant, et les deux fonctions
-- transactionnelles multi-lignes (retrait, reordonnancement).
-- ----------------------------------------------------------------------------
-- Test COMPORTEMENTAL, execute par psql contre la base locale (meme raison
-- que gescom-e10-3-commercial-quotes.sql : une migration ne change jamais
-- apres coup, un `toContain()` sur son texte ne detecterait aucune
-- regression sur un futur `drop policy`/`grant` mal repris).
--
-- Meme discipline que gescom-e10-3-commercial-quotes.sql pour les oracles :
-- tout identifiant necessaire a une assertion est fige EN PHASE PRIVILEGIEE
-- (role `postgres`), jamais rederive sous le role restreint (qui rendrait
-- NULL et viderait le controle de son sens).
--
-- Scenarios :
--   1. Garde d etat brouillon (BEFORE trigger) : INSERT/UPDATE/DELETE sur
--      une ligne d un devis NON brouillon sont tous les trois rejetes
--      (`quote_line.quote_not_draft`), quel que soit le chemin d ecriture
--      (INSERT sur un devis deja "sent" ; UPDATE et DELETE sur une ligne
--      dont le devis PASSE ENSUITE a "sent" — qa-review, point mineur 1 : l
--      en-tete promettait ces deux derniers sans les exercer).
--   2. Granularite de l audit : un INSERT produit UNE entree `added` avec
--      snapshot ; un UPDATE qui ne change QUE `sale_price` (les autres
--      colonnes auditables identiques) produit UNE SEULE entree `updated`/
--      `sale_price`, jamais une entree fantome sur les champs inchanges.
--      `sale_margin_rate` n est JAMAIS audite (champ derive).
--   3. `api_delete_commercial_quote_line` : retrait + resserrement des
--      positions dans UNE transaction, une entree `removed` + les entrees
--      `reordered` de resequencement PARTAGENT le meme `change_set_id`.
--   4. `api_reorder_commercial_quote_lines` : reordonnancement valide, et
--      rejet `quote_line.positions_mismatch` sur un ensemble incomplet.
--   5. Contrainte `commercial_quote_lines_origin_project_item_coherence` :
--      une ligne LIBRE (`origin = 'free'`) exige `project_item_id is null`,
--      et reciproquement.
--   6. RLS — isolation inter-tenant de `commercial_quote_line_audit` (lecture)
--      et append-only (UPDATE/DELETE directs rejetes pour `authenticated`).
--   7. Garde-fou de non-regression SQL vs `SingleCostPricingEngine`
--      (qa-review C2) : une regle `margin_rate` PUIS une regle
--      `discount_rate`, comparees a des constantes calculees a la main. Memes
--      entrees reprises dans `tests/modules/pricing/single-cost-pricing-
--      engine.test.ts` (describe "E10.9 SQL guard-rail").
--   8. (qa-review round 2, N1 BLOQUANT) Suppression d un devis BROUILLON
--      portant plusieurs lignes par le chemin EXACT de
--      `SupabaseCommercialQuotesRepository.remove` (`DELETE FROM
--      commercial_quotes WHERE id = ... AND status = 'draft'`, pas de
--      fonction RPC dediee) : ne doit lever AUCUNE erreur, et ne doit laisser
--      subsister NI ligne NI entree d audit pour ce devis (cascade sur les
--      deux tables).
--
-- Lancer : pnpm test:storefront:sql (necessite Supabase local demarre).
-- ============================================================================

begin;

create temporary table e10_9_context (
  actor_id      uuid not null,
  tenant_a      uuid not null,
  tenant_b      uuid not null,
  customer_a    uuid not null,
  project_a     uuid not null,
  quote_draft   uuid not null,
  quote_sent    uuid not null,
  line_1        uuid,
  line_2        uuid,
  audit_line_id uuid
);

grant select on e10_9_context to authenticated;

-- ── Phase privilegiee (role de connexion `postgres`, contourne la RLS) ─────
do $$
declare
  v_actor uuid;
  v_tenant_a uuid;
  v_tenant_b uuid;
  v_customer_a uuid;
  v_project_a uuid;
  v_quote_draft uuid;
  v_quote_sent uuid;
  v_line_1 uuid;
  v_line_2 uuid;
  v_rejected boolean;
  v_change_set_removed uuid;
  v_change_set_reordered uuid;
  v_audit_count integer;
  v_quote_state_test uuid;
  v_line_state_test uuid;
  v_item_margin uuid;
  v_item_discount uuid;
  v_price_rule_margin uuid;
  v_price_rule_discount uuid;
  v_quote_margin uuid;
  v_quote_discount uuid;
  v_applied_margin numeric;
  v_public_price numeric;
  v_customer_price numeric;
  v_quote_delete_test uuid;
  v_line_delete_1 uuid;
  v_line_delete_2 uuid;
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
    raise exception 'Un utilisateur Auth non super-admin est requis pour le scenario E10.9';
  end if;

  insert into public.tenants (slug, name) values ('e10-9-lines-a', 'E10.9 Lines Tenant A')
    returning id into v_tenant_a;
  insert into public.tenants (slug, name) values ('e10-9-lines-b', 'E10.9 Lines Tenant B')
    returning id into v_tenant_b;

  insert into public.tenant_members (tenant_id, user_id, role, access_scope, allowed_shop_ids)
  values (v_tenant_a, v_actor, 'admin', 'magrit_full', '{}');
  insert into public.tenant_members (tenant_id, user_id, role, access_scope, allowed_shop_ids)
  values (v_tenant_b, v_actor, 'admin', 'magrit_full', '{}');

  insert into public.customers (tenant_id, type, company_name, siret)
  values (v_tenant_a, 'company', 'Tenant A Impression E10.9', '73282932000074')
  returning id into v_customer_a;

  insert into public.projects (tenant_id, customer_id, name)
  values (v_tenant_a, v_customer_a, 'Projet E10.9')
  returning id into v_project_a;

  perform set_config('request.jwt.claim.sub', v_actor::text, true);

  -- Devis brouillon (utilise pour les scenarios 2-5), et devis "sent" (utilise
  -- pour le scenario 1 de garde d etat).
  insert into public.commercial_quotes (tenant_id, customer_id, project_id, number, status, created_by)
  values (v_tenant_a, v_customer_a, v_project_a, 'DEV-9999-00001', 'draft', v_actor)
  returning id into v_quote_draft;

  insert into public.commercial_quotes (tenant_id, customer_id, project_id, number, status, created_by)
  values (v_tenant_a, v_customer_a, v_project_a, 'DEV-9999-00002', 'sent', v_actor)
  returning id into v_quote_sent;

  insert into e10_9_context (actor_id, tenant_a, tenant_b, customer_a, project_a, quote_draft, quote_sent)
  values (v_actor, v_tenant_a, v_tenant_b, v_customer_a, v_project_a, v_quote_draft, v_quote_sent);

  -- ── 1. Garde d etat brouillon : INSERT/UPDATE/DELETE rejetes sur un devis
  --      "sent" ────────────────────────────────────────────────────────────
  v_rejected := false;
  begin
    insert into public.commercial_quote_lines
      (quote_id, origin, project_item_id, label, quantity, production_price, public_price,
       customer_price, applied_margin_rate, sale_price, breakdown)
    values
      (v_quote_sent, 'free', null, 'Ligne refusee', 1, 10.00, 10.00, 10.00, 0.0000, 10.00,
       '[{"post":"total","cost":"10.00","margin_rate":"0.0000","price":"10.00","source":"clariprint"}]'::jsonb);
  exception
    when others then
      if SQLERRM like 'quote_line.quote_not_draft%' then v_rejected := true;
      else raise exception 'Rejet inattendu a l insertion sur un devis non brouillon : %', SQLERRM;
      end if;
  end;
  if not v_rejected then
    raise exception 'Une ligne a ete inseree sur un devis "sent" malgre la garde d etat';
  end if;

  -- Une ligne EXISTANTE dont le devis passe ENSUITE a un etat non brouillon :
  -- UPDATE et DELETE doivent etre rejetes exactement comme l INSERT
  -- ci-dessus (meme trigger BEFORE, tous les chemins d ecriture). L en-tete
  -- de ce fichier promettait ces deux scenarios sans les exercer (qa-review,
  -- point mineur 1).
  insert into public.commercial_quotes (tenant_id, customer_id, project_id, number, status, created_by)
  values (v_tenant_a, v_customer_a, v_project_a, 'DEV-9999-00003', 'draft', v_actor)
  returning id into v_quote_state_test;

  insert into public.commercial_quote_lines
    (quote_id, origin, project_item_id, label, quantity, production_price, public_price,
     customer_price, applied_margin_rate, sale_price, breakdown)
  values
    (v_quote_state_test, 'free', null, 'Ligne devenue non-brouillon', 1, 10.00, 10.00, 10.00, 0.0000, 10.00,
     '[{"post":"total","cost":"10.00","margin_rate":"0.0000","price":"10.00","source":"clariprint"}]'::jsonb)
  returning id into v_line_state_test;

  update public.commercial_quotes set status = 'sent' where id = v_quote_state_test;

  v_rejected := false;
  begin
    update public.commercial_quote_lines set quantity = 2 where id = v_line_state_test;
  exception
    when others then
      if SQLERRM like 'quote_line.quote_not_draft%' then v_rejected := true;
      else raise exception 'Rejet inattendu a l UPDATE sur un devis non brouillon : %', SQLERRM;
      end if;
  end;
  if not v_rejected then
    raise exception 'Un UPDATE de ligne a ete accepte sur un devis "sent" malgre la garde d etat';
  end if;

  v_rejected := false;
  begin
    delete from public.commercial_quote_lines where id = v_line_state_test;
  exception
    when others then
      if SQLERRM like 'quote_line.quote_not_draft%' then v_rejected := true;
      else raise exception 'Rejet inattendu au DELETE sur un devis non brouillon : %', SQLERRM;
      end if;
  end;
  if not v_rejected then
    raise exception 'Un DELETE de ligne a ete accepte sur un devis "sent" malgre la garde d etat';
  end if;

  -- ── Lignes de reference sur le devis BROUILLON (scenarios 2-5) ──────────
  insert into public.commercial_quote_lines
    (quote_id, origin, project_item_id, label, quantity, production_price, public_price,
     customer_price, applied_margin_rate, sale_price, sale_margin_rate, discount_rate,
     margin_variation, breakdown)
  values
    (v_quote_draft, 'free', null, 'Ligne libre 1', 100, 50.00, 60.00, 60.00, 0.2000, 60.00,
     0.2000, 0.0000, 0.0000,
     '[{"post":"total","cost":"50.00","margin_rate":"0.2000","price":"60.00","source":"clariprint"}]'::jsonb)
  returning id into v_line_1;

  insert into public.commercial_quote_lines
    (quote_id, origin, project_item_id, label, quantity, production_price, public_price,
     customer_price, applied_margin_rate, sale_price, sale_margin_rate, discount_rate,
     margin_variation, breakdown)
  values
    (v_quote_draft, 'free', null, 'Ligne libre 2', 10, 20.00, 24.00, 24.00, 0.2000, 24.00,
     0.2000, 0.0000, 0.0000,
     '[{"post":"total","cost":"20.00","margin_rate":"0.2000","price":"24.00","source":"clariprint"}]'::jsonb)
  returning id into v_line_2;

  update e10_9_context set line_1 = v_line_1, line_2 = v_line_2;

  -- ── 2. Granularite de l audit ────────────────────────────────────────────
  -- Chaque INSERT produit deja une entree `added` (verifie ci-dessous) ; un
  -- UPDATE qui ne change QUE sale_price doit produire UNE SEULE entree
  -- `updated`/`sale_price`, aucune sur discount_rate/margin_variation/
  -- quantity/position (laisses identiques), ni sur sale_margin_rate (jamais
  -- audite, champ derive).
  select count(*) into v_audit_count
    from public.commercial_quote_line_audit
   where quote_line_id = v_line_1 and action = 'added';
  if v_audit_count <> 1 then
    raise exception 'L insertion de la ligne 1 n a pas produit exactement 1 entree "added" (obtenu %)', v_audit_count;
  end if;

  update public.commercial_quote_lines set sale_price = 55.00 where id = v_line_1;

  select count(*) into v_audit_count
    from public.commercial_quote_line_audit
   where quote_line_id = v_line_1 and action = 'updated';
  if v_audit_count <> 1 then
    raise exception 'Un UPDATE ne changeant que sale_price a produit % entree(s) "updated", 1 attendue', v_audit_count;
  end if;

  if not exists (
    select 1 from public.commercial_quote_line_audit
     where quote_line_id = v_line_1 and action = 'updated' and field = 'sale_price'
       and previous_value = '50.00' and new_value = '55.00'
  ) then
    raise exception 'L entree d audit sale_price ne porte pas les valeurs avant/apres attendues';
  end if;

  -- Un UPDATE no-op (meme valeur) ne doit produire AUCUNE entree.
  update public.commercial_quote_lines set sale_price = 55.00 where id = v_line_1;
  select count(*) into v_audit_count
    from public.commercial_quote_line_audit
   where quote_line_id = v_line_1 and action = 'updated';
  if v_audit_count <> 1 then
    raise exception 'Un UPDATE no-op a produit une entree d audit fantome (total desormais %)', v_audit_count;
  end if;

  -- ── 5. Contrainte origin <-> project_item_id ─────────────────────────────
  v_rejected := false;
  begin
    insert into public.commercial_quote_lines
      (quote_id, origin, project_item_id, label, quantity, production_price, public_price,
       customer_price, applied_margin_rate, sale_price, breakdown)
    values
      (v_quote_draft, 'free', gen_random_uuid(), 'Incoherente', 1, 1.00, 1.00, 1.00, 0.0000, 1.00,
       '[{"post":"total","cost":"1.00","margin_rate":"0.0000","price":"1.00","source":"clariprint"}]'::jsonb);
  exception
    when check_violation then v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'Une ligne "free" avec project_item_id non nul a ete acceptee (contrainte de coherence violee)';
  end if;

  -- ── 3. api_delete_commercial_quote_line : retrait + resequencement ───────
  -- meme change_set_id ──────────────────────────────────────────────────
  perform public.api_delete_commercial_quote_line(v_tenant_a, v_quote_draft, v_line_1);

  if exists (select 1 from public.commercial_quote_lines where id = v_line_1) then
    raise exception 'La ligne 1 existe toujours apres api_delete_commercial_quote_line';
  end if;

  if (select position from public.commercial_quote_lines where id = (select line_2 from e10_9_context)) <> 0 then
    raise exception 'La ligne restante n a pas ete resserree a la position 0 apres le retrait';
  end if;

  select change_set_id into v_change_set_removed
    from public.commercial_quote_line_audit
   where quote_line_id = (select line_1 from e10_9_context) and action = 'removed';
  select change_set_id into v_change_set_reordered
    from public.commercial_quote_line_audit
   where quote_line_id = (select line_2 from e10_9_context) and action = 'reordered'
   order by occurred_at desc limit 1;
  if v_change_set_removed is null or v_change_set_reordered is null
     or v_change_set_removed <> v_change_set_reordered then
    raise exception 'Le retrait et le resequencement qui en decoule ne partagent pas le meme change_set_id (% vs %)',
      v_change_set_removed, v_change_set_reordered;
  end if;

  -- ── 4. api_reorder_commercial_quote_lines ────────────────────────────────
  insert into public.commercial_quote_lines
    (quote_id, origin, project_item_id, label, quantity, production_price, public_price,
     customer_price, applied_margin_rate, sale_price, breakdown)
  values
    (v_quote_draft, 'free', null, 'Ligne libre 3', 1, 5.00, 5.00, 5.00, 0.0000, 5.00,
     '[{"post":"total","cost":"5.00","margin_rate":"0.0000","price":"5.00","source":"clariprint"}]'::jsonb)
  returning id into v_line_1; -- reutilise la variable, nouvelle ligne

  update e10_9_context set audit_line_id = v_line_1;

  -- Reordonnancement complet et valide : ligne 3 avant ligne 2.
  perform public.api_reorder_commercial_quote_lines(
    v_tenant_a, v_quote_draft,
    array[v_line_1, (select line_2 from e10_9_context)]
  );
  if (select position from public.commercial_quote_lines where id = v_line_1) <> 0 then
    raise exception 'Le reordonnancement valide n a pas place la ligne 3 en position 0';
  end if;

  -- Ensemble incomplet -> positions_mismatch, aucun effet de bord.
  v_rejected := false;
  begin
    perform public.api_reorder_commercial_quote_lines(v_tenant_a, v_quote_draft, array[v_line_1]);
  exception
    when others then
      if SQLERRM like 'quote_line.positions_mismatch%' then v_rejected := true;
      else raise exception 'Rejet inattendu pour un ensemble incomplet : %', SQLERRM;
      end if;
  end;
  if not v_rejected then
    raise exception 'Un ensemble incomplet de line_ids a ete accepte par le reordonnancement';
  end if;

  -- ── 8. Suppression d un devis BROUILLON portant des lignes (qa-review
  --      round 2, N1 BLOQUANT) : chemin EXACT de
  --      `SupabaseCommercialQuotesRepository.remove` (DELETE direct filtre
  --      par `status = 'draft'`, AUCUNE fonction RPC dediee pour cette
  --      operation). Avant le correctif, la cascade sur les LIGNES du devis
  --      (declenchee APRES la suppression physique de la ligne PARENTE, dans
  --      la MEME transaction) faisait lever au trigger BEFORE
  --      `quote_line.quote_not_draft: devis introuvable` (le SELECT sur
  --      commercial_quotes ne voit plus rien), et la FK immediate de
  --      `commercial_quote_line_audit.quote_id` aurait de toute facon rejete
  --      l entree 'removed' en 23503. ────────────────────────────────────────
  insert into public.commercial_quotes (tenant_id, customer_id, project_id, number, status, created_by)
  values (v_tenant_a, v_customer_a, v_project_a, 'DEV-9999-00004', 'draft', v_actor)
  returning id into v_quote_delete_test;

  insert into public.commercial_quote_lines
    (quote_id, origin, project_item_id, label, quantity, production_price, public_price,
     customer_price, applied_margin_rate, sale_price, breakdown)
  values
    (v_quote_delete_test, 'free', null, 'Ligne a supprimer 1', 1, 10.00, 10.00, 10.00, 0.0000, 10.00,
     '[{"post":"total","cost":"10.00","margin_rate":"0.0000","price":"10.00","source":"clariprint"}]'::jsonb)
  returning id into v_line_delete_1;

  insert into public.commercial_quote_lines
    (quote_id, origin, project_item_id, label, quantity, production_price, public_price,
     customer_price, applied_margin_rate, sale_price, breakdown)
  values
    (v_quote_delete_test, 'free', null, 'Ligne a supprimer 2', 1, 20.00, 20.00, 20.00, 0.0000, 20.00,
     '[{"post":"total","cost":"20.00","margin_rate":"0.0000","price":"20.00","source":"clariprint"}]'::jsonb)
  returning id into v_line_delete_2;

  -- Les deux insertions ci-dessus ont deja produit une entree 'added' chacune
  -- (verifie explicitement, pour prouver ensuite qu elles disparaissent bien
  -- et non qu elles n ont jamais existe).
  select count(*) into v_audit_count
    from public.commercial_quote_line_audit
   where quote_id = v_quote_delete_test;
  if v_audit_count <> 2 then
    raise exception
      'Devis de test N1 : % entree(s) d audit avant suppression, 2 "added" attendues', v_audit_count;
  end if;

  -- Chemin EXACT de SupabaseCommercialQuotesRepository.remove : AUCUNE
  -- exception ne doit remonter ici (c est tout l objet du correctif N1).
  delete from public.commercial_quotes where id = v_quote_delete_test and status = 'draft';

  if exists (select 1 from public.commercial_quotes where id = v_quote_delete_test) then
    raise exception 'Le devis de test N1 existe toujours apres sa propre suppression';
  end if;
  if exists (select 1 from public.commercial_quote_lines where quote_id = v_quote_delete_test) then
    raise exception 'Une ligne du devis de test N1 survit a la suppression du devis (regression N1)';
  end if;
  if exists (select 1 from public.commercial_quote_line_audit where quote_id = v_quote_delete_test) then
    raise exception 'Une entree d audit du devis de test N1 survit a sa suppression (regression N1)';
  end if;

  -- ── 7. Garde-fou de non-regression SQL vs SingleCostPricingEngine
  --      (qa-review C2) : une regle margin_rate PUIS une regle discount_rate
  --      sur le MEME tenant, comparees a des constantes calculees a la main.
  --      Memes entrees reprises dans tests/modules/pricing/single-cost-
  --      pricing-engine.test.ts (describe "E10.9 SQL guard-rail"), pour
  --      qu un futur lecteur voie le lien sans avoir a les rapprocher
  --      lui-meme. ───────────────────────────────────────────────────────────
  insert into public.project_items (project_id, label, quote_payload)
  values (
    v_project_a,
    'Poster A0 (garde-fou margin_rate)',
    '{"quantity": 1, "amounts": {"clariprint_price_ht": "80.00"}}'::jsonb
  )
  returning id into v_item_margin;

  insert into public.project_items (project_id, label, quote_payload)
  values (
    v_project_a,
    'Banderole (garde-fou discount_rate)',
    '{"quantity": 1, "amounts": {"clariprint_price_ht": "200.00"}}'::jsonb
  )
  returning id into v_item_discount;

  -- 7a. Regle margin_rate, portee 'global' : aucune regle de portee plus
  -- specifique n existe encore -> elle est retenue seule.
  -- 80.00 * (1 + 0.1500) = 92.00 EXACT (aucune ambiguite d arrondi).
  insert into public.price_rules (tenant_id, name, scope, value_type, value, valid_from, created_by)
  values (v_tenant_a, 'Marge garde-fou C2', 'global', 'margin_rate', 0.1500, date '2020-01-01', v_actor)
  returning id into v_price_rule_margin;

  v_quote_margin := public.api_create_commercial_quote_from_project_items(
    v_tenant_a, v_project_a, array[v_item_margin]
  );
  select applied_margin_rate, public_price, customer_price
    into v_applied_margin, v_public_price, v_customer_price
    from public.commercial_quote_lines
   where quote_id = v_quote_margin and project_item_id = v_item_margin;

  if v_applied_margin is distinct from 0.1500
     or v_public_price is distinct from 92.00
     or v_customer_price is distinct from 92.00 then
    raise exception
      'Garde-fou margin_rate (C2) : attendu (applied_margin_rate=0.1500, public_price=92.00, customer_price=92.00), obtenu (%, %, %)',
      v_applied_margin, v_public_price, v_customer_price;
  end if;

  -- 7b. Regle discount_rate, portee 'customer' (plus SPECIFIQUE que 'global' :
  -- l emporte sur la regle margin_rate ci-dessus pour ce client, quelle que
  -- soit la recence). Aucune regle margin_rate ne matche ce rang -> marge
  -- par defaut 0.0000 (commercial_quote_line_default_pricing n a pas de
  -- notion de marge de gamme, cf. en-tete de cette migration).
  -- 200.00 * (1 + 0.0000) = 200.00, puis 200.00 * (1 - 0.1000) = 180.00 EXACT.
  insert into public.price_rules (tenant_id, name, scope, customer_id, value_type, value, valid_from, created_by)
  values (v_tenant_a, 'Remise garde-fou C2', 'customer', v_customer_a, 'discount_rate', 0.1000, date '2020-01-01', v_actor)
  returning id into v_price_rule_discount;

  v_quote_discount := public.api_create_commercial_quote_from_project_items(
    v_tenant_a, v_project_a, array[v_item_discount]
  );
  select applied_margin_rate, public_price, customer_price
    into v_applied_margin, v_public_price, v_customer_price
    from public.commercial_quote_lines
   where quote_id = v_quote_discount and project_item_id = v_item_discount;

  if v_applied_margin is distinct from 0.0000
     or v_public_price is distinct from 200.00
     or v_customer_price is distinct from 180.00 then
    raise exception
      'Garde-fou discount_rate (C2) : attendu (applied_margin_rate=0.0000, public_price=200.00, customer_price=180.00), obtenu (%, %, %)',
      v_applied_margin, v_public_price, v_customer_price;
  end if;
end;
$$;

-- ── Phase 2 : retire la qualite de membre du tenant A ──────────────────────
delete from public.tenant_members
 where user_id = (select actor_id from e10_9_context)
   and tenant_id = (select tenant_a from e10_9_context);

set local role authenticated;
select set_config('request.jwt.claim.sub', (select actor_id::text from e10_9_context), true);

-- ── 6. RLS : isolation inter-tenant + append-only ──────────────────────────
do $$
declare
  v_tenant_a uuid;
  v_visible_a integer;
  v_updated integer;
  v_deleted integer;
  v_any_id uuid;
begin
  select tenant_a into v_tenant_a from e10_9_context;

  select count(*) into v_visible_a
    from public.commercial_quote_line_audit
   where quote_id = (select quote_draft from e10_9_context);
  if v_visible_a <> 0 then
    raise exception 'Un membre du seul tenant B lit % entree(s) d audit du tenant A', v_visible_a;
  end if;

  -- Append-only : meme un membre DU TENANT PROPRIETAIRE ne pourrait pas
  -- modifier/supprimer (revoke direct) — verifie ici sans qualite de membre
  -- du tout, qui est deja une condition suffisante pour l isolation, mais le
  -- `revoke` porte sur le ROLE `authenticated`, pas sur la RLS : le prouver
  -- suppose de retenter meme sans acces en lecture, ce que `update`/`delete`
  -- font independamment du `select`.
  select id into v_any_id from public.commercial_quote_line_audit limit 1;
  begin
    update public.commercial_quote_line_audit set actor_label = 'falsifie' where true;
    get diagnostics v_updated = row_count;
    raise exception 'Un UPDATE direct sur commercial_quote_line_audit n a pas ete rejete (% ligne(s))', v_updated;
  exception
    when insufficient_privilege then null; -- attendu
  end;

  begin
    delete from public.commercial_quote_line_audit where true;
    get diagnostics v_deleted = row_count;
    raise exception 'Un DELETE direct sur commercial_quote_line_audit n a pas ete rejete (% ligne(s))', v_deleted;
  exception
    when insufficient_privilege then null; -- attendu
  end;
end;
$$;

reset role;

rollback;
