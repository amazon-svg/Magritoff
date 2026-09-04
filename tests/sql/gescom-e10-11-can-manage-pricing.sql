-- ============================================================================
-- E10.11 — droit dedie `can_manage_pricing` : durcissement des policies
-- d ecriture de `price_rules` et `product_range_default_margins`
-- (20260904142026_gescom_e10_11_can_manage_pricing.sql), fondees sur
-- `public.user_has_capability(tenant_id, 'can_manage_pricing')` plutot que
-- sur `tm.role in ('admin', 'member')` ; ET durcissement des policies de
-- LECTURE des journaux d audit de prix (20260904150000_gescom_e10_11_audit_
-- select_capability.sql), fondees sur la MEME capability plutot que sur la
-- seule isolation tenant.
-- ----------------------------------------------------------------------------
-- Test COMPORTEMENTAL, execute par psql contre la base locale (meme raison
-- que gescom-e10-6-price-rules.sql : une migration ne change jamais apres
-- coup, un `toContain()` sur son texte ne detecterait aucune regression
-- future sur un `drop policy`/`create policy` mal repris).
--
-- Ce que gescom-e10-6-price-rules.sql prouve DEJA et que ce fichier ne
-- reprend PAS : l isolation inter-tenant (lecture/ecriture), le journal d
-- audit, l append-only. Ce fichier prouve UNIQUEMENT ce que E10.11 change.
--
-- ── Reecriture qa-review round 2 (consequence du bloquant B1 de l architecte
--    sur le contrat, deja anticipee) ───────────────────────────────────────
-- Le round precedent de ce fichier octroyait le droit `can_manage_pricing` a
-- un acteur `role = 'member'` par une NOUVELLE affectation de role portant
-- `{"can_manage_pricing": true}`. Ce mecanisme echoue desormais VOLONTAIREMENT
-- des lors que le membre est Magrit (`access_scope = 'magrit_full'`, le
-- defaut) : le trigger UM1 `restrict_magrit_assignments_to_options`
-- (`20260824000200_um1_admin_shop_guards.sql:47-74`) n autorise l affectation
-- d un role Magrit qu aux deux options produit (`option_shops`,
-- `option_orders`) — jamais a un role de tenant arbitraire, meme s il porte
-- une capability metier valide. Ce n est PAS un bug a contourner : c est le
-- verrou « admin unique » du chantier UM (14/08), rappele et confirme par
-- Arnaud le 04/09 pour E10.11 (docs/api/CONVENTIONS.md §8.11, s2) —
-- `can_manage_pricing` reste reserve aux `admin` du tenant par derivation
-- d appartenance, sans mecanisme de delegation dans cette story.
--
-- Ce fichier prouve donc desormais ce que la story livre REELLEMENT :
--   1. Un acteur `role = 'member'` (jamais admin, sans affectation de role) :
--      refuse en ECRITURE sur `price_rules`/`product_range_default_margins`,
--      refuse en LECTURE DIRECTE (hors facade API) sur
--      `commercial_quote_line_audit`/`price_rules_audit`, bien que les DEUX
--      journaux portent reellement au moins une entree dans son tenant
--      (precondition verifiee en phase privilegiee pour CHACUN des deux
--      journaux, qa-review R4 — pas seulement pour le premier).
--   2. Un acteur `role = 'admin'` du MEME tenant, SANS AUCUNE affectation de
--      role explicite : les DEUX ecritures reussissent ET les DEUX lectures
--      directes reussissent, par la seule derivation d appartenance
--      (`user_has_capability` retourne vrai pour `admin`,
--      `20260814000200_admin_unique.sql:135-142`). Ce scenario sert aussi de
--      garde-fou anti-regression (qa-review R1) pour le durcissement de
--      `20260904150000_gescom_e10_11_audit_select_capability.sql` : le seul
--      garde-fou de ce correctif ne reposait jusqu ici que sur de la prose.
--   3. Tentative EXPLICITE d affectation d un role portant
--      `can_manage_pricing` a un membre Magrit (`access_scope =
--      'magrit_full'`) : refusee par le trigger UM1 avec `magrit_option_
--      required` (SQLSTATE 23514) — comportement A PROTEGER, documente ici
--      comme partie du test plutot que suppose ou contourne.
--
-- Lancer : pnpm test:storefront:sql (necessite Supabase local demarre).
-- ============================================================================

begin;

create temporary table e10_11_pricing_context (
  actor_member uuid not null,
  actor_admin  uuid not null,
  tenant_a     uuid not null,
  gamme_a      uuid not null,
  customer_a   uuid not null,
  project_a    uuid not null,
  quote_a      uuid not null
);

grant select on e10_11_pricing_context to authenticated;

-- ── Phase privilegiee (role de connexion `postgres`) ────────────────────────
do $$
declare
  v_actor_member uuid;
  v_actor_admin uuid;
  v_tenant_a uuid;
  v_gamme_a uuid;
  v_customer_a uuid;
  v_project_a uuid;
  v_quote_a uuid;
  v_line_audit_count integer;
  v_price_audit_count integer;
  v_seed_rule_id uuid;
begin
  -- Deux acteurs DISTINCTS, ni l un ni l autre super-admin du tenant systeme
  -- (sinon `is_super_admin()` court-circuiterait la RLS et ne prouverait
  -- rien de la derivation d appartenance testee au scenario 2).
  select u.id into v_actor_member
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

  if v_actor_member is null then
    raise exception 'Un utilisateur Auth non super-admin est requis pour le scenario E10.11 (membre)';
  end if;

  select u.id into v_actor_admin
    from auth.users u
   where u.id <> v_actor_member
     and not exists (
       select 1
         from public.tenant_members tm
         join public.tenants t on t.id = tm.tenant_id
        where tm.user_id = u.id
          and t.is_system_tenant = true
          and tm.role in ('owner', 'admin')
     )
   order by u.created_at
   limit 1;

  if v_actor_admin is null then
    raise exception 'Un second utilisateur Auth non super-admin est requis pour le scenario E10.11 (admin)';
  end if;

  insert into public.tenants (slug, name) values ('e10-11-pricing-cap', 'E10.11 Pricing Capability Tenant')
    returning id into v_tenant_a;

  -- Un acteur `member` (jamais admin, jamais d affectation de role) et un
  -- acteur `admin` du MEME tenant, tous deux Magrit (`access_scope =
  -- 'magrit_full'`, le defaut) : c est cette derniere condition qui rend le
  -- scenario 3 (trigger UM1) pertinent pour n importe lequel des deux.
  insert into public.tenant_members (tenant_id, user_id, role, access_scope, allowed_shop_ids)
  values (v_tenant_a, v_actor_member, 'member', 'magrit_full', '{}');

  insert into public.tenant_members (tenant_id, user_id, role, access_scope, allowed_shop_ids)
  values (v_tenant_a, v_actor_admin, 'admin', 'magrit_full', '{}');

  insert into public.product_gammes (slug, name) values ('e10-11-carterie', 'Carterie E10.11')
    returning id into v_gamme_a;

  -- ── Donnees pour la lecture directe de `commercial_quote_line_audit` : un
  --    devis + une ligne dans le tenant, pour produire au moins une entree
  --    reelle (trigger d insertion, E10.9). Peuplees en phase privilegiee :
  --    bypass RLS, comme le reste de cette section.
  insert into public.customers (tenant_id, type, company_name, siret)
  values (v_tenant_a, 'company', 'Tenant A Impression E10.11', '73282932000074')
  returning id into v_customer_a;

  insert into public.projects (tenant_id, customer_id, name)
  values (v_tenant_a, v_customer_a, 'Projet E10.11')
  returning id into v_project_a;

  insert into public.commercial_quotes (tenant_id, customer_id, project_id, number, status, created_by)
  values (v_tenant_a, v_customer_a, v_project_a, 'DEV-9999-00101', 'draft', v_actor_admin)
  returning id into v_quote_a;

  insert into public.commercial_quote_lines
    (quote_id, origin, project_item_id, label, quantity, production_price, public_price,
     customer_price, applied_margin_rate, sale_price, breakdown)
  values
    (v_quote_a, 'free', null, 'Ligne E10.11 (audit)', 1, 10.00, 15.00, 15.00, 0.3333, 15.00,
     '[{"post":"total","cost":"10.00","margin_rate":"0.3333","price":"15.00","source":"clariprint"}]'::jsonb);

  -- Precondition (qa-review R4, deja en place pour ce journal au round
  -- precedent) : au moins une entree `commercial_quote_line_audit` existe
  -- reellement pour ce devis avant le test de non-visibilite du scenario 1.
  select count(*) into v_line_audit_count
    from public.commercial_quote_line_audit
   where quote_id = v_quote_a;
  if v_line_audit_count = 0 then
    raise exception 'Precondition invalide : aucune entree d audit de ligne generee pour le devis E10.11';
  end if;

  -- ── Donnees pour la lecture directe de `price_rules_audit` (qa-review
  --    R4) : une regle de prix est ecrite ICI, EN PHASE PRIVILEGIEE, pour
  --    produire une entree d audit REELLE (trigger `price_rules_audit_
  --    insert`, E10.6) AVANT le test du scenario 1 — auparavant, ce fichier
  --    comptait sur une chaine implicite depuis un scenario anterieur
  --    (l ecriture reussie du scenario « avec droit ») ; la precondition est
  --    desormais explicite et independante, symetrique de celle deja posee
  --    ci-dessus pour `commercial_quote_line_audit`.
  insert into public.price_rules (tenant_id, name, scope, value_type, value, valid_from)
  values (v_tenant_a, 'Regle seed audit E10.11', 'global', 'margin_rate', 0.1000, '2026-09-01')
  returning id into v_seed_rule_id;

  select count(*) into v_price_audit_count
    from public.price_rules_audit
   where tenant_id = v_tenant_a;
  if v_price_audit_count = 0 then
    raise exception 'Precondition invalide : aucune entree price_rules_audit generee pour le tenant E10.11';
  end if;

  insert into e10_11_pricing_context
    (actor_member, actor_admin, tenant_a, gamme_a, customer_a, project_a, quote_a)
  values
    (v_actor_member, v_actor_admin, v_tenant_a, v_gamme_a, v_customer_a, v_project_a, v_quote_a);
end;
$$;

-- ── 1. Membre SANS `can_manage_pricing` (jamais admin, aucune affectation) :
--      ecriture refusee sur les DEUX tables, lecture DIRECTE refusee sur les
--      DEUX journaux, bien qu ils portent reellement des entrees (preconditions
--      ci-dessus). ─────────────────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claim.sub', (select actor_member::text from e10_11_pricing_context), true);

do $$
declare
  v_tenant_a uuid;
  v_gamme_a uuid;
  v_quote_a uuid;
  v_insert_rejected boolean := false;
  v_margin_rejected boolean := false;
  v_visible_lines integer;
  v_visible_prices integer;
begin
  select tenant_a, gamme_a, quote_a into v_tenant_a, v_gamme_a, v_quote_a from e10_11_pricing_context;

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

  -- Lecture DIRECTE des deux journaux d audit : refusee sans le droit, bien
  -- que des lignes existent REELLEMENT dans son tenant (preconditions
  -- verifiees en phase privilegiee).
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

-- ── 2. Admin du MEME tenant, SANS AUCUNE affectation de role explicite :
--      les DEUX ecritures reussissent ET les DEUX lectures directes
--      reussissent, par la seule derivation d appartenance
--      (`user_has_capability`, `20260814000200_admin_unique.sql:135-142`).
--      Sert aussi de garde-fou anti-regression pour le durcissement de la
--      LECTURE (qa-review R1) : le seul garde-fou du correctif B1/R5 du
--      round precedent ne reposait jusqu ici que sur de la prose. ──────────
set local role authenticated;
select set_config('request.jwt.claim.sub', (select actor_admin::text from e10_11_pricing_context), true);

do $$
declare
  v_tenant_a uuid;
  v_gamme_a uuid;
  v_quote_a uuid;
  v_rule_id uuid;
  v_visible_lines integer;
  v_visible_prices integer;
begin
  select tenant_a, gamme_a, quote_a into v_tenant_a, v_gamme_a, v_quote_a from e10_11_pricing_context;

  insert into public.price_rules (tenant_id, name, scope, value_type, value, valid_from)
  values (v_tenant_a, 'Regle admin sans affectation', 'global', 'margin_rate', 0.1500, '2026-09-01')
  returning id into v_rule_id;
  if v_rule_id is null then
    raise exception 'Un admin du tenant n a pas pu creer une regle de prix par derivation';
  end if;

  insert into public.product_range_default_margins (tenant_id, product_range_id, margin_rate)
  values (v_tenant_a, v_gamme_a, 0.3000)
  on conflict (tenant_id, product_range_id) do update set margin_rate = excluded.margin_rate;

  perform 1 from public.product_range_default_margins
   where tenant_id = v_tenant_a and product_range_id = v_gamme_a and margin_rate = 0.3000;
  if not found then
    raise exception 'Un admin du tenant n a pas pu ecrire une marge standard par derivation';
  end if;

  select count(*) into v_visible_lines
    from public.commercial_quote_line_audit
   where quote_id = v_quote_a;
  if v_visible_lines = 0 then
    raise exception 'Un admin du tenant, sans affectation explicite, ne peut pas lire commercial_quote_line_audit en direct';
  end if;

  select count(*) into v_visible_prices
    from public.price_rules_audit
   where tenant_id = v_tenant_a;
  if v_visible_prices = 0 then
    raise exception 'Un admin du tenant, sans affectation explicite, ne peut pas lire price_rules_audit en direct';
  end if;
end;
$$;

reset role;

-- ── 3. Comportement A PROTEGER (pas un bug) : une definition de role portant
--      `can_manage_pricing` NE PEUT PAS etre affectee a un membre Magrit
--      (`access_scope = 'magrit_full'`) — trigger UM1
--      `restrict_magrit_assignments_to_options`
--      (`20260824000200_um1_admin_shop_guards.sql:47-74`). C est ce verrou,
--      et non une lacune de cette story, qui interdit toute delegation de
--      `can_manage_pricing` a un membre simple dans le modele Magrit actuel
--      (docs/api/CONVENTIONS.md §8.11, s2). Verifie sur le membre SANS le
--      droit du scenario 1, en phase privilegiee (le trigger s applique
--      independamment de l acteur qui ecrit, ce n est pas une garde RLS). ──
do $$
declare
  v_actor_member uuid;
  v_tenant_a uuid;
  v_role_def uuid;
  v_rejected boolean := false;
  v_message text;
begin
  select actor_member, tenant_a into v_actor_member, v_tenant_a from e10_11_pricing_context;

  insert into public.tenant_role_definitions (tenant_id, name, capabilities, created_by)
  values (v_tenant_a, 'E10.11 Commercial Prix (rejete)', '{"can_manage_pricing": true}'::jsonb, v_actor_member)
  returning id into v_role_def;

  begin
    insert into public.tenant_role_assignments (role_definition_id, user_id, assigned_by)
    values (v_role_def, v_actor_member, v_actor_member);
  exception
    when sqlstate '23514' then
      v_rejected := true;
      v_message := sqlerrm;
  end;

  if not v_rejected then
    raise exception 'Un role portant can_manage_pricing a pu etre affecte a un membre Magrit (trigger UM1 contourne)';
  end if;
  if v_message <> 'magrit_option_required' then
    raise exception 'Affectation rejetee pour une raison inattendue : %', v_message;
  end if;

  perform 1 from public.tenant_role_assignments where role_definition_id = v_role_def;
  if found then
    raise exception 'Une affectation rejetee par le trigger UM1 est neanmoins visible en base';
  end if;
end;
$$;

rollback;
