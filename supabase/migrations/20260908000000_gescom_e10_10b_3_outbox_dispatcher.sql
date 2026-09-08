-- ============================================================================
-- Sprint 5 Gestion commerciale — story E10.10b-3 : premier relais reel de
-- l outbox (drain periodique) + notification courriel client sur
-- `quote.sent`. Contrat : openapi/magrit-core.v1.yaml (description seule,
-- aucun chemin nouveau — voir docs/api/CONVENTIONS.md §8.13sexies).
-- ----------------------------------------------------------------------------
-- Ce que cette migration fait, dans l ordre :
--
--   1. Active `pg_cron` et `pg_net` (extensions deja utilisees NULLE PART
--      ailleurs dans le depot avant ce lot). Pose un declencheur `pg_cron`
--      qui appelle l Edge Function `magrit-outbox-dispatcher` via `pg_net`,
--      UNE FOIS PAR MINUTE. URL et secret partage sont lus depuis
--      Supabase Vault (`vault.decrypted_secrets`), JAMAIS en clair dans ce
--      fichier : deux secrets nommes `magrit_outbox_dispatch_url` et
--      `magrit_outbox_dispatch_secret` doivent exister AVANT que le bloc
--      ci-dessous s execute pour qu il planifie quoi que ce soit. C est un
--      GESTE D EXPLOITATION, hors de cette migration (elle ne peut pas
--      connaitre le secret a l avance) : si les deux secrets sont absents,
--      le bloc journalise un avertissement et NE PLANIFIE RIEN plutot que
--      d echouer le deploiement entier. Une fois les secrets poses
--      (`vault.create_secret`), NE PAS rejouer cette migration entiere pour
--      planifier le declencheur : executer le bloc SQL autonome documente en
--      pied de ce fichier (section "PLANIFICATION DIFFEREE DU
--      DECLENCHEUR") — voir la note de rejouabilite en fin d en-tete pour le
--      detail de ce qui est concerne et ce qui ne l est pas.
--
--   2. `outbox_events` gagne `next_attempt_at timestamptz not null default
--      now()` — le QUATRIEME champ mutable de la table (apres published_at,
--      delivery_attempts, last_error). Necessite dans LA MEME migration :
--      etendre le `grant update (...)` a service_role, ajouter l index
--      partiel de reclamation, et documenter que le trigger d append-only
--      (`outbox_events_reject_mutation()`) l autorise deja SANS
--      modification — il ne verrouille que les colonnes NOMMEES dans sa
--      liste (contenu metier), tout le reste (dont published_at/
--      delivery_attempts/last_error avant ce lot) est deja implicitement
--      mutable. `create or replace function` est neanmoins rejoue ici, a
--      l identique, pour que le commentaire de la fonction reste la source
--      de verite sur les QUATRE colonnes mutables — meme discipline que
--      `create or replace` plutot qu edition d une migration passee
--      (§8.13quater/quinquies).
--
--   3. `public.api_claim_outbox_events(p_limit, p_max_attempts, p_max_age)`
--      — `security definer`, grantee au SEUL `service_role`
--      (`revoke all from public, anon, authenticated`). Reclame `for update
--      skip locked` un lot d evenements `published_at is null` echus
--      (`next_attempt_at <= now()`) et pas encore epuises
--      (`delivery_attempts < p_max_attempts`), du plus ancien au plus
--      recent. Deux issues, DANS LA MEME instruction que la reclamation
--      (jamais au verdict, pour qu un isolat tue en pleine remise consomme
--      une tentative au lieu de rejouer indefiniment) :
--        - trop vieux (`occurred_at < now() - p_max_age`) : REBUT immediat,
--          `delivery_attempts` force a `p_max_attempts`, `last_error`
--          explicite, PAS rendu au relais (pas de courriel sur un devis
--          perime avant meme d avoir ete tente) ;
--        - sinon : `delivery_attempts` incremente, `next_attempt_at`
--          repousse selon la PROGRESSION CONFIRMEE (Arnaud, reserve e) —
--          1 / 5 / 25 / 125 minutes, soit `5 ^ (attempts - 1)`, plafonnee au
--          palier 4 pour toute tentative au-dela.
--      `skip locked` rend deux tours concurrents inoffensifs (chevauchement
--      d un tour lent par le suivant). Verifie REELLEMENT en local (atomicite
--      de la reclamation, progression exacte du backoff, rebut par
--      fraicheur, epuisement des tentatives, privileges) — voir
--      tests/sql/gescom-e10-10b-3-outbox-dispatcher.sql.
--
--   4. PASSIF AU REBUT — geste UNIQUE, execute UNE FOIS au deploiement de
--      cette migration : toute ligne `published_at is null` deja presente
--      **AVANT le 2026-09-08 00:00:00 UTC** (horodatage LITTERAL, fige au
--      moment ou cette version de la migration a ete ecrite — PAS `now()`,
--      qui bougerait a chaque execution) est marquee `delivery_attempts = 5`
--      (meme valeur que le reglage confirme `p_max_attempts`, en dur ici :
--      c est un instantane de deploiement, pas un reglage qui doit suivre
--      une reconfiguration future) avec un `last_error` explicite qui cite
--      cette meme borne. Sans ce geste, le premier tour de drain
--      notifierait des mois de
--      `quote.sent`/`quote.created`/`quote.accepted`/`quote.rejected`
--      historiques — des clients sur des devis anciens, voire deja
--      convertis. La borne existe PRECISEMENT pour qu un evenement cree
--      APRES ce deploiement (par exemple pendant la fenetre ou les secrets
--      Vault ne sont pas encore poses) ne soit jamais rebute par erreur si
--      cette section est un jour re-executee (cf. rejouabilite ci-dessous).
--
-- REJOUABILITE — a ne pas confondre entre les 4 parties ci-dessus :
--   - Parties 1, 2 et 3 sont ecrites de facon idempotente
--     (`create extension if not exists`, `unschedule` puis `reschedule`,
--     `add column if not exists`, `create index if not exists`,
--     `create or replace function`, `grant`/`revoke` re-appliques) : les
--     rejouer ne fait rien de plus que reconfirmer l etat courant.
--   - Partie 4 (passif au rebut) N EST PAS concue pour etre rejouee : c est
--     un geste ponctuel de migration de DONNEES, pas de schema. Grace a la
--     borne de date fixe ci-dessus, la rejouer ne re-abime plus rien (les
--     lignes deja rebutees ont `delivery_attempts = 5`, elles ne rematchent
--     plus la clause), mais ce n est pas une invitation a le faire : ce
--     n est pas ainsi que le declencheur pg_cron doit etre (re)planifie une
--     fois les secrets Vault poses — utiliser le bloc SQL autonome en pied
--     de fichier (section "PLANIFICATION DIFFEREE DU DECLENCHEUR"), qui ne
--     touche ni au passif ni au reste du schema.
--
-- Ce que cette migration NE fait PAS : aucune table de plus (le rebut
-- reutilise `delivery_attempts >= max`, "non publie et non reclamable" EST
-- la lettre morte — §8.13sexies point 3), aucune resolution de destinataire
-- en SQL (elle vit en TypeScript, adaptateur `service_role`, jointure
-- EXPLICITE `shops.tenant_id = <tenant de l evenement>` — voir
-- src/adapters/supabase/commercial-quotes-repository.ts,
-- `SupabaseQuoteNotificationGateway`), aucun endpoint `/api/v1` (le drain
-- n a pas de tenant, §8.13sexies point 2).
-- ============================================================================

-- ── 1. Declencheur pg_cron + pg_net, secrets via Vault ──────────────────────
create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'magrit_outbox_dispatch_url';
  select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'magrit_outbox_dispatch_secret';

  if v_url is null or v_secret is null then
    raise warning 'E10.10b-3: secrets Vault magrit_outbox_dispatch_url / magrit_outbox_dispatch_secret absents — declencheur pg_cron NON planifie. A poser (vault.create_secret) PUIS executer le bloc SQL autonome documente en pied de ce fichier (section "PLANIFICATION DIFFEREE DU DECLENCHEUR") — NE PAS rejouer cette migration entiere pour planifier le declencheur.';
  else
    if exists (select 1 from cron.job where jobname = 'magrit-outbox-dispatch') then
      perform cron.unschedule('magrit-outbox-dispatch');
    end if;

    -- Cadence visee : 1 minute (reglage confirme, reserve e). Le declencheur
    -- est INTERCHANGEABLE et hors du raisonnement du relais (§8.13sexies
    -- point 1) : ni la file, ni la fonction de reclamation, ni le
    -- consommateur ne dependent de son identite.
    perform cron.schedule(
      'magrit-outbox-dispatch',
      '* * * * *',
      format(
        $cron$select net.http_post(
          url := %L,
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'X-Magrit-Outbox-Secret', %L
          ),
          body := '{}'::jsonb,
          timeout_milliseconds := 20000
        );$cron$,
        v_url,
        v_secret
      )
    );
  end if;
end;
$$;

-- ── 2. Colonne d echeance de reprise — QUATRIEME champ mutable ──────────────
alter table public.outbox_events
  add column if not exists next_attempt_at timestamptz not null default now();

comment on column public.outbox_events.next_attempt_at is
  'E10.10b-3 — prochaine echeance a laquelle le drain peut reclamer cet evenement. Repoussee A LA RECLAMATION (api_claim_outbox_events), pas au verdict de remise, selon le backoff 1/5/25/125 minutes (5^(delivery_attempts-1), plafonne). QUATRIEME champ mutable de la table (avec published_at, delivery_attempts, last_error) — le contenu metier reste append-only.';

-- Reclamation : non publies, echus, pas encore epuises, du plus ancien au
-- plus recent. Distinct de `outbox_events_pending_idx` (occurred_at seul,
-- E10.0) : celui-ci porte l echeance de reprise, filtre supplementaire que
-- l ancien index ne couvre pas.
create index if not exists outbox_events_pending_due_idx
  on public.outbox_events (next_attempt_at)
  where published_at is null;

comment on index public.outbox_events_pending_due_idx is
  'E10.10b-3 — support de api_claim_outbox_events : evenements non publies dont l echeance de reprise est passee.';

-- Append-only : `next_attempt_at` n est PAS ajoute a la liste de garde
-- (comme published_at/delivery_attempts/last_error avant elle, elle est
-- DEJA implicitement mutable — le trigger ne bloque que les colonnes
-- NOMMEES). `create or replace` rejoue ici pour que le commentaire de la
-- fonction reste la source de verite sur les quatre colonnes mutables ;
-- aucun changement de comportement.
create or replace function public.outbox_events_reject_mutation()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    -- Purger l historique reste possible, mais uniquement pour des evenements
    -- deja relayes : supprimer une ligne en attente perdrait l evenement.
    if old.published_at is null then
      raise exception using
        errcode = '42501',
        message = 'outbox_append_only: un evenement non publie ne peut pas etre supprime';
    end if;
    return old;
  end if;

  if new.id is distinct from old.id
     or new.tenant_id is distinct from old.tenant_id
     or new.event_name is distinct from old.event_name
     or new.event_version is distinct from old.event_version
     or new.aggregate_type is distinct from old.aggregate_type
     or new.aggregate_id is distinct from old.aggregate_id
     or new.payload is distinct from old.payload
     or new.occurred_at is distinct from old.occurred_at
     or new.created_at is distinct from old.created_at then
    raise exception using
      errcode = '42501',
      message = 'outbox_append_only: le contenu d un evenement est immuable';
  end if;

  -- Suivi de livraison, LES QUATRE colonnes mutables (E10.10b-3) :
  -- published_at, delivery_attempts, last_error, next_attempt_at.
  return new;
end;
$$;

grant update (published_at, delivery_attempts, last_error, next_attempt_at)
  on table public.outbox_events to service_role;

-- ── 3. Reclamation atomique ─────────────────────────────────────────────────
create or replace function public.api_claim_outbox_events(
  p_limit integer default 25,
  p_max_attempts integer default 5,
  p_max_age interval default interval '24 hours'
)
returns setof public.outbox_events
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
begin
  return query
  with candidates as (
    select e.id, e.occurred_at, e.delivery_attempts
      from public.outbox_events e
     where e.published_at is null
       and e.delivery_attempts < p_max_attempts
       and e.next_attempt_at <= now()
     order by e.occurred_at asc
     limit greatest(p_limit, 0)
     for update skip locked
  ),
  -- Fraicheur : verifiee A CHAQUE reclamation (pas seulement au deploiement,
  -- voir §4 ci-dessous) — une panne de Resend de 48h ne doit pas se solder
  -- par une rafale de courriels a la reprise.
  stale as (
    select id from candidates where occurred_at < now() - p_max_age
  ),
  rebutted as (
    update public.outbox_events e
       set delivery_attempts = p_max_attempts,
           last_error = format(
             'outbox_stale: evenement du %s trop vieux (fraicheur %s depassee), mis au rebut sans remise',
             e.occurred_at,
             p_max_age
           )
      from stale s
     where e.id = s.id
    returning e.id
  ),
  fresh as (
    select id from candidates where id not in (select id from stale)
  ),
  -- Reclamation ET repoussee d echeance DANS LA MEME instruction que
  -- l incrementation : un isolat tue en pleine remise consomme une
  -- tentative au lieu de rejouer indefiniment (§8.13sexies point 3).
  -- Backoff 1/5/25/125 min = 5^(attempts-1), plafonne au palier 4.
  claimed as (
    update public.outbox_events e
       set delivery_attempts = e.delivery_attempts + 1,
           next_attempt_at = now()
             + (power(5, least(e.delivery_attempts + 1, 4) - 1))::numeric * interval '1 minute'
      from fresh f
     where e.id = f.id
    returning e.*
  )
  select * from claimed;
end;
$$;

comment on function public.api_claim_outbox_events(integer, integer, interval) is
  'E10.10b-3 — reclamation atomique du drain (for update skip locked). Incrémente delivery_attempts et repousse next_attempt_at A LA RECLAMATION. Rebut immediat (sans remise) des evenements trop vieux (p_max_age). service_role SEUL.';

revoke all on function public.api_claim_outbox_events(integer, integer, interval) from public, anon, authenticated;
grant execute on function public.api_claim_outbox_events(integer, integer, interval) to service_role;

-- ── 4. Passif au rebut — geste UNIQUE, au deploiement de cette migration ───
-- `5` est litteralement le reglage confirme de p_max_attempts (reserve e) :
-- un instantane de ce que "epuise" signifie AUJOURD HUI, pas une reference
-- au parametre par defaut de la fonction (qui pourrait changer sans que ce
-- geste de deploiement, deja joue, ne doive etre rejoue).
update public.outbox_events
   set delivery_attempts = 5,
       last_error = 'outbox_backlog_deployment: evenement cree avant le 2026-09-08 00:00:00 UTC (deploiement du relais E10.10b-3), mis au rebut au demarrage pour ne pas notifier retroactivement des devis anciens ou deja convertis'
 where published_at is null
   and delivery_attempts < 5
   and created_at < '2026-09-08 00:00:00+00'::timestamptz;

notify pgrst, 'reload schema';

-- ============================================================================
-- PLANIFICATION DIFFEREE DU DECLENCHEUR — a executer UNE FOIS les secrets
-- Vault `magrit_outbox_dispatch_url` / `magrit_outbox_dispatch_secret` poses
-- (`vault.create_secret`), SEUL, dans une session psql/SQL editor, JAMAIS en
-- rejouant cette migration entiere : contrairement aux parties 1/2/3
-- (idempotentes), la partie 4 (passif au rebut, ci-dessus) est un geste
-- ponctuel de migration de donnees que ce bloc ne touche PAS. Copie exacte
-- du corps du bloc `do $$ ... $$;` de la partie 1 — sans le test
-- `if v_url is null or v_secret is null` puisqu on ne l execute qu une fois
-- les secrets confirmes presents.
--
--   do $$
--   declare
--     v_url text;
--     v_secret text;
--   begin
--     select decrypted_secret into v_url
--       from vault.decrypted_secrets where name = 'magrit_outbox_dispatch_url';
--     select decrypted_secret into v_secret
--       from vault.decrypted_secrets where name = 'magrit_outbox_dispatch_secret';
--
--     if v_url is null or v_secret is null then
--       raise exception 'E10.10b-3: secrets Vault toujours absents — les poser avant de rejouer ce bloc.';
--     end if;
--
--     if exists (select 1 from cron.job where jobname = 'magrit-outbox-dispatch') then
--       perform cron.unschedule('magrit-outbox-dispatch');
--     end if;
--
--     perform cron.schedule(
--       'magrit-outbox-dispatch',
--       '* * * * *',
--       format(
--         $cron$select net.http_post(
--           url := %L,
--           headers := jsonb_build_object(
--             'Content-Type', 'application/json',
--             'X-Magrit-Outbox-Secret', %L
--           ),
--           body := '{}'::jsonb,
--           timeout_milliseconds := 20000
--         );$cron$,
--         v_url,
--         v_secret
--       )
--     );
--   end;
--   $$;
-- ============================================================================

-- ============================================================================
-- REVERSIBILITE — le CLI Supabase ne gere pas de bloc `down`. SQL de retrait,
-- a jouer tel quel dans une migration inverse si la story est annulee :
--
--   select cron.unschedule('magrit-outbox-dispatch')
--     where exists (select 1 from cron.job where jobname = 'magrit-outbox-dispatch');
--
--   revoke execute on function public.api_claim_outbox_events(integer, integer, interval) from service_role;
--   drop function if exists public.api_claim_outbox_events(integer, integer, interval);
--
--   drop index if exists public.outbox_events_pending_due_idx;
--   alter table public.outbox_events drop column if exists next_attempt_at;
--
--   -- Restaure le grant d origine (E10.0, 3 colonnes) :
--   grant update (published_at, delivery_attempts, last_error)
--     on table public.outbox_events to service_role;
--
--   -- Restaure outbox_events_reject_mutation() a sa forme 20260901000100
--   -- (corps identique, seul le commentaire changeait) — voir ce fichier.
--
--   notify pgrst, 'reload schema';
--
-- Le "passif au rebut" (§4) N EST PAS reversible : c est une ecriture de
-- donnees (delivery_attempts/last_error de lignes existantes), pas un objet
-- de schema. Aucun retrait ne le restaure — documente ici pour que ce ne
-- soit pas une surprise.
--
-- pg_cron/pg_net NE SONT PAS desactives par ce retrait : d autres migrations
-- ou d autres projets du meme cluster peuvent en dependre ; desactiver une
-- extension partagee n est jamais un geste local a une story.
-- ============================================================================
