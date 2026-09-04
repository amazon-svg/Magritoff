-- ============================================================================
-- E10.11 — droit dedie `can_manage_pricing` : durcissement des policies
-- d ecriture de `price_rules` et `product_range_default_margins`
-- (20260904142026_gescom_e10_11_can_manage_pricing.sql), fondees desormais
-- sur `public.user_has_capability(tenant_id, 'can_manage_pricing')` plutot
-- que sur `tm.role in ('admin', 'member')` ; ET (qa-review sur 1568143,
-- bloquant B1 + reserve R5) durcissement des policies de LECTURE des
-- journaux d audit de prix (20260904150000_gescom_e10_11_audit_select_
-- capability.sql), fondees desormais sur la MEME capability plutot que sur
-- la seule isolation tenant.
-- ----------------------------------------------------------------------------
-- Test COMPORTEMENTAL, execute par psql contre la base locale (meme raison
-- que gescom-e10-6-price-rules.sql : une migration ne change jamais apres
-- coup, un `toContain()` sur son texte ne detecterait aucune regression
-- future sur un `drop policy`/`create policy` mal repris).
--
-- Ce que gescom-e10-6-price-rules.sql prouve DEJA et que ce fichier ne
-- reprend PAS : l isolation inter-tenant (lecture/ecriture), le journal d
-- audit, l append-only. Ce fichier prouve UNIQUEMENT ce que E10.11 change :
-- l ecriture au sein d un MEME tenant depend maintenant du droit metier, pas
-- du simple statut de membre — ET la lecture DIRECTE (hors facade API) des
-- deux journaux d audit de prix depend elle aussi de ce meme droit.
--
-- Scenarios (un SEUL acteur, `role = 'member'` — jamais 'admin' — dans son
-- tenant, pour ecarter toute derivation) :
--   1. Sans aucune affectation de role portant `can_manage_pricing` : refus
--      d ECRITURE sur `price_rules` ET `product_range_default_margins`,
--      alors que la LECTURE reste ouverte (CA7 d E10.6 gouverne l ecran, pas
--      l API — docs/api/CONVENTIONS.md §8.11, « ecart assume »).
--   2. Apres affectation d un role de tenant portant
--      `{"can_manage_pricing": true}` (meme mecanisme que
--      shop-customer-delegation.sql, UM5) : les DEUX ecritures reussissent,
--      sans qu aucune autre donnee du membre n ait change.
--   3. Apres REVOCATION de cette affectation (`revoked_at`) : les DEUX
--      ecritures redeviennent refusees (qa-review R1 : les DEUX tables sont
--      effectivement rejouees ici, pas seulement `price_rules`) — la policy
--      lit `user_has_capability` A CHAQUE APPEL, pas un instantane fige a
--      l affectation. `product_range_default_margins` utilise une SECONDE
--      gamme (`gamme_b`) pour cet essai : `gamme_a` porte deja une ligne
--      ecrite au scenario 2 (PK `(tenant_id, product_range_id)`), reutiliser
--      la meme gamme ferait passer un `on conflict do update` a tort meme si
--      la policy d ecriture etait cassee — un INSERT franc sur une ligne
--      absente est le seul oracle honnete ici.
--   4. (qa-review, bloquant B1) Lecture DIRECTE des journaux d audit
--      (`commercial_quote_line_audit`, `price_rules_audit`) par appel
--      PostgREST/psql SANS passer par la facade API : refusee au meme
--      acteur `member` toujours SANS `can_manage_pricing` (etat courant en
--      fin de scenario 3, apres revocation) bien que des lignes existent
--      REELLEMENT dans son tenant (verifie en phase privilegiee, precondition
--      du test) ; puis acceptee des qu une NOUVELLE affectation portant
--      `can_manage_pricing` lui est attribuee. Prouve que la RLS ferme desormais
--      le contournement direct — la garde applicative de la facade
--      (`CommercialQuotesService.listAuditEntries`, 403
--      `identity.role_required`) reste hors-perimetre de ce fichier (deja
--      couverte par `tests/contract/commercial-quotes.contract.test.ts`).
--
-- Lancer : pnpm test:storefront:sql (necessite Supabase local demarre).
-- ============================================================================

begin;

create temporary table e10_11_pricing_context (
  actor_id      uuid not null,
  tenant_a      uuid not null,
  gamme_a       uuid not null,
  gamme_b       uuid not null,
  customer_a    uuid not null,
  project_a     uuid not null,
  quote_a       uuid not null,
  role_def_id   uuid,
  assignment_id uuid
);

grant select on e10_11_pricing_context to authenticated;

-- ── Phase privilegiee (role de connexion `postgres`) ────────────────────────
do $$
declare
  v_actor uuid;
  v_tenant_a uuid;
  v_gamme_a uuid;
  v_gamme_b uuid;
  v_customer_a uuid;
  v_project_a uuid;
  v_quote_a uuid;
  v_line_audit_count integer;
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
    raise exception 'Un utilisateur Auth non super-admin est requis pour le scenario E10.11';
  end if;

  insert into public.tenants (slug, name) values ('e10-11-pricing-cap', 'E10.11 Pricing Capability Tenant')
    returning id into v_tenant_a;

  -- L acteur n est que MEMBRE simple de son tenant — jamais admin, pour que
  -- toute reussite d ecriture ou de lecture d audit ci-dessous ne puisse
  -- venir QUE du droit dedie, jamais de la derivation d appartenance.
  insert into public.tenant_members (tenant_id, user_id, role, access_scope, allowed_shop_ids)
  values (v_tenant_a, v_actor, 'member', 'magrit_full', '{}');

  insert into public.product_gammes (slug, name) values ('e10-11-carterie', 'Carterie E10.11')
    returning id into v_gamme_a;
  insert into public.product_gammes (slug, name) values ('e10-11-affiches', 'Affiches E10.11')
    returning id into v_gamme_b;

  -- ── Donnees pour le scenario 4 (B1) : un devis + une ligne dans le MEME
  --    tenant, pour produire au moins une entree `commercial_quote_line_audit`
  --    reelle (trigger d insertion, E10.9) que l acteur pourra tenter de lire
  --    en direct. Peuplee en phase privilegiee : bypass RLS, comme le reste
  --    de cette section.
  insert into public.customers (tenant_id, type, company_name, siret)
  values (v_tenant_a, 'company', 'Tenant A Impression E10.11', '73282932000074')
  returning id into v_customer_a;

  insert into public.projects (tenant_id, customer_id, name)
  values (v_tenant_a, v_customer_a, 'Projet E10.11')
  returning id into v_project_a;

  insert into public.commercial_quotes (tenant_id, customer_id, project_id, number, status, created_by)
  values (v_tenant_a, v_customer_a, v_project_a, 'DEV-9999-00101', 'draft', v_actor)
  returning id into v_quote_a;

  insert into public.commercial_quote_lines
    (quote_id, origin, project_item_id, label, quantity, production_price, public_price,
     customer_price, applied_margin_rate, sale_price, breakdown)
  values
    (v_quote_a, 'free', null, 'Ligne E10.11 (audit B1)', 1, 10.00, 15.00, 15.00, 0.3333, 15.00,
     '[{"post":"total","cost":"10.00","margin_rate":"0.3333","price":"15.00","source":"clariprint"}]'::jsonb);

  -- Precondition du scenario 4 : au moins une entree d audit existe reellement
  -- pour ce devis (sinon un compte a 0 cote acteur ne prouverait rien).
  select count(*) into v_line_audit_count
    from public.commercial_quote_line_audit
   where quote_id = v_quote_a;
  if v_line_audit_count = 0 then
    raise exception 'Precondition invalide : aucune entree d audit de ligne generee pour le devis E10.11';
  end if;

  insert into e10_11_pricing_context (actor_id, tenant_a, gamme_a, gamme_b, customer_a, project_a, quote_a)
  values (v_actor, v_tenant_a, v_gamme_a, v_gamme_b, v_customer_a, v_project_a, v_quote_a);
end;
$$;

-- ── 1. Membre SANS le droit : lecture ouverte, ecriture refusee ────────────
set local role authenticated;
select set_config('request.jwt.claim.sub', (select actor_id::text from e10_11_pricing_context), true);

do $$
declare
  v_tenant_a uuid;
  v_gamme_a uuid;
  v_visible integer;
  v_insert_rejected boolean := false;
  v_margin_rejected boolean := false;
begin
  select tenant_a, gamme_a into v_tenant_a, v_gamme_a from e10_11_pricing_context;

  -- Lecture : toujours ouverte a tout membre (CA7 gouverne l ecran, pas l API).
  select count(*) into v_visible from public.price_rules where tenant_id = v_tenant_a;
  if v_visible <> 0 then
    raise exception 'Precondition invalide : % regle(s) deja presentes avant test', v_visible;
  end if;

  -- Ecriture price_rules : refusee sans le droit.
  begin
    insert into public.price_rules (tenant_id, name, scope, value_type, value, valid_from)
    values (v_tenant_a, 'Regle sans droit', 'global', 'margin_rate', 0.1000, '2026-09-01');
  exception
    when insufficient_privilege then v_insert_rejected := true;
  end;
  if not v_insert_rejected then
    perform 1 from public.price_rules where tenant_id = v_tenant_a and name = 'Regle sans droit';
    if found then
      raise exception 'Un membre SANS can_manage_pricing a pu creer une regle de prix';
    end if;
  end if;

  -- Ecriture product_range_default_margins : refusee sans le droit.
  begin
    insert into public.product_range_default_margins (tenant_id, product_range_id, margin_rate)
    values (v_tenant_a, v_gamme_a, 0.3000);
  exception
    when insufficient_privilege then v_margin_rejected := true;
  end;
  if not v_margin_rejected then
    perform 1 from public.product_range_default_margins
     where tenant_id = v_tenant_a and product_range_id = v_gamme_a;
    if found then
      raise exception 'Un membre SANS can_manage_pricing a pu ecrire une marge standard';
    end if;
  end if;
end;
$$;

reset role;

-- ── 2. Affectation du droit (meme mecanisme que shop-customer-delegation.sql,
--      UM5) : role de tenant portant `can_manage_pricing`, affecte a l acteur.
do $$
declare
  v_actor uuid;
  v_tenant_a uuid;
  v_role_def uuid;
  v_assignment uuid;
begin
  select actor_id, tenant_a into v_actor, v_tenant_a from e10_11_pricing_context;

  insert into public.tenant_role_definitions (tenant_id, name, capabilities, created_by)
  values (v_tenant_a, 'E10.11 Commercial Prix', '{"can_manage_pricing": true}'::jsonb, v_actor)
  returning id into v_role_def;

  insert into public.tenant_role_assignments (role_definition_id, user_id, assigned_by)
  values (v_role_def, v_actor, v_actor)
  returning id into v_assignment;

  update e10_11_pricing_context set role_def_id = v_role_def, assignment_id = v_assignment;
end;
$$;

-- ── 2 (suite). Meme acteur, meme tenant, AVEC le droit desormais : les deux
--      ecritures reussissent. ───────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claim.sub', (select actor_id::text from e10_11_pricing_context), true);

do $$
declare
  v_tenant_a uuid;
  v_gamme_a uuid;
  v_rule_id uuid;
begin
  select tenant_a, gamme_a into v_tenant_a, v_gamme_a from e10_11_pricing_context;

  insert into public.price_rules (tenant_id, name, scope, value_type, value, valid_from)
  values (v_tenant_a, 'Regle avec droit', 'global', 'margin_rate', 0.1000, '2026-09-01')
  returning id into v_rule_id;
  if v_rule_id is null then
    raise exception 'Un membre AVEC can_manage_pricing n a pas pu creer une regle de prix';
  end if;

  insert into public.product_range_default_margins (tenant_id, product_range_id, margin_rate)
  values (v_tenant_a, v_gamme_a, 0.3000)
  on conflict (tenant_id, product_range_id) do update set margin_rate = excluded.margin_rate;

  perform 1 from public.product_range_default_margins
   where tenant_id = v_tenant_a and product_range_id = v_gamme_a and margin_rate = 0.3000;
  if not found then
    raise exception 'Un membre AVEC can_manage_pricing n a pas pu ecrire une marge standard';
  end if;
end;
$$;

reset role;

-- ── 3. Revocation de l affectation : le droit est re-evalue A CHAQUE APPEL,
--      pas fige a l affectation — l ecriture redevient refusee sur les DEUX
--      tables (qa-review R1). ────────────────────────────────────────────────
update public.tenant_role_assignments
   set revoked_at = now()
 where id = (select assignment_id from e10_11_pricing_context);

set local role authenticated;
select set_config('request.jwt.claim.sub', (select actor_id::text from e10_11_pricing_context), true);

do $$
declare
  v_tenant_a uuid;
  v_gamme_b uuid;
  v_insert_rejected boolean := false;
  v_margin_rejected boolean := false;
begin
  select tenant_a, gamme_b into v_tenant_a, v_gamme_b from e10_11_pricing_context;

  begin
    insert into public.price_rules (tenant_id, name, scope, value_type, value, valid_from)
    values (v_tenant_a, 'Regle apres revocation', 'global', 'margin_rate', 0.1000, '2026-09-01');
  exception
    when insufficient_privilege then v_insert_rejected := true;
  end;
  if not v_insert_rejected then
    perform 1 from public.price_rules where tenant_id = v_tenant_a and name = 'Regle apres revocation';
    if found then
      raise exception 'Un membre dont can_manage_pricing a ete REVOQUE a quand meme pu creer une regle';
    end if;
  end if;

  -- qa-review R1 : le meme cycle est rejoue sur `product_range_default_margins`,
  -- pas seulement annonce dans l en-tete. `gamme_b` (jamais ecrite avant, PK
  -- distincte de gamme_a) evite tout `on conflict` qui masquerait une policy
  -- cassee derriere une mise a jour reussie.
  begin
    insert into public.product_range_default_margins (tenant_id, product_range_id, margin_rate)
    values (v_tenant_a, v_gamme_b, 0.4000);
  exception
    when insufficient_privilege then v_margin_rejected := true;
  end;
  if not v_margin_rejected then
    perform 1 from public.product_range_default_margins
     where tenant_id = v_tenant_a and product_range_id = v_gamme_b;
    if found then
      raise exception 'Un membre dont can_manage_pricing a ete REVOQUE a quand meme pu ecrire une marge standard';
    end if;
  end if;
end;
$$;

reset role;

-- ── 4. Bloquant B1 (qa-review sur 1568143) : lecture DIRECTE des journaux
--      d audit refusee sans le droit, acceptee avec. ──────────────────────────
set local role authenticated;
select set_config('request.jwt.claim.sub', (select actor_id::text from e10_11_pricing_context), true);

do $$
declare
  v_tenant_a uuid;
  v_quote_a uuid;
  v_visible_lines integer;
  v_visible_prices integer;
begin
  select tenant_a, quote_a into v_tenant_a, v_quote_a from e10_11_pricing_context;

  -- Acteur toujours SANS can_manage_pricing (revoque au scenario 3) : les
  -- DEUX journaux, pourtant peuples reellement (precondition verifiee en
  -- phase privilegiee pour commercial_quote_line_audit ; price_rules_audit
  -- porte au moins la ligne 'Regle avec droit' du scenario 2), doivent
  -- rester INVISIBLES par appel PostgREST/psql direct.
  select count(*) into v_visible_lines
    from public.commercial_quote_line_audit
   where quote_id = v_quote_a;
  if v_visible_lines <> 0 then
    raise exception 'Un membre SANS can_manage_pricing lit % entree(s) commercial_quote_line_audit en direct', v_visible_lines;
  end if;

  select count(*) into v_visible_prices
    from public.price_rules_audit
   where tenant_id = v_tenant_a;
  if v_visible_prices <> 0 then
    raise exception 'Un membre SANS can_manage_pricing lit % entree(s) price_rules_audit en direct', v_visible_prices;
  end if;
end;
$$;

reset role;

-- Nouvelle affectation (la precedente reste revoquee) portant
-- `can_manage_pricing`, pour prouver que la lecture s ouvre exactement dans
-- l autre sens — meme mecanisme que le scenario 2.
do $$
declare
  v_actor uuid;
  v_tenant_a uuid;
  v_role_def uuid;
begin
  select actor_id, tenant_a into v_actor, v_tenant_a from e10_11_pricing_context;

  insert into public.tenant_role_definitions (tenant_id, name, capabilities, created_by)
  values (v_tenant_a, 'E10.11 Supervision Prix', '{"can_manage_pricing": true}'::jsonb, v_actor)
  returning id into v_role_def;

  insert into public.tenant_role_assignments (role_definition_id, user_id, assigned_by)
  values (v_role_def, v_actor, v_actor);
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', (select actor_id::text from e10_11_pricing_context), true);

do $$
declare
  v_tenant_a uuid;
  v_quote_a uuid;
  v_visible_lines integer;
  v_visible_prices integer;
begin
  select tenant_a, quote_a into v_tenant_a, v_quote_a from e10_11_pricing_context;

  select count(*) into v_visible_lines
    from public.commercial_quote_line_audit
   where quote_id = v_quote_a;
  if v_visible_lines = 0 then
    raise exception 'Un membre AVEC can_manage_pricing ne peut plus lire commercial_quote_line_audit en direct';
  end if;

  select count(*) into v_visible_prices
    from public.price_rules_audit
   where tenant_id = v_tenant_a;
  if v_visible_prices = 0 then
    raise exception 'Un membre AVEC can_manage_pricing ne peut plus lire price_rules_audit en direct';
  end if;
end;
$$;

reset role;

rollback;
