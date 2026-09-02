-- ============================================================================
-- Sprint 5 Gestion commerciale — story E10.7 : arbitrage des regles de prix
-- concurrentes par la regle la plus recente.
-- ----------------------------------------------------------------------------
-- Decision WM du 01/09/2026 (Xavier Pechoultres, retour d experience
-- Clariprint) : quand deux regles de MEME portee et MEME cible sont
-- applicables a la meme date, c est la plus recemment CREEE qui l emporte.
-- Aucun decoupage temporel automatique (specification du 28/08 abrogee, deja
-- traduit en E10.6 : pas de contrainte GiST, pas de colonne
-- `split_from_rule_id`).
--
-- ── Algorithme (Dev Notes de la story) ──────────────────────────────────────
--   1. Filtrer les regles ACTIVES du tenant dont la periode couvre `p_at`
--      (`valid_from <= p_at` et `valid_to is null or valid_to >= p_at`,
--      `valid_to` INCLUS).
--   2. Parmi les candidates, ne retenir que celles dont la portee est
--      COMPATIBLE avec le contexte fourni : `global` toujours, `range`
--      seulement si `p_product_range_id` est fourni ET correspond, `customer`
--      seulement si `p_customer_id` est fourni ET correspond, `customer_range`
--      seulement si LES DEUX sont fournis ET correspondent. L ABSENCE d un
--      identifiant de contexte RESTREINT les portees candidates, elle
--      n elargit jamais la recherche.
--   3. Retenir le rang de specificite le plus eleve parmi les candidates
--      (global=0 < range=1 < customer=2 < customer_range=3).
--   4. A specificite egale, departager par `created_at` DECROISSANT — jamais
--      par un champ de priorite saisi a la main.
--   5. Motif (`PriceRuleSelectionReason`, contrat) : `recency` SSI plus d une
--      candidate au rang retenu, `specificity` sinon.
--
-- ── Pourquoi cette fonction ne rend que (rule_id, reason) ──────────────────
-- Le mapping complet ligne Postgres -> `PriceRuleDto` (dont la normalisation
-- des timestamps ISO, `toIsoTimestamp()`) reste dans
-- `SupabasePriceRulesRepository.toPriceRuleDto()`, SEUL endroit de ce mapping
-- (docs/api/CONVENTIONS.md, piege du 2026-09-02). `resolve()` de l adaptateur
-- relit la regle par `findById()` une fois l identifiant connu plutot que de
-- dupliquer ce mapping ici en SQL.
--
-- ── SECURITY INVOKER (pas DEFINER) — meme discipline que `list()`/`findById()`
-- ────────────────────────────────────────────────────────────────────────────
-- `p_tenant_id` est TOUJOURS fourni explicitement par l appelant (CA4 du
-- socle E10.0, tenant resolu du jeton par la facade, jamais par un
-- parametre) : c est la MEME discipline que le reste de cet adaptateur.
-- La fonction est volontairement SECURITY INVOKER (comportement par defaut) :
--   - pour une session utilisateur (`authenticated`, RLS active), la policy
--     `price_rules_select` s applique en DEFENSE EN PROFONDEUR, exactement
--     comme un `select * from price_rules where tenant_id = ...` direct ;
--   - pour une cle de service (Studio/Clariprint), la facade instancie deja
--     un client scope au tenant de la cle (meme modele de confiance que
--     `listPriceRules`/`getPriceRule`, E10.6) : aucune primitive SQL
--     supplementaire n est necessaire ici.
-- Un `security definer` aurait ELARGI la portee de lecture au-dela de ce que
-- l appelant peut deja voir par RLS — l inverse de ce que ce sprint attend
-- d une fonction de LECTURE.
-- ============================================================================

create or replace function public.resolve_price_rule(
  p_tenant_id uuid,
  p_customer_id uuid,
  p_product_range_id uuid,
  p_at date
)
returns table (rule_id uuid, reason text)
language sql
stable
as $$
  with candidates as (
    select
      pr.id,
      pr.created_at,
      case pr.scope
        when 'customer_range' then 3
        when 'customer'       then 2
        when 'range'          then 1
        else                       0
      end as specificity_rank
    from public.price_rules pr
    where pr.tenant_id = p_tenant_id
      and pr.is_active
      and pr.valid_from <= p_at
      and (pr.valid_to is null or pr.valid_to >= p_at)
      and (
        pr.scope = 'global'
        or (
          pr.scope = 'range'
          and p_product_range_id is not null
          and pr.product_range_id = p_product_range_id
        )
        or (
          pr.scope = 'customer'
          and p_customer_id is not null
          and pr.customer_id = p_customer_id
        )
        or (
          pr.scope = 'customer_range'
          and p_customer_id is not null
          and p_product_range_id is not null
          and pr.customer_id = p_customer_id
          and pr.product_range_id = p_product_range_id
        )
      )
  ),
  max_rank as (
    -- -1 : aucun candidat ne peut jamais avoir ce rang (les rangs reels vont
    -- de 0 a 3), ce qui rend `at_max_rank` naturellement vide en l absence de
    -- toute candidate, sans `case`/`coalesce` supplementaire en aval.
    select coalesce(max(specificity_rank), -1) as value from candidates
  ),
  at_max_rank as (
    select
      c.id,
      c.created_at,
      -- Nombre de candidates au rang retenu : > 1 signifie que le
      -- departage s est fait par la date, jamais par la specificite seule.
      count(*) over () as candidate_count
    from candidates c, max_rank m
    where c.specificity_rank = m.value
  )
  select
    a.id as rule_id,
    case when a.candidate_count > 1 then 'recency' else 'specificity' end as reason
  from at_max_rank a
  order by a.created_at desc
  limit 1;
$$;

comment on function public.resolve_price_rule(uuid, uuid, uuid, date) is
  'E10.7 — arbitrage des regles de prix concurrentes : la regle la plus SPECIFIQUE couvrant (p_customer_id, p_product_range_id) a p_at, departagee par created_at decroissant a specificite egale (reason = recency). Lecture pure, deterministe, SECURITY INVOKER (la RLS de price_rules s applique).';

-- Meme discipline que le grant de base herite sur `price_rules` (RLS = seule
-- barriere d autorisation, pas le grant) : execute ouvert a `anon` ET
-- `authenticated`, une cle de service pouvant emprunter l un ou l autre selon
-- la maniere dont la facade instancie son client (docs/api/CONVENTIONS.md).
grant execute on function public.resolve_price_rule(uuid, uuid, uuid, date) to anon, authenticated;

notify pgrst, 'reload schema';

-- ============================================================================
-- REVERSIBILITE — le CLI Supabase ne gere pas de bloc `down`. SQL de retrait,
-- a jouer tel quel dans une migration inverse si la story est annulee :
--
--   revoke execute on function public.resolve_price_rule(uuid, uuid, uuid, date) from anon, authenticated;
--   drop function if exists public.resolve_price_rule(uuid, uuid, uuid, date);
--   notify pgrst, 'reload schema';
--
-- Aucune table n est creee ni modifiee par cette migration : elle n ajoute
-- qu une fonction de LECTURE sur `public.price_rules` (E10.6). Le retrait est
-- sans effet de bord.
-- ============================================================================
