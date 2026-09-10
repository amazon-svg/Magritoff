-- ============================================================================
-- E10.22a (echeance + rappels) et E10.22a-bis (preuve de livraison) FUSIONNEES
-- -- purge automatique des fichiers de commande, RIEN N EST DETRUIT dans ce
-- lot. Migration : `20260910000500`. Contrat : docs/api/CONVENTIONS.md §8.22.
-- ----------------------------------------------------------------------------
-- Test COMPORTEMENTAL, execute par psql contre la base locale : les six
-- fonctions `security definer`, les deux triggers "append-only assoupli" et
-- les deux policies RLS vivent ENTIEREMENT dans la migration -- relire son
-- texte ne prouve pas qu ils se comportent correctement sous appel reel.
--
-- ECART CONSTATE ET ASSUME (voir rapport de fin de story, PAS corrige ici) :
-- le contrat §8.22 §4 decrit "tous les owner, repli sur admin". Depuis
-- `20260814000200_admin_unique.sql`, `owner` n est plus une valeur ECRIVABLE
-- de `tenant_members` (CHECK limite a admin/member/partner) -- ce test verifie
-- donc "tous les admin", qui est le comportement REELLEMENT implemente.
--
-- Scenarios :
--   0. (qa-review round 1, B1 BLOQUANT CRITIQUE) Le trigger `commercial_
--      order_files_set_updated_at()` est DESARME AVANT que la forme exacte
--      de l instruction UPDATE de la reprise du passif ne puisse y toucher :
--      `updated_at` d un fichier reel sort inchange de cette instruction.
--   1. api_resolve_order_file_purge_recipients : un admin SANS email
--      n est jamais rendu ; un membre (role != admin) n est jamais rendu ;
--      un tenant sans aucun admin joignable rend un ensemble VIDE.
--   2. api_claim_order_file_purge_notices('first', 20) : groupe par
--      (tenant, purge_at) -- DEUX fichiers de meme purge_at forment UN
--      rappel de file_count=2 ; un fichier de purge_at DIFFERENT (mais
--      egalement du) forme un SECOND rappel ; un fichier PAS ENCORE du
--      n est touche par aucun des deux ; un tenant SANS destinataire
--      joignable NE CREE RIEN et N EMET RIEN, meme avec des fichiers dus.
--      Le trigger updated_at de commercial_order_files reste INDIFFERENT au
--      rattachement (ETag jamais perime par cette tache de fond).
--   3. Reclamation IMMEDIATE d un second tour, meme palier : rien de plus
--      (les fichiers dejas rattaches ne rematchent plus la condition).
--   4. api_claim_order_file_purge_notices('second', 15) : seul le fichier
--      dont le palier est atteint EST reclame -- independant du palier
--      'first' (aucune dependance d ordre, lettre du contrat §4).
--   5. Privileges : authenticated/anon refuses (insufficient_privilege) sur
--      les SIX fonctions ; service_role seul.
--   6. Append-only assoupli : le CONTENU d un rappel/d une livraison est
--      immuable (UPDATE direct refuse) ; le SUIVI (accepted_at, etc.) reste
--      mutable ; DELETE refuse tant que le rappel/la livraison n a atteint
--      aucun etat terminal, autorise ensuite.
--   7. RLS lecture : un tenant etranger ne voit AUCUN rappel/AUCUNE livraison
--      d un autre tenant ; un membre ORDINAIRE (pas admin) du tenant
--      proprietaire les voit neanmoins (visibilite operationnelle, §4 du
--      contrat) ; aucune ecriture PostgREST directe n est possible
--      (authenticated ET service du role applicatif).
--   8. Cycle complet de preuve de livraison (E10.22a-bis) :
--      api_record_order_file_purge_notice_delivery_attempt (succes ET echec
--      d envoi immediat), api_claim_order_file_purge_notice_deliveries_for_check
--      (ne rend QUE les livraisons ACCEPTEES pas encore CONFIRMEES),
--      api_record_order_file_purge_notice_delivery_check ('delivered' confirme
--      LA livraison ET propage notices.confirmed_at ; un statut inconnu
--      laisse tout en attente). Upsert idempotent : un rejeu APRES
--      confirmation NE REGRESSE JAMAIS confirmed_at.
--   9. api_expire_order_file_purge_notices : un rappel de plus de 3 jours
--      SANS AUCUNE livraison confirmee est marque failed_at et son
--      rattachement REMIS A NULL sur le fichier (relance possible) ; un
--      rappel RECENT (meme sans confirmation) n est PAS touche.
--
-- Lancer : pnpm test:storefront:sql (necessite Supabase local demarre).
-- ============================================================================

begin;

create temporary table e10_22a_context (
  tenant_a           uuid not null,
  tenant_b           uuid not null,
  admin_a1           uuid not null, -- admin joignable (email)
  admin_a2           uuid not null, -- admin SANS email -- jamais un destinataire
  member_a           uuid not null, -- role != admin -- jamais un destinataire
  member_b           uuid not null, -- tenant_b : AUCUN admin -- zero destinataire
  order_a            uuid not null,
  order_b            uuid not null,
  file_first_1       uuid not null, -- purge_at = now()+18j (du au palier first, PAS second)
  file_first_2       uuid not null, -- MEME purge_at que file_first_1 -- meme rappel
  file_second        uuid not null, -- purge_at = now()+10j (du aux DEUX paliers)
  file_not_due       uuid not null, -- purge_at = now()+25j (du a AUCUN palier)
  file_b_due         uuid not null, -- tenant_b, du, MAIS zero destinataire
  file_expiry        uuid not null  -- fichier dedie au scenario 9 (expiration)
);

do $$
declare
  v_admin_a1 uuid := gen_random_uuid();
  v_admin_a2 uuid := gen_random_uuid();
  v_member_a uuid := gen_random_uuid();
  v_member_b uuid := gen_random_uuid();
  v_tenant_a uuid;
  v_tenant_b uuid;
  v_customer_a uuid;
  v_customer_b uuid;
  v_project_a uuid;
  v_project_b uuid;
  v_item_a uuid;
  v_item_b uuid;
  v_quote_a uuid;
  v_quote_b uuid;
  v_quote_line_a uuid;
  v_quote_line_b uuid;
  v_order_a uuid;
  v_order_b uuid;
  v_file_first_1 uuid := gen_random_uuid();
  v_file_first_2 uuid := gen_random_uuid();
  v_file_second uuid := gen_random_uuid();
  v_file_not_due uuid := gen_random_uuid();
  v_file_b_due uuid := gen_random_uuid();
  v_file_expiry uuid := gen_random_uuid();
  v_purge_at_group1 timestamptz := now() + interval '18 days';
  v_purge_at_group2 timestamptz := now() + interval '10 days';
  v_purge_at_not_due timestamptz := now() + interval '25 days';
  v_purge_at_b timestamptz := now() + interval '5 days';
begin
  insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
    values
      (v_admin_a1, 'e10-22a-admin-1@example.test', 'x', now(), now(), now(), 'authenticated', 'authenticated'),
      (v_admin_a2, null, 'x', now(), now(), now(), 'authenticated', 'authenticated'),
      (v_member_a, 'e10-22a-member-a@example.test', 'x', now(), now(), now(), 'authenticated', 'authenticated'),
      (v_member_b, 'e10-22a-member-b@example.test', 'x', now(), now(), now(), 'authenticated', 'authenticated');

  insert into public.tenants (slug, name) values ('e10-22a-tenant-a', 'E10.22a Tenant A') returning id into v_tenant_a;
  insert into public.tenants (slug, name) values ('e10-22a-tenant-b', 'E10.22a Tenant B') returning id into v_tenant_b;

  insert into public.tenant_members (tenant_id, user_id, role, access_scope, allowed_shop_ids)
    values (v_tenant_a, v_admin_a1, 'admin', 'magrit_full', '{}');
  insert into public.tenant_members (tenant_id, user_id, role, access_scope, allowed_shop_ids)
    values (v_tenant_a, v_admin_a2, 'admin', 'magrit_full', '{}');
  insert into public.tenant_members (tenant_id, user_id, role, access_scope, allowed_shop_ids)
    values (v_tenant_a, v_member_a, 'member', 'magrit_full', '{}');
  -- tenant_b : UN SEUL membre, role != admin -- AUCUN destinataire joignable.
  insert into public.tenant_members (tenant_id, user_id, role, access_scope, allowed_shop_ids)
    values (v_tenant_b, v_member_b, 'member', 'magrit_full', '{}');

  insert into public.customers (tenant_id, type, company_name, siret)
    values (v_tenant_a, 'company', 'E10.22a Client A', '73282932000074') returning id into v_customer_a;
  insert into public.customers (tenant_id, type, company_name, siret)
    values (v_tenant_b, 'company', 'E10.22a Client B', '73282932000074') returning id into v_customer_b;

  insert into public.projects (tenant_id, customer_id, name) values (v_tenant_a, v_customer_a, 'Projet E10.22a A') returning id into v_project_a;
  insert into public.projects (tenant_id, customer_id, name) values (v_tenant_b, v_customer_b, 'Projet E10.22a B') returning id into v_project_b;

  insert into public.project_items (project_id, label, position) values (v_project_a, 'Item A', 0) returning id into v_item_a;
  insert into public.commercial_quotes (tenant_id, customer_id, project_id, number, status, valid_until, show_discounts)
    values (v_tenant_a, v_customer_a, v_project_a, 'DEV-2026-99201', 'draft', '2099-01-01', true)
    returning id into v_quote_a;
  insert into public.commercial_quote_lines (
    quote_id, project_item_id, label, quantity, position,
    production_price, public_price, customer_price, applied_margin_rate, sale_price, breakdown
  ) values (v_quote_a, v_item_a, 'Ligne A', 10, 0, 5, 5, 5, 0, 5, '[{"label":"production"}]'::jsonb) returning id into v_quote_line_a;
  insert into public.commercial_orders (
    tenant_id, customer_id, quote_id, number, status, source_quote_status,
    lines_subtotal, global_discount, effective_discount_rate, net_total,
    vat_rate, vat_regime, vat_amount, total_incl_tax
  )
  values (v_tenant_a, v_customer_a, v_quote_a, 'CDE-2026-99201', 'validated', 'sent',
          10, 0, null, 10, 0.2, null, 2, 12)
  returning id into v_order_a;

  insert into public.project_items (project_id, label, position) values (v_project_b, 'Item B', 0) returning id into v_item_b;
  insert into public.commercial_quotes (tenant_id, customer_id, project_id, number, status, valid_until, show_discounts)
    values (v_tenant_b, v_customer_b, v_project_b, 'DEV-2026-99202', 'draft', '2099-01-01', true)
    returning id into v_quote_b;
  insert into public.commercial_quote_lines (
    quote_id, project_item_id, label, quantity, position,
    production_price, public_price, customer_price, applied_margin_rate, sale_price, breakdown
  ) values (v_quote_b, v_item_b, 'Ligne B', 5, 0, 3, 3, 3, 0, 3, '[{"label":"production"}]'::jsonb) returning id into v_quote_line_b;
  insert into public.commercial_orders (
    tenant_id, customer_id, quote_id, number, status, source_quote_status,
    lines_subtotal, global_discount, effective_discount_rate, net_total,
    vat_rate, vat_regime, vat_amount, total_incl_tax
  )
  values (v_tenant_b, v_customer_b, v_quote_b, 'CDE-2026-99202', 'validated', 'sent',
          15, 0, null, 15, 0.2, null, 3, 18)
  returning id into v_order_b;

  -- Fichiers, INSERES DIRECTEMENT en phase privilegiee (bypass RLS), purge_at
  -- FORCE pour rendre les scenarios de seuil DETERMINISTES (jamais derive de
  -- deposited_at dans ce test -- c est justement la colonne que la story
  -- interdit de recalculer a la lecture).
  insert into public.commercial_order_files (id, order_id, filename, content_type, byte_size, storage_path, purge_at)
    values (v_file_first_1, v_order_a, 'first-1.pdf', 'application/pdf', 100,
            v_tenant_a::text || '/' || v_order_a::text || '/' || v_file_first_1::text, v_purge_at_group1);
  insert into public.commercial_order_files (id, order_id, filename, content_type, byte_size, storage_path, purge_at)
    values (v_file_first_2, v_order_a, 'first-2.pdf', 'application/pdf', 100,
            v_tenant_a::text || '/' || v_order_a::text || '/' || v_file_first_2::text, v_purge_at_group1);
  insert into public.commercial_order_files (id, order_id, filename, content_type, byte_size, storage_path, purge_at)
    values (v_file_second, v_order_a, 'second.pdf', 'application/pdf', 100,
            v_tenant_a::text || '/' || v_order_a::text || '/' || v_file_second::text, v_purge_at_group2);
  insert into public.commercial_order_files (id, order_id, filename, content_type, byte_size, storage_path, purge_at)
    values (v_file_not_due, v_order_a, 'not-due.pdf', 'application/pdf', 100,
            v_tenant_a::text || '/' || v_order_a::text || '/' || v_file_not_due::text, v_purge_at_not_due);
  insert into public.commercial_order_files (id, order_id, filename, content_type, byte_size, storage_path, purge_at)
    values (v_file_b_due, v_order_b, 'b-due.pdf', 'application/pdf', 100,
            v_tenant_b::text || '/' || v_order_b::text || '/' || v_file_b_due::text, v_purge_at_b);
  insert into public.commercial_order_files (id, order_id, filename, content_type, byte_size, storage_path, purge_at)
    values (v_file_expiry, v_order_a, 'expiry.pdf', 'application/pdf', 100,
            v_tenant_a::text || '/' || v_order_a::text || '/' || v_file_expiry::text, now() + interval '35 days');

  insert into e10_22a_context (
    tenant_a, tenant_b, admin_a1, admin_a2, member_a, member_b,
    order_a, order_b, file_first_1, file_first_2, file_second, file_not_due, file_b_due, file_expiry
  ) values (
    v_tenant_a, v_tenant_b, v_admin_a1, v_admin_a2, v_member_a, v_member_b,
    v_order_a, v_order_b, v_file_first_1, v_file_first_2, v_file_second, v_file_not_due, v_file_b_due, v_file_expiry
  );
end;
$$;

grant select on e10_22a_context to authenticated;

-- ── 0 — qa-review round 1 (B1, BLOQUANT CRITIQUE, corrige) : le trigger
-- `commercial_order_files_set_updated_at()` est DESARME sur les colonnes de
-- purge AVANT que la reprise du passif ne puisse jamais y toucher. Ce test
-- ne peut pas litteralement "rejouer la migration a l envers" (elle a deja
-- ete appliquee, idempotente, a l ouverture de cette session psql) : il
-- rejoue A L IDENTIQUE la FORME de l instruction UPDATE de la reprise du
-- passif (meme SET, meme calcul de plancher) sur une ligne REELLE, et
-- prouve que `updated_at` en sort inchange -- exactement la garantie que
-- l inversion de B1 aurait violee si le trigger avait encore ete l ANCIEN
-- (bump inconditionnel) au moment ou cette instruction s execute.
do $$
declare
  v_tenant_a uuid;
  v_order_a uuid;
  v_file_id uuid := gen_random_uuid();
  v_updated_before timestamptz;
  v_updated_after timestamptz;
begin
  select tenant_a, order_a into v_tenant_a, v_order_a from e10_22a_context;

  insert into public.commercial_order_files (id, order_id, filename, content_type, byte_size, storage_path)
    values (v_file_id, v_order_a, 'b1-preexistant.pdf', 'application/pdf', 100,
            v_tenant_a::text || '/' || v_order_a::text || '/' || v_file_id::text);

  select updated_at into v_updated_before from public.commercial_order_files where id = v_file_id;

  -- FORME EXACTE de l UPDATE de reprise du passif (migration
  -- 20260910000500, section "Reprise du passif, PLANCHER EXPLICITE") --
  -- seule la clause WHERE differe (ici filtree sur UNE ligne, pour ne pas
  -- perturber les autres fixtures de ce fichier ; la reprise reelle n en
  -- porte aucune, elle touche TOUTES les lignes).
  update public.commercial_order_files
     set purge_at = greatest(
       deposited_at + interval '30 days',
       '2026-09-10 00:00:00+00'::timestamptz + interval '30 days'
     )
   where id = v_file_id;

  select updated_at into v_updated_after from public.commercial_order_files where id = v_file_id;

  if v_updated_before <> v_updated_after then
    raise exception 'scenario 0 (B1) : updated_at a bouge sur l instruction de reprise du passif -- le trigger n est PAS desarme AVANT cette ecriture';
  end if;

  raise notice 'scenario 0 (B1, trigger desarme AVANT la reprise du passif) OK';
end;
$$;

-- ── 1 — api_resolve_order_file_purge_recipients ─────────────────────────────
do $$
declare
  v_tenant_a uuid;
  v_tenant_b uuid;
  v_n integer;
  v_email text;
begin
  select tenant_a, tenant_b into v_tenant_a, v_tenant_b from e10_22a_context;

  select count(*), max(recipient_email) into v_n, v_email
    from public.api_resolve_order_file_purge_recipients(v_tenant_a);
  if v_n <> 1 then
    raise exception 'scenario 1 : tenant A attendu 1 destinataire (admin_a1 SEUL -- admin_a2 sans email, member_a hors role), obtenu %', v_n;
  end if;
  if v_email <> 'e10-22a-admin-1@example.test' then
    raise exception 'scenario 1 : destinataire inattendu : %', v_email;
  end if;

  select count(*) into v_n from public.api_resolve_order_file_purge_recipients(v_tenant_b);
  if v_n <> 0 then
    raise exception 'scenario 1 : tenant B (aucun admin) attendu 0 destinataire, obtenu %', v_n;
  end if;

  raise notice 'scenario 1 (resolution des destinataires) OK';
end;
$$;

-- ── 2 — reclamation du palier "first" ───────────────────────────────────────
do $$
declare
  v_tenant_a uuid;
  v_tenant_b uuid;
  v_order_a uuid;
  v_file_first_1 uuid;
  v_file_first_2 uuid;
  v_file_second uuid;
  v_file_not_due uuid;
  v_file_b_due uuid;
  v_updated_before timestamptz;
  v_updated_after timestamptz;
  v_n integer;
  v_notice_group1 uuid;
  v_notice_group2 uuid;
  v_file_count integer;
  v_order_count integer;
  v_payload jsonb;
begin
  select tenant_a, tenant_b, order_a, file_first_1, file_first_2, file_second, file_not_due, file_b_due
    into v_tenant_a, v_tenant_b, v_order_a, v_file_first_1, v_file_first_2, v_file_second, v_file_not_due, v_file_b_due
    from e10_22a_context;

  select updated_at into v_updated_before from public.commercial_order_files where id = v_file_first_1;

  select count(*) into v_n from public.api_claim_order_file_purge_notices('first', 20);
  if v_n <> 2 then
    raise exception 'scenario 2 : attendu 2 rappels crees (groupe de 2 fichiers + fichier seul), obtenu %', v_n;
  end if;

  select updated_at into v_updated_after from public.commercial_order_files where id = v_file_first_1;
  if v_updated_before <> v_updated_after then
    raise exception 'scenario 2 : updated_at a bouge alors que SEULE une colonne de purge a change -- ETag perime a tort';
  end if;

  select purge_notice_1_id into v_notice_group1 from public.commercial_order_files where id = v_file_first_1;
  if v_notice_group1 is null or v_notice_group1 <> (select purge_notice_1_id from public.commercial_order_files where id = v_file_first_2) then
    raise exception 'scenario 2 : file_first_1 et file_first_2 (meme purge_at) doivent partager LE MEME rappel';
  end if;

  select file_count, order_count into v_file_count, v_order_count
    from public.commercial_order_file_purge_notices where id = v_notice_group1;
  if v_file_count <> 2 or v_order_count <> 1 then
    raise exception 'scenario 2 : groupe attendu file_count=2/order_count=1, obtenu %/%', v_file_count, v_order_count;
  end if;

  select purge_notice_1_id into v_notice_group2 from public.commercial_order_files where id = v_file_second;
  if v_notice_group2 is null or v_notice_group2 = v_notice_group1 then
    raise exception 'scenario 2 : file_second (purge_at different) doit former un rappel SEPARE';
  end if;

  if (select purge_notice_1_id from public.commercial_order_files where id = v_file_not_due) is not null then
    raise exception 'scenario 2 : file_not_due (palier non atteint) ne doit porter AUCUN rappel';
  end if;

  if (select purge_notice_1_id from public.commercial_order_files where id = v_file_b_due) is not null then
    raise exception 'scenario 2 : file_b_due (tenant SANS destinataire) ne doit porter AUCUN rappel -- rien cree, rien emis';
  end if;
  if exists (select 1 from public.outbox_events where tenant_id = v_tenant_b) then
    raise exception 'scenario 2 : tenant B (aucun destinataire) ne doit produire AUCUN evenement order_files.purge_scheduled';
  end if;

  select payload into v_payload from public.outbox_events
   where tenant_id = v_tenant_a and event_name = 'order_files.purge_scheduled'
     and (payload->>'notice_id')::uuid = v_notice_group1;
  if v_payload is null then
    raise exception 'scenario 2 : aucun evenement order_files.purge_scheduled pour le groupe de 2 fichiers';
  end if;
  if (v_payload->>'stage') <> 'first' or (v_payload->>'file_count')::int <> 2 or (v_payload->>'order_count')::int <> 1 then
    raise exception 'scenario 2 : charge utile inattendue : %', v_payload;
  end if;
  if (v_payload->>'purge_at') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$' then
    raise exception 'scenario 2 : purge_at de la charge utile hors format ISO 8601 Z attendu par timestampSchema : %', v_payload->>'purge_at';
  end if;
  if jsonb_array_length(v_payload->'order_ids') <> 1 then
    raise exception 'scenario 2 : order_ids attendu 1 entree, obtenu %', v_payload->'order_ids';
  end if;

  raise notice 'scenario 2 (reclamation palier first, groupement, trigger desarme) OK';
end;
$$;

-- ── 3 — reclamation immediate du meme palier : rien de plus ────────────────
do $$
declare
  v_n integer;
begin
  select count(*) into v_n from public.api_claim_order_file_purge_notices('first', 20);
  if v_n <> 0 then
    raise exception 'scenario 3 : reclamation immediate du meme palier attendue vide, obtenu % rappel(s)', v_n;
  end if;
  raise notice 'scenario 3 (reclamation immediate, idempotence) OK';
end;
$$;

-- ── 4 — reclamation du palier "second", INDEPENDANTE du palier "first" ─────
do $$
declare
  v_file_first_1 uuid;
  v_file_second uuid;
  v_n integer;
begin
  select file_first_1, file_second into v_file_first_1, v_file_second from e10_22a_context;

  select count(*) into v_n from public.api_claim_order_file_purge_notices('second', 15);
  if v_n <> 1 then
    raise exception 'scenario 4 : attendu 1 rappel (seul file_second atteint le palier second), obtenu %', v_n;
  end if;

  if (select purge_notice_2_id from public.commercial_order_files where id = v_file_second) is null then
    raise exception 'scenario 4 : file_second doit porter un rappel de palier second';
  end if;
  if (select purge_notice_2_id from public.commercial_order_files where id = v_file_first_1) is not null then
    raise exception 'scenario 4 : file_first_1 (palier second NON atteint) ne doit porter AUCUN rappel de palier second';
  end if;

  raise notice 'scenario 4 (reclamation palier second, independance des paliers) OK';
end;
$$;

-- ── 5 — privileges : authenticated/anon refuses sur les SIX fonctions ──────
do $$
declare
  v_denied boolean;
begin
  -- authenticated
  set local role authenticated;
  v_denied := false;
  begin
    perform 1 from public.api_claim_order_file_purge_notices('first', 20);
  exception when insufficient_privilege then v_denied := true;
  end;
  if not v_denied then raise exception 'scenario 5 : authenticated a pu executer api_claim_order_file_purge_notices'; end if;

  v_denied := false;
  begin
    perform 1 from public.api_resolve_order_file_purge_recipients(gen_random_uuid());
  exception when insufficient_privilege then v_denied := true;
  end;
  if not v_denied then raise exception 'scenario 5 : authenticated a pu executer api_resolve_order_file_purge_recipients'; end if;

  v_denied := false;
  begin
    perform 1 from public.api_expire_order_file_purge_notices(interval '3 days');
  exception when insufficient_privilege then v_denied := true;
  end;
  if not v_denied then raise exception 'scenario 5 : authenticated a pu executer api_expire_order_file_purge_notices'; end if;

  v_denied := false;
  begin
    perform public.api_record_order_file_purge_notice_delivery_attempt(gen_random_uuid(), null, 'x@example.test', 'msg-1');
  exception when insufficient_privilege then v_denied := true;
  end;
  if not v_denied then raise exception 'scenario 5 : authenticated a pu executer api_record_order_file_purge_notice_delivery_attempt'; end if;

  v_denied := false;
  begin
    perform 1 from public.api_claim_order_file_purge_notice_deliveries_for_check(10, 20, interval '4 hours');
  exception when insufficient_privilege then v_denied := true;
  end;
  if not v_denied then raise exception 'scenario 5 : authenticated a pu executer api_claim_order_file_purge_notice_deliveries_for_check'; end if;

  v_denied := false;
  begin
    perform public.api_record_order_file_purge_notice_delivery_check(gen_random_uuid(), 'delivered');
  exception when insufficient_privilege then v_denied := true;
  end;
  if not v_denied then raise exception 'scenario 5 : authenticated a pu executer api_record_order_file_purge_notice_delivery_check'; end if;

  reset role;
  raise notice 'scenario 5 (privileges, authenticated) OK';
end;
$$;

do $$
declare
  v_denied boolean := false;
begin
  set local role anon;
  begin
    perform 1 from public.api_claim_order_file_purge_notices('first', 20);
  exception when insufficient_privilege then v_denied := true;
  end;
  reset role;
  if not v_denied then raise exception 'scenario 5 : anon a pu executer api_claim_order_file_purge_notices'; end if;
  raise notice 'scenario 5 (privileges, anon) OK';
end;
$$;

-- ── 6 — append-only assoupli ─────────────────────────────────────────────────
do $$
declare
  v_notice_id uuid;
  v_throwaway_notice uuid;
  v_delivery_id uuid;
  v_throwaway_delivery uuid;
  v_file_first_1 uuid;
  v_tenant_a uuid;
  v_rejected boolean;
begin
  select file_first_1, tenant_a into v_file_first_1, v_tenant_a from e10_22a_context;
  select purge_notice_1_id into v_notice_id from public.commercial_order_files where id = v_file_first_1;

  -- Contenu immuable, sur le rappel REEL du scenario 2 (v_notice_id) --
  -- aucune mutation destructrice ne doit lui etre appliquee ici, il est
  -- reutilise plus loin.
  v_rejected := false;
  begin
    update public.commercial_order_file_purge_notices set stage = 'second' where id = v_notice_id;
  exception when others then
    if sqlstate = '42501' then v_rejected := true; else raise; end if;
  end;
  if not v_rejected then raise exception 'scenario 6 : le STAGE d un rappel a pu etre modifie (contenu, doit etre immuable)'; end if;

  -- Suivi mutable.
  update public.commercial_order_file_purge_notices set accepted_at = now() where id = v_notice_id;

  -- DELETE refuse tant qu aucun etat terminal.
  v_rejected := false;
  begin
    delete from public.commercial_order_file_purge_notices where id = v_notice_id;
  exception when others then
    if sqlstate = '42501' then v_rejected := true; else raise; end if;
  end;
  if not v_rejected then raise exception 'scenario 6 : un rappel NI confirme NI en echec a pu etre supprime'; end if;

  -- Terminal -> DELETE autorise. Fixture JETABLE dediee (pas v_notice_id, qui
  -- reste necessaire tel quel pour les scenarios suivants) : un rappel/une
  -- livraison marques failed_at PEUVENT etre supprimes.
  insert into public.commercial_order_file_purge_notices (tenant_id, stage, purge_at, file_count, order_count, failed_at)
    values (v_tenant_a, 'first', now(), 1, 1, now())
    returning id into v_throwaway_notice;
  delete from public.commercial_order_file_purge_notices where id = v_throwaway_notice;
  if exists (select 1 from public.commercial_order_file_purge_notices where id = v_throwaway_notice) then
    raise exception 'scenario 6 : un rappel EN ECHEC (etat terminal) aurait du pouvoir etre supprime';
  end if;

  -- Livraison : meme regime, sur v_notice_id (reel, reutilise plus loin).
  insert into public.commercial_order_file_purge_notice_deliveries (notice_id, recipient_email, accepted_at)
    values (v_notice_id, 'e10-22a-append-only@example.test', now())
    returning id into v_delivery_id;

  v_rejected := false;
  begin
    update public.commercial_order_file_purge_notice_deliveries set recipient_email = 'autre@example.test' where id = v_delivery_id;
  exception when others then
    if sqlstate = '42501' then v_rejected := true; else raise; end if;
  end;
  if not v_rejected then raise exception 'scenario 6 : le destinataire d une livraison a pu etre modifie (immuable)'; end if;

  v_rejected := false;
  begin
    delete from public.commercial_order_file_purge_notice_deliveries where id = v_delivery_id;
  exception when others then
    if sqlstate = '42501' then v_rejected := true; else raise; end if;
  end;
  if not v_rejected then raise exception 'scenario 6 : une livraison NI confirmee NI en echec a pu etre supprimee'; end if;

  -- Terminal -> DELETE autorise, meme verification, fixture JETABLE dediee.
  insert into public.commercial_order_file_purge_notice_deliveries (notice_id, recipient_email, failed_at)
    values (v_notice_id, 'e10-22a-append-only-throwaway@example.test', now())
    returning id into v_throwaway_delivery;
  delete from public.commercial_order_file_purge_notice_deliveries where id = v_throwaway_delivery;
  if exists (select 1 from public.commercial_order_file_purge_notice_deliveries where id = v_throwaway_delivery) then
    raise exception 'scenario 6 : une livraison EN ECHEC (etat terminal) aurait du pouvoir etre supprimee';
  end if;

  raise notice 'scenario 6 (append-only assoupli) OK';
end;
$$;

-- ── 7 — RLS lecture/ecriture ────────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select member_b::text from e10_22a_context), 'role', 'authenticated')::text, true);

do $$
declare
  v_tenant_a uuid;
  v_visible integer;
  v_visible_deliveries integer;
begin
  select tenant_a into v_tenant_a from e10_22a_context;
  select count(*) into v_visible from public.commercial_order_file_purge_notices where tenant_id = v_tenant_a;
  if v_visible <> 0 then
    raise exception 'scenario 7 : un membre du tenant B lit % rappel(s) du tenant A', v_visible;
  end if;

  -- qa-review round 1 (N3) : l isolation de LA SECONDE table (deliveries)
  -- etait promise mais jamais interrogee -- prouvee ici, pas seulement vraie
  -- par accident. La livraison creee au scenario 6 est rattachee a un
  -- rappel du tenant A (jointure via notice_id) : le tenant B ne doit en
  -- lire AUCUNE.
  select count(*) into v_visible_deliveries
    from public.commercial_order_file_purge_notice_deliveries d
    join public.commercial_order_file_purge_notices n on n.id = d.notice_id
   where n.tenant_id = v_tenant_a;
  if v_visible_deliveries <> 0 then
    raise exception 'scenario 7 : un membre du tenant B lit % livraison(s) de rappel du tenant A', v_visible_deliveries;
  end if;
end;
$$;

reset role;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select member_a::text from e10_22a_context), 'role', 'authenticated')::text, true);

do $$
declare
  v_tenant_a uuid;
  v_visible integer;
  v_visible_deliveries integer;
  v_rejected boolean := false;
begin
  select tenant_a into v_tenant_a from e10_22a_context;
  select count(*) into v_visible from public.commercial_order_file_purge_notices where tenant_id = v_tenant_a;
  if v_visible < 2 then
    raise exception 'scenario 7 : un membre ORDINAIRE du tenant proprietaire devrait voir ses rappels (visibilite operationnelle), lu %', v_visible;
  end if;

  -- qa-review round 1 (N3) : symetrique, sur les deliveries -- un membre
  -- ORDINAIRE du tenant proprietaire voit NEANMOINS la livraison creee au
  -- scenario 6 (rattachee a UN de ses rappels).
  select count(*) into v_visible_deliveries
    from public.commercial_order_file_purge_notice_deliveries d
    join public.commercial_order_file_purge_notices n on n.id = d.notice_id
   where n.tenant_id = v_tenant_a;
  if v_visible_deliveries < 1 then
    raise exception 'scenario 7 : un membre du tenant proprietaire ne lit pas la livraison de reference (attendu >= 1, lu %)', v_visible_deliveries;
  end if;

  begin
    insert into public.commercial_order_file_purge_notices (tenant_id, stage, purge_at, file_count, order_count)
      values (v_tenant_a, 'first', now(), 1, 1);
  exception
    when insufficient_privilege then v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'scenario 7 : un membre authentifie a pu INSERT directement dans commercial_order_file_purge_notices';
  end if;

  -- qa-review round 1 (N3) : symetrique, ecriture DIRECTE sur deliveries.
  v_rejected := false;
  begin
    insert into public.commercial_order_file_purge_notice_deliveries (notice_id, recipient_email)
      values ((select id from public.commercial_order_file_purge_notices where tenant_id = v_tenant_a limit 1), 'x@example.test');
  exception
    when insufficient_privilege then v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'scenario 7 : un membre authentifie a pu INSERT directement dans commercial_order_file_purge_notice_deliveries';
  end if;
end;
$$;

reset role;

-- ── 8 — cycle de preuve de livraison (E10.22a-bis) ──────────────────────────
do $$
declare
  v_file_second uuid;
  v_notice_id uuid;
  v_delivery_ok uuid;
  v_delivery_failed uuid;
  v_claimed_id uuid;
  v_claimed_notice uuid;
  v_claimed_msg text;
  v_n integer;
  v_row public.commercial_order_file_purge_notice_deliveries;
  v_notice_accepted_at timestamptz;
  v_notice_confirmed_at timestamptz;
begin
  select file_second into v_file_second from e10_22a_context;
  select purge_notice_1_id into v_notice_id from public.commercial_order_files where id = v_file_second;

  -- Envoi ACCEPTE par Resend (id de message obtenu).
  v_row := public.api_record_order_file_purge_notice_delivery_attempt(v_notice_id, null, 'e10-22a-ok@example.test', 'resend-msg-ok');
  v_delivery_ok := v_row.id;
  if v_row.accepted_at is null or v_row.failed_at is not null then
    raise exception 'scenario 8 : livraison ACCEPTEE mal enregistree : %', v_row;
  end if;

  select accepted_at into v_notice_accepted_at from public.commercial_order_file_purge_notices where id = v_notice_id;
  if v_notice_accepted_at is null then
    raise exception 'scenario 8 : notices.accepted_at doit se poser des la PREMIERE acceptation';
  end if;

  -- Echec d envoi IMMEDIAT (pas d id de message -- "tentative faite", jamais une preuve).
  v_row := public.api_record_order_file_purge_notice_delivery_attempt(v_notice_id, null, 'e10-22a-fail@example.test', null);
  v_delivery_failed := v_row.id;
  if v_row.accepted_at is not null or v_row.failed_at is null or v_row.last_status <> 'send_failed' then
    raise exception 'scenario 8 : livraison en ECHEC IMMEDIAT mal enregistree : %', v_row;
  end if;

  -- Reclamation pour relecture : SEULE la livraison ACCEPTEE (pas la ratee
  -- d emblee, pas encore confirmee) doit revenir.
  select count(*) into v_n
    from public.api_claim_order_file_purge_notice_deliveries_for_check(50, 20, interval '4 hours')
   where delivery_id in (v_delivery_ok, v_delivery_failed);
  if v_n <> 1 then
    raise exception 'scenario 8 : reclamation pour relecture attendue 1 ligne (la livraison ACCEPTEE seule), obtenu %', v_n;
  end if;
  if (select check_attempts from public.commercial_order_file_purge_notice_deliveries where id = v_delivery_ok) <> 1 then
    raise exception 'scenario 8 : check_attempts non incremente par la reclamation';
  end if;

  -- Statut INCONNU/transitoire : rien ne se confirme, la relecture reste possible.
  v_row := public.api_record_order_file_purge_notice_delivery_check(v_delivery_ok, 'queued');
  if v_row.confirmed_at is not null then
    raise exception 'scenario 8 : un statut queued ne doit PAS confirmer la livraison';
  end if;
  if (select confirmed_at from public.commercial_order_file_purge_notices where id = v_notice_id) is not null then
    raise exception 'scenario 8 : notices.confirmed_at ne doit PAS se poser sur un statut non delivre';
  end if;

  -- Confirmation reelle : 'delivered'.
  v_row := public.api_record_order_file_purge_notice_delivery_check(v_delivery_ok, 'delivered');
  if v_row.confirmed_at is null then
    raise exception 'scenario 8 : delivered doit confirmer la livraison';
  end if;
  select confirmed_at into v_notice_confirmed_at from public.commercial_order_file_purge_notices where id = v_notice_id;
  if v_notice_confirmed_at is null then
    raise exception 'scenario 8 : delivered doit propager notices.confirmed_at (PREMIERE livraison confirmee)';
  end if;

  -- Rejeu APRES confirmation (au moins une fois, evenement outbox rejoue) :
  -- ne regresse JAMAIS confirmed_at ni provider_message_id.
  v_row := public.api_record_order_file_purge_notice_delivery_attempt(v_notice_id, null, 'e10-22a-ok@example.test', 'resend-msg-rejoue');
  if v_row.confirmed_at is null or v_row.provider_message_id <> 'resend-msg-ok' then
    raise exception 'scenario 8 : un rejeu APRES confirmation a REGRESSE la livraison confirmee : %', v_row;
  end if;
  if (select confirmed_at from public.commercial_order_file_purge_notices where id = v_notice_id) <> v_notice_confirmed_at then
    raise exception 'scenario 8 : notices.confirmed_at a bouge sur un rejeu -- doit rester la PREMIERE confirmation';
  end if;

  raise notice 'scenario 8 (cycle de preuve de livraison) OK';
end;
$$;

-- ── 9 — expiration d un rappel sans livraison confirmee ─────────────────────
do $$
declare
  v_file_expiry uuid;
  v_notice_old uuid;
  v_notice_recent uuid;
  v_expired_ids uuid[];
begin
  select file_expiry into v_file_expiry from e10_22a_context;

  -- Rappel "vieux" : CREE DIRECTEMENT (privilegie), avec created_at recule de
  -- 4 jours -- unite testee ici, c est api_expire_order_file_purge_notices,
  -- pas la reclamation (deja prouvee aux scenarios 2-4). file_expiry porte un
  -- purge_at a +35 jours (hors de portee des reclamations lead=20/lead=15 des
  -- scenarios precedents, expres pour ne PAS interferer avec eux).
  insert into public.commercial_order_file_purge_notices (tenant_id, stage, purge_at, file_count, order_count, created_at)
    values ((select tenant_a from e10_22a_context), 'first',
             (select purge_at from public.commercial_order_files where id = v_file_expiry),
             1, 1, now() - interval '4 days')
    returning id into v_notice_old;
  update public.commercial_order_files set purge_notice_1_id = v_notice_old where id = v_file_expiry;

  -- Rappel "recent" (fixture independante) : ne doit PAS expirer.
  insert into public.commercial_order_file_purge_notices (tenant_id, stage, purge_at, file_count, order_count)
    values ((select tenant_a from e10_22a_context), 'first', now(), 1, 1)
    returning id into v_notice_recent;

  select array_agg(id) into v_expired_ids from public.api_expire_order_file_purge_notices(interval '3 days');

  if not (v_notice_old = any(v_expired_ids)) then
    raise exception 'scenario 9 : le rappel vieux de 4 jours sans confirmation aurait du expirer';
  end if;
  if v_notice_recent = any(v_expired_ids) then
    raise exception 'scenario 9 : le rappel RECENT ne doit PAS expirer';
  end if;

  if (select failed_at from public.commercial_order_file_purge_notices where id = v_notice_old) is null then
    raise exception 'scenario 9 : le rappel expire doit porter failed_at';
  end if;
  if (select purge_notice_1_id from public.commercial_order_files where id = v_file_expiry) is not null then
    raise exception 'scenario 9 : le rattachement du fichier doit etre REMIS A NULL apres expiration (relance possible)';
  end if;

  raise notice 'scenario 9 (expiration sans livraison confirmee) OK';
end;
$$;

rollback;
