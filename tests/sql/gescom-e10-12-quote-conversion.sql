-- ============================================================================
-- E10.12 — « bouton Valider » : `api_convert_commercial_quote()`, transition
-- atomique sent/accepted -> converted, numerotation CDE-AAAA-NNNNN, copie
-- figee des lignes et des totaux, immuabilite en base, isolation inter-tenant.
-- ----------------------------------------------------------------------------
-- Test COMPORTEMENTAL, execute par psql contre la base locale : la garde, la
-- transition et l immuabilite vivent ENTIEREMENT dans la migration
-- 20260908010000 — une simple lecture de son texte ne prouve pas qu elles se
-- comportent correctement sous appel reel (memes lecons que E10.10a/E10.10b-2).
--
-- Scenarios :
--   1. Conversion depuis `sent` : commande creee (status validated, numero
--      CDE-AAAA-00001, source_quote_status='sent'), totaux figes corrects,
--      lignes copiees dans l ordre, devis -> converted + converted_at pose,
--      audit d entete 'converted' (previous_value='sent').
--   2. Conversion depuis `accepted` (second devis, meme tenant) :
--      source_quote_status='accepted', numero SUIVANT (00002) — sequence
--      PROPRE, partagee entre les deux devis du meme tenant.
--   3. Re-conversion du MEME devis (deja converted) : refusee,
--      quote.conversion_forbidden_status, AUCUNE seconde commande.
--   4. Conversion d un devis `draft` : refusee, meme code.
--   5. Conversion d un devis `rejected` : refusee, meme code.
--   6. Conversion d un devis introuvable dans ce tenant (id d un AUTRE
--      tenant) : quote.not_found — isolation inter-tenant sur l ECRITURE.
--   7. Immuabilite : une ligne de commande ne s UPDATE ni ne se DELETE
--      directement ; l entete d une commande ne change ni sur ses colonnes
--      figees ni par DELETE direct (colonnes mutables : status/updated_at).
--   8. RLS — isolation inter-tenant en LECTURE : un membre du tenant B ne
--      voit AUCUNE commande/ligne du tenant A (`commercial_orders_select`,
--      `commercial_order_lines_select`).
--   9. `commercial_order_number_counters` : RLS activee + zero policy =
--      deni total, meme sous le role authenticated.
--   10. GUC `magrit.quote_transition`/`magrit.change_set_id` VIDES apres
--       chaque appel, succes ET echecs (meme discipline B7 que b-2).
--   11. CONCURRENCE REELLE (qa-review round 1, correctif B1) — DEUX SESSIONS
--       Postgres SEPAREES (pas une sequence d instructions dans une seule
--       session) : le client ACCEPTE le devis (`api_decide_storefront_quote`,
--       transaction ouverte, non commitee) PENDANT qu un membre atelier lance
--       `api_convert_commercial_quote` sur le MEME devis (bloque sur le
--       verrou de ligne pris par `SELECT ... FOR UPDATE`). Le client
--       committe. La conversion reprend : `source_quote_status` enregistre
--       DOIT etre `accepted` (la valeur REELLEMENT en vigueur au moment de
--       la transition), jamais `sent` (la valeur perimee que l ancien patron
--       CTE aurait enregistree — reproduit et confirme par ce scenario avant
--       correctif, cf. commentaire ci-dessous). Ce scenario NE PEUT PAS
--       participer au `begin`/`rollback` des scenarios 1 a 10 (deja
--       termine par le `rollback;` qui precede) : deux connexions Postgres
--       separees ne voient QUE des donnees COMMITEES, ses fixtures sont donc
--       commitees puis explicitement nettoyees (cleanup en bloc EXCEPTION,
--       cf. plus bas).
--
-- Lancer : pnpm test:storefront:sql (necessite Supabase local demarre).
-- ============================================================================

begin;

create temporary table e10_12_context (
  tenant_a uuid not null,
  tenant_b uuid not null,
  actor_a uuid not null,
  actor_b uuid not null,
  customer_a uuid not null,
  quote_sent uuid not null,
  quote_accepted uuid not null,
  quote_draft uuid not null,
  quote_rejected uuid not null
);

do $$
declare
  v_actor_a uuid := gen_random_uuid();
  v_actor_b uuid := gen_random_uuid();
  v_tenant_a uuid;
  v_tenant_b uuid;
  v_customer_a uuid;
  v_customer_b uuid;
  v_project_a uuid;
  v_project_b uuid;
  v_quote_sent uuid;
  v_quote_accepted uuid;
  v_quote_draft uuid;
  v_quote_rejected uuid;
begin
  -- Deux acteurs LOCAUX A CE TEST (jamais reutilises entre fichiers, jamais
  -- committes hors de cette transaction) : le local Supabase de cette session
  -- ne porte aucun auth.users preexistant.
  insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
    values
      (v_actor_a, 'e10-12-actor-a@example.test', 'x', now(), now(), now(), 'authenticated', 'authenticated'),
      (v_actor_b, 'e10-12-actor-b@example.test', 'x', now(), now(), now(), 'authenticated', 'authenticated');

  insert into public.tenants (slug, name) values ('e10-12-tenant-a', 'E10.12 Tenant A') returning id into v_tenant_a;
  insert into public.tenants (slug, name) values ('e10-12-tenant-b', 'E10.12 Tenant B') returning id into v_tenant_b;

  -- `member`, PAS `admin` : decision #9 du contrat, tout membre du tenant
  -- valide, aucune garde de capability.
  insert into public.tenant_members (tenant_id, user_id, role, access_scope, allowed_shop_ids)
    values (v_tenant_a, v_actor_a, 'member', 'magrit_full', '{}');
  insert into public.tenant_members (tenant_id, user_id, role, access_scope, allowed_shop_ids)
    values (v_tenant_b, v_actor_b, 'member', 'magrit_full', '{}');

  insert into public.customers (tenant_id, type, company_name, siret)
    values (v_tenant_a, 'company', 'E10.12 Client A', '73282932000074') returning id into v_customer_a;
  insert into public.customers (tenant_id, type, company_name, siret)
    values (v_tenant_b, 'company', 'E10.12 Client B', '11111111100006') returning id into v_customer_b;

  insert into public.projects (tenant_id, customer_id, name) values (v_tenant_a, v_customer_a, 'Projet A') returning id into v_project_a;
  insert into public.projects (tenant_id, customer_id, name) values (v_tenant_b, v_customer_b, 'Projet B') returning id into v_project_b;

  -- ── Devis SENT, deux lignes (verifie la copie/ordre) ────────────────────
  insert into public.commercial_quotes (tenant_id, customer_id, project_id, number, status, valid_until, show_discounts)
    values (v_tenant_a, v_customer_a, v_project_a, 'DEV-2026-92001', 'draft', '2099-01-01', true)
    returning id into v_quote_sent;
  insert into public.commercial_quote_lines (quote_id, project_item_id, origin, label, quantity, position, production_price, public_price, customer_price, applied_margin_rate, sale_price, discount_rate, breakdown)
    values
      (v_quote_sent, null, 'free', 'Flyers A5', 500, 0, 100.00, 200.00, 200.00, 1.0000, 190.00, 0.0500, '[{"post":"total","cost":"100.00","margin_rate":"1.0000","price":"200.00","source":"prix_marche"}]'::jsonb),
      (v_quote_sent, null, 'free', 'Cartes de visite', 1000, 1, 50.00, 100.00, 100.00, 1.0000, 100.00, 0.0000, '[{"post":"total","cost":"50.00","margin_rate":"1.0000","price":"100.00","source":"prix_marche"}]'::jsonb);
  perform set_config('magrit.quote_transition', 'true', true);
  update public.commercial_quotes set status = 'sent', sent_at = now() - interval '1 day' where id = v_quote_sent;

  -- ── Devis ACCEPTED (le client s est prononce) ───────────────────────────
  insert into public.commercial_quotes (tenant_id, customer_id, project_id, number, status, valid_until, show_discounts)
    values (v_tenant_a, v_customer_a, v_project_a, 'DEV-2026-92002', 'draft', '2099-01-01', true)
    returning id into v_quote_accepted;
  insert into public.commercial_quote_lines (quote_id, project_item_id, origin, label, quantity, position, production_price, public_price, customer_price, applied_margin_rate, sale_price, discount_rate, breakdown)
    values (v_quote_accepted, null, 'free', 'Banderole', 1, 0, 80.00, 160.00, 160.00, 1.0000, 160.00, 0.0000, '[{"post":"total","cost":"80.00","margin_rate":"1.0000","price":"160.00","source":"prix_marche"}]'::jsonb);
  perform set_config('magrit.quote_transition', 'true', true);
  update public.commercial_quotes set status = 'sent', sent_at = now() - interval '2 days' where id = v_quote_accepted;
  perform set_config('magrit.quote_transition', 'true', true);
  update public.commercial_quotes set status = 'accepted', decided_at = now() where id = v_quote_accepted;

  -- ── Devis DRAFT (jamais envoye, scenario 4) ─────────────────────────────
  insert into public.commercial_quotes (tenant_id, customer_id, project_id, number, status, valid_until, show_discounts)
    values (v_tenant_a, v_customer_a, v_project_a, 'DEV-2026-92003', 'draft', '2099-01-01', true)
    returning id into v_quote_draft;
  insert into public.commercial_quote_lines (quote_id, project_item_id, origin, label, quantity, position, production_price, public_price, customer_price, applied_margin_rate, sale_price, discount_rate, breakdown)
    values (v_quote_draft, null, 'free', 'Affiches', 1, 0, 40.00, 80.00, 80.00, 1.0000, 80.00, 0.0000, '[{"post":"total","cost":"40.00","margin_rate":"1.0000","price":"80.00","source":"prix_marche"}]'::jsonb);

  -- ── Devis REJECTED (le client a dit non, scenario 5) ────────────────────
  insert into public.commercial_quotes (tenant_id, customer_id, project_id, number, status, valid_until, show_discounts)
    values (v_tenant_a, v_customer_a, v_project_a, 'DEV-2026-92004', 'draft', '2099-01-01', true)
    returning id into v_quote_rejected;
  insert into public.commercial_quote_lines (quote_id, project_item_id, origin, label, quantity, position, production_price, public_price, customer_price, applied_margin_rate, sale_price, discount_rate, breakdown)
    values (v_quote_rejected, null, 'free', 'Devis refuse', 1, 0, 40.00, 80.00, 80.00, 1.0000, 80.00, 0.0000, '[{"post":"total","cost":"40.00","margin_rate":"1.0000","price":"80.00","source":"prix_marche"}]'::jsonb);
  perform set_config('magrit.quote_transition', 'true', true);
  update public.commercial_quotes set status = 'sent', sent_at = now() - interval '3 days' where id = v_quote_rejected;
  perform set_config('magrit.quote_transition', 'true', true);
  update public.commercial_quotes set status = 'rejected', decided_at = now() where id = v_quote_rejected;

  perform set_config('magrit.quote_transition', '', true);
  perform set_config('magrit.change_set_id', '', true);

  insert into e10_12_context (tenant_a, tenant_b, actor_a, actor_b, customer_a, quote_sent, quote_accepted, quote_draft, quote_rejected)
  values (v_tenant_a, v_tenant_b, v_actor_a, v_actor_b, v_customer_a, v_quote_sent, v_quote_accepted, v_quote_draft, v_quote_rejected);
end;
$$;

-- ── 1. Conversion depuis `sent` ─────────────────────────────────────────────
do $$
declare
  v_tenant uuid;
  v_actor uuid;
  v_quote uuid;
  v_customer uuid;
  v_order uuid;
  v_order_row record;
  v_line_count integer;
  v_first_line record;
  v_quote_row record;
  v_audit record;
begin
  select tenant_a, actor_a, quote_sent, customer_a into v_tenant, v_actor, v_quote, v_customer from e10_12_context;

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select public.api_convert_commercial_quote(v_tenant, v_quote) into v_order;
  reset role;

  if v_order is null then
    raise exception 'api_convert_commercial_quote(sent) doit rendre un id de commande';
  end if;

  select * into v_order_row from public.commercial_orders where id = v_order;
  if v_order_row.number <> 'CDE-2026-00001' then
    raise exception 'numero de commande inattendu : % (attendu CDE-2026-00001)', v_order_row.number;
  end if;
  if v_order_row.status <> 'validated' then
    raise exception 'statut de commande inattendu : %', v_order_row.status;
  end if;
  if v_order_row.source_quote_status <> 'sent' then
    raise exception 'source_quote_status inattendu : % (attendu sent)', v_order_row.source_quote_status;
  end if;
  if v_order_row.customer_id <> v_customer then
    raise exception 'customer_id de la commande ne correspond pas au devis source';
  end if;
  if v_order_row.quote_id <> v_quote then
    raise exception 'quote_id de la commande ne correspond pas au devis converti';
  end if;
  -- 190.00 + 100.00 = 290.00 HT, TVA 20% (metropole_fr, aucune surcharge) = 58.00, TTC 348.00.
  if v_order_row.lines_subtotal <> 290.00 or v_order_row.net_total <> 290.00
     or v_order_row.vat_rate <> 0.2000 or v_order_row.vat_amount <> 58.00
     or v_order_row.total_incl_tax <> 348.00 then
    raise exception 'totaux figes inattendus : subtotal=%, net=%, vat_rate=%, vat_amount=%, ttc=%',
      v_order_row.lines_subtotal, v_order_row.net_total, v_order_row.vat_rate, v_order_row.vat_amount, v_order_row.total_incl_tax;
  end if;

  select count(*) into v_line_count from public.commercial_order_lines where order_id = v_order;
  if v_line_count <> 2 then
    raise exception 'nombre de lignes de commande inattendu : % (attendu 2)', v_line_count;
  end if;

  select * into v_first_line from public.commercial_order_lines where order_id = v_order and position = 0;
  if v_first_line.label <> 'Flyers A5' or v_first_line.sale_price <> 190.00 or v_first_line.quantity <> 500 then
    raise exception 'premiere ligne de commande inattendue : label=%, sale_price=%, quantity=%',
      v_first_line.label, v_first_line.sale_price, v_first_line.quantity;
  end if;
  if v_first_line.breakdown is null or jsonb_array_length(v_first_line.breakdown) < 1 then
    raise exception 'breakdown de la ligne de commande ne doit jamais etre vide';
  end if;

  select status, converted_at into v_quote_row from public.commercial_quotes where id = v_quote;
  if v_quote_row.status <> 'converted' then
    raise exception 'le devis source doit passer a converted, obtenu %', v_quote_row.status;
  end if;
  if v_quote_row.converted_at is null then
    raise exception 'converted_at doit etre pose sur le devis source';
  end if;

  select action, field, previous_value, new_value, quote_snapshot, actor_id
    into v_audit
  from public.commercial_quote_header_audit
  where quote_id = v_quote and action = 'converted';
  if not found then
    raise exception 'aucune entree d audit converted trouvee';
  end if;
  if v_audit.field is not null or v_audit.quote_snapshot is not null then
    raise exception 'field/quote_snapshot doivent etre NULL sur converted';
  end if;
  if v_audit.previous_value <> 'sent' or v_audit.new_value <> 'converted' then
    raise exception 'previous_value/new_value inattendus sur converted : % / %', v_audit.previous_value, v_audit.new_value;
  end if;
  if v_audit.actor_id <> v_actor then
    raise exception 'actor_id inattendu sur converted (doit etre le MEMBRE qui a valide)';
  end if;
end;
$$;

-- ── 2. Conversion depuis `accepted` : numero SUIVANT, meme sequence ────────
do $$
declare
  v_tenant uuid;
  v_actor uuid;
  v_quote uuid;
  v_order uuid;
  v_number text;
  v_source_status text;
begin
  select tenant_a, actor_a, quote_accepted into v_tenant, v_actor, v_quote from e10_12_context;

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select public.api_convert_commercial_quote(v_tenant, v_quote) into v_order;
  reset role;

  select number, source_quote_status into v_number, v_source_status from public.commercial_orders where id = v_order;
  if v_number <> 'CDE-2026-00002' then
    raise exception 'numero de commande inattendu : % (attendu CDE-2026-00002, sequence PARTAGEE)', v_number;
  end if;
  if v_source_status <> 'accepted' then
    raise exception 'source_quote_status inattendu : % (attendu accepted)', v_source_status;
  end if;
end;
$$;

-- ── 3. Re-conversion du MEME devis (deja converted) : refusee ─────────────
do $$
declare
  v_tenant uuid;
  v_actor uuid;
  v_quote uuid;
  v_count_before integer;
  v_count_after integer;
  v_rejected boolean := false;
begin
  select tenant_a, actor_a, quote_sent into v_tenant, v_actor, v_quote from e10_12_context;
  select count(*) into v_count_before from public.commercial_orders where quote_id = v_quote;

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.api_convert_commercial_quote(v_tenant, v_quote);
  exception
    when others then
      if sqlerrm like 'quote.conversion_forbidden_status%' then
        v_rejected := true;
      else
        reset role;
        raise;
      end if;
  end;
  reset role;

  if not v_rejected then
    raise exception 'une re-conversion a reussi (attendu : quote.conversion_forbidden_status)';
  end if;

  select count(*) into v_count_after from public.commercial_orders where quote_id = v_quote;
  if v_count_after <> v_count_before then
    raise exception 'une seconde commande a ete creee pour le meme devis (%), le unique(quote_id) aurait du l empecher', v_count_after;
  end if;
end;
$$;

-- ── 4. Conversion d un devis `draft` : refusee ─────────────────────────────
do $$
declare
  v_tenant uuid;
  v_actor uuid;
  v_quote uuid;
  v_rejected boolean := false;
begin
  select tenant_a, actor_a, quote_draft into v_tenant, v_actor, v_quote from e10_12_context;

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.api_convert_commercial_quote(v_tenant, v_quote);
  exception
    when others then
      if sqlerrm like 'quote.conversion_forbidden_status%' then
        v_rejected := true;
      else
        reset role;
        raise;
      end if;
  end;
  reset role;

  if not v_rejected then
    raise exception 'un devis draft a pu etre converti (attendu : quote.conversion_forbidden_status)';
  end if;
  if (select status from public.commercial_quotes where id = v_quote) <> 'draft' then
    raise exception 'le statut du devis draft a change malgre le refus';
  end if;
end;
$$;

-- ── 5. Conversion d un devis `rejected` : refusee ──────────────────────────
do $$
declare
  v_tenant uuid;
  v_actor uuid;
  v_quote uuid;
  v_rejected boolean := false;
begin
  select tenant_a, actor_a, quote_rejected into v_tenant, v_actor, v_quote from e10_12_context;

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.api_convert_commercial_quote(v_tenant, v_quote);
  exception
    when others then
      if sqlerrm like 'quote.conversion_forbidden_status%' then
        v_rejected := true;
      else
        reset role;
        raise;
      end if;
  end;
  reset role;

  if not v_rejected then
    raise exception 'un devis rejected a pu etre converti (attendu : quote.conversion_forbidden_status)';
  end if;
end;
$$;

-- ── 6. Isolation inter-tenant sur l ECRITURE : id d un AUTRE tenant ────────
do $$
declare
  v_tenant_b uuid;
  v_actor_b uuid;
  v_quote_a uuid;
  v_not_found boolean := false;
begin
  select tenant_b, actor_b, quote_draft into v_tenant_b, v_actor_b, v_quote_a from e10_12_context;

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_b::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    -- Le membre B tente de convertir un devis du TENANT A en se faisant
    -- passer pour son propre tenant : p_tenant_id=tenant_b, p_quote_id=devis A.
    perform public.api_convert_commercial_quote(v_tenant_b, v_quote_a);
  exception
    when others then
      if sqlerrm like 'quote.not_found%' then
        v_not_found := true;
      else
        reset role;
        raise;
      end if;
  end;
  reset role;

  if not v_not_found then
    raise exception 'un membre du tenant B a pu convertir un devis du tenant A (attendu : quote.not_found)';
  end if;
end;
$$;

-- ── 7. Immuabilite EN BASE ───────────────────────────────────────────────
do $$
declare
  v_order uuid;
  v_line_id uuid;
  v_blocked boolean;
begin
  select id into v_order from public.commercial_orders where quote_id = (select quote_sent from e10_12_context);
  select id into v_line_id from public.commercial_order_lines where order_id = v_order limit 1;

  v_blocked := false;
  begin
    update public.commercial_order_lines set sale_price = 1.00 where id = v_line_id;
  exception when others then
    if sqlerrm like 'order_line.immutable%' then v_blocked := true; else raise; end if;
  end;
  if not v_blocked then raise exception 'une ligne de commande a pu etre modifiee (UPDATE)'; end if;

  v_blocked := false;
  begin
    delete from public.commercial_order_lines where id = v_line_id;
  exception when others then
    if sqlerrm like 'order_line.immutable%' then v_blocked := true; else raise; end if;
  end;
  if not v_blocked then raise exception 'une ligne de commande a pu etre supprimee (DELETE)'; end if;

  v_blocked := false;
  begin
    update public.commercial_orders set net_total = 1.00 where id = v_order;
  exception when others then
    if sqlerrm like 'order.immutable%' then v_blocked := true; else raise; end if;
  end;
  if not v_blocked then raise exception 'une colonne figee de commande a pu etre modifiee (net_total)'; end if;

  v_blocked := false;
  begin
    delete from public.commercial_orders where id = v_order;
  exception when others then
    if sqlerrm like 'order.immutable%' then v_blocked := true; else raise; end if;
  end;
  if not v_blocked then raise exception 'une commande a pu etre supprimee directement (DELETE)'; end if;

  -- `status`/`updated_at` restent mutables (E10.13 y posera ses transitions) :
  -- ce test verifie que ce couple de colonnes N EST PAS bloque par erreur.
  update public.commercial_orders set status = 'validated' where id = v_order;
end;
$$;

-- ── 8. RLS — isolation inter-tenant en LECTURE ─────────────────────────────
do $$
declare
  v_actor_b uuid;
  v_visible_orders integer;
  v_visible_lines integer;
begin
  select actor_b into v_actor_b from e10_12_context;

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_b::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into v_visible_orders from public.commercial_orders;
  select count(*) into v_visible_lines from public.commercial_order_lines;
  reset role;

  if v_visible_orders <> 0 then
    raise exception 'le tenant B voit % commande(s) du tenant A — RLS commercial_orders_select rompue', v_visible_orders;
  end if;
  if v_visible_lines <> 0 then
    raise exception 'le tenant B voit % ligne(s) de commande du tenant A — RLS commercial_order_lines_select rompue', v_visible_lines;
  end if;
end;
$$;

-- ── 9. commercial_order_number_counters : deni total, meme authenticated ──
do $$
declare
  v_actor uuid;
  v_visible integer;
begin
  select actor_a into v_actor from e10_12_context;

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into v_visible from public.commercial_order_number_counters;
  reset role;

  if v_visible <> 0 then
    raise exception 'commercial_order_number_counters est lisible par authenticated (% ligne(s)) — RLS zero-policy rompue', v_visible;
  end if;
end;
$$;

-- ── 10. GUC de transition/change_set VIDES apres tous les appels ci-dessus ─
do $$
declare
  v_transition text;
  v_change_set text;
begin
  v_transition := current_setting('magrit.quote_transition', true);
  v_change_set := current_setting('magrit.change_set_id', true);

  if v_transition is not null and v_transition <> '' then
    raise exception 'magrit.quote_transition encore % apres les appels de api_convert_commercial_quote (attendu vide/NULL)', v_transition;
  end if;
  if v_change_set is not null and v_change_set <> '' then
    raise exception 'magrit.change_set_id encore % apres les appels de api_convert_commercial_quote (attendu vide/NULL)', v_change_set;
  end if;
end;
$$;

rollback;

-- ============================================================================
-- ── 11. CONCURRENCE REELLE — deux SESSIONS Postgres separees ────────────────
-- (qa-review round 1, correctif B1). Utilise l extension contrib `dblink`
-- pour ouvrir DEUX connexions Postgres independantes depuis ce script et les
-- orchestrer de facon ASYNCHRONE (`dblink_send_query`/`dblink_get_result`,
-- PAS `dblink()`/`dblink_exec()` seuls, qui sont bloquants et empecheraient
-- tout entrelacement reel) : c est la seule facon d obtenir un veritable
-- verrou de ligne tenu par une transaction PENDANT qu une autre bloque
-- dessus, dans un fichier unique execute par un seul `psql`.
--
-- `:dblink_host`/`:dblink_password` sont fournis par `scripts/
-- test-storefront-sql.sh` (`-v dblink_host=... -v dblink_password=...`,
-- lus dynamiquement depuis le conteneur Docker local — jamais une valeur en
-- dur : R5, aucun secret commis). La substitution psql `:'var'` ne
-- fonctionne PAS a l interieur d un bloc `do $$ ... $$;` (dollar-quoting) :
-- elle est donc faite ICI, en SQL top-level, dans un `insert` qui alimente
-- une table temporaire lue ensuite par les blocs `do`.
-- ============================================================================

create extension if not exists dblink with schema extensions;

create temporary table e10_12_race_context (
  connstr    text,
  tenant_id  uuid,
  actor_id   uuid,
  quote_id   uuid,
  token      text
);

insert into e10_12_race_context (connstr) values (
  format('dbname=postgres user=postgres password=%s host=%s', :'dblink_password', :'dblink_host')
);

-- Bloc A : fixtures — un devis `sent`, un compte boutique actif (session
-- directe) capable de l accepter, un membre du tenant capable de le
-- convertir. Statement top-level AUTONOME (autocommit) : COMMITE avant le
-- bloc B, donc visible des deux connexions dblink separees qu il ouvrira.
do $$
declare
  v_actor uuid := gen_random_uuid();
  v_tenant uuid;
  v_shop uuid;
  v_customer uuid;
  v_contact uuid;
  v_account uuid;
  v_project uuid;
  v_quote uuid;
  v_token text;
begin
  insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
    values (v_actor, 'e10-12-race-actor@example.test', 'x', now(), now(), now(), 'authenticated', 'authenticated');

  insert into public.tenants (slug, name) values ('e10-12-race-tenant', 'E10.12 Race Tenant') returning id into v_tenant;
  -- `member`, PAS `admin` : meme discipline que le fixture des scenarios
  -- 1-10 (decision #9 du contrat, aucune garde de capability).
  insert into public.tenant_members (tenant_id, user_id, role, access_scope, allowed_shop_ids)
    values (v_tenant, v_actor, 'member', 'magrit_full', '{}');
  insert into public.shops (owner_user_id, tenant_id, name, slug)
    values (v_actor, v_tenant, 'E10.12 Race Boutique', 'e10-12-race-boutique') returning id into v_shop;
  insert into public.customers (tenant_id, type, company_name, siret)
    values (v_tenant, 'company', 'E10.12 Race Client', '73282932000074') returning id into v_customer;
  insert into public.customer_contacts (customer_id, first_name, last_name, email)
    values (v_customer, 'Contact', 'Race', 'contact.race.e10-12@example.test') returning id into v_contact;
  insert into public.shop_customer_accounts (shop_id, email, full_name, status, activated_at, customer_contact_id)
    values (v_shop, 'account.race.e10-12@example.test', 'Compte Race Decideur', 'active', now(), v_contact)
    returning id into v_account;
  select encode(extensions.gen_random_bytes(32), 'hex') into v_token;
  insert into private.shop_customer_sessions (shop_customer_account_id, shop_id, token_hash, expires_at, session_kind)
    values (v_account, v_shop, extensions.digest(convert_to(v_token, 'UTF8'), 'sha256'), now() + interval '1 hour', 'direct');
  insert into public.projects (tenant_id, customer_id, name) values (v_tenant, v_customer, 'Projet Race') returning id into v_project;
  insert into public.commercial_quotes (tenant_id, customer_id, project_id, number, status, valid_until, show_discounts)
    values (v_tenant, v_customer, v_project, 'DEV-2026-93001', 'draft', '2099-01-01', true)
    returning id into v_quote;
  insert into public.commercial_quote_lines (quote_id, project_item_id, origin, label, quantity, position, production_price, public_price, customer_price, applied_margin_rate, sale_price, discount_rate, breakdown)
    values (v_quote, null, 'free', 'Article Race', 1, 0, 100.00, 200.00, 200.00, 1.0000, 200.00, 0.0000, '[{"post":"total","cost":"100.00","margin_rate":"1.0000","price":"200.00","source":"prix_marche"}]'::jsonb);
  perform set_config('magrit.quote_transition', 'true', true);
  update public.commercial_quotes set status = 'sent', sent_at = now() - interval '1 day' where id = v_quote;
  perform set_config('magrit.quote_transition', '', true);

  update e10_12_race_context set
    tenant_id = v_tenant, actor_id = v_actor, quote_id = v_quote, token = v_token;
end;
$$;

-- Bloc B : la course. Nettoyage GARANTI (bloc EXCEPTION) meme si l assertion
-- finale echoue — sinon une regression laisserait des fixtures orphelines en
-- base locale a chaque execution ratee.
do $$
declare
  v_connstr text;
  v_tenant uuid;
  v_actor uuid;
  v_quote uuid;
  v_token text;
  v_order_id uuid;
  v_source_status text;
  v_transition text;
  v_change_set text;
begin
  select connstr, tenant_id, actor_id, quote_id, token
    into v_connstr, v_tenant, v_actor, v_quote, v_token
  from e10_12_race_context;

  perform extensions.dblink_connect('race_client', v_connstr);
  perform extensions.dblink_connect('race_atelier', v_connstr);

  -- ── Session CLIENT : accepte le devis, PREND le verrou de ligne (l UPDATE
  --    interne a api_decide_storefront_quote), puis TIENT la transaction
  --    ouverte (aucun commit) le temps que la session ATELIER, ci-dessous,
  --    ait engage sa propre tentative et se soit mise en attente dessus.
  perform extensions.dblink_exec('race_client', 'begin');
  perform extensions.dblink_exec('race_client', 'set local role anon');
  perform 1 from extensions.dblink(
    'race_client',
    format('select * from public.api_decide_storefront_quote(%L, %L::uuid, %L)', v_token, v_quote, 'accepted')
  ) as t(id uuid, customer_id uuid);

  -- ── Session ATELIER : ENVOI ASYNCHRONE (dblink_send_query) de la
  --    conversion — elle bloque reellement sur `SELECT ... FOR UPDATE`
  --    (la ligne est verrouillee, non commitee, par la session CLIENT
  --    ci-dessus), SANS bloquer cette session orchestratrice.
  perform extensions.dblink_exec('race_atelier', 'begin');
  perform extensions.dblink_exec('race_atelier', 'set local role authenticated');
  perform 1 from extensions.dblink(
    'race_atelier',
    format('select set_config(%L, %L, true)', 'request.jwt.claims', json_build_object('sub', v_actor::text, 'role', 'authenticated')::text)
  ) as t(result text);
  perform extensions.dblink_send_query(
    'race_atelier',
    format('select public.api_convert_commercial_quote(%L::uuid, %L::uuid)', v_tenant, v_quote)
  );

  -- Laisse la session ATELIER atteindre reellement son attente sur le
  -- verrou (elle ne peut pas avoir progresse plus loin : le verrou est tenu
  -- depuis l UPDATE execute dans le bloc CLIENT, AVANT ce sleep).
  perform pg_sleep(0.5);

  -- Le CLIENT committe SEULEMENT MAINTENANT : le verrou se libere, la
  -- session ATELIER (bloquee sur `FOR UPDATE`) peut alors relire — sous
  -- attente de verrou puis lecture standard READ COMMITTED — la version la
  -- PLUS RECENTE COMMITEE, celle que le CLIENT vient de poser (`accepted`),
  -- jamais celle vue avant ce commit.
  perform extensions.dblink_exec('race_client', 'commit');

  -- Recupere le resultat ASYNCHRONE de la session ATELIER (bloque jusqu a
  -- ce que la conversion, debloquee par le commit ci-dessus, se termine) et
  -- draine l appel jusqu a NULL (discipline dblink_get_result standard).
  select result into v_order_id from extensions.dblink_get_result('race_atelier') as t(result uuid);
  perform extensions.dblink_get_result('race_atelier');
  perform extensions.dblink_exec('race_atelier', 'commit');

  perform extensions.dblink_disconnect('race_client');
  perform extensions.dblink_disconnect('race_atelier');

  if v_order_id is null then
    raise exception 'la conversion concurrente n a rendu aucun id de commande';
  end if;

  select source_quote_status into v_source_status
  from public.commercial_orders where id = v_order_id;

  if v_source_status is distinct from 'accepted' then
    raise exception 'B1 (qa-review round 1) : source_quote_status enregistre = %, attendu accepted — le client avait COMMITE sa decision AVANT que la conversion ne prenne effet sous le verrou ; ''sent'' serait la valeur PERIMEE que l ancien patron CTE (previous/transitioned) aurait enregistree a tort', v_source_status;
  end if;

  -- Meme discipline B7 (scenario 10) : les DEUX GUC doivent etre vides apres
  -- cet appel concurrent aussi, pas seulement sous appel sequentiel.
  v_transition := current_setting('magrit.quote_transition', true);
  v_change_set := current_setting('magrit.change_set_id', true);
  if (v_transition is not null and v_transition <> '') or (v_change_set is not null and v_change_set <> '') then
    raise exception 'GUC magrit.quote_transition/change_set_id non vides apres la conversion concurrente (% / %)', v_transition, v_change_set;
  end if;

  delete from public.tenants where id = v_tenant;
  delete from auth.users where id = v_actor;
exception
  when others then
    -- Nettoyage best-effort AVANT propagation : une assertion en echec ne
    -- doit pas laisser de fixtures orphelines pour l execution suivante.
    begin
      perform extensions.dblink_disconnect('race_client');
    exception when others then null;
    end;
    begin
      perform extensions.dblink_disconnect('race_atelier');
    exception when others then null;
    end;
    delete from public.tenants where id = v_tenant;
    delete from auth.users where id = v_actor;
    raise;
end;
$$;

drop table e10_12_race_context;
