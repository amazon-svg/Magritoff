-- ============================================================================
-- Sprint 5 Gestion commerciale — story E10.18d, passage 3 : FILET DE REPRISE
-- des exports comptables tues par le superviseur (CPU, pas memoire).
-- Contrat : docs/api/CONVENTIONS.md §8.24, point 4 (douzieme entree du
-- bandeau, condition 3 du plafond de 5 000 lignes) et treizieme entree,
-- point (iv). N EDITE JAMAIS `20260913000000_gescom_e10_18c_order_exports.sql`
-- (deja deployee) : `create or replace function` sur
-- `public.api_claim_order_exports` UNIQUEMENT.
-- ----------------------------------------------------------------------------
-- LE DEFAUT REEL, MESURE PAR L ARCHITECTE (2026-09-13, douzieme/treizieme
-- entrees du bandeau) : une invocation de `magrit-order-export-runner` TUEE
-- par le superviseur (limite CPU, 1000/2000 ms) DISPARAIT — `markReady`/
-- `markFailed` ne sont JAMAIS appeles. La ligne reste `running` POUR
-- TOUJOURS : `api_claim_order_exports` (version d origine, 20260913000000)
-- ne reclame que des lignes `pending`, et AUCUN balayeur n existait pour
-- les lignes `running` orphelines. Or `api_request_order_export` compte
-- `pending` ET `running` dans le plafond de TROIS demandes non terminees
-- par acteur (422 `order_export.pending_limit_reached`) : AU TROISIEME
-- EXPORT TUE, L ACTEUR NE PEUT PLUS JAMAIS EXPORTER, sans intervention
-- manuelle en base.
--
-- CE QUE CETTE MIGRATION FAIT, ET RIEN D AUTRE : `create or replace
-- function public.api_claim_order_exports(...)` — MEME SIGNATURE, MEMES
-- GRANTS, MEME logique de reclamation `pending` -> `running` ET de rebut
-- par fraicheur (`pending` -> `failed` si trop ancien) que la version
-- d origine, copiee ICI CARACTERE PAR CARACTERE (voir section 2). AJOUTE en
-- tete de la fonction, dans la MEME transaction : un balayage, sous verrou
-- (`for update skip locked`), de toute ligne `running` dont `started_at`
-- date de plus de 15 MINUTES (plus du double de la limite d horloge d une
-- invocation, 400 s dans le `main.ts` de la CLI Supabase — un isolat
-- encore vivant ne peut jamais etre vise) -> `failed`, avec
-- `completed_at = now()`, `error_code = 'order_export.generation_failed'`
-- (code DEJA PUBLIE au contrat, rien a y ajouter) et un `error_detail`
-- PREFIXE `order_export_interrupted:`.
--
-- `failed`, PAS `pending` : une mise a mort par ressources est
-- DETERMINISTE (memes donnees, meme cout) — la rejouer brulerait les
-- tentatives pour produire exactement le meme resultat. Le trigger
-- d immuabilite (`commercial_order_exports_reject_mutation()`, INCHANGE
-- par cette migration) le confirme : il n interdit PAS `running -> failed`
-- (chemin deja emprunte par `markFailed` cote application), mais il
-- REFUSE `running -> pending` SANS increment d `attempts` — verifie par le
-- test SQL de ce lot (scenario 5). Choisir `failed` evite meme d avoir a
-- discuter cette contrainte.
--
-- ⚠️ AFFIRMATION FAUSSE DANS LA MIGRATION 20260913000000, NON EDITABLE
-- (deja deployee) : le commentaire du bucket `order_exports` (section 7,
-- `file_size_limit`) cite « 50k lignes : 22 Mo EN MEMOIRE » comme mesure
-- de reference. Cette mesure a ete REFUTEE le 2026-09-13 (douzieme entree
-- du bandeau §8.24) : rejouee sous les limites REELLES du superviseur
-- (Edge Function servie en *user worker*, 256 Mo / CPU 1000-2000 ms), la
-- bibliotheque XLSX SEULE est deja TUEE PAR LE CPU a 50 000 lignes, avant
-- meme d approcher 22 Mo de memoire comptee. Le chiffre « 22 Mo » n est
-- pas faux en tant que mesure de memoire isolee ; ce qui est faux, c est
-- de l avoir cite comme preuve qu un export de 50 000 lignes tient dans le
-- budget d une invocation — CE N EST PAS LE CAS, et c est precisement
-- pourquoi le plafond `ORDER_EXPORT_ROW_LIMIT` est desormais 5 000
-- (`order-export-generation-service.ts`), pas 50 000. Ce commentaire ne
-- peut pas etre corrige a la source (migration deja deployee, immuable) :
-- il est signale ICI, dans la migration qui corrige ses consequences.
--
-- PATRON REPRIS A L IDENTIQUE : la fonction elle-meme, `20260913000000`
-- (a lire avant d ecrire, contrat point 6). Le balayage ajoute est un
-- simple `update ... where ... for update skip locked` en tete de
-- fonction, sans nouvelle table ni nouvelle colonne — `commercial_order_exports`
-- porte deja toutes les colonnes necessaires (`status`, `started_at`,
-- `completed_at`, `error_code`, `error_detail`).
-- ============================================================================

-- ── 1. `api_claim_order_exports` — filet de reprise AJOUTE, reste IDENTIQUE ──
create or replace function public.api_claim_order_exports(
  p_limit integer default 5,
  p_max_attempts integer default 3,
  p_max_age interval default interval '15 minutes'
)
returns setof public.commercial_order_exports
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  -- ── FILET DE REPRISE (E10.18d) — AJOUTE PAR CETTE MIGRATION ────────────
  -- Toute ligne `running` dont `started_at` date de plus de 15 minutes n a
  -- pas pu etre laissee en vie par un isolat legitime (limite d horloge
  -- d une invocation : 400 s, moins du tiers de ce seuil). Elle est donc
  -- soit tuee par le superviseur (CPU), soit orpheline pour une autre
  -- raison — dans les deux cas, `markReady`/`markFailed` ne seront JAMAIS
  -- appeles pour elle. Marquee `failed`, JAMAIS `pending` (voir en-tete de
  -- fichier). `for update skip locked` : si un runner concurrent la traite
  -- deja (course improbable, la fenetre de 15 minutes est tres large),
  -- cette instance passe simplement sans y toucher, plutot que d attendre
  -- ou d entrer en conflit.
  with stuck as (
    select id
      from public.commercial_order_exports
     where status = 'running'
       and started_at < now() - interval '15 minutes'
     for update skip locked
  )
  update public.commercial_order_exports e
     set status = 'failed',
         completed_at = now(),
         error_code = 'order_export.generation_failed',
         error_detail = format(
           'order_export_interrupted: isolat tue avant markReady/markFailed (demarre le %s, filet de reprise a 15 minutes, §8.24 point 4)',
           e.started_at
         )
    from stuck s
   where e.id = s.id;

  -- ── RECLAMATION NORMALE — INCHANGEE, copie CARACTERE PAR CARACTERE de la ─
  -- version d origine (20260913000000) : COPIE CONFORME du patron
  -- api_claim_notification_messages (E10.15c), adaptee aux colonnes de
  -- commercial_order_exports. Rebut par fraicheur -> status=failed SANS
  -- jamais avoir ete generee (une demande pending depuis plus de p_max_age
  -- n a jamais ete prise par un runner en vie).
  return query
  with candidates as (
    select e.id, e.requested_at, e.attempts
      from public.commercial_order_exports e
     where e.status = 'pending'
       and e.attempts < p_max_attempts
       and e.next_attempt_at <= now()
     order by e.requested_at asc
     limit greatest(p_limit, 0)
     for update skip locked
  ),
  stale as (
    select id from candidates where requested_at < now() - p_max_age
  ),
  rebutted as (
    update public.commercial_order_exports e
       set status = 'failed',
           attempts = p_max_attempts,
           completed_at = now(),
           error_code = 'order_export.generation_failed',
           error_detail = format(
             'order_export_stale: demande du %s trop ancienne (fraicheur %s depassee), abandonnee sans generation',
             e.requested_at,
             p_max_age
           )
      from stale s
     where e.id = s.id
    returning e.id
  ),
  fresh as (
    select id from candidates where id not in (select id from stale)
  ),
  claimed as (
    update public.commercial_order_exports e
       set status = 'running',
           attempts = e.attempts + 1,
           started_at = now(),
           next_attempt_at = now()
             + (power(5, least(e.attempts + 1, p_max_attempts) - 1))::numeric * interval '1 minute'
      from fresh f
     where e.id = f.id
    returning e.*
  )
  select * from claimed;
end;
$$;

comment on function public.api_claim_order_exports(integer, integer, interval) is
  'E10.18c/E10.18d — reclamation atomique du drain de generation (for update skip locked), copie conforme du patron api_claim_notification_messages. Passe status=running et incremente attempts A LA RECLAMATION (pas au verdict). Rebut (fraicheur depassee) -> status=failed sans jamais generer. AJOUT E10.18d (filet de reprise, §8.24 point 4) : en tete de fonction, toute ligne running dont started_at date de plus de 15 minutes (isolat tue par le superviseur, CPU) passe failed, error_code=order_export.generation_failed, error_detail prefixe order_export_interrupted: — jamais pending (mise a mort deterministe, rejouer brulerait les tentatives pour rien). service_role SEUL.';

-- GRANTS INCHANGES, caractere pour caractere (verifie contre 20260913000000).
revoke all on function public.api_claim_order_exports(integer, integer, interval) from public, anon, authenticated;
grant execute on function public.api_claim_order_exports(integer, integer, interval) to service_role;

-- ============================================================================
-- REVERSIBILITE — le CLI Supabase ne gere pas de bloc `down`. Pour annuler
-- CETTE SEULE migration (retirer le filet de reprise, revenir a la
-- reclamation `pending` seule de 20260913000000), rejouer tel quel le
-- `create or replace function` D ORIGINE (20260913000000, section 5) :
--
--   create or replace function public.api_claim_order_exports(
--     p_limit integer default 5,
--     p_max_attempts integer default 3,
--     p_max_age interval default interval '15 minutes'
--   )
--   returns setof public.commercial_order_exports
--   language plpgsql
--   security definer
--   set search_path = pg_catalog, public
--   as $$
--   begin
--     return query
--     with candidates as (
--       select e.id, e.requested_at, e.attempts
--         from public.commercial_order_exports e
--        where e.status = 'pending'
--          and e.attempts < p_max_attempts
--          and e.next_attempt_at <= now()
--        order by e.requested_at asc
--        limit greatest(p_limit, 0)
--        for update skip locked
--     ),
--     stale as (
--       select id from candidates where requested_at < now() - p_max_age
--     ),
--     rebutted as (
--       update public.commercial_order_exports e
--          set status = 'failed',
--              attempts = p_max_attempts,
--              completed_at = now(),
--              error_code = 'order_export.generation_failed',
--              error_detail = format(
--                'order_export_stale: demande du %s trop ancienne (fraicheur %s depassee), abandonnee sans generation',
--                e.requested_at,
--                p_max_age
--              )
--         from stale s
--        where e.id = s.id
--       returning e.id
--     ),
--     fresh as (
--       select id from candidates where id not in (select id from stale)
--     ),
--     claimed as (
--       update public.commercial_order_exports e
--          set status = 'running',
--              attempts = e.attempts + 1,
--              started_at = now(),
--              next_attempt_at = now()
--                + (power(5, least(e.attempts + 1, p_max_attempts) - 1))::numeric * interval '1 minute'
--         from fresh f
--        where e.id = f.id
--       returning e.*
--     )
--     select * from claimed;
--   end;
--   $$;
--
--   comment on function public.api_claim_order_exports(integer, integer, interval) is
--     'E10.18c — reclamation atomique du drain de generation (for update skip locked), copie conforme du patron api_claim_notification_messages. Passe status=running et incremente attempts A LA RECLAMATION (pas au verdict). Rebut (fraicheur depassee) -> status=failed sans jamais generer. service_role SEUL.';
--
--   revoke all on function public.api_claim_order_exports(integer, integer, interval) from public, anon, authenticated;
--   grant execute on function public.api_claim_order_exports(integer, integer, interval) to service_role;
-- ============================================================================
