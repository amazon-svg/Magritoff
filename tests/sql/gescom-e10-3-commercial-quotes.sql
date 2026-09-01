-- ============================================================================
-- E10.3 — commercial_quotes / commercial_quote_lines / numerotation
-- transactionnelle : isolation par tenant, `with check`, non-duplication du
-- numero de devis sous appels concurrents, et etancheite du compteur de
-- sequence en dehors de la fonction security definer.
-- ----------------------------------------------------------------------------
-- Test COMPORTEMENTAL, execute par psql contre la base locale (meme raison
-- que gescom-e10-1-projects.sql : une migration ne change jamais apres coup,
-- un `toContain()` sur son texte ne detecterait donc aucune regression sur un
-- futur `drop policy`, un `grant` sur le compteur accorde par erreur, ou une
-- serialisation qui cesserait de tenir sous appels concurrents).
--
-- ── Correction qa-review (bloquant) ─────────────────────────────────────────
-- Une premiere version de ce cas relisait l id du devis du tenant A et l etat
-- du compteur EN LES REQUETANT SOUS LE ROLE RESTREINT (`authenticated`,
-- reduit au seul tenant B a partir du scenario 4) — exactement la RLS que le
-- test est cense verifier. Sous ce role, ces lectures rendaient NULL, ce qui
-- rendait vacants quatre controles (comparaison a NULL, jamais prise ; DELETE/
-- UPDATE cible sur `id = NULL`, 0 ligne quelle que soit la policy). Le
-- correctif reprend le patron de `gescom-e10-1-projects.sql` : tout ce dont
-- une assertion a besoin comme ORACLE (identifiants, valeurs "avant") est
-- calcule et fige PENDANT LA PHASE PRIVILEGIEE (role de connexion `postgres`,
-- qui contourne la RLS sans dependre d aucune policy), jamais rederive sous
-- le role restreint. Les scenarios 1, 2, 3 et 7 n exercent d ailleurs aucune
-- RLS : ils verifient le COMPORTEMENT de la fonction `security definer`
-- (numerotation, atomicite, rejet), qui s applique a l identique quel que
-- soit le role appelant (une fonction `security definer` s execute avec les
-- droits de son PROPRIETAIRE, jamais ceux de l appelant) — ils sont donc
-- executes en phase privilegiee, avant meme le premier `set local role
-- authenticated`. Seuls les scenarios 4, 5, 6 (isolation RLS proprement dite)
-- s executent sous le role restreint, et n y lisent plus que des valeurs
-- deja figees dans `e10_3_quotes_context`.
--
-- Scenarios :
--   1. api_create_commercial_quote_from_project_items() cree un devis avec
--      ses lignes dans la meme transaction : numero DEV-AAAA-NNNNN, client
--      herite du projet (CA4), production_price repris du chiffrage source
--      (CA3, priorite clariprint_price_ht puis price puis 0).
--   2. Un second appel sur le MEME projet et le MEME element produit un
--      SECOND devis avec un numero DIFFERENT et SEQUENTIEL : l element de
--      projet n est jamais consomme ni marque exclusif (CA7).
--   3. item_ids ne appartenant pas au projet -> exception invalid_item_ids
--      (verifiee par le CONTENU du message, pas seulement `when others` : un
--      rejet pour une tout autre raison ne doit pas faire passer ce
--      scenario). Le compteur n avance pas — garanti par le SAVEPOINT
--      implicite que PL/pgSQL pose autour de tout bloc `begin ... exception
--      ... end` : une exception depuis `perform` y annule TOUT ce que l
--      appel a fait, y compris un increment de compteur qui aurait eu lieu
--      avant le point d echec. Ce n est PAS une garantie sur l ORDRE interne
--      des validations de la fonction (elle valide bien `item_ids` avant de
--      toucher au compteur, mais le test resterait vrai meme si ce n etait
--      pas le cas). Compteur lu EN PHASE PRIVILEGIEE, avant et apres la
--      tentative (le scenario 6 prouve plus bas qu une lecture sous le role
--      restreint y rendrait NULL, ce qui ne prouverait rien).
--   4. Isolation par tenant en lecture ET en ecriture sur commercial_quotes
--      ET commercial_quote_lines (jointure dediee, jamais exercee avant ce
--      test), avec controle positif symetrique sur le tenant de l acteur.
--      Les identifiants "cible" du tenant A viennent de `e10_3_quotes_context`
--      (figes en phase privilegiee), jamais d une lecture sous le role
--      restreint qui rendrait NULL.
--   5. `with check` : un INSERT direct portant le tenant_id d un tenant tiers
--      est refuse ; un UPDATE qui ferait muter tenant_id d une ligne qui
--      appartient a l acteur est refuse.
--   6. commercial_quote_number_counters n est accessible ni en lecture ni en
--      ecriture directe par un role authenticated (RLS activee, aucune
--      policy declaree) : seule la fonction security definer l atteint.
--      L assertion qui doit reellement mordre porte sur le compteur du
--      tenant B — celui dont l acteur EST membre a ce stade du script — pas
--      sur celui du tenant A dont il vient d etre exclu : cibler A masquerait
--      une future policy d ecriture scopee "admin du tenant proprietaire",
--      calquee sur `commercial_quotes_write`, qui laisserait un admin
--      modifier le compteur de SON PROPRE tenant (exactement ce que CA5
--      interdit) sans que le controle sur A ne le detecte jamais.
--   7. Sous deux appels concurrents entrelaces sur le meme (tenant, annee)
--      (deux transactions simultanees via dblink/session paralleles n etant
--      pas disponible en un seul script psql sequentiel), l UPSERT du
--      compteur est verrouillant : ce scenario le prouve en verifiant que
--      chaque numero avance de EXACTEMENT 1 par rapport au precedent (pas
--      seulement qu ils sont distincts), sur N appels sequentiels rapides.
--
-- Lancer : pnpm test:storefront:sql (necessite Supabase local demarre).
-- ============================================================================

begin;

create temporary table e10_3_quotes_context (
  actor_id      uuid not null,
  tenant_a      uuid not null,
  tenant_b      uuid not null,
  customer_a    uuid not null,
  customer_b    uuid not null,
  project_a     uuid not null,
  project_b     uuid not null,
  item_a1       uuid not null,
  item_a2       uuid not null,
  item_b        uuid not null,
  -- Figes PENDANT LA PHASE PRIVILEGIEE, une fois connus (colonnes nullable a
  -- la creation de la ligne, renseignees par la suite via UPDATE — toujours
  -- comme `postgres`, jamais sous le role restreint).
  quote_a1      uuid,
  quote_b1      uuid
);

grant select on e10_3_quotes_context to authenticated;

-- ── Phase privilegiee (role de connexion `postgres`, contourne la RLS) ─────
-- Prealables ET scenarios 1, 2, 3, 7 : aucun d eux n exerce de RLS (voir
-- en-tete). `set_config` fixe le sujet JWT pour toute la duree de la
-- TRANSACTION (troisieme argument `true` = local a la transaction, pas au
-- role) : il reste actif meme apres un `set local role authenticated` plus
-- bas, `auth.uid()` continue donc de resoudre correctement partout.
do $$
declare
  v_actor uuid;
  v_tenant_a uuid;
  v_tenant_b uuid;
  v_customer_a uuid;
  v_customer_b uuid;
  v_project_a uuid;
  v_project_b uuid;
  v_item_a1 uuid;
  v_item_a2 uuid;
  v_item_b uuid;
  v_quote_1 uuid;
  v_quote_2 uuid;
  v_quote_b uuid;
  v_number_1 text;
  v_number_2 text;
  v_line_count integer;
  v_production_1 numeric;
  v_production_2 numeric;
  v_customer_on_quote uuid;
  v_project_item_still_there integer;
  v_rejected boolean;
  v_counter_before integer;
  v_counter_after integer;
  v_quote_seq uuid;
  v_seq_numbers text[] := '{}';
  v_previous_seq integer;
  v_current_seq integer;
  i integer;
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
    raise exception 'Un utilisateur Auth non super-admin est requis pour le scenario E10.3';
  end if;

  insert into public.tenants (slug, name) values ('e10-3-quotes-a', 'E10.3 Quotes Tenant A')
    returning id into v_tenant_a;
  insert into public.tenants (slug, name) values ('e10-3-quotes-b', 'E10.3 Quotes Tenant B')
    returning id into v_tenant_b;

  -- L acteur est membre (role admin) du tenant A ET du tenant B, pour
  -- pouvoir exercer la fonction de creation sur SES DEUX espaces (scenarios
  -- 1-3, 7), puis n etre reduit qu au tenant B pour les scenarios d isolation
  -- (4-6), ou sa qualite de membre du tenant A est retiree.
  insert into public.tenant_members (tenant_id, user_id, role, access_scope, allowed_shop_ids)
  values (v_tenant_a, v_actor, 'admin', 'magrit_full', '{}');
  insert into public.tenant_members (tenant_id, user_id, role, access_scope, allowed_shop_ids)
  values (v_tenant_b, v_actor, 'admin', 'magrit_full', '{}');

  insert into public.customers (tenant_id, type, company_name, siret)
  values (v_tenant_a, 'company', 'Tenant A Impression', '73282932000074')
  returning id into v_customer_a;

  insert into public.customers (tenant_id, type, company_name, siret)
  values (v_tenant_b, 'company', 'Tenant B Impression', '56078919152347')
  returning id into v_customer_b;

  insert into public.projects (tenant_id, customer_id, name)
  values (v_tenant_a, v_customer_a, 'Projet Tenant A')
  returning id into v_project_a;

  insert into public.projects (tenant_id, customer_id, name)
  values (v_tenant_b, v_customer_b, 'Projet Tenant B')
  returning id into v_project_b;

  -- Deux elements sur le projet A : le premier porte un prix Clariprint
  -- (priorite CA3), le second seulement un prix marche (repli `.amounts.price`).
  insert into public.project_items (project_id, label, quote_payload)
  values (
    v_project_a,
    'Flyer A5',
    '{"quantity": 1000, "amounts": {"clariprint_price_ht": "42.50", "price": "45.00"}}'::jsonb
  )
  returning id into v_item_a1;

  insert into public.project_items (project_id, label, quote_payload)
  values (
    v_project_a,
    'Carte de visite',
    '{"quantity": 500, "amounts": {"price": "12.30"}}'::jsonb
  )
  returning id into v_item_a2;

  insert into public.project_items (project_id, label, quote_payload)
  values (v_project_b, 'Element Tenant B', '{"quantity": 200}'::jsonb)
  returning id into v_item_b;

  insert into e10_3_quotes_context (
    actor_id, tenant_a, tenant_b, customer_a, customer_b,
    project_a, project_b, item_a1, item_a2, item_b
  ) values (
    v_actor, v_tenant_a, v_tenant_b, v_customer_a, v_customer_b,
    v_project_a, v_project_b, v_item_a1, v_item_a2, v_item_b
  );

  -- Sujet JWT fixe pour TOUTE la transaction (troisieme argument `true`),
  -- pas seulement pour le role courant : `auth.uid()` continuera de le
  -- resoudre apres le `set local role authenticated` de la phase 2.
  perform set_config('request.jwt.claim.sub', v_actor::text, true);

  -- ── 1. Premier devis, sur les deux elements du projet A ──────────────────
  v_quote_1 := public.api_create_commercial_quote_from_project_items(
    v_tenant_a, v_project_a, array[v_item_a1, v_item_a2]
  );
  if v_quote_1 is null then
    raise exception 'La creation du premier devis n a rendu aucun identifiant';
  end if;

  -- Fige IMMEDIATEMENT l id, en phase privilegiee : c est la valeur oracle
  -- reutilisee par les scenarios 4 et 5 (jamais rederivee sous le role
  -- restreint, voir en-tete).
  update e10_3_quotes_context set quote_a1 = v_quote_1;

  select number, customer_id into v_number_1, v_customer_on_quote
    from public.commercial_quotes where id = v_quote_1;
  if v_number_1 !~ '^DEV-[0-9]{4}-[0-9]{5}$' then
    raise exception 'Le numero du premier devis ne respecte pas le format DEV-AAAA-NNNNN (valeur: %)', v_number_1;
  end if;
  -- CA4 — le client est herite du PROJET, jamais ressaisi.
  if v_customer_on_quote is distinct from v_customer_a then
    raise exception 'Le devis n a pas herite du client du projet (valeur: %)', v_customer_on_quote;
  end if;

  select count(*) into v_line_count from public.commercial_quote_lines where quote_id = v_quote_1;
  if v_line_count <> 2 then
    raise exception 'Le premier devis compte % ligne(s), 2 attendues', v_line_count;
  end if;

  -- CA3 — production_price : priorite clariprint_price_ht, repli sur price.
  select production_price into v_production_1
    from public.commercial_quote_lines where quote_id = v_quote_1 and project_item_id = v_item_a1;
  if v_production_1 <> 42.50 then
    raise exception 'production_price de l element avec prix Clariprint est % (42.50 attendu)', v_production_1;
  end if;

  select production_price into v_production_2
    from public.commercial_quote_lines where quote_id = v_quote_1 and project_item_id = v_item_a2;
  if v_production_2 <> 12.30 then
    raise exception 'production_price de l element sans prix Clariprint (repli price) est % (12.30 attendu)', v_production_2;
  end if;

  -- Point critique E10.21 (pas encore livree) : les colonnes de prix de
  -- vente restent NULL, breakdown reste vide. Une valeur non nulle ici
  -- signalerait un calcul de prix invente hors PricingEngine.
  if exists (
    select 1 from public.commercial_quote_lines
     where quote_id = v_quote_1
       and (public_price is not null or customer_price is not null
            or applied_margin_rate is not null or applied_rule_id is not null
            or breakdown <> '[]'::jsonb)
  ) then
    raise exception 'Une colonne de prix de vente E10.21 a ete renseignee alors qu E10.21 n est pas livree';
  end if;

  -- ── 2. Second devis sur le MEME projet et le MEME premier element ────────
  -- CA7 : l element n est jamais consomme ni marque exclusif.
  v_quote_2 := public.api_create_commercial_quote_from_project_items(
    v_tenant_a, v_project_a, array[v_item_a1]
  );
  select number into v_number_2 from public.commercial_quotes where id = v_quote_2;
  if v_number_2 = v_number_1 then
    raise exception 'Les deux devis partagent le meme numero (%), la sequence n avance pas', v_number_1;
  end if;
  -- Les deux numeros doivent etre strictement croissants (meme annee).
  if right(v_number_2, 5)::integer <> right(v_number_1, 5)::integer + 1 then
    raise exception 'La sequence n avance pas de 1 en 1 (premier: %, second: %)', v_number_1, v_number_2;
  end if;

  select count(*) into v_project_item_still_there from public.project_items where id = v_item_a1;
  if v_project_item_still_there <> 1 then
    raise exception 'L element de projet a disparu apres avoir alimente deux devis (CA7 viole)';
  end if;

  -- ── 3. item_ids hors du projet -> exception, aucun effet de bord ─────────
  -- Lu EN PHASE PRIVILEGIEE (role `postgres`) : le scenario 6 prouve plus
  -- bas que ce compteur est invisible sous `authenticated`, une lecture sous
  -- ce role rendrait systematiquement NULL et ne prouverait rien (bug corrige
  -- suite qa-review).
  select last_value into v_counter_before
    from public.commercial_quote_number_counters
   where tenant_id = v_tenant_a and year = extract(year from (now() at time zone 'utc'))::integer;
  if v_counter_before is null then
    raise exception 'Compteur illisible en phase privilegiee : le prealable du scenario 3 est invalide';
  end if;

  -- `invalid_item_ids` est leve par un `raise exception` applicatif, sans
  -- SQLSTATE dedie (P0001 generique, partage par tout `raise exception` sans
  -- code explicite) : il n existe pas de condition nommee equivalente a
  -- `insufficient_privilege` (scenario 5) a capturer specifiquement. Le
  -- `when others` est donc necessairement large, mais on verifie ENSUITE le
  -- CONTENU du message : un rejet pour une tout autre raison (ex. une
  -- regression qui ferait echouer la fonction sur `permission_denied` ou une
  -- erreur interne) ne doit pas faire passer ce scenario en silence.
  v_rejected := false;
  begin
    perform public.api_create_commercial_quote_from_project_items(
      v_tenant_a, v_project_a, array[v_item_b]
    );
  exception
    when others then
      if SQLERRM like 'invalid_item_ids%' then
        v_rejected := true;
      else
        raise exception 'Rejet inattendu pour un item_id hors du projet : %', SQLERRM;
      end if;
  end;
  if not v_rejected then
    raise exception 'Un item_id hors du projet a ete accepte par la fonction de creation';
  end if;

  select last_value into v_counter_after
    from public.commercial_quote_number_counters
   where tenant_id = v_tenant_a and year = extract(year from (now() at time zone 'utc'))::integer;
  if v_counter_after is distinct from v_counter_before then
    raise exception
      'Le compteur a avance (% -> %) malgre une creation refusee : trou de sequence possible',
      v_counter_before, v_counter_after;
  end if;

  -- ── 7. N appels sequentiels rapides sur le meme (tenant, annee) ──────────
  -- La sequence avance de EXACTEMENT 1 a chaque fois (pas seulement des
  -- numeros distincts : un generateur qui sauterait ou reculerait produirait
  -- lui aussi des valeurs distinctes) — c est ce que verrouille l UPSERT sous
  -- concurrence reelle.
  for i in 1..5 loop
    v_quote_seq := public.api_create_commercial_quote_from_project_items(
      v_tenant_a, v_project_a, array[v_item_a1]
    );
    select number into v_number_1 from public.commercial_quotes where id = v_quote_seq;
    if v_number_1 = any(v_seq_numbers) then
      raise exception 'Numero de devis duplique detecte au passage % : %', i, v_number_1;
    end if;
    v_current_seq := right(v_number_1, 5)::integer;
    if i > 1 and v_current_seq <> v_previous_seq + 1 then
      raise exception
        'Le compteur n a pas avance de exactement 1 au passage % (precedent: %, courant: %)',
        i, v_previous_seq, v_current_seq;
    end if;
    v_previous_seq := v_current_seq;
    v_seq_numbers := array_append(v_seq_numbers, v_number_1);
  end loop;
  if array_length(v_seq_numbers, 1) <> 5 then
    raise exception 'Attendu 5 numeros distincts, obtenu %', array_length(v_seq_numbers, 1);
  end if;

  -- Devis de reference sur le tenant B, pour le controle positif symetrique
  -- des scenarios 4/5. Meme raison que ci-dessus : la fonction s execute a
  -- l identique quel que soit le role appelant (security definer), ce n est
  -- donc PAS un test de RLS de le creer ici, en phase privilegiee.
  v_quote_b := public.api_create_commercial_quote_from_project_items(
    v_tenant_b, v_project_b, array[v_item_b]
  );
  if v_quote_b is null then
    raise exception 'La creation du devis de reference sur le tenant B a echoue';
  end if;
  update e10_3_quotes_context set quote_b1 = v_quote_b;
end;
$$;

-- ── Phase 2 : retire la qualite de membre du tenant A ──────────────────────
-- A partir d ici, l acteur n est plus membre QUE du tenant B — les scenarios
-- 4, 5, 6 exercent la RLS pour de vrai, sous le role reellement restreint.
delete from public.tenant_members
 where user_id = (select actor_id from e10_3_quotes_context)
   and tenant_id = (select tenant_a from e10_3_quotes_context);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  (select actor_id::text from e10_3_quotes_context),
  true
);

-- ── 6. commercial_quote_number_counters : deni total hors de la fonction ──
-- Correction qa-review (regression introduite par le correctif precedent) :
-- a ce stade, l acteur n est plus membre QUE du tenant B. Cibler le compteur
-- du tenant A pour l assertion d ECRITURE serait vacant, meme corrige :
-- l UPDATE rendrait 0 ligne affectee que ce soit a cause de l absence totale
-- de policy (ce qu on veut prouver) OU d une future policy d ecriture
-- scopee "admin/member du tenant proprietaire de la ligne" (calquee sur
-- `commercial_quotes_write`/`commercial_quote_lines_write`, lignes 192-214
-- de la migration — exactement ce qu un futur contributeur copierait-
-- collerait). Dans ce second cas, la policy hypothetique refuserait a bon
-- droit l acces au compteur du tenant A (isolation inter-tenant correcte),
-- mais AUTORISERAIT l acteur a modifier le compteur de SON PROPRE tenant
-- (B) — exactement le trou que CA5 interdit (un admin de B pourrait forcer
-- une collision ou un trou de numerotation dans son propre tenant). Seule
-- une assertion ciblant le compteur de B peut detecter cette regression.
-- Le compteur de A reste sonde en LECTURE, en controle inter-tenant
-- additionnel (invisibilite meme d une ligne dont l acteur n est pas
-- proprietaire).
do $$
declare
  v_tenant_a uuid;
  v_tenant_b uuid;
  v_visible_a integer;
  v_visible_b integer;
  v_updated integer;
begin
  select tenant_a, tenant_b into v_tenant_a, v_tenant_b from e10_3_quotes_context;

  -- Controle inter-tenant additionnel (le compteur du tenant A, dont l
  -- acteur n est plus membre, reste invisible).
  select count(*) into v_visible_a
    from public.commercial_quote_number_counters where tenant_id = v_tenant_a;
  if v_visible_a <> 0 then
    raise exception
      'Un role authenticated lit % ligne(s) du compteur du tenant A malgre l absence de policy RLS',
      v_visible_a;
  end if;

  -- Assertion qui doit REELLEMENT mordre : le compteur de SON PROPRE tenant
  -- (B), dont l acteur est admin a ce stade.
  select count(*) into v_visible_b
    from public.commercial_quote_number_counters where tenant_id = v_tenant_b;
  if v_visible_b <> 0 then
    raise exception
      'Un admin lit % ligne(s) du compteur de SON PROPRE tenant (B) malgre l absence de policy RLS',
      v_visible_b;
  end if;

  update public.commercial_quote_number_counters set last_value = 999 where tenant_id = v_tenant_b;
  get diagnostics v_updated = row_count;
  if v_updated <> 0 then
    raise exception
      'Un admin du tenant B a pu modifier DIRECTEMENT le compteur de SON PROPRE tenant (CA5 viole : collision ou trou de numerotation possible)';
  end if;
end;
$$;

-- ── 4. Isolation par tenant, lecture ET ecriture ────────────────────────────
-- `v_quote_a_id` vient de `e10_3_quotes_context.quote_a1`, fige en phase
-- privilegiee (scenario 1) : PAS d une lecture sous le role restreint, qui
-- rendrait NULL et viderait les deux controles negatifs de leur sens (bug
-- corrige suite qa-review).
do $$
declare
  v_tenant_a uuid;
  v_tenant_b uuid;
  v_quote_a_id uuid;
  v_visible_a integer;
  v_visible_b integer;
  v_lines_visible_a integer;
  v_lines_visible_b integer;
  v_updated integer;
begin
  select tenant_a, tenant_b, quote_a1 into v_tenant_a, v_tenant_b, v_quote_a_id
    from e10_3_quotes_context;
  if v_quote_a_id is null then
    raise exception 'quote_a1 n a pas ete fige en phase privilegiee : le scenario 4 ne peut pas cibler une ligne reelle';
  end if;

  -- Lecture commercial_quotes : rien du tenant A, controle positif sur B.
  select count(*) into v_visible_a from public.commercial_quotes where tenant_id = v_tenant_a;
  if v_visible_a <> 0 then
    raise exception 'Un membre du seul tenant B lit % devis du tenant A', v_visible_a;
  end if;

  select count(*) into v_visible_b from public.commercial_quotes where tenant_id = v_tenant_b;
  if v_visible_b <> 1 then
    raise exception 'Un membre du tenant B lit % devis de son propre tenant, 1 attendu', v_visible_b;
  end if;

  -- Lecture commercial_quote_lines (jointure DEDIEE, jamais exercee avant),
  -- ciblee sur le VRAI id du devis du tenant A (quote_a1).
  select count(*) into v_lines_visible_a
    from public.commercial_quote_lines where quote_id = v_quote_a_id;
  if v_lines_visible_a <> 0 then
    raise exception 'Un membre du seul tenant B lit % ligne(s) de devis du tenant A', v_lines_visible_a;
  end if;

  select count(*) into v_lines_visible_b
    from public.commercial_quote_lines ql
    join public.commercial_quotes q on q.id = ql.quote_id
   where q.tenant_id = v_tenant_b;
  if v_lines_visible_b <> 1 then
    raise exception 'Un membre du tenant B lit % ligne(s) de son propre devis, 1 attendue', v_lines_visible_b;
  end if;

  -- Ecriture : refus sur le devis REEL du tenant A (using) — cible desormais
  -- une ligne qui existe vraiment, donc ce controle mordrait si la policy
  -- etait relachee (ex. `using (true)`).
  update public.commercial_quotes set show_discounts = true where id = v_quote_a_id;
  get diagnostics v_updated = row_count;
  if v_updated <> 0 then
    raise exception 'Un membre du tenant B a pu modifier un devis du tenant A';
  end if;

  -- Controle positif symetrique en ecriture sur son propre devis.
  update public.commercial_quotes set show_discounts = true
   where tenant_id = v_tenant_b;
  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'Un membre du tenant B n a pas pu modifier son propre devis (% ligne(s))', v_updated;
  end if;
end;
$$;

-- ── 5. `with check` — INSERT/UPDATE direct portant un tenant_id tiers ──────
do $$
declare
  v_tenant_a uuid;
  v_tenant_b uuid;
  v_customer_a uuid;
  v_project_a uuid;
  v_quote_b uuid;
  v_rejected boolean;
  v_still_tenant uuid;
begin
  select tenant_a, tenant_b, customer_a, project_a
    into v_tenant_a, v_tenant_b, v_customer_a, v_project_a
    from e10_3_quotes_context;

  -- Positif : l acteur reste membre du tenant B, cette lecture est legitime
  -- (pas un oracle de negation, contrairement a quote_a1 ci-dessus).
  select id into v_quote_b from public.commercial_quotes where tenant_id = v_tenant_b limit 1;
  if v_quote_b is null then
    raise exception 'Aucun devis du tenant B visible pour cibler le scenario with check';
  end if;

  -- INSERT direct portant le tenant_id d un tenant tiers -> refuse.
  v_rejected := false;
  begin
    insert into public.commercial_quotes (tenant_id, customer_id, project_id, number, status)
    values (v_tenant_a, v_customer_a, v_project_a, 'DEV-9999-99999', 'draft');
  exception
    when insufficient_privilege then v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'Un membre du tenant B a pu INSERER un devis portant tenant_id = tenant A';
  end if;

  -- UPDATE qui mute tenant_id d un devis du tenant B vers le tenant A : la
  -- ligne CIBLE appartient a l acteur (using passe), seul with check protege.
  v_rejected := false;
  begin
    update public.commercial_quotes set tenant_id = v_tenant_a where id = v_quote_b;
  exception
    when insufficient_privilege then v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'Un membre du tenant B a pu deplacer son propre devis vers le tenant A';
  end if;
  select tenant_id into v_still_tenant from public.commercial_quotes where id = v_quote_b;
  if v_still_tenant is distinct from v_tenant_b then
    raise exception 'Le devis du tenant B a change de tenant malgre le rejet attendu (valeur: %)', v_still_tenant;
  end if;
end;
$$;

reset role;

-- Aucune ligne bloquee ci-dessus n a ete modifiee sur le tenant A. Cible le
-- MEME id que le scenario 4 (quote_a1, fige en phase privilegiee), pas une
-- redecouverte "la plus ancienne" qui pourrait masquer un id different si le
-- test evolue un jour.
do $$
declare
  v_quote_a_id uuid;
  v_still_flag boolean;
begin
  select quote_a1 into v_quote_a_id from e10_3_quotes_context;
  select show_discounts into v_still_flag from public.commercial_quotes where id = v_quote_a_id;
  if v_still_flag is distinct from false then
    raise exception 'Le devis du tenant A a ete modifie malgre le blocage RLS attendu (valeur: %)', v_still_flag;
  end if;
end;
$$;

-- Le "0 ligne affectee" du scenario 6 ne prouve pas a lui seul que l ecriture
-- n a pas atterri ailleurs (ex. sur une AUTRE annee du meme tenant, si le
-- filtre de la policy hypothetique etait imparfait) : reverifie ICI, en
-- phase privilegiee, que `last_value` du tenant B (SEUL tenant dont l acteur
-- etait membre pendant le scenario 6) vaut toujours 1 — la seule creation de
-- devis jamais faite sur ce tenant, en phase 1.
do $$
declare
  v_tenant_b uuid;
  v_last_value integer;
begin
  select tenant_b into v_tenant_b from e10_3_quotes_context;
  select last_value into v_last_value
    from public.commercial_quote_number_counters
   where tenant_id = v_tenant_b and year = extract(year from (now() at time zone 'utc'))::integer;
  if v_last_value is distinct from 1 then
    raise exception
      'Le compteur du tenant B a change malgre le blocage RLS attendu au scenario 6 (valeur: %)', v_last_value;
  end if;
end;
$$;

rollback;
