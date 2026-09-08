-- ============================================================================
-- Sprint 5 Gestion commerciale — story E10.13 : etapes de production
-- configurables et ordonnancables. Contrat : openapi/magrit-core.v1.yaml,
-- docs/api/CONVENTIONS.md §8.15.
-- ----------------------------------------------------------------------------
-- Ce que cette migration fait :
--
--   1. Table NEUVE `public.production_steps` — referentiel de tenant (CA1,
--      CA2, CA4, CA7), DISTINCTE de `public.tenant_order_status_definitions`
--      (S-ORDER-ROLES) : cette derniere est adossee a l enum SQL
--      `tenant_order_status` et gouverne la commande BOUTIQUE
--      (`tenant_orders`), elle ne peut PAS recevoir de code neuf — le CA2
--      d E10.13 exige de CREER des etapes. Meme frontiere qu entre `quotes`/
--      `commercial_quotes` (E10.3) et `tenant_orders`/`commercial_orders`
--      (E10.12). Voir docs/api/CONVENTIONS.md §8.15 §0 decouverte n°2.
--
--   2. Seed du jeu standard (CA1) — `seed_tenant_catalogs()` (trigger
--      `tenants_seed_catalogs`, `20260601000200`, deja etendu par
--      `20260824000600`) est REMPLACE (`create or replace function`, jamais
--      une edition des migrations d origine) avec un troisieme bloc
--      `production_steps`, plus un RATTRAPAGE des tenants deja crees.
--
--   3. `commercial_orders.current_production_step_id` — colonne NEUVE,
--      nullable, `on delete restrict` depuis `production_steps`. Le trigger
--      `commercial_orders_immutable()` (E10.12) N EST NI EDITE NI RECREE : il
--      est PAR COLONNE, une colonne neuve n y figure pas, elle est mutable
--      des sa creation (docs/api/CONVENTIONS.md §8.15 §0 decouverte n°1).
--
--   4. `api_convert_commercial_quote(uuid, uuid)` — RECOPIEE VERBATIM depuis
--      `20260908010000` (`create or replace`, meme signature), UNE SEULE
--      difference : la colonne `current_production_step_id` est ajoutee a
--      l `insert into commercial_orders`, posee a l etape ACTIVE de POSITION
--      LA PLUS BASSE du tenant (sous-requete scalaire dans le `values`,
--      arbitrage Arnaud du 2026-09-08, docs/api/CONVENTIONS.md §8.15 #2ter).
--      `null` sans erreur si le tenant n a aucune etape active. E10.12 n est
--      PAS rouverte : ni son fichier de migration, ni son perimetre.
--
--   5. RATTRAPAGE des commandes `commercial_orders` deja creees par E10.12
--      (avant ce lot) : posees sur l etape active de position la plus basse
--      du tenant, ou laissees `null` si aucune n existe.
--
--   6. Trois fonctions `api_*` (`security definer`), chacune UNE transaction,
--      serialisees PAR TENANT via `pg_advisory_xact_lock` (meme patron que
--      `20260811000400_api_create_order_atomic.sql`) :
--      `api_create_production_step` (plafond 50 sous verrou, position = n),
--      `api_delete_production_step` (409 `production_step.in_use` tenu par
--      la cle etrangere, reindexation dans la meme transaction),
--      `api_reorder_production_steps` (`set constraints ... deferred`,
--      exhaustivite verifiee AVANT tout UPDATE, reindexation 0..n-1).
--      `updateProductionStep` (PATCH) n a besoin d AUCUNE fonction : un
--      UPDATE garde par la RLS suffit (§3 du contrat).
--
--   7. RLS — `production_steps_select` (meme forme que les autres tables E10),
--      `production_steps_write` PORTE PAR `public.user_has_capability(tenant_id,
--      'can_manage_production_steps')` DIRECTEMENT en `using`/`with check` —
--      pas un role code en dur (regle 4 du §3.5 : la garde doit exister EN
--      BASE). Les trois fonctions `security definer` ci-dessus BYPASSENT
--      cette RLS (proprietaire de la fonction) : chacune reimplemente donc le
--      MEME controle explicitement en tete de corps, meme discipline que
--      `api_convert_commercial_quote`.
--
--   8. `public.list_commercial_orders_by_production_step(...)` — lecture
--      SEULE, `security invoker` (la RLS de `commercial_orders`/
--      `production_steps` s applique normalement, comme un SELECT direct),
--      necessaire pour `sort=production_step|-production_step` de
--      `listCommercialOrders` (CA6) : ce tri porte sur la POSITION de l etape
--      jointe, avec les commandes SANS etape toujours en dernier — un ordre
--      que `.order()` PostgREST ne sait pas exprimer sur une table jointe en
--      LEFT JOIN (il ne propage l ordre au niveau de la ligne parente qu avec
--      `!inner`, qui exclurait les commandes sans etape). Meme precedent
--      qu `resolve_price_rule` (E10.7) : une lecture qui exige un calcul que
--      PostgREST seul ne sait pas exprimer passe par une fonction SQL, pas
--      par une reimplementation cote application.
-- ============================================================================

-- ── 1. Table `production_steps` ─────────────────────────────────────────────
create table if not exists public.production_steps (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  label       text not null check (btrim(label) <> '' and char_length(label) <= 60),
  -- Entier, contigu de 0 a n-1 (actives et desactivees confondues). Reaffecte
  -- PAR LE SERVEUR (creation/suppression/reordonnancement) : aucune colonne
  -- de commande de creation/modification ne le porte (contrat).
  position    integer not null check (position >= 0),
  -- Jeton de couleur d une palette FERMEE (meme valeurs que ProjectTagColor,
  -- E10.2, schema NEANMOINS DISTINCT — deux catalogues sans rapport) : jamais
  -- un hexadecimal, la charte doit pouvoir evoluer sans migration.
  color       text not null check (color in ('slate', 'blue', 'green', 'amber', 'red', 'violet')),
  is_terminal boolean not null default false,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- DEFERRABLE INITIALLY IMMEDIATE (et non INITIALLY DEFERRED) : le contrat
  -- (§8.15 §3) le prescrit tel quel. `api_reorder_production_steps` doit donc
  -- poser explicitement `set constraints ... deferred` en debut de
  -- transaction — sans quoi un `UPDATE` qui permute deux positions echoue au
  -- milieu de l instruction meme si l etat final est valide (PostgreSQL
  -- verifie une contrainte immediate ligne par ligne, pas en fin d instruction).
  constraint production_steps_position_unique unique (tenant_id, position) deferrable initially immediate
);

comment on table public.production_steps is
  'E10.13 — referentiel des etapes de production du tenant (flux d atelier), configurable et ordonnancable. DONNEE DE TENANT, jamais une valeur d enumeration applicative. Distincte de tenant_order_status_definitions (boutique, adossee a un enum SQL verrouille) : meme frontiere que commercial_quotes/quotes (E10.3) et commercial_orders/tenant_orders (E10.12).';
comment on column public.production_steps.position is
  'Rang dans le flux, entier, contigu 0..n-1. L etape ACTIVE de position la plus basse est le point d entree des commandes a la conversion d un devis (api_convert_commercial_quote).';
comment on column public.production_steps.is_active is
  'false n est PAS un effacement logique : l etape reste listee, garde sa position, reste lisible sur les commandes qui la portent (CA3). Seul effet : plus candidate au point d entree des nouvelles commandes.';

-- Libelle UNIQUE dans le tenant sur sa forme normalisee (trim, casse
-- insensible), ETAPES DESACTIVEES COMPRISES : leur libelle reste reserve,
-- puisqu elles restent affichees dans l historique (decision #11 du contrat).
-- Index NORMAL (pas deferrable) : sert aussi d arbitre a l `on conflict` du
-- seed ci-dessous — un arbitre `on conflict` ne peut pas porter sur une
-- contrainte deferrable, contrairement a `production_steps_position_unique`.
create unique index if not exists production_steps_tenant_label_uidx
  on public.production_steps (tenant_id, btrim(lower(label)));

drop trigger if exists production_steps_set_updated_at on public.production_steps;
create or replace function public.production_steps_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger production_steps_set_updated_at
  before update on public.production_steps
  for each row execute function public.production_steps_set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────
-- Le grant applicatif de base (`20260811000100_api_role_table_grants.sql`)
-- rend la table ecrivable par defaut a `anon`/`authenticated` : la RLS est la
-- SEULE barriere. `production_steps_select` reprend la forme exacte des
-- autres tables E10 (jamais une variante). `production_steps_write` PORTE
-- DIRECTEMENT `public.user_has_capability(tenant_id, 'can_manage_production_steps')`
-- (regle 4 du §3.5 : la garde doit exister EN BASE, pas seulement dans la
-- facade — un appel PostgREST direct avec un jeton de membre ordinaire doit
-- lui aussi etre refuse).
alter table public.production_steps enable row level security;

drop policy if exists "production_steps_select" on public.production_steps;
create policy "production_steps_select" on public.production_steps for select using (
  is_super_admin()
  or tenant_id in (select public.current_user_tenant_ids())
);

drop policy if exists "production_steps_write" on public.production_steps;
create policy "production_steps_write" on public.production_steps for all using (
  is_super_admin()
  or public.user_has_capability(tenant_id, 'can_manage_production_steps')
) with check (
  is_super_admin()
  or public.user_has_capability(tenant_id, 'can_manage_production_steps')
);

-- ── 2. Seed du jeu standard (CA1) — extension de seed_tenant_catalogs() ────
-- Copie VERBATIM du corps le plus recent (`20260824000600_um1_seed_profile_
-- options.sql`), `create or replace`, avec un troisieme bloc d insertion
-- ajoute a la fin. Jamais une edition des migrations d origine (regle de
-- process §8.13quinquies).
create or replace function public.seed_tenant_catalogs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.tenant_role_definitions
    (tenant_id, name, description, capabilities, notify_policy, scope,
     ordering_index, system_key, identity_context)
  values
    (new.id, 'Boutiques', 'Créer des boutiques et administrer les siennes',
     '{"can_manage_shops": true}'::jsonb, 'none', 'tenant', 10, 'option_shops', 'magrit'),
    (new.id, 'Commandes',
     'Administrer les commandes : valider, modifier, gérer les statuts, exporter, annuler',
     '{"can_validate": true, "can_modify": true, "can_cancel": true, "can_export": true}'::jsonb,
     'none', 'tenant', 20, 'option_orders', 'magrit')
  on conflict (tenant_id, system_key) where system_key is not null do nothing;

  insert into public.tenant_order_status_definitions
    (tenant_id, code, label, color, ordering_index, is_terminal)
  values
    (new.id, 'draft', 'Brouillon', '#9ca3af', 10, false),
    (new.id, 'validated', 'Validée', '#10b981', 20, false),
    (new.id, 'in_production', 'En production', '#3b82f6', 30, false),
    (new.id, 'shipped', 'Expédiée', '#8b5cf6', 40, false),
    (new.id, 'delivered', 'Livrée', '#059669', 50, true),
    (new.id, 'invoiced', 'Facturée', '#0891b2', 60, true),
    (new.id, 'cancelled', 'Annulée', '#ef4444', 70, true)
  on conflict (tenant_id, code) do nothing;

  -- E10.13 (CA1) — jeu standard des six etapes, seance produit du 28/08/2026,
  -- confirme par Arnaud le 2026-09-08 : ces six libelles se seedent TELS
  -- QUELS, dans cet ordre, « Livré » seule etape terminale. Rien a arbitrer.
  insert into public.production_steps (tenant_id, label, position, color, is_terminal)
  values
    (new.id, 'Fichier reçu', 0, 'slate', false),
    (new.id, 'PAO', 1, 'blue', false),
    (new.id, 'Fichier validé', 2, 'violet', false),
    (new.id, 'En cours de production', 3, 'amber', false),
    (new.id, 'En cours d''expédition', 4, 'red', false),
    (new.id, 'Livré', 5, 'green', true)
  on conflict (tenant_id, btrim(lower(label))) do nothing;

  perform public.seed_tenant_status_transitions(new.id);
  return new;
end;
$$;

-- ── Rattrapage des TENANTS existants — le trigger ne vaut que pour les ────
-- creations a venir (meme complement que 20260601000200/20260824000600
-- avaient du faire). `on conflict` sur le meme arbitre que le seed ci-dessus.
insert into public.production_steps (tenant_id, label, position, color, is_terminal)
select t.id, v.label, v.position, v.color, v.is_terminal
  from public.tenants t
  cross join (values
    ('Fichier reçu', 0, 'slate', false),
    ('PAO', 1, 'blue', false),
    ('Fichier validé', 2, 'violet', false),
    ('En cours de production', 3, 'amber', false),
    ('En cours d''expédition', 4, 'red', false),
    ('Livré', 5, 'green', true)
  ) as v(label, position, color, is_terminal)
 where not exists (
   select 1 from public.production_steps ps where ps.tenant_id = t.id
 )
on conflict (tenant_id, btrim(lower(label))) do nothing;

-- ── 3. Rattachement a la commande ──────────────────────────────────────────
-- `on delete restrict` est ICI la bonne action (a la difference d E10.12, qui
-- proscrit `restrict` sur ses propres FK) : `production_steps.tenant_id` est
-- lui-meme `on delete cascade` DEPUIS LE MEME TENANT, donc la suppression
-- d un tenant supprime a la fois les commandes et les etapes — une contrainte
-- `restrict` entre deux tables du meme tenant qui disparaissent ENSEMBLE
-- n est jamais franchie. Ce que `restrict` protege, c est le chemin NOMINAL
-- (`deleteProductionStep`, CA3), docs/api/CONVENTIONS.md §8.15 §3.
alter table public.commercial_orders
  add column if not exists current_production_step_id uuid
    references public.production_steps(id) on delete restrict;

comment on column public.commercial_orders.current_production_step_id is
  'E10.13 — etape de production COURANTE (pointeur, pas une progression), ou NULL. Posee UNE SEULE FOIS, a la conversion (api_convert_commercial_quote), sur l etape ACTIVE de position la plus basse du tenant. Aucune operation de ce contrat ne la change ensuite : le changement d etape est E10.14.';

create index if not exists commercial_orders_tenant_step_idx
  on public.commercial_orders (tenant_id, current_production_step_id);

-- Le trigger `commercial_orders_immutable()` (E10.12, PAR COLONNE) N EST NI
-- EDITE NI RECREE ICI : `current_production_step_id` n y figure pas dans la
-- liste des colonnes gelees, elle est donc mutable des sa creation — exactement
-- ce que §8.14 avait prevu. Le recreer « pour ajouter la colonne a la liste »
-- gelerait l etape courante et rendrait E10.14 impossible.

-- ── 4. `api_convert_commercial_quote` — RECOPIE VERBATIM + UNE difference ──
-- Corps IDENTIQUE a `20260908010000` (lignes 446-592 de cette migration-la),
-- meme signature, `create or replace`. Seule difference : `current_production_
-- step_id` ajoutee a la liste de colonnes de l `insert` et sa valeur (sous-
-- requete scalaire, DETERMINISTE grace a `unique(tenant_id, position)`) au
-- `values`. Aucune exception si la sous-requete ne rend rien : `null`, la
-- conversion reussit quand meme (arbitrage (a), #2ter du contrat — un defaut
-- de parametrage d atelier ne bloque jamais un engagement commercial).
create or replace function public.api_convert_commercial_quote(
  p_tenant_id uuid,
  p_quote_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_actor uuid := auth.uid();
  v_prior_status text;
  v_customer_id uuid;
  v_updated_id uuid;
  v_change_set uuid := gen_random_uuid();
  v_totals record;
  v_year integer;
  v_next integer;
  v_number text;
  v_order_id uuid;
begin
  if v_actor is null then
    raise exception 'authentication_required';
  end if;

  -- Decision #9 du contrat E10.12 (arbitrage Arnaud, 2026-09-08, reserve (b)
  -- close) : TOUT membre du tenant, aucune garde de capability. INCHANGE par
  -- E10.13.
  if not (
    public.is_super_admin()
    or exists (
      select 1 from public.tenant_members tm
      where tm.tenant_id = p_tenant_id
        and tm.user_id = v_actor
        and tm.role in ('admin', 'member')
    )
  ) then
    raise exception 'permission_denied: quote conversion forbidden';
  end if;

  perform set_config('magrit.change_set_id', v_change_set::text, true);
  perform set_config('magrit.quote_transition', 'true', true);

  select status, customer_id
    into v_prior_status, v_customer_id
  from public.commercial_quotes
  where id = p_quote_id and tenant_id = p_tenant_id
  for update;

  if not found then
    perform set_config('magrit.quote_transition', '', true);
    perform set_config('magrit.change_set_id', '', true);
    raise exception 'quote.not_found: devis % introuvable', p_quote_id;
  end if;

  update public.commercial_quotes cq
     set status = 'converted',
         converted_at = now()
   where cq.id = p_quote_id
     and cq.tenant_id = p_tenant_id
     and cq.status in ('sent', 'accepted')
  returning cq.id into v_updated_id;

  if v_updated_id is null then
    perform set_config('magrit.quote_transition', '', true);
    perform set_config('magrit.change_set_id', '', true);
    raise exception 'quote.conversion_forbidden_status: devis % a l etat % (sent ou accepted requis)', p_quote_id, v_prior_status;
  end if;

  insert into public.commercial_quote_header_audit
    (quote_id, change_set_id, action, field, previous_value, new_value, quote_snapshot, actor_id, actor_label)
  values
    (p_quote_id, v_change_set, 'converted', null, v_prior_status, 'converted', null, v_actor,
     (select email from auth.users where id = v_actor));

  select * into v_totals from private.commercial_order_totals_at_conversion(p_quote_id);

  v_year := extract(year from (now() at time zone 'utc'))::integer;

  insert into public.commercial_order_number_counters (tenant_id, year, last_value)
  values (p_tenant_id, v_year, 1)
  on conflict (tenant_id, year)
  do update set last_value = public.commercial_order_number_counters.last_value + 1
  returning last_value into v_next;

  v_number := 'CDE-' || v_year::text || '-' || lpad(v_next::text, 5, '0');

  -- E10.13 — SEULE difference avec le corps E10.12 (20260908010000) :
  -- `current_production_step_id` rejoint la liste de colonnes et de valeurs,
  -- posee sur l etape ACTIVE de position la plus basse du tenant (arbitrage
  -- (a), #2ter du contrat). Sous-requete SCALAIRE dans le `values`, jamais un
  -- `update` apres coup (qui reveillerait `commercial_orders_set_updated_at`
  -- et ferait passer une ligne toute neuve par le trigger d immuabilite pour
  -- rien).
  insert into public.commercial_orders (
    tenant_id, customer_id, quote_id, number, status, source_quote_status,
    lines_subtotal, global_discount, effective_discount_rate, net_total,
    vat_rate, vat_regime, vat_amount, total_incl_tax, created_by,
    current_production_step_id
  )
  values (
    p_tenant_id, v_customer_id, p_quote_id, v_number, 'validated', v_prior_status,
    v_totals.lines_subtotal, v_totals.global_discount, v_totals.effective_discount_rate, v_totals.net_total,
    v_totals.vat_rate, v_totals.vat_regime, v_totals.vat_amount, v_totals.total_incl_tax, v_actor,
    (select ps.id
       from public.production_steps ps
      where ps.tenant_id = p_tenant_id
        and ps.is_active
      order by ps.position
      limit 1)
  )
  returning id into v_order_id;

  insert into public.commercial_order_lines (
    order_id, source_quote_line_id, origin, label, product_config, quantity, position,
    production_price, public_price, customer_price, applied_margin_rate, applied_rule_id,
    sale_price, sale_margin_rate, discount_rate, margin_variation, breakdown
  )
  select
    v_order_id, l.id, l.origin, l.label, l.product_config, l.quantity, l.position,
    l.production_price, l.public_price, l.customer_price, l.applied_margin_rate, l.applied_rule_id,
    l.sale_price, l.sale_margin_rate, l.discount_rate, l.margin_variation, l.breakdown
  from public.commercial_quote_lines l
  where l.quote_id = p_quote_id
  order by l.position;

  perform set_config('magrit.quote_transition', '', true);
  perform set_config('magrit.change_set_id', '', true);

  return v_order_id;
end;
$$;

comment on function public.api_convert_commercial_quote(uuid, uuid) is
  'E10.12/E10.13 — POST /quotes/{quoteId}/conversions. Transition ATOMIQUE sent/accepted -> converted, numerotation CDE-AAAA-NNNNN, copie FIGEE des lignes et totaux, audit d entete converted, ETAPE DE PRODUCTION INITIALE posee sur l etape active de position la plus basse du tenant (E10.13, arbitrage Arnaud 2026-09-08, null sans erreur si le tenant n a aucune etape active). Ouverte a TOUT membre du tenant (aucune garde de capability).';

revoke all on function public.api_convert_commercial_quote(uuid, uuid) from public, anon;
grant execute on function public.api_convert_commercial_quote(uuid, uuid) to authenticated;

-- ── 5. Rattrapage des commandes EXISTANTES ──────────────────────────────────
-- Toute commande anterieure a ce lot a ete creee sans etape (aucun mecanisme
-- de changement d etape n existe encore, E10.14 non livree) : elle est, par
-- construction, au tout debut de son flux. Le trigger d immuabilite LAISSE
-- PASSER cet update (colonne non gelee) ; `commercial_orders_set_updated_at`
-- fera avancer `updated_at` sur les lignes reprises, ce qui est accepte (une
-- migration de donnees EST une modification).
update public.commercial_orders o
   set current_production_step_id = (
         select ps.id from public.production_steps ps
          where ps.tenant_id = o.tenant_id and ps.is_active
          order by ps.position limit 1)
 where o.current_production_step_id is null;

-- ── 6. Fonctions d ecriture du referentiel `production_steps` ──────────────
-- Les trois fonctions ci-dessous sont `security definer` : la RLS de
-- `production_steps` (ci-dessus) est donc BYPASSEE a l interieur de leur
-- corps, comme pour toute fonction `security definer` de ce depot
-- (`api_convert_commercial_quote`, etc.) — chacune reimplemente donc EXPLICI-
-- TEMENT le meme controle de capability que la policy `production_steps_write`.
-- Serialisees PAR TENANT via `pg_advisory_xact_lock` (meme patron que
-- `api_create_order_atomic`, `20260811000400`) : deux creations, suppressions
-- ou reordonnancements concurrents sur le MEME tenant ne se chevauchent
-- jamais, ce qui rend le plafond de 50 (creation) et la reindexation
-- (suppression/reordonnancement) fiables sans avoir a raisonner sur des
-- anomalies de serialisation Postgres.

create or replace function public.api_create_production_step(
  p_tenant_id uuid,
  p_label text,
  p_color text,
  p_is_terminal boolean
)
returns public.production_steps
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_count integer;
  v_row public.production_steps;
begin
  if v_actor is null then
    raise exception 'authentication_required';
  end if;
  if not (
    public.is_super_admin()
    or public.user_has_capability(p_tenant_id, 'can_manage_production_steps')
  ) then
    raise exception 'permission_denied: can_manage_production_steps required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('production_steps:' || p_tenant_id::text, 0));

  select count(*) into v_count from public.production_steps where tenant_id = p_tenant_id;
  if v_count >= 50 then
    raise exception 'production_step.limit_reached: tenant % a deja 50 etapes', p_tenant_id;
  end if;

  insert into public.production_steps (tenant_id, label, position, color, is_terminal)
  values (p_tenant_id, p_label, v_count, p_color, coalesce(p_is_terminal, false))
  returning * into v_row;

  return v_row;
end;
$$;

comment on function public.api_create_production_step(uuid, text, text, boolean) is
  'E10.13 — POST /production-steps. Position affectee par le serveur (fin de flux, = compte courant), plafond de 50 verifie SOUS VERROU (pg_advisory_xact_lock par tenant) dans la MEME transaction que l insertion. 409 production_step.label_conflict porte par l index unique fonctionnel (tenant_id, btrim(lower(label))), jamais verifie ici.';

revoke all on function public.api_create_production_step(uuid, text, text, boolean) from public, anon;
grant execute on function public.api_create_production_step(uuid, text, text, boolean) to authenticated;

create or replace function public.api_delete_production_step(
  p_tenant_id uuid,
  p_step_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_deleted_position integer;
begin
  if v_actor is null then
    raise exception 'authentication_required';
  end if;
  if not (
    public.is_super_admin()
    or public.user_has_capability(p_tenant_id, 'can_manage_production_steps')
  ) then
    raise exception 'permission_denied: can_manage_production_steps required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('production_steps:' || p_tenant_id::text, 0));

  begin
    delete from public.production_steps
     where tenant_id = p_tenant_id and id = p_step_id
    returning position into v_deleted_position;
  exception
    when foreign_key_violation then
      raise exception 'production_step.in_use: etape % encore portee par au moins une commande', p_step_id;
  end;

  if v_deleted_position is null then
    raise exception 'production_step.not_found: etape % introuvable dans le tenant %', p_step_id, p_tenant_id;
  end if;

  -- Reindexation 0..n-1 des etapes restantes, MEME transaction. Deplacement
  -- MONOTONE vers le bas : chaque nouvelle position vient de se liberer
  -- (celle qui la precedait immediatement dans l ordre de traitement), aucune
  -- collision possible meme sous contrainte immediate — pas de `deferred`
  -- necessaire ici (a la difference du reordonnancement, qui permute).
  update public.production_steps
     set position = position - 1
   where tenant_id = p_tenant_id
     and position > v_deleted_position;
end;
$$;

comment on function public.api_delete_production_step(uuid, uuid) is
  'E10.13 — DELETE /production-steps/{stepId}. 404 production_step.not_found si absente du tenant ; 409 production_step.in_use si portee par au moins une commande, tenu EN BASE par la cle etrangere commercial_orders.current_production_step_id (on delete restrict), jamais par une verification prealable de facade. Reindexe les positions restantes dans la MEME transaction.';

revoke all on function public.api_delete_production_step(uuid, uuid) from public, anon;
grant execute on function public.api_delete_production_step(uuid, uuid) to authenticated;

create or replace function public.api_reorder_production_steps(
  p_tenant_id uuid,
  p_step_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_requested_count integer;
  v_existing_count integer;
begin
  if v_actor is null then
    raise exception 'authentication_required';
  end if;
  if not (
    public.is_super_admin()
    or public.user_has_capability(p_tenant_id, 'can_manage_production_steps')
  ) then
    raise exception 'permission_denied: can_manage_production_steps required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('production_steps:' || p_tenant_id::text, 0));

  -- Piege de cette story (docs/api/CONVENTIONS.md §8.15 §3) : la contrainte
  -- `production_steps_position_unique` est DEFERRABLE INITIALLY IMMEDIATE.
  -- Sans ce `set constraints ... deferred`, un `UPDATE` qui permute deux
  -- positions echoue au milieu de l instruction meme si l etat final est
  -- valide (PostgreSQL verifie une contrainte immediate ligne par ligne).
  set constraints production_steps_position_unique deferred;

  v_requested_count := coalesce(array_length(p_step_ids, 1), 0);

  select count(*) into v_existing_count
    from public.production_steps
   where tenant_id = p_tenant_id;

  -- Exhaustivite verifiee ENTIEREMENT avant tout UPDATE (meme discipline que
  -- `api_reorder_commercial_quote_lines`, E10.9) : cardinalite, absence de
  -- doublon, appartenance de chaque id au tenant.
  if v_requested_count <> v_existing_count
     or v_requested_count <> (select count(distinct x) from unnest(p_step_ids) as x)
     or v_requested_count <> (
       select count(*) from unnest(p_step_ids) as x(id)
        where exists (
          select 1 from public.production_steps ps2
           where ps2.id = x.id and ps2.tenant_id = p_tenant_id
        )
     )
  then
    raise exception 'production_step.positions_mismatch: % etape(s) fournie(s), % attendue(s) dans le tenant %',
      v_requested_count, v_existing_count, p_tenant_id;
  end if;

  with wanted as (
    select id, ord - 1 as new_position
    from unnest(p_step_ids) with ordinality as t(id, ord)
  )
  update public.production_steps ps
     set position = wanted.new_position
    from wanted
   where ps.id = wanted.id
     and ps.tenant_id = p_tenant_id
     and ps.position <> wanted.new_position;
end;
$$;

comment on function public.api_reorder_production_steps(uuid, uuid[]) is
  'E10.13 — PUT /production-step-positions. step_ids porte la liste COMPLETE (actives et desactivees) dans l ordre voulu ; reaffecte position 0..n-1. 422 production_step.positions_mismatch si le recouvrement n est pas exact. set constraints deferred en debut de transaction (contrainte position deferrable initially immediate).';

revoke all on function public.api_reorder_production_steps(uuid, uuid[]) from public, anon;
grant execute on function public.api_reorder_production_steps(uuid, uuid[]) to authenticated;

-- ── 7. Lecture triee par etape courante (CA6, sort=production_step) ────────
-- `security invoker` (PAS definer) : la RLS de commercial_orders/
-- production_steps s applique normalement, exactement comme un SELECT direct
-- fait par l adaptateur pour les autres tris. Necessaire seulement parce que
-- PostgREST/`supabase-js` ne sait pas propager un ORDER BY sur une colonne
-- d une table jointe en LEFT JOIN au niveau de la ligne PARENTE (seul `!inner`
-- le permet, ce qui exclurait a tort les commandes sans etape). Meme
-- precedent qu `resolve_price_rule` (E10.7) : une lecture qui exige un calcul
-- que la facade REST seule ne sait pas exprimer passe par une fonction SQL.
-- Le curseur porte `p_cursor_step_id` (l `current_production_step_id` de la
-- DERNIERE commande de la page precedente, deja publie sur `CommercialOrder`)
-- plutot qu une position entiere : la POSITION correspondante est resolue ICI
-- (`cursor_step`), pas par l appelant. L adaptateur n a donc jamais besoin de
-- connaitre le catalogue des positions pour construire un curseur — seul le
-- champ `sort` du curseur opaque (§ route) encode cet id.
create or replace function public.list_commercial_orders_by_production_step(
  p_tenant_id uuid,
  p_customer_id uuid,
  p_quote_id uuid,
  p_status text,
  p_current_production_step_id uuid,
  p_descending boolean,
  p_limit integer,
  p_has_cursor boolean,
  p_cursor_step_id uuid,
  p_cursor_created_at timestamptz,
  p_cursor_id uuid
)
returns setof public.commercial_orders
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  with cursor_step as (
    select position from public.production_steps where id = p_cursor_step_id
  )
  select o.*
    from public.commercial_orders o
    left join public.production_steps ps on ps.id = o.current_production_step_id
   where o.tenant_id = p_tenant_id
     and (p_customer_id is null or o.customer_id = p_customer_id)
     and (p_quote_id is null or o.quote_id = p_quote_id)
     and (p_status is null or o.status = p_status)
     and (p_current_production_step_id is null or o.current_production_step_id = p_current_production_step_id)
     and (
       not p_has_cursor
       or (
         (select position from cursor_step) is not null and (
              (p_descending and ps.position < (select position from cursor_step))
           or (not p_descending and ps.position > (select position from cursor_step))
           or ps.position is null
           or (ps.position = (select position from cursor_step) and o.created_at < p_cursor_created_at)
           or (ps.position = (select position from cursor_step) and o.created_at = p_cursor_created_at and o.id < p_cursor_id)
         )
       )
       or (
         (select position from cursor_step) is null and ps.position is null and (
              o.created_at < p_cursor_created_at
           or (o.created_at = p_cursor_created_at and o.id < p_cursor_id)
         )
       )
     )
   order by
     (case when p_descending then -ps.position else ps.position end) asc nulls last,
     o.created_at desc,
     o.id desc
   limit p_limit
$$;

comment on function public.list_commercial_orders_by_production_step is
  'E10.13 CA6 — lecture triee de listCommercialOrders quand sort=production_step|-production_step : ordre sur la POSITION de l etape courante (jointure LEFT), commandes SANS etape toujours en dernier dans les deux sens. Curseur porte par p_cursor_step_id (pas une position brute) : la resolution se fait ICI. security invoker : la RLS de commercial_orders/production_steps s applique normalement.';

revoke all on function public.list_commercial_orders_by_production_step from public, anon;
grant execute on function public.list_commercial_orders_by_production_step to authenticated, service_role;

notify pgrst, 'reload schema';

-- ============================================================================
-- REVERSIBILITE — le CLI Supabase ne gere pas de bloc `down`. SQL de retrait,
-- a jouer tel quel dans une migration inverse si la story est annulee :
--
--   revoke execute on function public.list_commercial_orders_by_production_step from authenticated, service_role;
--   drop function if exists public.list_commercial_orders_by_production_step(uuid, uuid, uuid, text, uuid, boolean, integer, boolean, uuid, timestamptz, uuid);
--   revoke execute on function public.api_reorder_production_steps(uuid, uuid[]) from authenticated;
--   drop function if exists public.api_reorder_production_steps(uuid, uuid[]);
--   revoke execute on function public.api_delete_production_step(uuid, uuid) from authenticated;
--   drop function if exists public.api_delete_production_step(uuid, uuid);
--   revoke execute on function public.api_create_production_step(uuid, text, text, boolean) from authenticated;
--   drop function if exists public.api_create_production_step(uuid, text, text, boolean);
--   -- api_convert_commercial_quote : revenir a la version E10.12
--   -- (20260908010000, lignes 446-592), recopiee verbatim sans la colonne
--   -- current_production_step_id.
--   alter table public.commercial_orders drop column if exists current_production_step_id;
--   drop policy if exists "production_steps_write" on public.production_steps;
--   drop policy if exists "production_steps_select" on public.production_steps;
--   drop trigger if exists production_steps_set_updated_at on public.production_steps;
--   drop function if exists public.production_steps_set_updated_at();
--   drop table if exists public.production_steps;
--   -- seed_tenant_catalogs() : revenir a la version 20260824000600 (sans le
--   -- troisieme bloc production_steps).
--   notify pgrst, 'reload schema';
--
-- `tenant_order_status_definitions` et la boutique sont INTOUCHEES par ce
-- lot : aucune migration, aucune donnee, aucun ecran.
-- ============================================================================
