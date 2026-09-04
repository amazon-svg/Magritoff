-- ============================================================================
-- Sprint 5 Gestion commerciale — story E10.9 : remises granulaires par ligne
-- de devis et tracabilite d audit, elargie par les capacites de l ancien
-- editeur de devis (ajout/suppression/requantification/reordonnancement,
-- decision d Arnaud du 01/09) et par la reprise du geste commercial
-- (`sale_price`/`margin_rate` mutuellement exclusifs, CA1-CA9).
-- ----------------------------------------------------------------------------
-- ── Ce que cette migration fait ─────────────────────────────────────────────
--   1. `commercial_quote_lines.project_item_id` devient NULLABLE : une ligne
--      LIBRE (`origin = 'free'`) n a par construction aucun element de projet
--      source.
--   2. Nouvelles colonnes du geste commercial : `origin`, `sale_price`,
--      `sale_margin_rate`, `discount_rate`, `margin_variation`,
--      `chiffrage_quantity` (quantite du chiffrage source, pour detecter
--      l alerte `production_cost_stale` sans rejoindre `project_items` a
--      chaque lecture).
--   3. Durcissement des colonnes deja posees par E10.3 mais laissees NULL en
--      attendant E10.21 (desormais livree) : `public_price`, `customer_price`,
--      `applied_margin_rate` deviennent NOT NULL, `breakdown` doit porter au
--      moins un element. Backfill des lignes existantes AVANT le NOT NULL
--      (section dediee ci-dessous).
--   4. Garde d etat : toute ecriture sur une ligne exige que le devis parent
--      soit `draft` (`quote_line.quote_not_draft`), portee par un trigger
--      BEFORE — vrai quel que soit le chemin d ecriture (INSERT/UPDATE/DELETE
--      direct, ou les fonctions RPC de retrait/reordonnancement ci-dessous).
--   5. Journal d audit append-only `commercial_quote_line_audit`, une entree
--      PAR CHAMP PERSISTE effectivement change (CA5, CA6), alimentee par
--      trigger AFTER INSERT/UPDATE/DELETE sur `commercial_quote_lines`.
--   6. Deux fonctions `security definer` pour les operations MULTI-LIGNES
--      transactionnelles (retrait avec resserrement des positions,
--      reordonnancement complet) — meme raisonnement que
--      `api_create_commercial_quote_from_project_items` (E10.3) : PostgREST
--      n offre pas de transaction multi-requetes, une fonction plpgsql le
--      fait en un seul aller-retour. L ajout et la modification d une ligne
--      restent de simples `insert`/`update` PostgREST (une seule ligne
--      affectee, le prix est calcule cote application par `PriceRulesService`
--      + `PricingEngine`, jamais en SQL — E10.8 gelee, aucun calcul de prix de
--      vente hors PricingEngine).
--   7. (qa-review, correctifs) Position UNIQUE par devis (`quote_id,
--      position`, DEFERRABLE INITIALLY DEFERRED — point mineur 2), et
--      propagation de TOUTE ecriture de ligne vers `commercial_quotes.
--      updated_at` (trigger AFTER, section 4bis) : sans ce dernier,
--      `reorderQuoteLines` promettait par contrat une concurrence optimiste
--      qui n avancait jamais l ETag du devis (B1, BLOQUANT).
--
-- ── Backfill des lignes E10.3 existantes (choix documente) ─────────────────
-- Ces lignes ont `public_price`/`customer_price`/`applied_margin_rate` NULL et
-- `breakdown = '[]'` : le contrat E10.9 interdit desormais ces valeurs
-- (QuoteLine, `openapi/magrit-core.v1.yaml`). Le calcul canonique vit dans
-- `SingleCostPricingEngine.price()` (TypeScript, E10.21) ; le rejouer ici en
-- SQL PUR est un choix assume plutot qu une passe applicative separee,
-- possible car :
--   - l algorithme est enterement deterministe et documente
--     (`src/modules/pricing/application/single-cost-pricing-engine.ts`) ;
--   - la regle de prix a appliquer est deja arbitree par la fonction SQL
--     `resolve_price_rule` (E10.7, meme SGBD, memes donnees) ;
--   - AUCUNE ligne E10.3 existante ne porte de `product_range_id` (le champ
--     n existe nulle part dans `project_items.quote_payload` a ce jour) : la
--     resolution ne peut donc retenir qu une regle de portee `global` ou
--     `customer` (jamais `range`/`customer_range`, qui exigent une gamme), et
--     la marge par defaut de gamme (`product_range_default_margins`) n a
--     jamais de cible a joindre — elle est donc omise du backfill (defaut
--     `0.0000`, coherent avec le comportement du moteur pour un contexte sans
--     gamme). C est un ecart assume, documente ici et dans le rapport de fin
--     de story, pas un oubli : une ligne CREEE APRES cette story avec un
--     `product_range_id` resoluble (si un jour porte par `product_config`)
--     beneficiera normalement de la marge de gamme, comme toute nouvelle
--     ligne passee par le service applicatif.
--   - l arrondi `round(numeric, 2|4)` de PostgreSQL est round-half-away-from-
--     zero, equivalent a round-half-up pour les operandes non negatifs en jeu
--     ici (couts et taux de regle toujours >= 0, `nonNegativeRateSchema`) —
--     meme discipline que `pricing-money.ts` cote TypeScript (CA4).
-- `sale_price` demarre sur le `customer_price` recalcule (aucune remise,
-- aucun ecart de marge — CA1/CA2/CA3, meme etat qu une ligne fraichement
-- creee), `chiffrage_quantity` est fige a la quantite courante (rien n a
-- encore diverge), `origin` vaut `project_item` (ces lignes n existaient
-- qu au travers de `createQuoteFromProject`, aucune ligne libre avant E10.9).
-- ============================================================================

-- ── 1. Nouvelles colonnes (nullable pour permettre le backfill) ────────────
alter table public.commercial_quote_lines
  alter column project_item_id drop not null;

alter table public.commercial_quote_lines
  add column if not exists origin text not null default 'project_item',
  add column if not exists chiffrage_quantity integer,
  add column if not exists sale_price numeric(12,2),
  add column if not exists sale_margin_rate numeric(6,4),
  add column if not exists discount_rate numeric(6,4),
  add column if not exists margin_variation numeric(6,4);

comment on column public.commercial_quote_lines.origin is
  'E10.9 — provenance de la ligne : project_item (chiffrage du projet source, E10.3) ou free (ligne libre saisie a la main, decision d Arnaud du 01/09).';
comment on column public.commercial_quote_lines.project_item_id is
  'E10.3 CA3, elargi par E10.9 : NULL pour une ligne libre (origin = free). Reference SANS cascade : le retrait d un devis ne touche jamais l element de projet source.';
comment on column public.commercial_quote_lines.chiffrage_quantity is
  'E10.9 — quantite du chiffrage source au moment ou la ligne a ete creee (NULL sur une ligne libre, qui n a pas de chiffrage). Sert a detecter l alerte production_cost_stale quand quantity diverge, sans rejoindre project_items a chaque lecture.';
comment on column public.commercial_quote_lines.sale_price is
  'E10.9 CA1 — prix de vente effectivement porte au devis, total pour quantity. Seule grandeur monetaire pilotee par le commercial (directement ou via un taux de marge vise). Vaut customer_price a la creation.';
comment on column public.commercial_quote_lines.sale_margin_rate is
  'E10.9 — taux de marge REELLEMENT obtenu par sale_price sur production_price. NULL quand production_price = 0 (marge sur zero indefinie) ou hors intervalle numeric(6,4). Champ DERIVE, jamais audite (cf. commercial_quote_line_audit).';
comment on column public.commercial_quote_lines.discount_rate is
  'E10.9 CA2 — remise DEDUITE : (customer_price - sale_price) / customer_price. Peut etre negative (majoration). NULL quand customer_price = 0.';
comment on column public.commercial_quote_lines.margin_variation is
  'E10.9 CA3 — ecart entre sale_margin_rate et applied_margin_rate. NULL exactement quand sale_margin_rate l est.';

-- ── 2. Backfill des lignes E10.3 existantes (avant durcissement NOT NULL) ──
with source as (
  select
    l.id as line_id,
    l.production_price,
    l.quantity,
    q.tenant_id,
    q.customer_id,
    q.created_at::date as at_date
  from public.commercial_quote_lines l
  join public.commercial_quotes q on q.id = l.quote_id
  where l.public_price is null
     or l.customer_price is null
     or l.applied_margin_rate is null
     or l.sale_price is null
),
rule_pick as (
  select s.line_id, rpr.rule_id
  from source s
  left join lateral public.resolve_price_rule(s.tenant_id, s.customer_id, null::uuid, s.at_date) rpr on true
),
rule_detail as (
  select rp.line_id, pr.value_type, pr.value
  from rule_pick rp
  left join public.price_rules pr on pr.id = rp.rule_id
),
margin_calc as (
  select
    s.line_id,
    s.production_price,
    coalesce(case when rd.value_type = 'margin_rate' then rd.value end, 0.0000) as applied_margin_rate,
    case when rd.value_type = 'margin_rate' then rp.rule_id end as margin_rule_id,
    case when rd.value_type = 'discount_rate' then rd.value end as discount_value,
    case when rd.value_type = 'discount_rate' then rp.rule_id end as discount_rule_id
  from source s
  join rule_pick rp on rp.line_id = s.line_id
  left join rule_detail rd on rd.line_id = s.line_id
),
priced as (
  select
    line_id,
    production_price,
    applied_margin_rate,
    round(production_price * (1 + applied_margin_rate), 2) as public_price,
    discount_value,
    coalesce(margin_rule_id, discount_rule_id) as applied_rule_id
  from margin_calc
),
final as (
  select
    line_id,
    production_price,
    applied_margin_rate,
    public_price,
    case when discount_value is not null then round(public_price * (1 - discount_value), 2) else public_price end
      as customer_price,
    applied_rule_id
  from priced
)
update public.commercial_quote_lines l
set
  origin = 'project_item',
  chiffrage_quantity = l.quantity,
  applied_margin_rate = f.applied_margin_rate,
  public_price = f.public_price,
  customer_price = f.customer_price,
  applied_rule_id = f.applied_rule_id,
  sale_price = f.customer_price,
  sale_margin_rate = case
    when f.production_price = 0 then null
    else round((f.customer_price - f.production_price) / f.production_price, 4)
  end,
  margin_variation = case
    when f.production_price = 0 then null
    else round(round((f.customer_price - f.production_price) / f.production_price, 4) - f.applied_margin_rate, 4)
  end,
  discount_rate = case when f.customer_price = 0 then null else 0.0000 end,
  breakdown = jsonb_build_array(jsonb_build_object(
    'post', 'total',
    'cost', f.production_price::numeric(12,2)::text,
    'margin_rate', f.applied_margin_rate::numeric(6,4)::text,
    'price', f.customer_price::numeric(12,2)::text,
    'source', 'clariprint'
  ))
from final f
where f.line_id = l.id;

-- Toute ligne creee APRES cette migration (via addLine/le service applicatif)
-- porte deja sale_price/origin/chiffrage_quantity a l insertion : ce second
-- passage ne peut viser que d improbables lignes orphelines (aucune connue a
-- ce jour) et est sans effet sur elles si `production_price` est absent.
update public.commercial_quote_lines
   set chiffrage_quantity = quantity
 where origin = 'project_item' and chiffrage_quantity is null;

-- ── 3. Durcissement des colonnes de prix (E10.9, cf. en-tete QuoteLine) ────
alter table public.commercial_quote_lines
  alter column public_price set not null,
  alter column customer_price set not null,
  alter column applied_margin_rate set not null,
  alter column sale_price set not null;

alter table public.commercial_quote_lines
  add constraint commercial_quote_lines_sale_price_non_negative check (sale_price >= 0),
  add constraint commercial_quote_lines_origin_check check (origin in ('project_item', 'free')),
  -- Coherence origin <-> project_item_id, dans LES DEUX SENS (meme
  -- raisonnement que price_rules_scope_*_coherence, E10.6 CA2).
  add constraint commercial_quote_lines_origin_project_item_coherence check (
    (origin = 'project_item') = (project_item_id is not null)
  ),
  -- Durcissement E10.9 : breakdown JAMAIS vide (red flag E10.21).
  add constraint commercial_quote_lines_breakdown_not_empty check (jsonb_array_length(breakdown) >= 1);

-- ── 3bis. Position UNIQUE par devis (qa-review, point mineur 2) ─────────────
-- `commercial_quote_lines_quote_position_idx` (migration 20260901000600)
-- n etait qu un index de tri, pas une contrainte : `addLine` (adaptateur
-- Supabase) calcule `position` par `count(*)` PUIS `insert` en deux
-- allers-retours SEPARES, jamais dans la meme transaction verrouillante —
-- deux ajouts concurrents sur le MEME devis peuvent lire le meme compte et
-- produire deux lignes a la MEME position. Remplace l index par une
-- contrainte d unicite sur (quote_id, position), qui rend cette situation
-- IMPOSSIBLE a committer (l adaptateur retente alors l ajout, voir
-- `SupabaseCommercialQuotesRepository.addLine`).
--
-- DEFERRABLE INITIALLY DEFERRED, jamais IMMEDIATE : `api_reorder_commercial_
-- quote_lines` (section 6 ci-dessous) reordonne PLUSIEURS lignes dans un
-- SEUL `update ... from wanted`, ce qui traverse necessairement un etat
-- intermediaire ou deux lignes partagent momentanement la meme position
-- avant que la derniere ligne du batch ne retablisse l unicite — un controle
-- IMMEDIAT (verifie ligne par ligne au fil de l instruction) casserait ce
-- balayage pourtant parfaitement valide au moment du COMMIT. C est l exemple
-- canonique documente par Postgres pour DEFERRABLE (permutation de valeurs
-- uniques) : la verification est reportee a la fin de la transaction, donc
-- de la requete HTTP (chaque appel PostgREST = une transaction), ce qui la
-- laisse strictement equivalente a un controle immediat pour un `addLine`
-- (une seule ligne inseree par transaction) tout en laissant passer un
-- reordonnancement complet.
drop index if exists public.commercial_quote_lines_quote_position_idx;
alter table public.commercial_quote_lines
  add constraint commercial_quote_lines_quote_position_unique
    unique (quote_id, position) deferrable initially deferred;

-- ── 4. Garde d etat — toute ecriture exige un devis brouillon ──────────────
-- BEFORE INSERT/UPDATE/DELETE : vrai quel que soit le chemin d ecriture
-- (insert/update PostgREST direct, ou les fonctions RPC ci-dessous), une
-- seule fois pose plutot qu une verification dupliquee cote application a
-- chaque nouvelle voie d ecriture.
create or replace function public.commercial_quote_lines_require_draft_quote()
returns trigger
language plpgsql
as $$
declare
  v_quote_id uuid := coalesce(new.quote_id, old.quote_id);
  v_status text;
begin
  select status into v_status from public.commercial_quotes where id = v_quote_id;
  if v_status is null then
    raise exception 'quote_line.quote_not_draft: devis introuvable (%)', v_quote_id;
  end if;
  if v_status <> 'draft' then
    raise exception 'quote_line.quote_not_draft: devis % a l etat % (draft requis)', v_quote_id, v_status;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists commercial_quote_lines_require_draft_before_write on public.commercial_quote_lines;
create trigger commercial_quote_lines_require_draft_before_write
  before insert or update or delete on public.commercial_quote_lines
  for each row execute function public.commercial_quote_lines_require_draft_quote();

-- ── 4bis. Propagation vers l ETag du devis parent (B1, qa-review BLOQUANT) ──
-- Le contrat (`If-Match` de `reorderQuoteLines`, openapi/magrit-core.v1.yaml)
-- promet explicitement : « Toute ecriture de ligne (ajout, modification,
-- retrait, reordonnancement) avance `updated_at` du devis, donc son ETag. »
-- `commercial_quotes_set_updated_at` (migration 20260901000600) est un
-- trigger BEFORE UPDATE ON commercial_quotes UNIQUEMENT : aucune ecriture sur
-- commercial_quote_lines ne le declenchait, ce qui rendait la concurrence
-- optimiste de `reorderQuoteLines` INERTE — deux commerciaux qui lisent le
-- meme devis (meme ETag), l un reordonne (200, ETag inchange en reponse), le
-- second rejoue le MEME `If-Match` perime et obtenait 200 au lieu du 409
-- attendu, ecrasant le premier reordonnancement en silence.
--
-- AFTER INSERT OR UPDATE OR DELETE, SANS `when` : contrairement au trigger
-- d audit (qui ne journalise QUE les changements reels), celui-ci doit
-- avancer `updated_at` pour TOUTE ecriture reellement executee par Postgres,
-- y compris un `update` dont les valeurs finales sont identiques aux valeurs
-- de depart (une requete PATCH a bien ete honoree, l ETag doit en temoigner).
create or replace function public.commercial_quote_lines_touch_quote_updated_at()
returns trigger
language plpgsql
as $$
begin
  update public.commercial_quotes
     set updated_at = now()
   where id = coalesce(new.quote_id, old.quote_id);
  return coalesce(new, old);
end;
$$;

drop trigger if exists commercial_quote_lines_touch_quote_updated_at_trigger on public.commercial_quote_lines;
create trigger commercial_quote_lines_touch_quote_updated_at_trigger
  after insert or update or delete on public.commercial_quote_lines
  for each row execute function public.commercial_quote_lines_touch_quote_updated_at();

-- ── 5. Journal d audit append-only (CA5, CA6) ──────────────────────────────
-- `quote_line_id` porte AUCUNE contrainte de cle etrangere : une ligne
-- retiree doit rester interrogeable par son identifiant (contrat,
-- `QuoteLineAuditEntry.quote_line_id`) ; une FK obligerait soit une cascade de
-- suppression de l audit (contraire a l append-only), soit un rejet de
-- `deleteQuoteLine` (contraire a la fonctionnalite). `quote_id`, lui, garde sa
-- FK habituelle vers `commercial_quotes` (cascade coherente avec le reste du
-- schema : supprimer un devis supprime son propre journal, jamais celui d un
-- autre devis).
create table if not exists public.commercial_quote_line_audit (
  id             uuid primary key default gen_random_uuid(),
  quote_id       uuid not null references public.commercial_quotes(id) on delete cascade,
  quote_line_id  uuid not null,
  change_set_id  uuid not null,
  action         text not null check (action in ('added', 'updated', 'removed', 'reordered')),
  field          text check (field in ('sale_price', 'discount_rate', 'margin_variation', 'quantity', 'position')),
  previous_value text,
  new_value      text,
  line_snapshot  jsonb,
  actor_id       uuid references auth.users(id),
  actor_label    text,
  occurred_at    timestamptz not null default now(),

  -- `field`/`line_snapshot` selon l action (contrat QuoteLineAuditEntry) :
  -- added/removed portent line_snapshot et field=null ; updated/reordered
  -- portent field et line_snapshot=null.
  constraint commercial_quote_line_audit_shape check (
    (action in ('added', 'removed') and field is null and line_snapshot is not null)
    or (action in ('updated', 'reordered') and field is not null and line_snapshot is null)
  )
);

comment on table public.commercial_quote_line_audit is
  'E10.9 CA5/CA6 — journal append-only des lignes de devis, une entree PAR CHAMP PERSISTE effectivement change (sale_margin_rate est DERIVE, jamais audite). change_set_id regroupe les entrees nees d une meme requete. quote_line_id survit a la suppression de la ligne (aucune FK). Jamais edite ni supprime par l application.';

create index if not exists commercial_quote_line_audit_line_idx
  on public.commercial_quote_line_audit (quote_line_id, occurred_at desc);
create index if not exists commercial_quote_line_audit_quote_idx
  on public.commercial_quote_line_audit (quote_id, occurred_at desc);

create or replace function public.commercial_quote_lines_write_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_change_set uuid;
  v_actor uuid := auth.uid();
  v_actor_label text;
begin
  select email into v_actor_label from auth.users where id = v_actor;

  -- `magrit.change_set_id` : positionne par l application (`set_config(...,
  -- true)`, local a la transaction) quand UNE MEME requete peut affecter
  -- PLUSIEURS lignes (retrait avec resserrement des positions,
  -- reordonnancement complet) — toutes les entrees nees de cette transaction
  -- partagent alors le meme identifiant (contrat, QuoteLineAuditEntry.
  -- change_set_id). A defaut (ecriture simple, une seule ligne affectee), un
  -- identifiant frais est genere PAR INVOCATION du trigger, ce qui revient au
  -- meme puisqu une seule ligne est alors concernee.
  begin
    v_change_set := nullif(current_setting('magrit.change_set_id', true), '')::uuid;
  exception when others then
    v_change_set := null;
  end;
  if v_change_set is null then
    v_change_set := gen_random_uuid();
  end if;

  if tg_op = 'INSERT' then
    insert into public.commercial_quote_line_audit
      (quote_id, quote_line_id, change_set_id, action, field, previous_value, new_value, line_snapshot, actor_id, actor_label)
    values
      (new.quote_id, new.id, v_change_set, 'added', null, null, null, to_jsonb(new), v_actor, v_actor_label);
    return new;
  end if;

  if tg_op = 'DELETE' then
    insert into public.commercial_quote_line_audit
      (quote_id, quote_line_id, change_set_id, action, field, previous_value, new_value, line_snapshot, actor_id, actor_label)
    values
      (old.quote_id, old.id, v_change_set, 'removed', null, null, null, to_jsonb(old), v_actor, v_actor_label);
    return old;
  end if;

  -- UPDATE : une entree PAR CHAMP PERSISTE effectivement change (CA5). Un
  -- champ envoye avec sa valeur inchangee ne produit AUCUNE entree (le WHEN
  -- du trigger ecarte deja les UPDATE totalement no-op, mais un UPDATE peut
  -- tres bien changer sale_price ET laisser quantity intact : chaque colonne
  -- est donc testee independamment ici).
  if new.position is distinct from old.position then
    insert into public.commercial_quote_line_audit
      (quote_id, quote_line_id, change_set_id, action, field, previous_value, new_value, actor_id, actor_label)
    values
      (new.quote_id, new.id, v_change_set, 'reordered', 'position', old.position::text, new.position::text, v_actor, v_actor_label);
  end if;

  if new.sale_price is distinct from old.sale_price then
    insert into public.commercial_quote_line_audit
      (quote_id, quote_line_id, change_set_id, action, field, previous_value, new_value, actor_id, actor_label)
    values
      (new.quote_id, new.id, v_change_set, 'updated', 'sale_price', old.sale_price::text, new.sale_price::text, v_actor, v_actor_label);
  end if;

  if new.discount_rate is distinct from old.discount_rate then
    insert into public.commercial_quote_line_audit
      (quote_id, quote_line_id, change_set_id, action, field, previous_value, new_value, actor_id, actor_label)
    values
      (new.quote_id, new.id, v_change_set, 'updated', 'discount_rate', old.discount_rate::text, new.discount_rate::text, v_actor, v_actor_label);
  end if;

  if new.margin_variation is distinct from old.margin_variation then
    insert into public.commercial_quote_line_audit
      (quote_id, quote_line_id, change_set_id, action, field, previous_value, new_value, actor_id, actor_label)
    values
      (new.quote_id, new.id, v_change_set, 'updated', 'margin_variation', old.margin_variation::text, new.margin_variation::text, v_actor, v_actor_label);
  end if;

  if new.quantity is distinct from old.quantity then
    insert into public.commercial_quote_line_audit
      (quote_id, quote_line_id, change_set_id, action, field, previous_value, new_value, actor_id, actor_label)
    values
      (new.quote_id, new.id, v_change_set, 'updated', 'quantity', old.quantity::text, new.quantity::text, v_actor, v_actor_label);
  end if;

  return new;
end;
$$;

drop trigger if exists commercial_quote_lines_audit_insert on public.commercial_quote_lines;
create trigger commercial_quote_lines_audit_insert
  after insert on public.commercial_quote_lines
  for each row execute function public.commercial_quote_lines_write_audit();

drop trigger if exists commercial_quote_lines_audit_update on public.commercial_quote_lines;
create trigger commercial_quote_lines_audit_update
  after update on public.commercial_quote_lines
  for each row
  when (old.* is distinct from new.*)
  execute function public.commercial_quote_lines_write_audit();

drop trigger if exists commercial_quote_lines_audit_delete on public.commercial_quote_lines;
create trigger commercial_quote_lines_audit_delete
  after delete on public.commercial_quote_lines
  for each row execute function public.commercial_quote_lines_write_audit();

alter table public.commercial_quote_line_audit enable row level security;

drop policy if exists "commercial_quote_line_audit_select" on public.commercial_quote_line_audit;
create policy "commercial_quote_line_audit_select" on public.commercial_quote_line_audit for select using (
  is_super_admin()
  or exists (
    select 1 from public.commercial_quotes q
    where q.id = commercial_quote_line_audit.quote_id
      and q.tenant_id in (select public.current_user_tenant_ids())
  )
);

comment on policy "commercial_quote_line_audit_select" on public.commercial_quote_line_audit is
  'RLS = isolation par TENANT uniquement (defense en profondeur). La garde "role admin du tenant" du contrat (listQuoteAuditEntries, 403 identity.role_required) est posee cote application (CommercialQuotesService), pas ici : une reponse vide par RLS masquerait a tort une absence d habilitation derriere une absence de trace (contrat, cf. openapi listQuoteAuditEntries).';

-- Append-only : ecriture reservee au trigger SECURITY DEFINER ci-dessus.
revoke insert, update, delete on table public.commercial_quote_line_audit from authenticated, anon;

-- ── 5bis. Evolution de la creation groupee de lignes (E10.3) ────────────────
-- `api_create_commercial_quote_from_project_items` (migration 20260901000600)
-- laissait `public_price`/`customer_price`/`applied_margin_rate`/`sale_price`
-- a leurs valeurs par defaut, NULL a l epoque. Le durcissement NOT NULL de
-- l etape 3 ci-dessus rend cette forme d INSERT invalide pour toute NOUVELLE
-- ligne creee par cette voie : elle doit desormais fournir ces colonnes,
-- exactement comme `addLine` (E10.9) le fait cote application.
--
-- Derogation documentee et assumee (a signaler explicitement au rapport de
-- fin de story) : cette fonction cree PLUSIEURS lignes dans UNE SEULE
-- transaction SQL (c est sa raison d etre, CA5 E10.3) ; elle ne peut donc pas
-- appeler l interface TypeScript `PricingEngine`. `commercial_quote_line_
-- default_pricing` ci-dessous replique EXACTEMENT l algorithme de
-- `SingleCostPricingEngine.price()` pour le cas sans decomposition et sans
-- `product_range_id` connu (memes bornes que le backfill de l etape 2 et que
-- `CommercialQuotesService.priceLine()` cote application, qui appellent tous
-- deux `resolve_price_rule` pour la MEME regle). `addLine`/`updateLine`
-- (E10.9), qui n affectent qu UNE ligne a la fois, restent le chemin normal
-- qui appelle reellement PricingEngine ; c est le SEUL chemin d ecriture de
-- ce contrat qui ne le fait pas, et il ne peut pas diverger dans les faits :
-- meme regle resolue, meme formule.
create or replace function public.commercial_quote_line_default_pricing(
  p_tenant_id uuid,
  p_customer_id uuid,
  p_production_price numeric,
  p_at date
)
returns table (
  applied_margin_rate numeric,
  public_price numeric,
  customer_price numeric,
  applied_rule_id uuid
)
language sql
stable
as $$
  with resolved as (
    -- `left join lateral ... on true` sur une source a UNE SEULE ligne :
    -- garantit un resultat meme quand `resolve_price_rule` n a AUCUNE regle a
    -- rendre (ensemble vide), ce qu un simple appel de la fonction ne
    -- garantirait pas dans un contexte de table function seule.
    select rpr.rule_id
    from (select 1) as one
    left join lateral public.resolve_price_rule(p_tenant_id, p_customer_id, null::uuid, p_at) rpr on true
  ),
  detail as (
    select pr.id, pr.value_type, pr.value
    from resolved
    left join public.price_rules pr on pr.id = resolved.rule_id
  ),
  margin as (
    select
      coalesce(case when detail.value_type = 'margin_rate' then detail.value end, 0.0000) as applied_margin_rate,
      case when detail.value_type = 'margin_rate' then detail.id end as margin_rule_id,
      case when detail.value_type = 'discount_rate' then detail.value end as discount_value,
      case when detail.value_type = 'discount_rate' then detail.id end as discount_rule_id
    from detail
  )
  select
    m.applied_margin_rate,
    round(p_production_price * (1 + m.applied_margin_rate), 2) as public_price,
    case
      when m.discount_value is not null
        then round(round(p_production_price * (1 + m.applied_margin_rate), 2) * (1 - m.discount_value), 2)
      else round(p_production_price * (1 + m.applied_margin_rate), 2)
    end as customer_price,
    coalesce(m.margin_rule_id, m.discount_rule_id) as applied_rule_id
  from margin m;
$$;

comment on function public.commercial_quote_line_default_pricing(uuid, uuid, numeric, date) is
  'E10.9 — replique SingleCostPricingEngine.price() (cas poste unique, sans product_range_id) pour la creation groupee de lignes (api_create_commercial_quote_from_project_items). Seul chemin d ecriture de ligne qui ne passe pas par l interface TypeScript PricingEngine, documente en tete de ce bloc.';

grant execute on function public.commercial_quote_line_default_pricing(uuid, uuid, numeric, date) to authenticated;

create or replace function public.api_create_commercial_quote_from_project_items(
  p_tenant_id uuid,
  p_project_id uuid,
  p_item_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_customer_id uuid;
  v_item_count integer;
  v_requested_count integer;
  v_year integer;
  v_next integer;
  v_number text;
  v_quote_id uuid;
begin
  if v_actor is null then
    raise exception 'authentication_required';
  end if;

  v_requested_count := coalesce(array_length(p_item_ids, 1), 0);
  if v_requested_count = 0 then
    raise exception 'invalid_item_ids: at least one project item is required';
  end if;

  if not (
    public.is_super_admin()
    or exists (
      select 1 from public.tenant_members tm
      where tm.tenant_id = p_tenant_id
        and tm.user_id = v_actor
        and tm.role in ('admin', 'member')
    )
  ) then
    raise exception 'permission_denied: quote creation forbidden';
  end if;

  select customer_id into v_customer_id
    from public.projects
   where id = p_project_id
     and tenant_id = p_tenant_id;
  if v_customer_id is null then
    raise exception 'project_not_found';
  end if;

  select count(*) into v_item_count
    from public.project_items
   where project_id = p_project_id
     and id = any(p_item_ids);
  if v_item_count <> v_requested_count then
    raise exception 'invalid_item_ids: one or more items do not belong to this project';
  end if;

  v_year := extract(year from (now() at time zone 'utc'))::integer;

  -- Verrouille la ligne du compteur (tenant_id, annee) le temps de la
  -- transaction : deux creations concurrentes sur le meme couple se
  -- serialisent, jamais de numero duplique.
  insert into public.commercial_quote_number_counters (tenant_id, year, last_value)
  values (p_tenant_id, v_year, 1)
  on conflict (tenant_id, year)
  do update set last_value = public.commercial_quote_number_counters.last_value + 1
  returning last_value into v_next;

  v_number := 'DEV-' || v_year::text || '-' || lpad(v_next::text, 5, '0');

  insert into public.commercial_quotes (tenant_id, customer_id, project_id, number, status, created_by)
  values (p_tenant_id, v_customer_id, p_project_id, v_number, 'draft', v_actor)
  returning id into v_quote_id;

  -- CA3 — chaque ligne reprend la configuration produit, la quantite et le
  -- prix de production issus du chiffrage source. E10.9 : chaque ligne recoit
  -- aussi son prix de vente initial (sale_price = customer_price, remise et
  -- ecart de marge nuls), via `commercial_quote_line_default_pricing` (voir
  -- derogation documentee ci-dessus).
  with items as (
    select
      pi.id as project_item_id,
      pi.label,
      pi.quote_payload,
      row_number() over (order by pi.position) - 1 as position,
      greatest(coalesce((pi.quote_payload->>'quantity')::numeric, 1), 1)::integer as quantity,
      coalesce(
        (pi.quote_payload#>>'{amounts,clariprint_price_ht}')::numeric,
        (pi.quote_payload#>>'{amounts,price}')::numeric,
        0
      )::numeric(12,2) as production_price
    from public.project_items pi
    where pi.project_id = p_project_id
      and pi.id = any(p_item_ids)
  ),
  priced as (
    select
      items.*,
      pricing.applied_margin_rate,
      pricing.public_price,
      pricing.customer_price,
      pricing.applied_rule_id
    from items
    cross join lateral public.commercial_quote_line_default_pricing(
      p_tenant_id, v_customer_id, items.production_price, (now() at time zone 'utc')::date
    ) as pricing
  )
  insert into public.commercial_quote_lines
    (quote_id, project_item_id, label, product_config, quantity, position, production_price,
     origin, chiffrage_quantity, applied_margin_rate, public_price, customer_price, applied_rule_id,
     sale_price, sale_margin_rate, discount_rate, margin_variation, breakdown)
  select
    v_quote_id,
    priced.project_item_id,
    priced.label,
    priced.quote_payload,
    priced.quantity,
    priced.position,
    priced.production_price,
    'project_item',
    priced.quantity,
    priced.applied_margin_rate,
    priced.public_price,
    priced.customer_price,
    priced.applied_rule_id,
    priced.customer_price,
    case when priced.production_price = 0 then null
         else round((priced.customer_price - priced.production_price) / priced.production_price, 4) end,
    case when priced.customer_price = 0 then null else 0.0000 end,
    case when priced.production_price = 0 then null
         else round(
           round((priced.customer_price - priced.production_price) / priced.production_price, 4)
           - priced.applied_margin_rate,
           4
         ) end,
    jsonb_build_array(jsonb_build_object(
      'post', 'total',
      'cost', priced.production_price::numeric(12,2)::text,
      'margin_rate', priced.applied_margin_rate::numeric(6,4)::text,
      'price', priced.customer_price::numeric(12,2)::text,
      'source', 'clariprint'
    ))
  from priced;

  return v_quote_id;
exception
  when invalid_text_representation then
    raise exception 'invalid_item_ids: malformed uuid';
end;
$$;

revoke all on function public.api_create_commercial_quote_from_project_items(uuid, uuid, uuid[]) from public, anon;
grant execute on function public.api_create_commercial_quote_from_project_items(uuid, uuid, uuid[]) to authenticated;

-- ── 6. Fonctions transactionnelles multi-lignes (retrait, reordonnancement) ─
-- Meme raisonnement que api_create_commercial_quote_from_project_items
-- (E10.3) : SECURITY INVOKER (pas DEFINER) — la RLS de commercial_quote_lines
-- s applique normalement a l appelant, ces fonctions n elargissent aucun
-- droit de lecture/ecriture, elles ne font qu atomiser plusieurs instructions
-- SQL et partager un `change_set_id` (voir trigger d audit ci-dessus).
create or replace function public.api_delete_commercial_quote_line(
  p_tenant_id uuid,
  p_quote_id uuid,
  p_line_id uuid
)
returns void
language plpgsql
as $$
declare
  v_change_set uuid := gen_random_uuid();
  v_deleted integer;
begin
  perform set_config('magrit.change_set_id', v_change_set::text, true);

  delete from public.commercial_quote_lines l
   using public.commercial_quotes q
   where l.id = p_line_id
     and l.quote_id = p_quote_id
     and q.id = l.quote_id
     and q.tenant_id = p_tenant_id;
  get diagnostics v_deleted = row_count;
  if v_deleted = 0 then
    raise exception 'quote_line.not_found: ligne % introuvable dans le devis % (ou devis non brouillon)', p_line_id, p_quote_id;
  end if;

  -- Resserre les positions des lignes restantes pour rester contigues
  -- (0..n-1), meme change_set que la suppression ci-dessus.
  with ranked as (
    select id, row_number() over (order by position) - 1 as new_position
    from public.commercial_quote_lines
    where quote_id = p_quote_id
  )
  update public.commercial_quote_lines l
     set position = ranked.new_position
    from ranked
   where l.id = ranked.id
     and l.position <> ranked.new_position;
end;
$$;

revoke all on function public.api_delete_commercial_quote_line(uuid, uuid, uuid) from public, anon;
grant execute on function public.api_delete_commercial_quote_line(uuid, uuid, uuid) to authenticated;

create or replace function public.api_reorder_commercial_quote_lines(
  p_tenant_id uuid,
  p_quote_id uuid,
  p_line_ids uuid[]
)
returns void
language plpgsql
as $$
declare
  v_change_set uuid := gen_random_uuid();
  v_existing_count integer;
  v_requested_count integer;
begin
  perform set_config('magrit.change_set_id', v_change_set::text, true);

  v_requested_count := coalesce(array_length(p_line_ids, 1), 0);

  select count(*) into v_existing_count
    from public.commercial_quote_lines l
    join public.commercial_quotes q on q.id = l.quote_id
   where l.quote_id = p_quote_id
     and q.tenant_id = p_tenant_id;

  -- `line_ids` doit recouvrir EXACTEMENT les lignes existantes : meme
  -- cardinalite, aucun doublon, et chaque id appartient reellement a CE
  -- devis. Verifie ENTIEREMENT avant tout UPDATE — un `UPDATE ... FROM`
  -- ignore silencieusement les lignes de `wanted` sans correspondance, ce qui
  -- masquerait `positions_mismatch` si on se fiait au nombre de lignes
  -- affectees (`GET DIAGNOSTICS`), lui-meme legitimement nul quand l ordre
  -- demande est deja l ordre courant.
  if v_requested_count <> v_existing_count
     or v_requested_count <> (select count(distinct x) from unnest(p_line_ids) as x)
     or v_requested_count <> (
       select count(*) from unnest(p_line_ids) as x(id)
        where exists (
          select 1 from public.commercial_quote_lines l2
           where l2.id = x.id and l2.quote_id = p_quote_id
        )
     )
  then
    raise exception 'quote_line.positions_mismatch: % ligne(s) fournie(s), % attendue(s) dans le devis %',
      v_requested_count, v_existing_count, p_quote_id;
  end if;

  with wanted as (
    select id, ord - 1 as new_position
    from unnest(p_line_ids) with ordinality as t(id, ord)
  )
  update public.commercial_quote_lines l
     set position = wanted.new_position
    from wanted
   where l.id = wanted.id
     and l.quote_id = p_quote_id
     and l.position <> wanted.new_position;
end;
$$;

revoke all on function public.api_reorder_commercial_quote_lines(uuid, uuid, uuid[]) from public, anon;
grant execute on function public.api_reorder_commercial_quote_lines(uuid, uuid, uuid[]) to authenticated;

notify pgrst, 'reload schema';

-- ============================================================================
-- REVERSIBILITE — le CLI Supabase ne gere pas de bloc `down`. SQL de retrait,
-- a jouer tel quel dans une migration inverse si la story est annulee :
--
--   revoke execute on function public.api_reorder_commercial_quote_lines(uuid, uuid, uuid[]) from authenticated;
--   drop function if exists public.api_reorder_commercial_quote_lines(uuid, uuid, uuid[]);
--   revoke execute on function public.api_delete_commercial_quote_line(uuid, uuid, uuid) from authenticated;
--   drop function if exists public.api_delete_commercial_quote_line(uuid, uuid, uuid);
--   -- api_create_commercial_quote_from_project_items : restaurer la version
--   -- E10.3 (migration 20260901000600) par un NOUVEAU `create or replace`
--   -- reprenant son corps d origine (INSERT sans colonnes de prix) — un
--   -- simple DROP casserait la creation de devis, la fonction devant TOUJOURS
--   -- exister.
--   revoke execute on function public.commercial_quote_line_default_pricing(uuid, uuid, numeric, date) from authenticated;
--   drop function if exists public.commercial_quote_line_default_pricing(uuid, uuid, numeric, date);
--   drop trigger if exists commercial_quote_lines_audit_delete on public.commercial_quote_lines;
--   drop trigger if exists commercial_quote_lines_audit_update on public.commercial_quote_lines;
--   drop trigger if exists commercial_quote_lines_audit_insert on public.commercial_quote_lines;
--   drop function if exists public.commercial_quote_lines_write_audit();
--   drop policy if exists "commercial_quote_line_audit_select" on public.commercial_quote_line_audit;
--   drop table if exists public.commercial_quote_line_audit;
--   drop trigger if exists commercial_quote_lines_touch_quote_updated_at_trigger on public.commercial_quote_lines;
--   drop function if exists public.commercial_quote_lines_touch_quote_updated_at();
--   drop trigger if exists commercial_quote_lines_require_draft_before_write on public.commercial_quote_lines;
--   drop function if exists public.commercial_quote_lines_require_draft_quote();
--   alter table public.commercial_quote_lines
--     drop constraint if exists commercial_quote_lines_quote_position_unique,
--     drop constraint if exists commercial_quote_lines_breakdown_not_empty,
--     drop constraint if exists commercial_quote_lines_origin_project_item_coherence,
--     drop constraint if exists commercial_quote_lines_origin_check,
--     drop constraint if exists commercial_quote_lines_sale_price_non_negative,
--     alter column sale_price drop not null,
--     alter column applied_margin_rate drop not null,
--     alter column customer_price drop not null,
--     alter column public_price drop not null,
--     drop column if exists margin_variation,
--     drop column if exists discount_rate,
--     drop column if exists sale_margin_rate,
--     drop column if exists sale_price,
--     drop column if exists chiffrage_quantity,
--     drop column if exists origin;
--   -- project_item_id NOT NULL n est PAS restaure automatiquement : une ligne
--   -- libre creee entre-temps ferait echouer le retour arriere. A traiter au
--   -- cas par cas si ce retrait est reellement joue (purger les lignes
--   -- origin=free au prealable).
--   create index if not exists commercial_quote_lines_quote_position_idx
--     on public.commercial_quote_lines (quote_id, position);
--   notify pgrst, 'reload schema';
--
-- Aucune autre table ne reference commercial_quote_line_audit : le retrait
-- est sans effet de bord au-dela de la perte du journal lui-meme.
-- ============================================================================
