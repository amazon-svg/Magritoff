-- ============================================================================
-- E10.10a — statut/envoi (`draft` -> `sent`), renvoi, duplication, remise
-- globale, reglages commerciaux (`commercial_settings`), journal d audit de
-- l ENTETE (`commercial_quote_header_audit`).
-- ----------------------------------------------------------------------------
-- Test COMPORTEMENTAL, execute par psql contre la base locale (meme raison
-- que gescom-e10-9-quote-line-discounts.sql : une migration ne change jamais
-- apres coup, un `toContain()` sur son texte ne detecterait aucune
-- regression future sur un `drop policy`/`grant` mal repris).
--
-- ── Limite assumee (deja documentee ailleurs, gescom-e10-7-price-rules-
--    resolve.sql:125-126) : TOUTE cette suite s execute dans UNE SEULE
--    transaction (`begin; ... rollback;`), et Postgres `now()` renvoie l
--    instant de DEBUT de la transaction, invariable jusqu au COMMIT/ROLLBACK
--    — jamais l instant de l instruction. Un `pg_sleep()` entre deux appels
--    ne changerait que `clock_timestamp()`, jamais `now()`. Consequence :
--    `sent_at`/`last_sent_at`/`occurred_at` de deux ecritures distinctes dans
--    ce fichier peuvent avoir la MEME valeur — ce n est pas un defaut du
--    code sous test, c est une limite du harnais. Les assertions ci-dessous
--    portent donc sur des invariants STRUCTURELS (compte de lignes,
--    PRESENCE/ABSENCE d une action d audit, valeur INCHANGEE d une colonne
--    que la fonction ne touche pas) plutot que sur une progression d
--    horodatage, qui ne serait pas discriminante ici.
--
-- Scenarios :
--   1. `commercial_settings` : creation IMPLICITE a la premiere lecture (tout
--      membre), ecriture GARDEE par can_manage_pricing (E10.11), isolation
--      inter-tenant.
--   2. `api_send_commercial_quote`, premier envoi : transition vers `sent`,
--      `valid_until` calculee depuis `default_validity_days` (SEULEMENT si
--      encore NULL), entree d audit `sent` (snapshot) + `updated` (les
--      champs reellement changes), MEME change_set_id.
--   3. RENVOI (`sent` -> `sent`) : `sent_at` INCHANGE, une SEULE entree
--      `sent` existe jamais (jamais dupliquee), une entree `resent`
--      apparait ; un `show_discounts` DIVERGENT est rejete
--      (`quote.resend_immutable`), sans creer d entree.
--   3bis. IMMUABILITE d un devis `sent` (qa-review round 1, B3) : un UPDATE
--      DIRECT (hors `api_send_commercial_quote`/`api_duplicate_commercial_
--      quote`) sur un devis dont le statut COURANT n est pas `draft` est
--      REJETE par le trigger `commercial_quotes_require_draft_before_write`
--      — y compris pour redonner `draft` a un devis `sent` (le "degel" que la
--      RLS seule laissait passer avant ce trigger), et y compris pour une
--      colonne ordinaire (`global_discount_rate`) sans toucher au statut.
--   3ter. `status_forced` (qa-review round 2, B3 volet 3, docs/api/
--      CONVENTIONS.md §8.12ter) : (a) un PATCH direct `{"status":"accepted"}`
--      sur un devis encore `draft` (le trou precis laisse par le round 1, qui
--      ne regardait que le statut deja non-`draft`) est desormais REJETE EN
--      AMONT par la garde de prevention etendue, et ne produit AUCUNE entree
--      `status_forced` — bloquer vaut mieux que constater, la garde couvre ce
--      cas completement ; (b) le scenario RESIDUEL que `status_forced` vise
--      reellement : une session privilegiee qui desactive EXPLICITEMENT le
--      seul trigger de prevention (le journal d audit, lui, restant actif)
--      force malgre tout une trace exploitable ; (c) non-regression :
--      l envoi (scenario 2) ET le renvoi (scenario 3) normaux ne produisent
--      JAMAIS `status_forced`, seulement `sent`/`resent`.
--   4. Gardes : devis SANS ligne rejete (`quote.send_requires_lines`) ;
--      statut hors {`draft`,`sent`} rejete (`quote.send_forbidden_status`).
--   5. `api_duplicate_commercial_quote` : nouveau devis `draft`, nouveau
--      numero, `source_quote_id`, lignes recopiees a l IDENTIQUE (aucun
--      recalcul), `valid_until` REMISE a `null` meme si le source en portait
--      une, entree `duplicated` sur l ORIGINAL.
--   6. Contraintes `commercial_quotes_global_discount_exclusive` /
--      `_global_discount_rate_max` / `_vat_rate_non_negative` (qa-review
--      round 1, B1).
--   7. RLS — isolation inter-tenant de `commercial_quote_header_audit`
--      (lecture, garde can_manage_pricing comme le journal des lignes) et
--      append-only (UPDATE/DELETE directs rejetes pour `authenticated`).
--   8. Isolation inter-tenant des DEUX fonctions (`api_send_commercial_quote`/
--      `api_duplicate_commercial_quote`) : un acteur d un AUTRE tenant ne
--      peut ni envoyer ni dupliquer le devis du tenant A.
--   9. `api_commercial_quote_line_subtotals` (qa-review round 1, B2) :
--      agregation correcte, et isolation inter-tenant — un admin d un AUTRE
--      tenant ne lit aucune ligne, meme en fournissant un `p_tenant_id`
--      usurpe (RLS `security invoker`, independante du parametre fourni).
--
-- Lancer : pnpm test:storefront:sql (necessite Supabase local demarre).
-- ============================================================================

begin;

create temporary table e10_10a_context (
  actor_admin_a   uuid not null,
  actor_member_a  uuid not null,
  actor_admin_b   uuid not null,
  tenant_a        uuid not null,
  tenant_b        uuid not null,
  customer_a      uuid not null,
  project_a       uuid not null,
  quote_with_lines     uuid not null,
  quote_no_lines       uuid not null,
  quote_wrong_status   uuid not null,
  quote_status_forced  uuid not null,
  line_1          uuid not null
);

grant select on e10_10a_context to authenticated;

-- ── Phase privilegiee (role de connexion `postgres`) ────────────────────────
do $$
declare
  v_actor_admin_a uuid;
  v_actor_member_a uuid;
  v_actor_admin_b uuid;
  v_tenant_a uuid;
  v_tenant_b uuid;
  v_customer_a uuid;
  v_project_a uuid;
  v_quote_with_lines uuid;
  v_quote_no_lines uuid;
  v_quote_wrong_status uuid;
  v_quote_status_forced uuid;
  v_line_1 uuid;
begin
  select u.id into v_actor_admin_a
    from auth.users u
   where not exists (
     select 1 from public.tenant_members tm join public.tenants t on t.id = tm.tenant_id
      where tm.user_id = u.id and t.is_system_tenant = true and tm.role in ('owner', 'admin')
   )
   order by u.created_at limit 1;
  if v_actor_admin_a is null then
    raise exception 'Un utilisateur Auth non super-admin est requis (admin tenant A)';
  end if;

  select u.id into v_actor_member_a
    from auth.users u
   where u.id <> v_actor_admin_a
     and not exists (
       select 1 from public.tenant_members tm join public.tenants t on t.id = tm.tenant_id
        where tm.user_id = u.id and t.is_system_tenant = true and tm.role in ('owner', 'admin')
     )
   order by u.created_at limit 1;
  if v_actor_member_a is null then
    raise exception 'Un second utilisateur Auth non super-admin est requis (membre tenant A)';
  end if;

  select u.id into v_actor_admin_b
    from auth.users u
   where u.id not in (v_actor_admin_a, v_actor_member_a)
     and not exists (
       select 1 from public.tenant_members tm join public.tenants t on t.id = tm.tenant_id
        where tm.user_id = u.id and t.is_system_tenant = true and tm.role in ('owner', 'admin')
     )
   order by u.created_at limit 1;
  if v_actor_admin_b is null then
    raise exception 'Un troisieme utilisateur Auth non super-admin est requis (admin tenant B)';
  end if;

  insert into public.tenants (slug, name) values ('e10-10a-send-a', 'E10.10a Tenant A') returning id into v_tenant_a;
  insert into public.tenants (slug, name) values ('e10-10a-send-b', 'E10.10a Tenant B') returning id into v_tenant_b;

  -- Tous Magrit (`access_scope = 'magrit_full'`, le defaut) : `can_manage_
  -- pricing` du membre est donc bien DERIVE par role, jamais par affectation
  -- (meme raisonnement que le cas SQL E10.11).
  insert into public.tenant_members (tenant_id, user_id, role, access_scope, allowed_shop_ids)
  values (v_tenant_a, v_actor_admin_a, 'admin', 'magrit_full', '{}');
  insert into public.tenant_members (tenant_id, user_id, role, access_scope, allowed_shop_ids)
  values (v_tenant_a, v_actor_member_a, 'member', 'magrit_full', '{}');
  insert into public.tenant_members (tenant_id, user_id, role, access_scope, allowed_shop_ids)
  values (v_tenant_b, v_actor_admin_b, 'admin', 'magrit_full', '{}');

  insert into public.customers (tenant_id, type, company_name, siret)
  values (v_tenant_a, 'company', 'Tenant A Impression E10.10a', '73282932000074')
  returning id into v_customer_a;

  insert into public.projects (tenant_id, customer_id, name)
  values (v_tenant_a, v_customer_a, 'Projet E10.10a')
  returning id into v_project_a;

  -- Devis DRAFT avec une ligne (scenario 2/3/5).
  insert into public.commercial_quotes (tenant_id, customer_id, project_id, number, status, created_by)
  values (v_tenant_a, v_customer_a, v_project_a, 'DEV-9999-00201', 'draft', v_actor_admin_a)
  returning id into v_quote_with_lines;

  insert into public.commercial_quote_lines
    (quote_id, origin, project_item_id, label, quantity, production_price, public_price,
     customer_price, applied_margin_rate, sale_price, breakdown)
  values
    (v_quote_with_lines, 'free', null, 'Ligne E10.10a', 1, 100.00, 150.00, 150.00, 0.5000, 150.00,
     '[{"post":"total","cost":"100.00","margin_rate":"0.5000","price":"150.00","source":"clariprint"}]'::jsonb)
  returning id into v_line_1;

  -- Devis DRAFT SANS ligne (scenario 4a).
  insert into public.commercial_quotes (tenant_id, customer_id, project_id, number, status, created_by)
  values (v_tenant_a, v_customer_a, v_project_a, 'DEV-9999-00202', 'draft', v_actor_admin_a)
  returning id into v_quote_no_lines;

  -- Devis a un statut qui n autorise ni premier envoi ni renvoi (scenario 4b).
  insert into public.commercial_quotes (tenant_id, customer_id, project_id, number, status, created_by)
  values (v_tenant_a, v_customer_a, v_project_a, 'DEV-9999-00203', 'accepted', v_actor_admin_a)
  returning id into v_quote_wrong_status;

  -- Devis DRAFT dedie au scenario 3ter (status_forced) : independant de
  -- quote_with_lines, deja `sent` au moment ou 3ter s execute.
  insert into public.commercial_quotes (tenant_id, customer_id, project_id, number, status, created_by)
  values (v_tenant_a, v_customer_a, v_project_a, 'DEV-9999-00204', 'draft', v_actor_admin_a)
  returning id into v_quote_status_forced;

  insert into e10_10a_context
    (actor_admin_a, actor_member_a, actor_admin_b, tenant_a, tenant_b, customer_a, project_a,
     quote_with_lines, quote_no_lines, quote_wrong_status, quote_status_forced, line_1)
  values
    (v_actor_admin_a, v_actor_member_a, v_actor_admin_b, v_tenant_a, v_tenant_b, v_customer_a, v_project_a,
     v_quote_with_lines, v_quote_no_lines, v_quote_wrong_status, v_quote_status_forced, v_line_1);
end;
$$;

-- ── 1. commercial_settings : creation implicite, garde can_manage_pricing,
--      isolation inter-tenant. ───────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claim.sub', (select actor_member_a::text from e10_10a_context), true);

do $$
declare
  v_tenant_a uuid;
  v_settings jsonb;
  v_rejected boolean := false;
begin
  select tenant_a into v_tenant_a from e10_10a_context;

  -- Un membre SANS can_manage_pricing peut declencher la creation implicite
  -- (lecture ouverte a tout membre).
  select public.api_get_commercial_settings(v_tenant_a) into v_settings;
  if v_settings is null or (v_settings->>'default_validity_days') is not null then
    raise exception 'commercial_settings : creation implicite invalide (%).', v_settings;
  end if;

  -- Mais ne peut pas ECRIRE directement (RLS commercial_settings_write).
  begin
    update public.commercial_settings set default_validity_days = 10 where tenant_id = v_tenant_a;
  exception
    when insufficient_privilege then v_rejected := true;
  end;
  if not v_rejected then
    perform 1 from public.commercial_settings where tenant_id = v_tenant_a and default_validity_days = 10;
    if found then
      raise exception 'Un membre SANS can_manage_pricing a pu modifier commercial_settings';
    end if;
  end if;
end;
$$;

reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', (select actor_admin_a::text from e10_10a_context), true);

do $$
declare
  v_tenant_a uuid;
begin
  select tenant_a into v_tenant_a from e10_10a_context;
  -- Un admin (can_manage_pricing par derivation) PEUT ecrire directement.
  update public.commercial_settings set default_validity_days = 15 where tenant_id = v_tenant_a;
  perform 1 from public.commercial_settings where tenant_id = v_tenant_a and default_validity_days = 15;
  if not found then
    raise exception 'Un admin du tenant n a pas pu fixer default_validity_days a 15';
  end if;
end;
$$;

reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', (select actor_admin_b::text from e10_10a_context), true);

do $$
declare
  v_tenant_a uuid;
  v_visible integer;
  v_rejected boolean := false;
begin
  select tenant_a into v_tenant_a from e10_10a_context;

  select count(*) into v_visible from public.commercial_settings where tenant_id = v_tenant_a;
  if v_visible <> 0 then
    raise exception 'Un admin du tenant B lit % ligne(s) commercial_settings du tenant A', v_visible;
  end if;

  begin
    perform public.api_get_commercial_settings(v_tenant_a);
  exception
    when others then
      if sqlerrm like 'permission_denied%' then v_rejected := true;
      else raise;
      end if;
  end;
  if not v_rejected then
    raise exception 'Un admin du tenant B a pu lire/creer commercial_settings du tenant A via la fonction';
  end if;
end;
$$;

reset role;

-- ── 2. api_send_commercial_quote — PREMIER ENVOI ────────────────────────────
set local role authenticated;
select set_config('request.jwt.claim.sub', (select actor_admin_a::text from e10_10a_context), true);

do $$
declare
  v_tenant_a uuid;
  v_quote uuid;
  v_status text;
  v_sent_at timestamptz;
  v_last_sent_at timestamptz;
  v_sent_by uuid;
  v_valid_until date;
  v_actor_admin_a uuid;
  v_sent_count integer;
  v_updated_valid_until_count integer;
  v_change_set_sent uuid;
  v_change_set_updated uuid;
begin
  select tenant_a, quote_with_lines, actor_admin_a into v_tenant_a, v_quote, v_actor_admin_a from e10_10a_context;

  perform public.api_send_commercial_quote(v_tenant_a, v_quote, null, false);

  select status, sent_at, last_sent_at, sent_by, valid_until
    into v_status, v_sent_at, v_last_sent_at, v_sent_by, v_valid_until
    from public.commercial_quotes where id = v_quote;

  if v_status <> 'sent' then raise exception 'Premier envoi : statut attendu sent, obtenu %', v_status; end if;
  if v_sent_at is null then raise exception 'Premier envoi : sent_at non renseigne'; end if;
  if v_last_sent_at is distinct from v_sent_at then
    raise exception 'Premier envoi : last_sent_at (%) doit egaler sent_at (%)', v_last_sent_at, v_sent_at;
  end if;
  if v_sent_by is distinct from v_actor_admin_a then
    raise exception 'Premier envoi : sent_by attendu %, obtenu %', v_actor_admin_a, v_sent_by;
  end if;
  -- default_validity_days = 15 (fixe au scenario 1) : valid_until = date d envoi + 15.
  if v_valid_until is distinct from ((now() at time zone 'utc')::date + 15) then
    raise exception 'Premier envoi : valid_until attendue %, obtenue %',
      (now() at time zone 'utc')::date + 15, v_valid_until;
  end if;

  select count(*) into v_sent_count
    from public.commercial_quote_header_audit where quote_id = v_quote and action = 'sent';
  if v_sent_count <> 1 then raise exception 'Premier envoi : % entree(s) sent, 1 attendue', v_sent_count; end if;

  select count(*) into v_updated_valid_until_count
    from public.commercial_quote_header_audit
   where quote_id = v_quote and action = 'updated' and field = 'valid_until';
  if v_updated_valid_until_count <> 1 then
    raise exception 'Premier envoi : % entree(s) updated/valid_until, 1 attendue', v_updated_valid_until_count;
  end if;

  select change_set_id into v_change_set_sent
    from public.commercial_quote_header_audit where quote_id = v_quote and action = 'sent';
  select change_set_id into v_change_set_updated
    from public.commercial_quote_header_audit where quote_id = v_quote and action = 'updated' and field = 'valid_until';
  if v_change_set_sent is distinct from v_change_set_updated then
    raise exception 'Premier envoi : sent et updated/valid_until doivent partager le meme change_set_id';
  end if;

  perform 1 from public.commercial_quote_header_audit
   where quote_id = v_quote and action = 'sent' and quote_snapshot is not null
     and quote_snapshot ? 'quote' and quote_snapshot ? 'lines';
  if not found then
    raise exception 'Premier envoi : quote_snapshot doit porter quote ET lines';
  end if;
end;
$$;

-- ── 3. RENVOI — sent_at INCHANGE, une seule entree sent, entree resent,
--      show_discounts divergent refuse. ─────────────────────────────────────
do $$
declare
  v_tenant_a uuid;
  v_quote uuid;
  v_sent_at_before timestamptz;
  v_sent_at_after timestamptz;
  v_rejected boolean := false;
  v_sent_count integer;
  v_resent_count integer;
begin
  select tenant_a, quote_with_lines into v_tenant_a, v_quote from e10_10a_context;

  select sent_at into v_sent_at_before from public.commercial_quotes where id = v_quote;

  -- show_discounts DIVERGENT (le devis vaut false par defaut) -> refuse.
  begin
    perform public.api_send_commercial_quote(v_tenant_a, v_quote, true, true);
  exception
    when others then
      if sqlerrm like 'quote.resend_immutable%' then v_rejected := true;
      else raise;
      end if;
  end;
  if not v_rejected then
    raise exception 'Renvoi avec show_discounts divergent aurait du etre rejete (quote.resend_immutable)';
  end if;

  -- Renvoi tel quel (non fourni) -> accepte.
  perform public.api_send_commercial_quote(v_tenant_a, v_quote, null, false);

  select sent_at into v_sent_at_after from public.commercial_quotes where id = v_quote;
  if v_sent_at_after is distinct from v_sent_at_before then
    raise exception 'Renvoi : sent_at ne doit JAMAIS changer (avant %, apres %)', v_sent_at_before, v_sent_at_after;
  end if;

  select count(*) into v_sent_count
    from public.commercial_quote_header_audit where quote_id = v_quote and action = 'sent';
  if v_sent_count <> 1 then
    raise exception 'Renvoi : % entree(s) sent apres renvoi, 1 attendue (jamais dupliquee)', v_sent_count;
  end if;

  select count(*) into v_resent_count
    from public.commercial_quote_header_audit where quote_id = v_quote and action = 'resent';
  if v_resent_count <> 1 then
    raise exception 'Renvoi : % entree(s) resent, 1 attendue', v_resent_count;
  end if;
end;
$$;

-- ── 3bis. IMMUABILITE d un devis sent — trigger BEFORE UPDATE, pas
--      seulement en application (qa-review E10.10a round 1, B3). ──────────
do $$
declare
  v_quote uuid;
  v_status_before text;
  v_global_discount_before numeric;
  v_rejected boolean := false;
begin
  select quote_with_lines into v_quote from e10_10a_context;
  select status, global_discount_rate into v_status_before, v_global_discount_before
    from public.commercial_quotes where id = v_quote;
  if v_status_before <> 'sent' then
    raise exception 'Precondition scenario 3bis : devis attendu sent, obtenu %', v_status_before;
  end if;

  -- Tentative de DEGEL direct (redonner draft a un devis envoye) : c est
  -- EXACTEMENT le scenario du bloquant (`PATCH .../commercial_quotes?id=eq.X`
  -- avec `{"status":"draft"}`).
  begin
    update public.commercial_quotes set status = 'draft' where id = v_quote;
  exception
    when others then
      if sqlerrm like 'quote.update_requires_draft%' then v_rejected := true;
      else raise;
      end if;
  end;
  if not v_rejected then
    raise exception 'Un UPDATE direct a pu redonner l etat draft a un devis sent (immuabilite non respectee)';
  end if;
  perform 1 from public.commercial_quotes where id = v_quote and status = 'sent';
  if not found then
    raise exception 'Le devis n est plus a l etat sent apres la tentative de degel rejetee';
  end if;

  -- Tentative de modification d une AUTRE colonne (remise globale), SANS
  -- toucher au statut : refusee de la meme maniere — le trigger regarde le
  -- statut COURANT (`old.status`), pas la colonne visee par l UPDATE.
  v_rejected := false;
  begin
    update public.commercial_quotes set global_discount_rate = 0.5000 where id = v_quote;
  exception
    when others then
      if sqlerrm like 'quote.update_requires_draft%' then v_rejected := true;
      else raise;
      end if;
  end;
  if not v_rejected then
    raise exception 'Un UPDATE direct a pu modifier global_discount_rate sur un devis sent';
  end if;
  perform 1 from public.commercial_quotes
   where id = v_quote and global_discount_rate is not distinct from v_global_discount_before;
  if not found then
    raise exception 'global_discount_rate a change malgre le rejet attendu';
  end if;
end;
$$;

-- ── 3ter. `status_forced` — qa-review round 2, B3 volet 3 (docs/api/
--      CONVENTIONS.md §8.12ter). Deux couches DISTINCTES, a ne pas confondre :
--      la garde de prevention (BEFORE UPDATE, bloque) et le journal de
--      detection (AFTER UPDATE, constate) ne protegent PAS la meme chose. La
--      garde, une fois etendue, couvre a elle seule le cas ordinaire (PATCH
--      direct depuis un jeton de membre) : AUCUNE entree n en resulte, par
--      construction (l ecriture n atteint jamais la ligne). Le journal ne
--      produit reellement une entree QUE dans le cas RESIDUEL ou la garde
--      elle-meme serait contournee (ici : une session privilegiee qui
--      desactive explicitement le trigger de prevention). ────────────────────
do $$
declare
  v_quote uuid;
  v_status_before text;
  v_rejected boolean := false;
begin
  select quote_status_forced into v_quote from e10_10a_context;

  select status into v_status_before from public.commercial_quotes where id = v_quote;
  if v_status_before <> 'draft' then
    raise exception 'Precondition scenario 3ter : devis attendu draft, obtenu %', v_status_before;
  end if;

  -- (a) PATCH direct {"status":"accepted"} sur un devis ENCORE DRAFT, hors
  -- api_send_commercial_quote : EXACTEMENT le trou laisse par le round 1 (qui
  -- ne bloquait qu un devis DEJA non-draft). La garde etendue
  -- (commercial_quotes_require_draft_before_write) le rejette EN AMONT, avant
  -- meme que le trigger d audit (AFTER UPDATE, meme instruction) n ait la
  -- moindre occasion de s executer : ce scenario NE PEUT PAS et NE DOIT PAS
  -- produire d entree status_forced, la garde a deja tout arrete.
  begin
    update public.commercial_quotes set status = 'accepted' where id = v_quote;
  exception
    when others then
      if sqlerrm like 'quote.update_requires_draft%' then v_rejected := true;
      else raise;
      end if;
  end;
  if not v_rejected then
    raise exception 'Un PATCH direct depuis draft a pu forcer le statut (garde round 2 non respectee)';
  end if;

  perform 1 from public.commercial_quotes where id = v_quote and status = 'draft';
  if not found then
    raise exception 'Le devis n est plus draft apres la tentative de forcage rejetee';
  end if;

  perform 1 from public.commercial_quote_header_audit
   where quote_id = v_quote and action = 'status_forced';
  if found then
    raise exception 'Une entree status_forced existe alors que l ecriture a ete BLOQUEE en amont (3ter/a)';
  end if;
end;
$$;

-- (b) Scenario RESIDUEL : la garde de prevention est CELLE QUI EST
-- DESACTIVEE ici (pas la RLS, pas une autre policy) pour simuler la seule
-- situation ou `status_forced` a une raison d exister une fois le point 1 en
-- place — une session privilegiee qui contournerait AUSSI le trigger de
-- prevention (correctif manuel en base, script de service avec role
-- proprietaire). Le trigger d audit (AFTER UPDATE, commercial_quotes_audit_
-- update), lui, N EST JAMAIS TOUCHE : c est lui, seul, qui produit l entree.
reset role;

alter table public.commercial_quotes disable trigger commercial_quotes_require_draft_before_write;

do $$
declare
  v_quote uuid;
  v_status_forced_count integer;
  v_previous text;
  v_new text;
begin
  select quote_status_forced into v_quote from e10_10a_context;

  update public.commercial_quotes set status = 'accepted' where id = v_quote;

  select count(*) into v_status_forced_count
    from public.commercial_quote_header_audit where quote_id = v_quote and action = 'status_forced';
  if v_status_forced_count <> 1 then
    raise exception '3ter/b : % entree(s) status_forced, 1 attendue (garde de prevention contournee)', v_status_forced_count;
  end if;

  select previous_value, new_value into v_previous, v_new
    from public.commercial_quote_header_audit where quote_id = v_quote and action = 'status_forced';
  if v_previous is distinct from 'draft' or v_new is distinct from 'accepted' then
    raise exception '3ter/b : previous_value/new_value attendus draft/accepted, obtenus %/%', v_previous, v_new;
  end if;

  perform 1 from public.commercial_quote_header_audit
   where quote_id = v_quote and action = 'status_forced' and field is null and quote_snapshot is null;
  if not found then
    raise exception '3ter/b : field et quote_snapshot doivent etre NULL sur status_forced';
  end if;
end;
$$;

alter table public.commercial_quotes enable trigger commercial_quotes_require_draft_before_write;

-- (c) Non-regression : l envoi normal (scenario 2, premier envoi) ET le
-- renvoi normal (scenario 3) ne produisent JAMAIS status_forced, seulement
-- sent/resent — l echappatoire magrit.quote_transition, posee par
-- api_send_commercial_quote AVANT ses deux branches, evite tout doublon.
do $$
declare
  v_quote uuid;
  v_status_forced_count integer;
begin
  select quote_with_lines into v_quote from e10_10a_context;

  select count(*) into v_status_forced_count
    from public.commercial_quote_header_audit where quote_id = v_quote and action = 'status_forced';
  if v_status_forced_count <> 0 then
    raise exception '3ter/c : envoi/renvoi normal a produit % entree(s) status_forced (non-regression)', v_status_forced_count;
  end if;
end;
$$;

-- Restaure l etat pre-3ter (role authenticated, admin_a) pour les scenarios
-- suivants, qui l attendent tel quel (aucun `set local role` n intervient
-- entre la fin du scenario 3bis et le debut du scenario 4 dans la version
-- avant ce lot).
set local role authenticated;
select set_config('request.jwt.claim.sub', (select actor_admin_a::text from e10_10a_context), true);

-- ── 4. Gardes — devis sans ligne, statut hors {draft,sent}. ─────────────────
do $$
declare
  v_tenant_a uuid;
  v_quote_no_lines uuid;
  v_quote_wrong_status uuid;
  v_rejected boolean := false;
begin
  select tenant_a, quote_no_lines, quote_wrong_status
    into v_tenant_a, v_quote_no_lines, v_quote_wrong_status
    from e10_10a_context;

  begin
    perform public.api_send_commercial_quote(v_tenant_a, v_quote_no_lines, null, false);
  exception
    when others then
      if sqlerrm like 'quote.send_requires_lines%' then v_rejected := true;
      else raise;
      end if;
  end;
  if not v_rejected then
    raise exception 'Envoi d un devis sans ligne aurait du etre rejete (quote.send_requires_lines)';
  end if;

  v_rejected := false;
  begin
    perform public.api_send_commercial_quote(v_tenant_a, v_quote_wrong_status, null, false);
  exception
    when others then
      if sqlerrm like 'quote.send_forbidden_status%' then v_rejected := true;
      else raise;
      end if;
  end;
  if not v_rejected then
    raise exception 'Envoi d un devis "accepted" aurait du etre rejete (quote.send_forbidden_status)';
  end if;
end;
$$;

-- ── 5. api_duplicate_commercial_quote ────────────────────────────────────────
do $$
declare
  v_tenant_a uuid;
  v_source uuid;
  v_copy uuid;
  v_source_number text;
  v_copy_number text;
  v_copy_status text;
  v_copy_valid_until date;
  v_copy_source_id uuid;
  v_source_line_count integer;
  v_copy_line_count integer;
  v_copy_sale_price numeric;
  v_duplicated_count integer;
  v_duplicated_new_value text;
begin
  select tenant_a, quote_with_lines into v_tenant_a, v_source from e10_10a_context;

  -- Le source porte deja une valid_until (calculee au premier envoi) : la
  -- copie doit la remettre a NULL malgre tout.
  select number into v_source_number from public.commercial_quotes where id = v_source;

  select public.api_duplicate_commercial_quote(v_tenant_a, v_source) into v_copy;

  select number, status, valid_until, source_quote_id
    into v_copy_number, v_copy_status, v_copy_valid_until, v_copy_source_id
    from public.commercial_quotes where id = v_copy;

  if v_copy_number = v_source_number then raise exception 'Duplication : le numero doit etre FRAIS'; end if;
  if v_copy_status <> 'draft' then raise exception 'Duplication : statut attendu draft, obtenu %', v_copy_status; end if;
  if v_copy_valid_until is not null then
    raise exception 'Duplication : valid_until doit etre NULL (source en portait une), obtenue %', v_copy_valid_until;
  end if;
  if v_copy_source_id is distinct from v_source then
    raise exception 'Duplication : source_quote_id attendu %, obtenu %', v_source, v_copy_source_id;
  end if;

  select count(*) into v_source_line_count from public.commercial_quote_lines where quote_id = v_source;
  select count(*) into v_copy_line_count from public.commercial_quote_lines where quote_id = v_copy;
  if v_copy_line_count <> v_source_line_count then
    raise exception 'Duplication : % ligne(s) copiee(s), % attendue(s)', v_copy_line_count, v_source_line_count;
  end if;

  select sale_price into v_copy_sale_price from public.commercial_quote_lines where quote_id = v_copy limit 1;
  if v_copy_sale_price is distinct from 150.00 then
    raise exception 'Duplication : sale_price de la ligne copiee attendu 150.00, obtenu % (prix recalcule ?)', v_copy_sale_price;
  end if;

  -- Ligne copiee -> une entree 'added' dans le journal des LIGNES (trigger
  -- E10.9, automatique).
  perform 1 from public.commercial_quote_line_audit
   where quote_id = v_copy and action = 'added';
  if not found then
    raise exception 'Duplication : le journal des lignes de la copie doit porter au moins une entree added';
  end if;

  -- Tracabilite sur l ORIGINAL : entree 'duplicated', new_value = id de la copie.
  select count(*) into v_duplicated_count
    from public.commercial_quote_header_audit where quote_id = v_source and action = 'duplicated';
  if v_duplicated_count <> 1 then
    raise exception 'Duplication : % entree(s) duplicated sur l original, 1 attendue', v_duplicated_count;
  end if;

  select new_value into v_duplicated_new_value
    from public.commercial_quote_header_audit where quote_id = v_source and action = 'duplicated';
  if v_duplicated_new_value <> v_copy::text then
    raise exception 'Duplication : new_value attendu %, obtenu %', v_copy, v_duplicated_new_value;
  end if;
end;
$$;

reset role;

-- ── 6. Contraintes de coherence de la remise globale. ───────────────────────
do $$
declare
  v_tenant_a uuid;
  v_customer_a uuid;
  v_project_a uuid;
  v_rejected boolean := false;
begin
  select tenant_a, customer_a, project_a into v_tenant_a, v_customer_a, v_project_a from e10_10a_context;

  begin
    insert into public.commercial_quotes
      (tenant_id, customer_id, project_id, number, status, global_discount_rate, target_net_total)
    values
      (v_tenant_a, v_customer_a, v_project_a, 'DEV-9999-00299', 'draft', 0.1000, 50.00);
  exception
    when check_violation then v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'global_discount_rate ET target_net_total simultanes auraient du etre rejetes (CHECK)';
  end if;

  v_rejected := false;
  begin
    insert into public.commercial_quotes
      (tenant_id, customer_id, project_id, number, status, global_discount_rate)
    values
      (v_tenant_a, v_customer_a, v_project_a, 'DEV-9999-00298', 'draft', 1.5000);
  exception
    when check_violation then v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'global_discount_rate > 1.0000 aurait du etre rejete (CHECK)';
  end if;

  -- qa-review round 1, B1 : vat_rate NEGATIF rejete en base (defense en
  -- profondeur du CHECK, en plus du contrat/nonNegativeRateSchema cote API).
  v_rejected := false;
  begin
    insert into public.commercial_quotes
      (tenant_id, customer_id, project_id, number, status, vat_rate)
    values
      (v_tenant_a, v_customer_a, v_project_a, 'DEV-9999-00297', 'draft', -0.2000);
  exception
    when check_violation then v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'vat_rate NEGATIF aurait du etre rejete (CHECK commercial_quotes_vat_rate_non_negative)';
  end if;
end;
$$;

-- ── 7. RLS de commercial_quote_header_audit — isolation + garde can_manage_
--      pricing + append-only. ───────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claim.sub', (select actor_member_a::text from e10_10a_context), true);

do $$
declare
  v_quote uuid;
  v_visible integer;
begin
  select quote_with_lines into v_quote from e10_10a_context;
  select count(*) into v_visible from public.commercial_quote_header_audit where quote_id = v_quote;
  if v_visible <> 0 then
    raise exception 'Un membre SANS can_manage_pricing lit % entree(s) commercial_quote_header_audit', v_visible;
  end if;
end;
$$;

reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', (select actor_admin_b::text from e10_10a_context), true);

do $$
declare
  v_quote uuid;
  v_visible integer;
begin
  select quote_with_lines into v_quote from e10_10a_context;
  select count(*) into v_visible from public.commercial_quote_header_audit where quote_id = v_quote;
  if v_visible <> 0 then
    raise exception 'Un admin du tenant B lit % entree(s) commercial_quote_header_audit du tenant A', v_visible;
  end if;
end;
$$;

reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', (select actor_admin_a::text from e10_10a_context), true);

do $$
declare
  v_quote uuid;
  v_entry_id uuid;
  v_visible integer;
  v_rejected boolean := false;
begin
  select quote_with_lines into v_quote from e10_10a_context;

  select count(*) into v_visible from public.commercial_quote_header_audit where quote_id = v_quote;
  if v_visible = 0 then
    raise exception 'Un admin du tenant, par derivation, doit lire commercial_quote_header_audit en direct';
  end if;

  select id into v_entry_id from public.commercial_quote_header_audit where quote_id = v_quote limit 1;

  begin
    update public.commercial_quote_header_audit set actor_label = 'falsifie' where id = v_entry_id;
  exception
    when insufficient_privilege then v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'commercial_quote_header_audit : UPDATE direct aurait du etre rejete (append-only)';
  end if;

  v_rejected := false;
  begin
    delete from public.commercial_quote_header_audit where id = v_entry_id;
  exception
    when insufficient_privilege then v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'commercial_quote_header_audit : DELETE direct aurait du etre rejete (append-only)';
  end if;
end;
$$;

reset role;

-- ── 8. Isolation inter-tenant des fonctions send/duplicate. ─────────────────
set local role authenticated;
select set_config('request.jwt.claim.sub', (select actor_admin_b::text from e10_10a_context), true);

do $$
declare
  v_tenant_a uuid;
  v_quote uuid;
  v_rejected boolean := false;
begin
  select tenant_a, quote_with_lines into v_tenant_a, v_quote from e10_10a_context;

  begin
    perform public.api_send_commercial_quote(v_tenant_a, v_quote, null, false);
  exception
    when others then
      if sqlerrm like 'quote.not_found%' or sqlerrm like 'permission_denied%' then v_rejected := true;
      else raise;
      end if;
  end;
  if not v_rejected then
    raise exception 'Un admin d un AUTRE tenant a pu renvoyer un devis du tenant A';
  end if;

  v_rejected := false;
  begin
    perform public.api_duplicate_commercial_quote(v_tenant_a, v_quote);
  exception
    when others then
      if sqlerrm like 'quote.not_found%' or sqlerrm like 'permission_denied%' then v_rejected := true;
      else raise;
      end if;
  end;
  if not v_rejected then
    raise exception 'Un admin d un AUTRE tenant a pu dupliquer un devis du tenant A';
  end if;
end;
$$;

reset role;

-- ── 9. api_commercial_quote_line_subtotals — agregation EN BASE, isolation
--      inter-tenant (qa-review E10.10a round 1, B2). ───────────────────────
set local role authenticated;
select set_config('request.jwt.claim.sub', (select actor_admin_b::text from e10_10a_context), true);

do $$
declare
  v_tenant_a uuid;
  v_quote uuid;
  v_rows integer;
begin
  select tenant_a, quote_with_lines into v_tenant_a, v_quote from e10_10a_context;

  -- Admin B, en fournissant le tenant_id ET l id de devis du tenant A : la
  -- RLS (`security invoker`) bloque la visibilite des lignes independamment
  -- du parametre fourni — `p_tenant_id` est une defense en profondeur, pas
  -- une delegation de privilege (meme si un appelant mentait dessus).
  select count(*) into v_rows
    from public.api_commercial_quote_line_subtotals(v_tenant_a, array[v_quote]);
  if v_rows <> 0 then
    raise exception 'api_commercial_quote_line_subtotals : un admin d un AUTRE tenant a pu lire % ligne(s)', v_rows;
  end if;
end;
$$;

reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', (select actor_admin_a::text from e10_10a_context), true);

do $$
declare
  v_tenant_a uuid;
  v_quote uuid;
  v_subtotal numeric;
begin
  select tenant_a, quote_with_lines into v_tenant_a, v_quote from e10_10a_context;

  -- Une seule ligne a 150.00 (precondition, section privilegiee) : le
  -- sous-total AGREGE EN BASE doit valoir exactement 150.00.
  select subtotal into v_subtotal
    from public.api_commercial_quote_line_subtotals(v_tenant_a, array[v_quote]);
  if v_subtotal is distinct from 150.00 then
    raise exception 'api_commercial_quote_line_subtotals : sous-total attendu 150.00, obtenu %', v_subtotal;
  end if;
end;
$$;

reset role;

rollback;
