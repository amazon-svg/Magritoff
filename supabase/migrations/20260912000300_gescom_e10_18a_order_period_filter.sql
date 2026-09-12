-- ============================================================================
-- Sprint 5 Gestion commerciale — story E10.18a : bornes de periode
-- (`created_from`/`created_to`) sur `GET /commercial-orders`
-- (`listCommercialOrders`), "la periode, a la grille d abord".
-- Contrat : openapi/magrit-core.v1.yaml (`listCommercialOrders.created_from`/
-- `.created_to`), docs/api/CONVENTIONS.md §8.24 points 2 et 5 regle 8.
-- ----------------------------------------------------------------------------
-- CE QUE CE LOT FAIT, ET POURQUOI IL TOUCHE UNE FONCTION DEJA LIVREE (E10.13) :
--
-- `listCommercialOrders` connait DEUX chemins de lecture selon `sort` :
--   - `-created_at`/`created_at` (defaut) : un SELECT PostgREST direct,
--     l ADAPTATEUR (src/adapters/supabase/commercial-orders-repository.ts)
--     y ajoute `.gte()`/`.lte()` sans migration ;
--   - `production_step`/`-production_step` (E10.13 CA6) : delegue a
--     `public.list_commercial_orders_by_production_step`, SEULE parce que
--     PostgREST ne sait pas ordonner sur une colonne d une table jointe en
--     LEFT JOIN au niveau de la ligne parente.
--
-- Le contrat ne rend PAS les deux filtres (periode, tri par etape)
-- mutuellement exclusifs : un atelier doit pouvoir demander "les commandes de
-- septembre, triees par etape de production" — c est le meme besoin que
-- filtrer par client ou par devis, deja porte par cette fonction. Ignorer
-- silencieusement `created_from`/`created_to` des qu on trie par etape
-- aurait ete exactement le genre de defaut qu un test de bord ne revele
-- jamais tant qu on ne pense pas a combiner les deux — et un filtre de
-- periode ignore a la cloture est precisement ce que ce lot existe pour
-- empecher (§8.24 point 2).
--
-- ADDITIF ET RETROCOMPATIBLE : deux parametres NEUFS, EN FIN de liste,
-- `default null` (`p_created_from`, `p_created_to`, timestamptz — DEJA
-- resolus en UTC par la route depuis une date civile `Europe/Paris`,
-- `src/kernel/clock`, cette fonction ne connait AUCUN fuseau). Un appelant
-- existant qui omet ces deux cles (`supabase-js` invoque cette RPC par NOMS,
-- jamais par position) continue de tout lire, comportement INCHANGE.
--
-- POSTGRESQL EXIGE UN DROP AVANT LE CREATE : `create or replace function` ne
-- remplace une fonction que si la signature (types des parametres) est
-- IDENTIQUE. Ajouter deux parametres cree sinon une SECONDE fonction
-- surchargee au lieu de remplacer la premiere — le `drop` ci-dessous est
-- donc necessaire, pas une precaution superflue.
-- ============================================================================

drop function if exists public.list_commercial_orders_by_production_step(
  uuid, uuid, uuid, text, uuid, boolean, integer, boolean, uuid, timestamptz, uuid
);

create function public.list_commercial_orders_by_production_step(
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
  p_cursor_id uuid,
  p_created_from timestamptz default null,
  p_created_to timestamptz default null
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
     -- E10.18a — bornes INCLUSIVES des deux cotes (contrat : "premier/dernier
     -- jour de la periode, INCLUS"). `p_created_to` porte deja 23:59:59.999
     -- du dernier jour civil (resolu par la route), jamais minuit du
     -- lendemain : une borne haute EXCLUSIVE ici ferait basculer les
     -- commandes du dernier jour d un mois sur le mois suivant.
     and (p_created_from is null or o.created_at >= p_created_from)
     and (p_created_to is null or o.created_at <= p_created_to)
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
  'E10.13 CA6 / E10.18a — lecture triee de listCommercialOrders quand sort=production_step|-production_step : ordre sur la POSITION de l etape courante (jointure LEFT), commandes SANS etape toujours en dernier dans les deux sens. Curseur porte par p_cursor_step_id (pas une position brute) : la resolution se fait ICI. p_created_from/p_created_to (E10.18a) bornent created_at, INCLUS des deux cotes, DEJA resolus en UTC par la route (fuseau de reference Europe/Paris) : cette fonction ne connait aucun fuseau. security invoker : la RLS de commercial_orders/production_steps s applique normalement.';

revoke all on function public.list_commercial_orders_by_production_step from public, anon;
grant execute on function public.list_commercial_orders_by_production_step to authenticated, service_role;

notify pgrst, 'reload schema';

-- ============================================================================
-- REVERSIBILITE — le CLI Supabase ne gere pas de bloc `down`. SQL de retrait,
-- a jouer tel quel dans une migration inverse si la story est annulee : DROP
-- la version a 13 parametres puis RECREER la version E10.13 a 11 parametres
-- (verbatim depuis 20260908020000, lignes 623-671), pour revenir exactement
-- a l etat pre-E10.18a :
--
--   drop function if exists public.list_commercial_orders_by_production_step(
--     uuid, uuid, uuid, text, uuid, boolean, integer, boolean, uuid, timestamptz, uuid, timestamptz, timestamptz
--   );
--   -- puis re-executer le corps E10.13 (20260908020000) tel quel.
-- ============================================================================
