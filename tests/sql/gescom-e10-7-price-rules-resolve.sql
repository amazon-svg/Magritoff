-- ============================================================================
-- E10.7 — resolve_price_rule() : arbitrage specificite puis recence, isolation
-- par tenant (RLS de public.price_rules, SECURITY INVOKER).
-- ----------------------------------------------------------------------------
-- Test COMPORTEMENTAL, execute par psql contre la base locale (meme raison
-- que gescom-e10-6-price-rules.sql : une migration ne change jamais apres
-- coup, un `toContain()` sur son texte ne detecterait aucune regression
-- future sur l algorithme reellement execute par Postgres).
--
-- Scenarios :
--   1. Une seule regle candidate au rang le plus specifique -> reason =
--      'specificity'.
--   2. Deux regles de MEME portee et MEME cible, periodes chevauchantes ->
--      la plus recente (created_at) gagne, reason = 'recency'.
--   3. La specificite prime TOUJOURS sur la recence : une regle 'global'
--      creee APRES une regle 'customer_range' ne la bat jamais.
--   4. Desactiver la regle gagnante fait immediatement reprendre la regle
--      moins specifique/moins recente, sans qu aucune ecriture n ait touche
--      cette derniere (created_at/updated_at inchanges).
--   5. Aucune regle active ne couvre le contexte -> rule_id/reason NULL.
--   6. `at` en dehors de la periode -> non candidate.
--   7. Isolation par tenant (qa-review, meme piege que B3/m4/m5/C5/p3 : les
--      identifiants oracle sont figes en phase PRIVILEGIEE) : un membre du
--      tenant B ne peut jamais resoudre une regle du tenant A, meme en
--      fournissant explicitement l id du tenant A en p_tenant_id — la RLS
--      (SECURITY INVOKER) l en empeche, pas seulement le filtre applicatif.
--      Controle positif symetrique sur son propre tenant.
--
-- Lancer : pnpm test:storefront:sql (necessite Supabase local demarre).
-- ============================================================================

begin;

create temporary table e10_7_resolve_context (
  actor_id uuid not null,
  tenant_a uuid not null,
  tenant_b uuid not null,
  customer_b uuid not null,
  gamme_b uuid not null,
  annual_rule_b uuid not null,
  september_rule_b uuid not null
);

grant select on e10_7_resolve_context to authenticated;

-- ── Jeu de donnees, joue en tant que postgres (phase privilegiee) ──────────
do $$
declare
  v_actor uuid;
  v_tenant_a uuid;
  v_tenant_b uuid;
  v_customer_a uuid;
  v_customer_b uuid;
  v_gamme_a uuid;
  v_gamme_b uuid;
  v_annual_rule_a uuid;
  v_customer_range_rule_a uuid;
  v_annual_rule_b uuid;
  v_september_rule_b uuid;
  v_older_rule_b uuid;
  v_newer_rule_b uuid;
  v_range_only_rule_b uuid;
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
    raise exception 'Un utilisateur Auth non super-admin est requis pour le scenario E10.7';
  end if;

  insert into public.tenants (slug, name) values ('e10-7-resolve-a', 'E10.7 Resolve Tenant A')
    returning id into v_tenant_a;
  insert into public.tenants (slug, name) values ('e10-7-resolve-b', 'E10.7 Resolve Tenant B')
    returning id into v_tenant_b;

  -- L acteur n est membre QUE du tenant B (scenario 7).
  insert into public.tenant_members (tenant_id, user_id, role, access_scope, allowed_shop_ids)
  values (v_tenant_b, v_actor, 'admin', 'magrit_full', '{}');

  insert into public.customers (tenant_id, type, company_name, siret)
  values (v_tenant_a, 'company', 'Tenant A Impression', '73282932000074')
  returning id into v_customer_a;
  insert into public.customers (tenant_id, type, company_name, siret)
  values (v_tenant_b, 'company', 'Tenant B Impression', '56078919152347')
  returning id into v_customer_b;

  insert into public.product_gammes (slug, name) values ('e10-7-carterie-a', 'Carterie E10.7 A')
    returning id into v_gamme_a;
  insert into public.product_gammes (slug, name) values ('e10-7-carterie-b', 'Carterie E10.7 B')
    returning id into v_gamme_b;

  -- ── Tenant A : sert UNIQUEMENT au scenario 7 (isolation) ────────────────
  insert into public.price_rules (tenant_id, name, scope, value_type, value, valid_from)
  values (v_tenant_a, 'Marge annuelle A', 'global', 'margin_rate', 0.4000, '2026-01-01')
  returning id into v_annual_rule_a;

  insert into public.price_rules (
    tenant_id, name, scope, customer_id, product_range_id, value_type, value, valid_from
  ) values (
    v_tenant_a, 'Client+gamme A', 'customer_range', v_customer_a, v_gamme_a, 'margin_rate', 0.6000, '2026-01-01'
  ) returning id into v_customer_range_rule_a;

  -- ── Tenant B : scenarios 1 a 6 ──────────────────────────────────────────
  -- Scenario 1/3 : globale, seule candidate au rang le plus specifique dans
  -- son propre contexte (aucun customer_id/product_range_id fourni).
  insert into public.price_rules (tenant_id, name, scope, value_type, value, valid_from)
  values (v_tenant_b, 'Marge annuelle B', 'global', 'margin_rate', 0.3000, '2026-01-01')
  returning id into v_annual_rule_b;

  -- Scenario 3 : customer_range B, creee APRES la globale B mais plus
  -- specifique — doit gagner independamment de created_at.
  insert into public.price_rules (
    tenant_id, name, scope, customer_id, product_range_id, value_type, value, valid_from
  ) values (
    v_tenant_b, 'Client+gamme B', 'customer_range', v_customer_b, v_gamme_b, 'margin_rate', 0.5000, '2026-01-01'
  ) returning id into v_september_rule_b;

  -- Scenario 2 : deux regles GLOBALES, periodes chevauchantes, meme portee.
  -- v_older_rule_b est creee EN PREMIER (created_at le plus ancien).
  insert into public.price_rules (tenant_id, name, scope, value_type, value, valid_from, valid_to)
  values (v_tenant_b, 'Ancienne regle globale B', 'global', 'discount_rate', 0.1000, '2026-06-01', '2026-12-31')
  returning id into v_older_rule_b;

  -- Garantit created_at strictement croissant meme si l horloge de test est
  -- grossiere (meme raisonnement que le fake TypeScript, docs du module).
  perform pg_sleep(0.01);

  insert into public.price_rules (tenant_id, name, scope, value_type, value, valid_from, valid_to)
  values (v_tenant_b, 'Nouvelle regle globale B', 'global', 'discount_rate', 0.1500, '2026-09-01', '2026-09-30')
  returning id into v_newer_rule_b;

  -- Scenario 6 : regle 'range' hors contexte (aucun product_range_id fourni
  -- dans les appels de ce fichier) -> ne doit JAMAIS etre candidate.
  insert into public.price_rules (tenant_id, name, scope, product_range_id, value_type, value, valid_from)
  values (v_tenant_b, 'Regle gamme seule B', 'range', v_gamme_b, 'margin_rate', 0.9999, '2026-01-01')
  returning id into v_range_only_rule_b;

  insert into e10_7_resolve_context (
    actor_id, tenant_a, tenant_b, customer_b, gamme_b, annual_rule_b, september_rule_b
  ) values (v_actor, v_tenant_a, v_tenant_b, v_customer_b, v_gamme_b, v_annual_rule_b, v_september_rule_b);
end;
$$;

-- ── Scenarios 1 a 6, joues en tant que postgres (SECURITY INVOKER : le
-- proprietaire de la fonction est superutilisateur, la RLS ne filtre donc
-- rien ici — c est voulu, ce test verifie l ALGORITHME, l isolation est
-- verifiee separement au scenario 7 sous le role restreint) ─────────────────
do $$
declare
  v_tenant_b uuid;
  v_customer_b uuid;
  v_gamme_b uuid;
  v_annual_rule_b uuid;
  v_september_rule_b uuid;
  v_older_rule_b uuid;
  v_newer_rule_b uuid;
  v_result_rule_id uuid;
  v_result_reason text;
  v_row_count integer;
begin
  select tenant_b, customer_b, gamme_b, annual_rule_b, september_rule_b
    into v_tenant_b, v_customer_b, v_gamme_b, v_annual_rule_b, v_september_rule_b
    from e10_7_resolve_context;

  select id into v_older_rule_b from public.price_rules where name = 'Ancienne regle globale B';
  select id into v_newer_rule_b from public.price_rules where name = 'Nouvelle regle globale B';

  -- 1/3 — sans customer_id/product_range_id : seule la regle globale peut
  -- etre candidate (la customer_range B n a ni customer_id ni
  -- product_range_id fournis) -> specificity, la globale B.
  select rule_id, reason into v_result_rule_id, v_result_reason
    from public.resolve_price_rule(v_tenant_b, null, null, '2027-01-01'::date);
  if v_result_rule_id is distinct from v_annual_rule_b or v_result_reason is distinct from 'specificity' then
    raise exception
      'Sans contexte, resolve_price_rule a rendu (%, %), attendu (%, specificity)',
      v_result_rule_id, v_result_reason, v_annual_rule_b;
  end if;

  -- 3 — AVEC le contexte customer+gamme : la customer_range B doit gagner,
  -- meme si elle a ete creee AVANT les deux regles globales chevauchantes
  -- ci-dessous (la specificite prime toujours sur la recence, CA4).
  select rule_id, reason into v_result_rule_id, v_result_reason
    from public.resolve_price_rule(v_tenant_b, v_customer_b, v_gamme_b, '2026-09-15'::date);
  if v_result_rule_id is distinct from v_september_rule_b or v_result_reason is distinct from 'specificity' then
    raise exception
      'Avec contexte client+gamme, resolve_price_rule a rendu (%, %), attendu (%, specificity)',
      v_result_rule_id, v_result_reason, v_september_rule_b;
  end if;

  -- 2 — deux regles GLOBALES chevauchantes (aucun contexte client/gamme
  -- fourni, donc la customer_range B n est pas candidate) : la plus RECENTE
  -- (v_newer_rule_b) gagne, reason = recency.
  select rule_id, reason into v_result_rule_id, v_result_reason
    from public.resolve_price_rule(v_tenant_b, null, null, '2026-09-15'::date);
  if v_result_rule_id is distinct from v_newer_rule_b or v_result_reason is distinct from 'recency' then
    raise exception
      'Chevauchement de deux regles globales, resolve_price_rule a rendu (%, %), attendu (%, recency)',
      v_result_rule_id, v_result_reason, v_newer_rule_b;
  end if;

  -- Deterministe : un second appel IDENTIQUE rend exactement le meme resultat.
  select rule_id, reason into v_result_rule_id, v_result_reason
    from public.resolve_price_rule(v_tenant_b, null, null, '2026-09-15'::date);
  if v_result_rule_id is distinct from v_newer_rule_b or v_result_reason is distinct from 'recency' then
    raise exception 'resolve_price_rule n est pas deterministe : rendu (%, %) au second appel identique',
      v_result_rule_id, v_result_reason;
  end if;

  -- 6 — hors de la periode des deux regles chevauchantes (mais dans celle de
  -- l annuelle) : seule l annuelle B est candidate.
  select rule_id, reason into v_result_rule_id, v_result_reason
    from public.resolve_price_rule(v_tenant_b, null, null, '2026-03-01'::date);
  if v_result_rule_id is distinct from v_annual_rule_b or v_result_reason is distinct from 'specificity' then
    raise exception
      'Hors periode des regles chevauchantes, resolve_price_rule a rendu (%, %), attendu (%, specificity)',
      v_result_rule_id, v_result_reason, v_annual_rule_b;
  end if;

  -- 4 — desactiver la regle gagnante (la plus recente) fait immediatement
  -- reprendre l ancienne regle globale B, SANS qu aucune ecriture n ait
  -- touche cette derniere.
  update public.price_rules set is_active = false where id = v_newer_rule_b;

  select rule_id, reason into v_result_rule_id, v_result_reason
    from public.resolve_price_rule(v_tenant_b, null, null, '2026-09-15'::date);
  if v_result_rule_id is distinct from v_older_rule_b or v_result_reason is distinct from 'specificity' then
    raise exception
      'Apres desactivation de la plus recente, resolve_price_rule a rendu (%, %), attendu (%, specificity)',
      v_result_rule_id, v_result_reason, v_older_rule_b;
  end if;

  -- L ancienne regle globale B n a jamais ete ecrite (aucun decoupage/duplication).
  perform 1 from public.price_rules
   where id = v_older_rule_b and updated_at = created_at;
  if not found then
    raise exception 'La regle plus ancienne a ete modifiee alors qu aucune ecriture ne devait la toucher';
  end if;

  -- Reactivation : la plus recente reprend immediatement la main.
  update public.price_rules set is_active = true where id = v_newer_rule_b;
  select rule_id, reason into v_result_rule_id, v_result_reason
    from public.resolve_price_rule(v_tenant_b, null, null, '2026-09-15'::date);
  if v_result_rule_id is distinct from v_newer_rule_b then
    raise exception 'Apres reactivation, resolve_price_rule n a pas repris la regle la plus recente (%)',
      v_result_rule_id;
  end if;

  -- 5 — aucune regle active ne couvre ce contexte (aucune regle B n a de
  -- periode couvrant 2020-01-01) -> AUCUNE ligne rendue (pas une ligne
  -- (null, null) : `where rule_id is not null` laisserait passer ce cas-la,
  -- qa-review R3).
  select count(*) into v_row_count
    from public.resolve_price_rule(v_tenant_b, null, null, '2020-01-01'::date);
  if v_row_count <> 0 then
    raise exception
      'Sans aucune regle active couvrant le contexte, resolve_price_rule a rendu % ligne(s) au lieu de zero',
      v_row_count;
  end if;
end;
$$;

-- ── 7. Isolation par tenant, exercee sous le role restreint REEL ───────────
set local role authenticated;

select set_config(
  'request.jwt.claim.sub',
  (select actor_id::text from e10_7_resolve_context),
  true
);

do $$
declare
  v_tenant_a uuid;
  v_tenant_b uuid;
  v_annual_rule_b uuid;
  v_result_rule_id uuid;
  v_result_reason text;
  v_cross_tenant_rows integer;
begin
  select tenant_a, tenant_b, annual_rule_b into v_tenant_a, v_tenant_b, v_annual_rule_b
    from e10_7_resolve_context;

  -- Controle positif : un membre du tenant B resout normalement une regle de
  -- SON PROPRE tenant (sans contexte client/gamme -> la globale B).
  select rule_id, reason into v_result_rule_id, v_result_reason
    from public.resolve_price_rule(v_tenant_b, null, null, '2026-01-15'::date);
  if v_result_rule_id is distinct from v_annual_rule_b then
    raise exception
      'Un membre du tenant B ne peut pas resoudre une regle de son propre tenant (rendu %)',
      v_result_rule_id;
  end if;

  -- Controle negatif — CRITIQUE : un membre du tenant B fournit EXPLICITEMENT
  -- l id du tenant A en p_tenant_id (attaque directe, pas une simple omission)
  -- et ne doit JAMAIS resoudre une regle de ce tenant. La fonction etant
  -- SECURITY INVOKER, la RLS de price_rules filtre les lignes AVANT tout
  -- calcul de specificite/recence : aucune ligne du tenant A n est meme
  -- visible, quel que soit p_customer_id/p_product_range_id fournis.
  select count(*) into v_cross_tenant_rows
    from public.resolve_price_rule(v_tenant_a, null, null, '2026-01-15'::date)
   where rule_id is not null;
  if v_cross_tenant_rows <> 0 then
    raise exception
      'Un membre du tenant B a pu resoudre % regle(s) du tenant A en forcant p_tenant_id',
      v_cross_tenant_rows;
  end if;
end;
$$;

reset role;

rollback;
