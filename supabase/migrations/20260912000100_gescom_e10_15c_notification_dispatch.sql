-- ============================================================================
-- Sprint 5 Gestion commerciale — story E10.15c : la chaine d envoi des
-- notifications, branchee sur UN SEUL evenement (`order.step_changed`).
-- Contrat : openapi/magrit-core.v1.yaml (deja ecrit par l architecte,
-- E10.15a), docs/api/CONVENTIONS.md §8.23 (cadrage complet, point 4 pour le
-- schema de donnees, point 3 pour le mecanisme de consommation).
-- ----------------------------------------------------------------------------
-- CORRIGE EN PLACE le 2026-09-12, a la suite du RECTIFICATIF D ARBITRAGE de
-- §8.23 (qa-review E10.15c, B1/M2) : cette migration n avait jamais ete
-- appliquee (non suivie par git avant ce lot), le correctif est donc ecrit
-- directement ici plutot qu en migration separee.
--   - `coalescing_window_minutes` (colonne neuve sur `notification_logs`,
--     recopiee du catalogue d evenements a la mise en file, jamais en dur) ;
--   - `notification_logs_grouping_uidx` porte desormais le destinataire ET
--     n interdit une seconde ligne QUE si l evenement declare une fenetre
--     (`coalescing_window_minutes > 0`) ;
--   - `api_enqueue_notification_message` gagne `p_coalescing_window_minutes`,
--     ne tente le regroupement QUE si `p_status = 'pending' AND
--     p_coalescing_window_minutes > 0`, et ne touche plus JAMAIS
--     `next_attempt_at` d une ligne deja en file (seul `occurrence_count`
--     bouge) ;
--   - `notification_logs_reject_mutation()` tolere desormais la transition
--     `template_id` non nul -> `null` (consequence du `on delete set null`
--     de la FK vers `notification_templates`, une UPDATE SYSTEME, pas un
--     contournement applicatif) ;
--   - la contrainte de destinataire est renommee et devient reciproque : un
--     `recipient` est EXIGE hors `dropped`, pas seulement INTERDIT en
--     `dropped`.
-- ----------------------------------------------------------------------------
-- PERIMETRE DE CE LOT (§8.23 §8, decoupage en cinq sous-stories) :
--
--   1. Table NEUVE `public.notification_logs` — la file d envoi ET le
--      journal (une seule table, meme precedent que `outbox_events`) :
--      colonnes, contraintes, index (dont l unique de non-doublon
--      `(event_id, template_id, coalesce(recipient, ''))` et l unique
--      partiel de regroupement `(template_id, aggregate_id, coalesce(recipient,
--      '')) where status = 'pending' and coalescing_window_minutes > 0`),
--      trigger d immuabilite CALQUE sur `outbox_events_reject_mutation()`
--      (§8.23 §4, corrige le 2026-09-12 — voir en-tete).
--
--   2. `public.api_enqueue_notification_message(...)` — `security definer`,
--      grantee au SEUL `service_role`. Insertion IDEMPOTENTE (rejeu du
--      consommateur -> aucun doublon) ET REGROUPANTE (un message `pending`
--      deja en file pour le meme `(template_id, aggregate_id, destinataire)`
--      ET la meme fenetre active accueille l occurrence plutot que d en
--      ouvrir un second). Pas un nom impose par le cadrage (seul
--      `api_claim_notification_messages` l est) : nomme ici par symetrie.
--
--   3. `public.api_claim_notification_messages(p_limit, p_max_attempts,
--      p_max_age)` — COPIE CONFORME du patron `api_claim_outbox_events`
--      (E10.10b-3, 20260908000000), adaptee aux colonnes de
--      `notification_logs` (`status`/`attempts` au lieu de
--      `published_at`/`delivery_attempts`). `security definer`, grantee au
--      SEUL `service_role`.
--
--   4. Purge SQL de retention, QUOTIDIENNE, basee sur
--      `commercial_settings.notification_retention_days` PAR TENANT
--      (7-730 j, colonne deja posee par E10.15a) — `public.
--      purge_expired_notification_logs()`, planifiee par un `pg_cron`
--      DIRECT (`perform public.purge_expired_notification_logs();`), SANS
--      Edge Function ni secret : a la difference des deux drains d envoi
--      (`magrit-outbox-dispatcher`, `magrit-notification-sender`), la purge
--      ne fait AUCUN appel reseau — c est une ecriture SQL pure, et le
--      cadrage la nomme explicitement « purge SQL » (§8.23 point 1). C est
--      un ECART DELIBERE et BORNE au patron `pg_cron + pg_net` des drains :
--      a signaler explicitement en revue.
--
--   5. Declencheur `pg_cron` A LA MINUTE de la future Edge Function
--      `magrit-notification-sender` (E10.15c) — planification DIFFEREE
--      (memes secrets Vault inconnus a l ecriture de cette migration), meme
--      forme que `20260908000000`/`20260910000500`.
--
-- CE QUE CE LOT NE FAIT PAS :
--   - AUCUN branchement sur `quote.sent`/`quote.converted`/`customer.created`/
--     `order.files_submitted` (E10.15d) ;
--   - AUCUN canal SMS (E10.15e, fournisseur non tranche) ;
--   - AUCUNE colonne neuve sur `commercial_settings` (les trois reglages de
--     notification sont DEJA poses par E10.15a).
-- ============================================================================

-- ── 1. Table `notification_logs` ────────────────────────────────────────────
create table if not exists public.notification_logs (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null references public.tenants(id) on delete cascade,
  -- Pas de FK vers outbox_events : le journal survit a une eventuelle purge
  -- future de la file (§8.23 §4).
  event_id             uuid not null,
  event_name           text not null check (event_name in (
                          'quote.sent', 'quote.converted', 'order.step_changed',
                          'order.files_submitted', 'customer.created'
                        )),
  aggregate_type       text not null,
  aggregate_id         uuid not null,
  template_id          uuid references public.notification_templates(id) on delete set null,
  channel              text not null check (channel in ('email', 'sms')),
  status               text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'dropped')),
  -- `null` ssi `status = 'dropped'` faute de destinataire (contrat,
  -- `NotificationLog.recipient`).
  recipient            text,
  -- `null` ssi `channel = 'sms'` (contrat).
  subject              text,
  body                 text not null,
  attempts             integer not null default 0 check (attempts >= 0),
  occurrence_count     integer not null default 1 check (occurrence_count >= 1),
  -- CORRIGE 2026-09-12 (§8.23 point 4, arbitrage) : fenetre de regroupement
  -- DE L EVENEMENT, recopiee du catalogue (`NotificationEventDescriptor.
  -- coalescing_window_minutes`, jamais en dur) A LA MISE EN FILE, et FIGEE
  -- comme le texte l est. `0` = cette entree n est JAMAIS regroupable.
  coalescing_window_minutes integer not null default 0
                       check (coalescing_window_minutes between 0 and 120),
  -- Meme mecanique de backoff que `outbox_events.next_attempt_at` (E10.10b-3).
  next_attempt_at      timestamptz not null default now(),
  provider_message_id  text,
  last_error           text,
  created_at           timestamptz not null default now(),
  sent_at              timestamptz,

  -- CORRIGE 2026-09-12 (m2, qa-review) : renommee et rendue RECIPROQUE — un
  -- `recipient` est EXIGE hors `dropped` (sinon une ligne `pending` sans
  -- destinataire serait acceptee puis jamais reclamable, `api_claim_notification_messages`
  -- filtrant `recipient is not null` : coincee en `pending` indefiniment,
  -- meme famille de defaut que B2 mais par une autre voie), et INTERDIT EN
  -- `dropped` (motif d abandon connu d avance, jamais un destinataire fantome).
  constraint notification_logs_recipient_shape check (
    (status = 'dropped' and recipient is null) or (status <> 'dropped' and recipient is not null)
  ),
  constraint notification_logs_subject_shape check (
    channel <> 'sms' or subject is null
  )
);

comment on table public.notification_logs is
  'E10.15c — file d envoi ET journal des notifications, une seule table (meme precedent que outbox_events). Le texte (recipient/subject/body) est FIGE A LA MISE EN FILE, immuable apres insertion (trigger notification_logs_reject_mutation) ; seules les colonnes de suivi (status/attempts/next_attempt_at/provider_message_id/last_error/sent_at/occurrence_count) evoluent. PEUT ETRE DETRUITE (retention RGPD, purge_expired_notification_logs) — a la difference de outbox_events, aucune garde ne bloque un DELETE.';
comment on column public.notification_logs.event_id is
  'outbox_events.id a l origine du message — SANS FK (le journal survit a la purge eventuelle de la file). Sur un message REGROUPE, c est le PREMIER evenement de la fenetre.';
comment on column public.notification_logs.template_id is
  'Modele a l origine du message. on delete set null : l entree survit au modele (cascade de suppression d une etape de production, ex.), c est tout l interet de ne pas pouvoir supprimer un modele directement.';
comment on column public.notification_logs.recipient is
  'Adresse ou numero REELLEMENT vise. NULL uniquement sur une entree dropped faute de destinataire — cas VISIBLE, pas un silence (« un modele actif qui ne previent personne est exactement le cas qu il faut voir »).';
comment on column public.notification_logs.occurrence_count is
  'Nombre de faits metier regroupes dans ce message (>= 1). Incremente par api_enqueue_notification_message quand un message pending existe deja pour le meme (template_id, aggregate_id, destinataire) ET que la fenetre de regroupement est active (coalescing_window_minutes > 0) : le texte reste celui de la PREMIERE occurrence (immuabilite), seul ce compteur bouge.';
comment on column public.notification_logs.coalescing_window_minutes is
  'CORRIGE 2026-09-12 (§8.23 point 4). Fenetre de regroupement DE L EVENEMENT (0-120 min), recopiee du catalogue (NotificationEventDescriptor.coalescing_window_minutes) A LA MISE EN FILE, jamais reecrite en dur. `0` = cette entree n est JAMAIS regroupable (un fait, un message) ; c est la valeur de tous les evenements branches par ce lot (E10.15c, order.step_changed seul). Figee comme le texte l est : une ligne en file reste jugee sous la regle qui l a mise en file.';

create index if not exists notification_logs_tenant_created_idx
  on public.notification_logs (tenant_id, created_at desc);

create index if not exists notification_logs_pending_due_idx
  on public.notification_logs (next_attempt_at)
  where status = 'pending';

-- Non-doublon : LA garantie du mecanisme (§8.23 §4), en base, pas dans le
-- code. `coalesce(recipient, '')` couvre le cas dropped (recipient null).
create unique index if not exists notification_logs_dedupe_uidx
  on public.notification_logs (event_id, template_id, (coalesce(recipient, '')));

-- Regroupement — CORRIGE 2026-09-12 (§8.23 point 4, RECTIFICATIF D ARBITRAGE) :
-- la version d origine ignorait le destinataire ET s appliquait a tout
-- evenement, deux defauts CUMULATIFS sur le meme index (aucun des deux ne
-- suffit seul a le corriger) :
--   1. LA CLE PORTE LE DESTINATAIRE. Un regroupement est un regroupement de
--      FAITS, jamais de PERSONNES ; sans le destinataire dans la clé, un
--      modele a plusieurs destinataires (audience explicit, ou un client a
--      plusieurs contacts) met le premier en file et ABSORBE les autres
--      dans son compteur, silencieusement (ils ne sont ni envoyes, ni
--      journalises, ni visibles) — contradiction frontale avec NotificationLog
--      (« UN message, UN destinataire, UN canal »).
--   2. LA CONTRAINTE NE S APPLIQUE QU AUX ENTREES D UN EVENEMENT QUI DECLARE
--      UNE FENETRE (coalescing_window_minutes > 0). Sans ce predicat, l index
--      interdirait une seconde ligne pending sur le meme objet MEME quand
--      aucun regroupement n est voulu (order.step_changed, fenetre 0) : deux
--      changements d etape rapproches fusionneraient en un seul message dont
--      le corps, immuable, decrirait la PREMIERE etape — un message FAUX sur
--      l etat reel de la commande.
-- `template_id` peut valoir NULL en theorie (cascade sur un modele supprime
-- APRES la mise en file) : l index partiel `unique` traite alors chaque NULL
-- comme distinct (semantique standard Postgres), ce qui est correct ici
-- puisqu un message dont le modele a deja disparu ne peut plus etre
-- regroupe avec un autre.
create unique index if not exists notification_logs_grouping_uidx
  on public.notification_logs (template_id, aggregate_id, (coalesce(recipient, '')))
  where status = 'pending' and coalescing_window_minutes > 0;

create index if not exists notification_logs_aggregate_idx
  on public.notification_logs (aggregate_type, aggregate_id, created_at desc);

-- ── 2. Immuabilite : trigger, pas revoke ────────────────────────────────────
-- `.claude/rules/db.md` exige l append-only sur les tables d audit ; cette
-- table DOIT muter (une file change d etat) et DOIT pouvoir etre DETRUITE
-- (retention RGPD) — la regle s applique donc dans son INTENTION : un
-- trigger refuse toute modification hors des colonnes de suivi, CALQUE sur
-- `outbox_events_reject_mutation()` (E10.0), MAIS SANS le refus de DELETE
-- que porte celui-ci (une notification purgee n a pas d equivalent de
-- "evenement non publie perdu").
create or replace function public.notification_logs_reject_mutation()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    -- Purge de retention : toujours autorisee, quel que soit le statut.
    return old;
  end if;

  if new.id is distinct from old.id
     or new.tenant_id is distinct from old.tenant_id
     or new.event_id is distinct from old.event_id
     or new.event_name is distinct from old.event_name
     or new.aggregate_type is distinct from old.aggregate_type
     or new.aggregate_id is distinct from old.aggregate_id
     -- CORRIGE 2026-09-12 (§8.23 point 4, arbitrage) : `template_id` est
     -- declare `on delete set null` precisement pour que « l entree survive
     -- au modele » (suppression d une etape de production, qui emporte ses
     -- modeles en cascade). Cette action de cle etrangere est une UPDATE
     -- executee par le SYSTEME, pas une tentative de contournement
     -- applicatif : refuser tout changement de `template_id` ferait echouer
     -- la cascade, donc la suppression de l etape de production elle-meme.
     -- SEULE la transition non-nul -> null est toleree ; toute autre
     -- reecriture (vers un AUTRE modele) reste refusee, puisqu elle
     -- reecrirait le "pourquoi" d un message deja parti.
     or (
       new.template_id is distinct from old.template_id
       and not (old.template_id is not null and new.template_id is null)
     )
     or new.channel is distinct from old.channel
     or new.recipient is distinct from old.recipient
     or new.subject is distinct from old.subject
     or new.body is distinct from old.body
     or new.created_at is distinct from old.created_at then
    raise exception using
      errcode = '42501',
      message = 'notification_logs_immutable: seules status/attempts/next_attempt_at/provider_message_id/last_error/sent_at/occurrence_count sont modifiables (template_id: seule la transition non-nul -> null, via cascade FK, est toleree)';
  end if;

  return new;
end;
$$;

comment on function public.notification_logs_reject_mutation() is
  'E10.15c — CALQUE sur outbox_events_reject_mutation() : refuse toute modification hors des colonnes de suivi. DELETE toujours autorise (purge de retention), contrairement a outbox_events. EXCEPTION (2026-09-12) : tolere la transition template_id non-nul -> null, produite par le on delete set null de la FK vers notification_templates (UPDATE systeme, pas un contournement).';

drop trigger if exists notification_logs_append_only on public.notification_logs;
create trigger notification_logs_append_only
  before update or delete on public.notification_logs
  for each row execute function public.notification_logs_reject_mutation();

-- ── 3. RLS — lecture ouverte au tenant, AUCUNE ecriture applicative ─────────
-- Seule la fonction security definer du consommateur (api_enqueue_notification_message)
-- ET le service_role (drain d envoi, purge) ecrivent — meme parti que
-- outbox_events (§8.23 §4 : "seule la fonction security definer du
-- consommateur ET le service_role ecrivent").
alter table public.notification_logs enable row level security;

drop policy if exists "notification_logs_select" on public.notification_logs;
create policy "notification_logs_select" on public.notification_logs for select using (
  is_super_admin()
  or tenant_id in (select public.current_user_tenant_ids())
);

-- Aucune policy d ecriture : ni insert, ni update, ni delete pour
-- authenticated/anon — l ecriture applicative n existe pas cote client.
revoke all on table public.notification_logs from public, anon, authenticated;
grant select on table public.notification_logs to authenticated;

grant select, insert, delete on table public.notification_logs to service_role;
grant update (status, attempts, next_attempt_at, provider_message_id, last_error, sent_at, occurrence_count)
  on table public.notification_logs to service_role;

-- ── 4. Mise en file — idempotente ET regroupante ────────────────────────────
-- CORRIGE 2026-09-12 (§8.23 point 4, RECTIFICATIF D ARBITRAGE) : signature
-- ELARGIE (`p_coalescing_window_minutes`), regroupement conditionne A LA
-- FOIS a `p_status = 'pending'` ET a une fenetre STRICTEMENT POSITIVE, clef
-- de regroupement elargie au destinataire, et `next_attempt_at` d une ligne
-- DEJA en file n est PLUS JAMAIS repoussee (seul occurrence_count bouge).
create or replace function public.api_enqueue_notification_message(
  p_tenant_id      uuid,
  p_event_id       uuid,
  p_event_name     text,
  p_aggregate_type text,
  p_aggregate_id   uuid,
  p_template_id    uuid,
  p_channel        text,
  p_status         text,
  p_recipient      text,
  p_subject        text,
  p_body           text,
  p_last_error     text default null,
  p_coalescing_window_minutes integer default 0
)
returns public.notification_logs
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_existing public.notification_logs;
  v_pending  public.notification_logs;
  v_result   public.notification_logs;
begin
  -- (a) Idempotence de rejeu : meme evenement, meme modele, meme
  -- destinataire deja traite (le composite qui englobe ce consommateur a pu
  -- echouer PLUS LOIN et faire rejouer l evenement entier). INCHANGE par ce
  -- correctif.
  select * into v_existing
    from public.notification_logs
   where event_id = p_event_id
     and template_id = p_template_id
     and coalesce(recipient, '') = coalesce(p_recipient, '')
   limit 1;

  if found then
    return v_existing;
  end if;

  -- (b) Regroupement : SEULEMENT si `p_status = 'pending'` ET
  -- `p_coalescing_window_minutes > 0` — sur `order.step_changed`
  -- (fenetre 0), cette branche ne s execute JAMAIS, comportement identique
  -- a avant ce correctif. La cle porte desormais le DESTINATAIRE : un
  -- regroupement est un regroupement de FAITS, jamais de PERSONNES. `for
  -- update` (bloquant, pas skip locked) : une seule ligne cible possible
  -- ici, bloquer brievement est correct et evite la course qu un skip
  -- locked laisserait ouverte. Seul `occurrence_count` est touche —
  -- `next_attempt_at` n est JAMAIS repoussee par une occurrence
  -- supplementaire (contrat : « un client qui depose pendant une heure
  -- declenche un message toutes les fenetres, jamais un message
  -- indefiniment differe »).
  if p_status = 'pending' and p_coalescing_window_minutes > 0 then
    select * into v_pending
      from public.notification_logs
     where template_id = p_template_id
       and aggregate_id = p_aggregate_id
       and coalesce(recipient, '') = coalesce(p_recipient, '')
       and status = 'pending'
       and coalescing_window_minutes > 0
     for update
     limit 1;

    if found then
      update public.notification_logs
         set occurrence_count = occurrence_count + 1
       where id = v_pending.id
      returning * into v_result;
      return v_result;
    end if;
  end if;

  -- (c) Sinon, nouvelle entree. `coalescing_window_minutes` recopie tel
  -- quel ; `next_attempt_at` n est differee QUE si la fenetre est
  -- strictement positive — avec `0`, l expression vaut `now()`,
  -- comportement INCHANGE pour E10.15c. Filet de securite EXCEPTION : une
  -- course entre deux appels concurrents peut, malgre (a)/(b), heurter l un
  -- des deux index uniques — on retombe alors sur la ligne du gagnant
  -- plutot que de faire echouer tout l appelant.
  begin
    insert into public.notification_logs (
      tenant_id, event_id, event_name, aggregate_type, aggregate_id,
      template_id, channel, status, recipient, subject, body, last_error,
      coalescing_window_minutes, next_attempt_at
    ) values (
      p_tenant_id, p_event_id, p_event_name, p_aggregate_type, p_aggregate_id,
      p_template_id, p_channel, p_status, p_recipient, p_subject, p_body, p_last_error,
      p_coalescing_window_minutes,
      now() + make_interval(mins => p_coalescing_window_minutes)
    )
    returning * into v_result;
  exception when unique_violation then
    select * into v_result
      from public.notification_logs
     where event_id = p_event_id
       and template_id = p_template_id
       and coalesce(recipient, '') = coalesce(p_recipient, '')
     limit 1;
    if not found then
      -- La collision venait de l index de regroupement, pas du non-doublon :
      -- relire selon la MEME cle elargie (destinataire compris, fenetre
      -- active).
      select * into v_result
        from public.notification_logs
       where template_id = p_template_id
         and aggregate_id = p_aggregate_id
         and coalesce(recipient, '') = coalesce(p_recipient, '')
         and status = 'pending'
         and coalescing_window_minutes > 0
       limit 1;
    end if;
  end;

  return v_result;
end;
$$;

comment on function public.api_enqueue_notification_message(uuid, uuid, text, text, uuid, uuid, text, text, text, text, text, text, integer) is
  'E10.15c — mise en file IDEMPOTENTE (event_id, template_id, destinataire) ET REGROUPANTE (un message pending du meme modele, sur le meme objet metier, pour le meme destinataire, accueille l occurrence — mais SEULEMENT si coalescing_window_minutes > 0, recopie du catalogue d evenements a la mise en file). Appelee par NotificationDispatchConsumer. security definer, service_role SEUL.';

revoke all on function public.api_enqueue_notification_message(uuid, uuid, text, text, uuid, uuid, text, text, text, text, text, text, integer) from public, anon, authenticated;
grant execute on function public.api_enqueue_notification_message(uuid, uuid, text, text, uuid, uuid, text, text, text, text, text, text, integer) to service_role;

-- ── 5. Reclamation atomique du drain d envoi ────────────────────────────────
-- COPIE CONFORME du patron api_claim_outbox_events (E10.10b-3), adaptee aux
-- colonnes de notification_logs. Rebut par fraicheur -> status = 'failed'
-- (et non 'dropped' : le message A ETE candidat a l envoi, contrairement a
-- un dropped « jamais tente » — voir NotificationStatus, contrat).
create or replace function public.api_claim_notification_messages(
  p_limit integer default 25,
  p_max_attempts integer default 5,
  p_max_age interval default interval '24 hours'
)
returns setof public.notification_logs
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
begin
  return query
  with candidates as (
    select n.id, n.created_at, n.attempts
      from public.notification_logs n
     where n.status = 'pending'
       and n.recipient is not null
       and n.attempts < p_max_attempts
       and n.next_attempt_at <= now()
     order by n.created_at asc
     limit greatest(p_limit, 0)
     for update skip locked
  ),
  stale as (
    select id from candidates where created_at < now() - p_max_age
  ),
  rebutted as (
    update public.notification_logs n
       set status = 'failed',
           attempts = p_max_attempts,
           last_error = format(
             'notification_stale: message du %s trop vieux (fraicheur %s depassee), abandonne sans envoi',
             n.created_at,
             p_max_age
           )
      from stale s
     where n.id = s.id
    returning n.id
  ),
  fresh as (
    select id from candidates where id not in (select id from stale)
  ),
  claimed as (
    update public.notification_logs n
       set attempts = n.attempts + 1,
           next_attempt_at = now()
             + (power(5, least(n.attempts + 1, 4) - 1))::numeric * interval '1 minute'
      from fresh f
     where n.id = f.id
    returning n.*
  )
  select * from claimed;
end;
$$;

comment on function public.api_claim_notification_messages(integer, integer, interval) is
  'E10.15c — reclamation atomique du drain d envoi (for update skip locked), copie conforme du patron api_claim_outbox_events. Incremente attempts et repousse next_attempt_at A LA RECLAMATION. Rebut (fraicheur depassee) -> status=failed sans remise. service_role SEUL.';

revoke all on function public.api_claim_notification_messages(integer, integer, interval) from public, anon, authenticated;
grant execute on function public.api_claim_notification_messages(integer, integer, interval) to service_role;

-- ── 6. Purge de retention — QUOTIDIENNE, SQL PURE, par tenant ───────────────
create or replace function public.purge_expired_notification_logs()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_deleted integer;
begin
  delete from public.notification_logs n
   using public.commercial_settings cs
   where cs.tenant_id = n.tenant_id
     and n.created_at < now() - (cs.notification_retention_days || ' days')::interval;
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

comment on function public.purge_expired_notification_logs() is
  'E10.15c — purge quotidienne RGPD : detruit les entrees plus vieilles que CommercialSettings.notification_retention_days DU TENANT (7-730 j, defaut 90). Un tenant sans ligne commercial_settings n est jamais purge (jointure interne) — api_get_commercial_settings cree la ligne par defaut au premier acces, donc ce cas ne persiste pas en usage reel. security definer, service_role SEUL : aucun appel applicatif, uniquement le pg_cron ci-dessous.';

revoke all on function public.purge_expired_notification_logs() from public, anon, authenticated;
grant execute on function public.purge_expired_notification_logs() to service_role;

-- pg_cron/pg_net sont DEJA actives par 20260908000000 : cette migration ne
-- les active pas une seconde fois. AUCUN secret, AUCUNE Edge Function :
-- appel SQL DIRECT (voir en-tete, point 4 — ecart deliberement borne au
-- patron pg_net des deux drains d envoi).
do $$
begin
  if exists (select 1 from cron.job where jobname = 'magrit-notification-log-purge') then
    perform cron.unschedule('magrit-notification-log-purge');
  end if;

  -- Cadence quotidienne, 03:10 UTC (creux d exploitation, apres le rappel de
  -- purge de fichiers a 05:00 -- pas de collision voulue, aucune dependance
  -- entre les deux).
  perform cron.schedule(
    'magrit-notification-log-purge',
    '10 3 * * *',
    $sql$select public.purge_expired_notification_logs();$sql$
  );
end;
$$;

notify pgrst, 'reload schema';

-- ============================================================================
-- PLANIFICATION DIFFEREE DU DECLENCHEUR pg_cron DE `magrit-notification-sender`
-- — meme motif et meme forme que `20260908000000`/`20260910000500` : cette
-- migration NE PLANIFIE RIEN elle-meme pour ce SECOND declencheur (elle ne
-- peut pas connaitre a l avance les secrets Vault de la NOUVELLE Edge
-- Function `magrit-notification-sender`, distincte de
-- `magrit-outbox-dispatcher` — §8.23 §3(c) : SON PROPRE pg_cron A LA MINUTE,
-- SON PROPRE secret). A executer UNE FOIS les secrets
-- `magrit_notification_send_url` / `magrit_notification_send_secret` poses
-- (`vault.create_secret`), dans une session psql/SQL editor :
--
--   do $$
--   declare
--     v_url text;
--     v_secret text;
--   begin
--     select decrypted_secret into v_url
--       from vault.decrypted_secrets where name = 'magrit_notification_send_url';
--     select decrypted_secret into v_secret
--       from vault.decrypted_secrets where name = 'magrit_notification_send_secret';
--
--     if v_url is null or v_secret is null then
--       raise exception 'E10.15c: secrets Vault magrit_notification_send_url / magrit_notification_send_secret absents.';
--     end if;
--
--     if exists (select 1 from cron.job where jobname = 'magrit-notification-send') then
--       perform cron.unschedule('magrit-notification-send');
--     end if;
--
--     -- Cadence A LA MINUTE (meme raisonnement que magrit-outbox-dispatch :
--     -- la promptitude est ici la qualite recherchee, §8.23 §3(c)).
--     perform cron.schedule(
--       'magrit-notification-send',
--       '* * * * *',
--       format(
--         $cron$select net.http_post(
--           url := %L,
--           headers := jsonb_build_object(
--             'Content-Type', 'application/json',
--             'X-Magrit-Notification-Send-Secret', %L
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
--   select cron.unschedule('magrit-notification-send')
--     where exists (select 1 from cron.job where jobname = 'magrit-notification-send');
--   select cron.unschedule('magrit-notification-log-purge')
--     where exists (select 1 from cron.job where jobname = 'magrit-notification-log-purge');
--
--   revoke execute on function public.purge_expired_notification_logs() from service_role;
--   drop function if exists public.purge_expired_notification_logs();
--
--   revoke execute on function public.api_claim_notification_messages(integer, integer, interval) from service_role;
--   drop function if exists public.api_claim_notification_messages(integer, integer, interval);
--
--   revoke execute on function public.api_enqueue_notification_message(uuid, uuid, text, text, uuid, uuid, text, text, text, text, text, text, integer) from service_role;
--   drop function if exists public.api_enqueue_notification_message(uuid, uuid, text, text, uuid, uuid, text, text, text, text, text, text, integer);
--
--   drop trigger if exists notification_logs_append_only on public.notification_logs;
--   drop function if exists public.notification_logs_reject_mutation();
--   drop policy if exists "notification_logs_select" on public.notification_logs;
--   drop index if exists public.notification_logs_aggregate_idx;
--   drop index if exists public.notification_logs_grouping_uidx;
--   drop index if exists public.notification_logs_dedupe_uidx;
--   drop index if exists public.notification_logs_pending_due_idx;
--   drop index if exists public.notification_logs_tenant_created_idx;
--   drop table if exists public.notification_logs;
--
--   notify pgrst, 'reload schema';
--
-- pg_cron/pg_net NE SONT PAS desactives (extension partagee).
-- ============================================================================
