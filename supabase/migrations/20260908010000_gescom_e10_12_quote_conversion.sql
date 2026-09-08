-- ============================================================================
-- Sprint 5 Gestion commerciale — story E10.12 : « Bouton Valider » — un devis
-- `sent` ou `accepted` devient une COMMANDE. Contrat : openapi/magrit-core.v1.yaml,
-- docs/api/CONVENTIONS.md §8.14.
-- ----------------------------------------------------------------------------
-- Ce que cette migration fait :
--
--   1. `commercial_quotes.converted_at` — colonne d entete, meme motif que
--      `sent_at`/`decided_at` : le journal d entete est reserve a
--      `can_manage_pricing`, savoir qu une affaire est commandee est
--      l information la plus ordinaire du suivi commercial. `Quote.converted_at`
--      n est PAS double d un `order_id` (decision #8 du contrat) : la relation
--      1-1 devis <-> commande est portee UNE SEULE fois, par
--      `commercial_orders.quote_id` (unique).
--
--   2. `commercial_quote_header_audit` gagne une action, `converted` — memes
--      contraintes de forme que `resent`/`duplicated`/`status_forced` (ni
--      `field` ni `quote_snapshot`, l instantane pris a l envoi faisant deja
--      foi, un devis `sent`/`accepted` etant deja immuable).
--
--   3. Deux NOUVELLES tables, `commercial_orders` / `commercial_order_lines`,
--      distinctes de `tenant_orders` (boutique) — meme frontiere que
--      `commercial_quotes`/`quotes` posee par E10.3 (docs/api/CONVENTIONS.md
--      §8.14, fait 2 du §0) : un document de GESTION COMMERCIALE, rattache a
--      un client du referentiel, sans boutique obligatoire, PAS un document
--      boutique rattache a un compte d acheteur. `commercial_order_number_
--      counters` porte la sequence CDE-AAAA-NNNNN, meme mecanisme que
--      `commercial_quote_number_counters` (E10.3) : aucune policy RLS
--      (deni total), seule voie d ecriture = la fonction ci-dessous.
--
--   4. Deux triggers d IMMUABILITE, EN BASE (pas seulement au contrat) :
--      `commercial_order_lines` refuse tout UPDATE/DELETE (sauf cascade de
--      suppression d un tenant, reconnue en verifiant que la commande PARENTE
--      a deja disparu — meme mecanique que `commercial_quote_lines_require_
--      draft_quote`, E10.9 correctif N1) ; `commercial_orders` refuse tout
--      changement des colonnes FIGEES (identite, filiation, totaux) et tout
--      DELETE direct (meme exception de cascade tenant que `commercial_quotes_
--      require_draft_before_write`, E10.10a). `status`/`updated_at` restent
--      mutables : E10.13 n aura pas a demonter ce trigger pour poser sa
--      premiere transition.
--
--   5. `private.commercial_order_totals_at_conversion(quote_id)` — MEME
--      arithmetique que `computeQuoteTotals()` (TypeScript) et que
--      `private.commercial_quote_totals()` (b-1, migration 20260906170000),
--      SANS le filtre `show_discounts` : ce dernier est une regle de
--      visibilite CLIENT (StorefrontQuoteTotals), sans objet ici — une
--      commande de gestion commerciale est un document d ATELIER, ses totaux
--      sont toujours pleinement lisibles par le tenant qui l a creee.
--      Fonction PRIVEE : jamais grantee, appelee uniquement depuis
--      `api_convert_commercial_quote`.
--
--   6. `api_convert_commercial_quote(p_tenant_id, p_quote_id)` — TRANSITION
--      ATOMIQUE `sent`/`accepted` -> `converted` (arbitrage Arnaud du
--      2026-09-08, docs/api/CONVENTIONS.md §8.14 reserve (a) close), NUMEROTATION
--      transactionnelle (meme verrou de ligne que `commercial_quote_number_
--      counters`), copie FIGEE des lignes (aucun recalcul de prix — E10.8
--      gelee, decision #4 du contrat), audit d entete, EN UNE SEULE
--      TRANSACTION. `security definer`, `grant execute to authenticated`
--      SANS aucune garde de capability (arbitrage Arnaud du 2026-09-08,
--      reserve (b) close, decision #9 du contrat) : tout membre du tenant
--      (`admin` ou `member`) peut valider.
--
--      La lecture prealable du statut/client se fait par `SELECT ... FOR
--      UPDATE` (MEME patron que `api_send_commercial_quote`, migration
--      20260906160000, lignes 647-651 — PAS le patron CTE `previous`/
--      `transitioned` initialement livre ici, qui laissait une fenetre de
--      staleness : la CTE `previous` lit le snapshot pris au DEBUT de l
--      instruction, tandis que l `UPDATE` packagee dans la seconde CTE
--      attend le verrou puis re-evalue sur la version la plus RECENTE
--      -- EvalPlanQual -- si bien que les deux CTE pouvaient voir deux
--      versions differentes de la ligne sous course reelle, qa-review round 1
--      B1). `FOR UPDATE` pose le verrou de ligne et attend la fin de toute
--      transaction concurrente qui la modifierait AVANT de rendre son
--      resultat : la valeur lue est donc TOUJOURS la derniere version
--      COMMITEE, jamais un snapshot perime. La ligne reste verrouillee
--      jusqu a la fin de CETTE transaction (COMMIT ou ROLLBACK), donc aucune
--      autre transaction ne peut la modifier entre la lecture et l `UPDATE`
--      de garde qui suit — l atomicite est portee par le verrou de ligne
--      tenu du debut a la fin de la fonction, pas par un seul plan
--      d execution : deux conversions concurrentes portant deux cles
--      d idempotence differentes ne peuvent pas franchir ce controle toutes
--      les deux, et le `source_quote_status` enregistre est TOUJOURS celui
--      reellement en vigueur au moment de la transition, jamais une valeur
--      lue quelques instants plus tot (cf. la course « le client accepte
--      pendant que le commercial valide », decision #6/#5ter du contrat :
--      inoffensive, justifiant l absence de `If-Match` — MAIS la valeur
--      enregistree doit refleter la decision du client si elle a ete
--      committee avant que la conversion ne prenne le verrou, ce que le
--      patron CTE ne garantissait PAS).
--
--      Echappatoire d immuabilite (`magrit.quote_transition`, `magrit.
--      change_set_id`) posee PUIS REMISE A VIDE sur les DEUX branches d echec
--      (`quote.not_found`, `quote.conversion_forbidden_status`) et sur le
--      retour de succes — meme correctif que B7 (E10.10a round 5,
--      docs/api/CONVENTIONS.md §8.12bis).
--
-- Nommage des codes d erreur, cote base (traduits par l adaptateur Supabase) :
-- `quote.not_found`, `quote.conversion_forbidden_status`, `permission_denied`,
-- `authentication_required`.
-- ============================================================================

-- ── 1. `commercial_quotes.converted_at` ─────────────────────────────────────
alter table public.commercial_quotes
  add column if not exists converted_at timestamptz;

comment on column public.commercial_quotes.converted_at is
  'E10.12 — instant de la transformation en commande (convertQuote). NULL tant que le devis n a pas ete converti. Pas de order_id cote devis (decision #8 du contrat) : voir commercial_orders.quote_id (unique).';

-- ── 2. Journal d entete : action `converted` ────────────────────────────────
alter table public.commercial_quote_header_audit
  drop constraint if exists commercial_quote_header_audit_action_check,
  add constraint commercial_quote_header_audit_action_check
    check (action in ('updated', 'sent', 'resent', 'duplicated', 'status_forced', 'accepted', 'rejected', 'converted'));

alter table public.commercial_quote_header_audit
  drop constraint if exists commercial_quote_header_audit_shape,
  add constraint commercial_quote_header_audit_shape check (
    (action = 'updated' and field is not null and quote_snapshot is null)
    or (action = 'sent' and field is null and quote_snapshot is not null)
    or (action in ('resent', 'duplicated', 'status_forced', 'accepted', 'rejected', 'converted') and field is null and quote_snapshot is null)
  );

-- ── 3. Tables — commercial_orders / commercial_order_lines / compteur ──────
create table if not exists public.commercial_orders (
  id                       uuid primary key default gen_random_uuid(),
  tenant_id                uuid not null references public.tenants(id) on delete cascade,
  customer_id              uuid not null references public.customers(id),
  -- Reference NUE, sans clause `on delete` : le devis source est toujours
  -- non-`draft` (converti), donc deja protege par le trigger d immuabilite
  -- d E10.10a (BEFORE DELETE, `commercial_quotes_require_draft_before_write`)
  -- sur tout chemin nominal. Seule la cascade de suppression d un TENANT peut
  -- encore l atteindre ; `no action` (le defaut, differe en fin d instruction)
  -- la laisse passer. Meme raisonnement, memes mots que `commercial_quotes.
  -- source_quote_id` (migration 20260906160000, correctif B6) : jamais
  -- `restrict`, jamais `set null`.
  quote_id                 uuid not null unique references public.commercial_quotes(id),
  number                   text not null check (btrim(number) <> ''),
  status                   text not null default 'validated' check (status in ('validated')),
  source_quote_status      text not null check (source_quote_status in ('sent', 'accepted')),
  -- Huit colonnes de totaux FIGES a la conversion (CommercialOrderTotals) :
  -- jamais recalcules, meme arithmetique que QuoteTotals au moment ou la
  -- commande est nee. Cf. private.commercial_order_totals_at_conversion.
  lines_subtotal           numeric(12,2) not null check (lines_subtotal >= 0),
  global_discount          numeric(12,2) not null,
  effective_discount_rate  numeric(6,4),
  net_total                numeric(12,2) not null check (net_total >= 0),
  vat_rate                 numeric(6,4) not null check (vat_rate >= 0),
  vat_regime               text,
  vat_amount               numeric(12,2) not null check (vat_amount >= 0),
  total_incl_tax           numeric(12,2) not null check (total_incl_tax >= 0),
  created_by               uuid references auth.users(id),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),

  constraint commercial_orders_number_unique_per_tenant unique (tenant_id, number)
);

comment on table public.commercial_orders is
  'E10.12 — commande de gestion commerciale, nee de la conversion d un devis (convertQuote). Document ATELIER (client du referentiel, customers/E10.4), distinct de tenant_orders (boutique, shop_id + shop_customer_account_id). Une seule voie d ecriture : api_convert_commercial_quote (security definer). Aucune policy RLS d ecriture.';
comment on column public.commercial_orders.quote_id is
  'Devis source, UNIQUE : un devis ne donne qu une commande. Porte l arete 1-1 devis<->commande, jamais doublee cote devis (decision #8 du contrat).';
comment on column public.commercial_orders.number is
  'CDE-AAAA-NNNNN, unique et sequentiel par tenant et par annee. Sequence PROPRE, distincte de celle des devis (commercial_order_number_counters). Attribue par api_convert_commercial_quote, jamais calcule cote client.';
comment on column public.commercial_orders.source_quote_status is
  'Statut du DEVIS au moment de la conversion (sent ou accepted, arbitrage Arnaud du 2026-09-08). accepted = le client s est formellement prononce depuis son portail ; sent = l atelier a valide sur une reponse recue hors systeme. Un litige se tranche sur cette distinction.';

create index if not exists commercial_orders_tenant_created_idx
  on public.commercial_orders (tenant_id, created_at desc);
create index if not exists commercial_orders_tenant_customer_idx
  on public.commercial_orders (tenant_id, customer_id);
create index if not exists commercial_orders_tenant_status_idx
  on public.commercial_orders (tenant_id, status);

drop trigger if exists commercial_orders_set_updated_at on public.commercial_orders;
create or replace function public.commercial_orders_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger commercial_orders_set_updated_at
  before update on public.commercial_orders
  for each row execute function public.commercial_orders_set_updated_at();

-- ── Lignes de commande, COPIE FIGEE du bloc PricedLine + geste commercial ──
create table if not exists public.commercial_order_lines (
  id                    uuid primary key default gen_random_uuid(),
  order_id              uuid not null references public.commercial_orders(id) on delete cascade,
  -- Reference NUE (pas de `on delete`) : le devis source etant converti donc
  -- immuable (E10.10a), et ses lignes gardees par `commercial_quote_lines_
  -- require_draft_quote` (E10.9), cette reference ne peut devenir orpheline
  -- par aucun chemin nominal. Seule la cascade tenant peut encore l atteindre.
  source_quote_line_id  uuid not null references public.commercial_quote_lines(id),
  origin                text not null check (origin in ('project_item', 'free')),
  label                 text not null check (btrim(label) <> ''),
  product_config        jsonb not null default '{}'::jsonb check (jsonb_typeof(product_config) = 'object'),
  quantity              integer not null check (quantity > 0),
  position              integer not null check (position >= 0),
  -- Bloc PricedLine (E10.21) COPIE tel quel, jamais recalcule.
  production_price      numeric(12,2) not null check (production_price >= 0),
  public_price          numeric(12,2) not null check (public_price >= 0),
  customer_price        numeric(12,2) not null check (customer_price >= 0),
  applied_margin_rate   numeric(6,4) not null,
  applied_rule_id       uuid,
  -- Geste commercial (E10.9) COPIE tel quel.
  sale_price            numeric(12,2) not null check (sale_price >= 0),
  sale_margin_rate      numeric(6,4),
  discount_rate         numeric(6,4),
  margin_variation      numeric(6,4),
  breakdown             jsonb not null default '[]'::jsonb check (jsonb_typeof(breakdown) = 'array'),
  created_at            timestamptz not null default now(),

  constraint commercial_order_lines_breakdown_not_empty check (jsonb_array_length(breakdown) >= 1)
);

comment on table public.commercial_order_lines is
  'E10.12 — ligne de commande, copie FIGEE d une ligne de devis a la conversion. Aucun montant n est recalcule (E10.8 gelee, decision #4 du contrat). Immuable en base (trigger commercial_order_lines_immutable_before_write) : aucun ecran ne permet de modifier les prix d une commande.';

create index if not exists commercial_order_lines_order_position_idx
  on public.commercial_order_lines (order_id, position);
create index if not exists commercial_order_lines_source_quote_line_idx
  on public.commercial_order_lines (source_quote_line_id);

-- ── Sequence de numerotation des commandes, PROPRE, par tenant et par annee ─
create table if not exists public.commercial_order_number_counters (
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  year        integer not null,
  last_value  integer not null default 0,

  primary key (tenant_id, year)
);

comment on table public.commercial_order_number_counters is
  'E10.12 — etat de la sequence de numerotation des commandes (CDE-AAAA-NNNNN), par tenant et par annee. Sequence PROPRE, distincte de commercial_quote_number_counters. Accessible UNIQUEMENT via api_convert_commercial_quote (aucune policy RLS declaree ci-dessous, deni par defaut).';

-- ── RLS — meme pattern que commercial_quotes/commercial_quote_lines ────────
-- Le grant applicatif de base (20260811000100_api_role_table_grants.sql) est
-- herite par defaut : la RLS est la SEULE barriere d autorisation. Aucune
-- policy d ECRITURE pour authenticated/anon sur commercial_orders/
-- commercial_order_lines : la seule voie d insertion est la fonction
-- security definer ci-dessous. commercial_order_number_counters n a AUCUNE
-- policy : RLS activee + zero policy = deni total.
alter table public.commercial_orders               enable row level security;
alter table public.commercial_order_lines           enable row level security;
alter table public.commercial_order_number_counters enable row level security;

drop policy if exists "commercial_orders_select" on public.commercial_orders;
create policy "commercial_orders_select" on public.commercial_orders for select using (
  is_super_admin()
  or tenant_id in (select public.current_user_tenant_ids())
);

drop policy if exists "commercial_order_lines_select" on public.commercial_order_lines;
create policy "commercial_order_lines_select" on public.commercial_order_lines for select using (
  is_super_admin()
  or exists (
    select 1 from public.commercial_orders o
    where o.id = commercial_order_lines.order_id
      and o.tenant_id in (select public.current_user_tenant_ids())
  )
);

-- ── 4. IMMUABILITE, EN BASE — la phrase « aucun ecran ne permet de modifier
--    les prix d une commande » n est vraie que grace a ce couple de triggers,
--    pas a une simple absence d endpoint (contournable par un appel PostgREST
--    direct avec un jeton de membre ordinaire, meme raisonnement que le
--    bloquant B5 d E10.10a) ────────────────────────────────────────────────
create or replace function public.commercial_order_lines_immutable()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if not exists (select 1 from public.commercial_orders o where o.id = old.order_id) then
      -- Cascade depuis la suppression de la commande PARENTE (elle-meme
      -- cascade depuis la suppression d un tenant, seul chemin qui supprime
      -- jamais une commande — voir commercial_orders_immutable ci-dessous) :
      -- legitime, pas une suppression directe de cette ligne. Meme mecanique
      -- que commercial_quote_lines_require_draft_quote (E10.9, correctif N1).
      return old;
    end if;
    raise exception 'order_line.immutable: une ligne de commande ne se supprime jamais directement (commande %)', old.order_id;
  end if;

  raise exception 'order_line.immutable: une ligne de commande ne se modifie jamais (commande %)', old.order_id;
end;
$$;

drop trigger if exists commercial_order_lines_immutable_before_write on public.commercial_order_lines;
create trigger commercial_order_lines_immutable_before_write
  before update or delete on public.commercial_order_lines
  for each row execute function public.commercial_order_lines_immutable();

-- `commercial_orders` : trigger PAR COLONNE (pas par ligne) — refuse tout
-- changement d identite/filiation/totaux ; `status`/`updated_at` restent
-- mutables pour qu E10.13 n ait pas a demonter ce trigger pour poser sa
-- premiere transition. `BEFORE DELETE` : refuse, meme exception de cascade
-- tenant que `commercial_quotes_require_draft_before_write` (E10.10a).
create or replace function public.commercial_orders_immutable()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if not exists (select 1 from public.tenants t where t.id = old.tenant_id) then
      -- Cascade depuis la suppression du tenant parent : legitime.
      return old;
    end if;
    raise exception 'order.immutable: une commande ne se supprime jamais directement (%)', old.id;
  end if;

  if new.customer_id is distinct from old.customer_id
     or new.quote_id is distinct from old.quote_id
     or new.number is distinct from old.number
     or new.source_quote_status is distinct from old.source_quote_status
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at
     or new.lines_subtotal is distinct from old.lines_subtotal
     or new.global_discount is distinct from old.global_discount
     or new.effective_discount_rate is distinct from old.effective_discount_rate
     or new.net_total is distinct from old.net_total
     or new.vat_rate is distinct from old.vat_rate
     or new.vat_regime is distinct from old.vat_regime
     or new.vat_amount is distinct from old.vat_amount
     or new.total_incl_tax is distinct from old.total_incl_tax
  then
    raise exception 'order.immutable: seuls status et updated_at sont modifiables sur une commande (%)', old.id;
  end if;

  return new;
end;
$$;

drop trigger if exists commercial_orders_immutable_before_write on public.commercial_orders;
create trigger commercial_orders_immutable_before_write
  before update or delete on public.commercial_orders
  for each row execute function public.commercial_orders_immutable();

-- ── 5. Totaux FIGES a la conversion — meme arithmetique que computeQuoteTotals
--    (TypeScript) et private.commercial_quote_totals (b-1), SANS le filtre
--    show_discounts (regle de visibilite CLIENT, sans objet cote atelier) ───
create or replace function private.commercial_order_totals_at_conversion(p_quote_id uuid)
returns table (
  lines_subtotal numeric(12,2),
  global_discount numeric(12,2),
  effective_discount_rate numeric(6,4),
  net_total numeric(12,2),
  vat_rate numeric(6,4),
  vat_regime text,
  vat_amount numeric(12,2),
  total_incl_tax numeric(12,2)
)
language plpgsql
stable
set search_path = pg_catalog, public, private
as $$
declare
  v_global_discount_rate numeric(6,4);
  v_target_net_total numeric(12,2);
  v_vat_rate_override numeric(6,4);
  v_tenant_tax_regime text;
  v_subtotal numeric(12,2);
  v_net_total numeric(12,2);
  v_global_discount numeric(12,2);
  v_effective_rate_raw numeric;
  v_effective_discount_rate numeric(6,4);
  v_raw_vat_rate numeric(6,4);
  v_vat_regime text;
  v_vat_amount numeric(12,2);
  v_total_incl_tax numeric(12,2);
begin
  select q.global_discount_rate, q.target_net_total, q.vat_rate, t.tax_regime::text
    into v_global_discount_rate, v_target_net_total, v_vat_rate_override, v_tenant_tax_regime
  from public.commercial_quotes q
  join public.tenants t on t.id = q.tenant_id
  where q.id = p_quote_id;

  if not found then
    return;
  end if;

  select coalesce(sum(l.sale_price), 0)::numeric(12,2) into v_subtotal
  from public.commercial_quote_lines l
  where l.quote_id = p_quote_id;

  -- Meme ordre CONTRACTUEL que computeQuoteTotals() : sous-total -> net_total
  -- (cible OU taux OU sous-total tel quel) -> remise DEDUITE -> TVA en bas.
  if v_target_net_total is not null then
    v_net_total := v_target_net_total;
  elsif v_global_discount_rate is not null then
    v_net_total := round(v_subtotal * (1 - v_global_discount_rate), 2);
  else
    v_net_total := v_subtotal;
  end if;

  if v_net_total < 0 then
    v_net_total := 0;
  end if;

  v_global_discount := v_subtotal - v_net_total;

  if v_subtotal <> 0 then
    v_effective_rate_raw := round(v_global_discount / v_subtotal, 4);
    if v_effective_rate_raw > 99.9999 or v_effective_rate_raw < -99.9999 then
      v_effective_discount_rate := null;
    else
      v_effective_discount_rate := v_effective_rate_raw;
    end if;
  else
    v_effective_discount_rate := null;
  end if;

  v_raw_vat_rate := coalesce(
    v_vat_rate_override,
    case v_tenant_tax_regime
      when 'metropole_fr' then 0.2000
      when 'dom_tom' then 0.0850
      when 'franchise_tva' then 0.0000
      when 'export_eu' then 0.0000
      when 'export_world' then 0.0000
      else 0.0000
    end
  );
  if v_raw_vat_rate < 0 then
    v_raw_vat_rate := 0;
  end if;
  v_vat_regime := case when v_vat_rate_override is not null then null else v_tenant_tax_regime end;
  v_vat_amount := round(v_net_total * v_raw_vat_rate, 2);
  v_total_incl_tax := v_net_total + v_vat_amount;

  return query select
    v_subtotal, v_global_discount, v_effective_discount_rate, v_net_total,
    v_raw_vat_rate, v_vat_regime, v_vat_amount, v_total_incl_tax;
end;
$$;

comment on function private.commercial_order_totals_at_conversion(uuid) is
  'E10.12 — CommercialOrderTotals au moment de la conversion, meme arithmetique que computeQuoteTotals()/private.commercial_quote_totals (b-1), SANS filtre show_discounts (document atelier, pas une vue client). Fonction PRIVEE : jamais grantee, appelee uniquement depuis api_convert_commercial_quote.';

revoke all on function private.commercial_order_totals_at_conversion(uuid) from public, anon, authenticated;

-- ── 6. CONVERSION — api_convert_commercial_quote ────────────────────────────
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

  -- Decision #9 du contrat (arbitrage Arnaud, 2026-09-08, reserve (b) close) :
  -- TOUT membre du tenant, aucune garde de capability.
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

  -- Echappatoire d immuabilite (commercial_quotes_require_draft_before_write,
  -- migration 20260906160000), posee AVANT la transition ci-dessous — meme
  -- correctif B7 (E10.10a round 5) applique des le depart : remise a vide sur
  -- CHAQUE branche de sortie, echecs compris.
  perform set_config('magrit.change_set_id', v_change_set::text, true);
  perform set_config('magrit.quote_transition', 'true', true);

  -- TRANSITION ATOMIQUE (contrat, §3 "une seule fonction, une seule
  -- transaction", point 1) : lecture PREALABLE du statut/client par
  -- `SELECT ... FOR UPDATE` (MEME patron que `api_send_commercial_quote`,
  -- migration 20260906160000, lignes 647-651 — qa-review round 1, correctif
  -- B1). Le verrou de ligne pose ici est tenu jusqu a la fin de la
  -- transaction : aucun autre acteur ne peut modifier cette ligne entre
  -- cette lecture et l UPDATE de garde qui suit, et la valeur lue est
  -- TOUJOURS la derniere version COMMITEE (jamais un snapshot pris avant
  -- qu une transaction concurrente n ait committe pendant l attente du
  -- verrou).
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

  -- Garde de transition : `v_prior_status` a ete lu SOUS LE VERROU ci-dessus,
  -- donc ce WHERE ne peut jamais echouer a tort ni reussir a tort — la ligne
  -- n a pas pu changer depuis la lecture.
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

  -- Audit d entete (contrat, §3 point 5) : field/quote_snapshot NULL (l
  -- instantane pris a l envoi fait deja foi), previous_value = le statut
  -- source, new_value = 'converted', actor_id/actor_label = le MEMBRE qui a
  -- valide (contrairement a accepted/rejected, cette action a toujours un
  -- auteur Magrit).
  insert into public.commercial_quote_header_audit
    (quote_id, change_set_id, action, field, previous_value, new_value, quote_snapshot, actor_id, actor_label)
  values
    (p_quote_id, v_change_set, 'converted', null, v_prior_status, 'converted', null, v_actor,
     (select email from auth.users where id = v_actor));

  -- Totaux FIGES, calcules UNE FOIS, sur les lignes du devis (inchangees par
  -- la transition ci-dessus : seul commercial_quotes.status/converted_at a
  -- bouge).
  select * into v_totals from private.commercial_order_totals_at_conversion(p_quote_id);

  -- Numerotation — sequence PROPRE (commercial_order_number_counters),
  -- meme verrou de ligne (`insert ... on conflict do update ... returning`)
  -- que commercial_quote_number_counters (E10.3) : jamais un `max(number)+1`.
  v_year := extract(year from (now() at time zone 'utc'))::integer;

  insert into public.commercial_order_number_counters (tenant_id, year, last_value)
  values (p_tenant_id, v_year, 1)
  on conflict (tenant_id, year)
  do update set last_value = public.commercial_order_number_counters.last_value + 1
  returning last_value into v_next;

  v_number := 'CDE-' || v_year::text || '-' || lpad(v_next::text, 5, '0');

  insert into public.commercial_orders (
    tenant_id, customer_id, quote_id, number, status, source_quote_status,
    lines_subtotal, global_discount, effective_discount_rate, net_total,
    vat_rate, vat_regime, vat_amount, total_incl_tax, created_by
  )
  values (
    p_tenant_id, v_customer_id, p_quote_id, v_number, 'validated', v_prior_status,
    v_totals.lines_subtotal, v_totals.global_discount, v_totals.effective_discount_rate, v_totals.net_total,
    v_totals.vat_rate, v_totals.vat_regime, v_totals.vat_amount, v_totals.total_incl_tax, v_actor
  )
  returning id into v_order_id;

  -- Lignes COPIEES telles quelles, dans l ordre de position (decision #4 du
  -- contrat : jamais recalculees, E10.8 gelee).
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
  'E10.12 — POST /quotes/{quoteId}/conversions. Transition ATOMIQUE sent/accepted -> converted (arbitrage Arnaud 2026-09-08), numerotation CDE-AAAA-NNNNN, copie FIGEE des lignes et totaux, audit d entete converted. Ouverte a TOUT membre du tenant (aucune garde de capability, arbitrage Arnaud 2026-09-08).';

revoke all on function public.api_convert_commercial_quote(uuid, uuid) from public, anon;
grant execute on function public.api_convert_commercial_quote(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';

-- ============================================================================
-- REVERSIBILITE — le CLI Supabase ne gere pas de bloc `down`. SQL de retrait,
-- a jouer tel quel dans une migration inverse si la story est annulee :
--
--   revoke execute on function public.api_convert_commercial_quote(uuid, uuid) from authenticated;
--   drop function if exists public.api_convert_commercial_quote(uuid, uuid);
--   revoke execute on function private.commercial_order_totals_at_conversion(uuid) from authenticated;
--   drop function if exists private.commercial_order_totals_at_conversion(uuid);
--   drop trigger if exists commercial_orders_immutable_before_write on public.commercial_orders;
--   drop function if exists public.commercial_orders_immutable();
--   drop trigger if exists commercial_order_lines_immutable_before_write on public.commercial_order_lines;
--   drop function if exists public.commercial_order_lines_immutable();
--   drop policy if exists "commercial_order_lines_select" on public.commercial_order_lines;
--   drop policy if exists "commercial_orders_select" on public.commercial_orders;
--   drop trigger if exists commercial_orders_set_updated_at on public.commercial_orders;
--   drop function if exists public.commercial_orders_set_updated_at();
--   drop table if exists public.commercial_order_number_counters;
--   drop table if exists public.commercial_order_lines;
--   drop table if exists public.commercial_orders;
--   alter table public.commercial_quote_header_audit
--     drop constraint if exists commercial_quote_header_audit_shape,
--     add constraint commercial_quote_header_audit_shape check (
--       (action = 'updated' and field is not null and quote_snapshot is null)
--       or (action = 'sent' and field is null and quote_snapshot is not null)
--       or (action in ('resent', 'duplicated', 'status_forced', 'accepted', 'rejected') and field is null and quote_snapshot is null)
--     );
--   alter table public.commercial_quote_header_audit
--     drop constraint if exists commercial_quote_header_audit_action_check,
--     add constraint commercial_quote_header_audit_action_check
--       check (action in ('updated', 'sent', 'resent', 'duplicated', 'status_forced', 'accepted', 'rejected'));
--   alter table public.commercial_quotes drop column if exists converted_at;
--   notify pgrst, 'reload schema';
--
-- Aucune autre table ne reference commercial_orders/commercial_order_lines :
-- le retrait est sans effet de bord au-dela de la perte des commandes
-- elles-memes. `commercial_quotes`/`commercial_quote_lines` ne sont pas
-- touchees par le retrait au-dela de converted_at et de l elargissement du
-- CHECK d audit.
-- ============================================================================
