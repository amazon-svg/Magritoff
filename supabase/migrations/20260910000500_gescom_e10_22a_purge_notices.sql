-- ============================================================================
-- Sprint 5 Gestion commerciale — stories E10.22a (echeance + rappels) et
-- E10.22a-bis (preuve de livraison), FUSIONNEES dans ce lot sur decision de
-- perimetre du mandat de story (la preuve de livraison est un prealable
-- fonctionnel aux rappels : sans elle la garde de purge de E10.22b ne serait
-- jamais satisfiable). Contrat : openapi/magrit-core.v1.yaml (deja ecrit par
-- l architecte), docs/api/CONVENTIONS.md §8.22.
-- ----------------------------------------------------------------------------
-- PERIMETRE STRICT DE CE LOT : aucune destruction. E10.22b (purge reelle) et
-- E10.22c (objets orphelins) ne sont PAS ce lot.
--
-- ORDRE D EXECUTION REEL, NON NEGOCIABLE (corrige en qa-review round 1,
-- B1 BLOQUANT CRITIQUE) : les QUATRE colonnes sont ajoutees, PUIS le trigger
-- `commercial_order_files_set_updated_at()` est DESARME sur ces colonnes,
-- ET SEULEMENT ENSUITE la reprise du passif (UPDATE sans `where`, sur TOUTES
-- les lignes existantes) s execute. Inverser ce dernier point avec le
-- desarmement du trigger ferait sauter `updated_at` de TOUS les fichiers
-- deja en production (E10.17a/17b/20b) au moment du deploiement — perimant
-- leur ETag sans qu aucun utilisateur n ait rien fait, exactement le dommage
-- que le contrat §8.22 §2 exige d empecher. Ce bloc AVAIT ete ecrit dans le
-- mauvais ordre (passif reprise avant desarmement du trigger), prouve par
-- rejeu reel en base locale ; corrige ici, le texte ci-dessous decrit
-- desormais l ORDRE REEL du fichier.
--
-- Ce que cette migration fait, dans l ordre :
--
--   1. QUATRE colonnes sur `commercial_order_files` : `purge_at` (figee au
--      depot, jamais recalculee a la lecture — §2 du contrat), deux
--      POINTEURS `purge_notice_1_id`/`purge_notice_2_id` vers la table de
--      rappels ci-dessous, et `purged_at` (discriminant de `deleted_at`,
--      reserve a E10.22b).
--
--   2. `commercial_order_files_set_updated_at()` REECRITE (meme fonction,
--      `create or replace`, AUCUNE migration passee editee) pour devenir
--      INDIFFERENTE aux quatre colonnes de purge — sans ca, rattacher un
--      rappel a un fichier bougerait son `updated_at` et perimerait son
--      `ETag` sous les pieds d un utilisateur qui n a rien fait (§2 du
--      contrat, prescription OPPOSABLE, publiee sur `OrderFile.updated_at`).
--      AVANT toute ecriture de donnees sur cette table (voir paragraphe
--      ci-dessus, B1).
--
--   3. Reprise du PASSIF avec PLANCHER EXPLICITE, meme piege documente que
--      `20260908000000` : le DEFAULT de l ALTER ne couvre les lignes
--      existantes qu avec une valeur PROVISOIRE (`now()+30j`, evaluee UNE
--      FOIS pour toute la table car `now()` est STABLE, pas IMMUTABLE) —
--      l UPDATE explicite qui suit calcule la vraie valeur PAR FICHIER, avec
--      un plancher a horodatage LITTERAL (jamais `now()`, qui ferait glisser
--      le plancher a chaque rejeu). Desormais SANS EFFET sur `updated_at`
--      (point 2 deja applique).
--
--   4. DEUX TABLES DE SUIVI NEUVES (arbitrage Arnaud du 2026-09-10, §2 du
--      contrat — la version d origine du cadrage retenait quatre colonnes
--      et aucune table ; elle est ABANDONNEE par l arbitrage lui-meme) :
--        - `commercial_order_file_purge_notices` — un RAPPEL (deux paliers
--          `first`/`second`), le fait qu il ait ete EMIS puis CONFIRME
--          DELIVRE (`confirmed_at` = instant de la PREMIERE livraison
--          confirmee parmi ses destinataires).
--        - `commercial_order_file_purge_notice_deliveries` — UN message
--          Resend PAR destinataire d un rappel, avec SON identifiant de
--          message, SON statut, SA propre fenetre de relecture.
--      Regime IDENTIQUE a `outbox_events` (E10.0/E10.10b-3) : contenu
--      metier immuable, colonnes de SUIVI mutables, via un trigger dedie sur
--      chaque table (append-only assoupli, pas un simple `revoke`).
--
--   5. SIX fonctions `security definer`, `service_role` SEUL (sauf la
--      resolution des destinataires, egalement `service_role` seul — ni
--      `authenticated` ni `anon` n atteignent jamais ce mecanisme, meme
--      discipline qu `api_claim_outbox_events`) :
--        - `api_resolve_order_file_purge_recipients(tenant)` — TOUS les
--          `admin` du tenant avec une adresse exploitable. §4 du contrat
--          decrit "tous les owner, repli sur admin" en citant la migration
--          D ORIGINE de `tenant_members` (`20260424000100`) : ECART CONSTATE
--          et ASSUME ICI, PAS CORRIGE dans le cadrage (hors perimetre R5,
--          voir rapport de fin de story) — `20260814000200_admin_unique.sql`
--          a DEPUIS retire `owner` des valeurs ecrivables
--          (`tenant_members_role_admin_check` n autorise plus que
--          `admin`/`member`/`partner`) : "un seul profil d administration :
--          admin". Il n existe donc plus de palier "owner" vers lequel
--          replier quoi que ce soit ; TOUS les admin sont deja le public le
--          plus large qui porte ce droit. Fonction PARTAGEE
--          entre la verification d existence a la reclamation ET la
--          resolution A LA REMISE (le consommateur outbox l appelle a
--          nouveau) : deux appels de la MEME regle, jamais deux copies.
--        - `api_claim_order_file_purge_notices(stage, lead_days)` — reclame
--          (`for update skip locked`) les fichiers vivants dont le palier
--          est atteint (`purge_at - lead_days <= now()`, JAMAIS
--          `deposited_at + N`, cf. §2 du contrat) et la marque du palier
--          encore nulle, groupe par (tenant, purge_at) — TOUS les fichiers
--          d une meme emission PARTAGENT la meme date annoncee (§4 du
--          contrat) —, verifie qu au moins un destinataire existe, cree LE
--          rappel, rattache les fichiers, insere l evenement
--          `order_files.purge_scheduled`, LE TOUT DANS LA MEME transaction
--          que la reclamation.
--        - `api_expire_order_file_purge_notices(window)` — un rappel sans
--          AUCUNE livraison confirmee au bout de la fenetre (3 jours
--          proposes, reserve (h)) est marque `failed_at` et son rattachement
--          REMIS A NULL sur les fichiers : le balayage du lendemain en emet
--          un neuf, vers les destinataires DU MOMENT (§4 du contrat,
--          arbitrage 2026-09-10, reserve (d) fermee).
--        - `api_record_order_file_purge_notice_delivery_attempt(...)` —
--          ecrit CE QUE le consommateur outbox a obtenu de Resend a l envoi
--          (id du message = ACCEPTE, rien de plus — §0 du contrat) ; upsert
--          idempotent sur (notice_id, recipient_email), jamais deux lignes
--          pour le meme destinataire d un meme rappel rejoue.
--        - `api_claim_order_file_purge_notice_deliveries_for_check(...)` —
--          reclame les livraisons ACCEPTEES mais pas encore CONFIRMEES pour
--          relecture de `GET /emails/{id}` (E10.22a-bis), meme patron
--          `for update skip locked` que la reclamation de rappels.
--        - `api_record_order_file_purge_notice_delivery_check(...)` —
--          ecrit `last_event` releve chez Resend ; SEUL `delivered` confirme
--          (propage `notices.confirmed_at`), SEUL `bounced` est un echec
--          TERMINAL de CETTE livraison (voir adaptateur TS pour la limite de
--          ce que la specification Resend documente reellement) ; tout autre
--          statut reste PENDANT jusqu a expiration de la fenetre — c est la
--          fenetre, jamais une enumeration de statuts, qui debloque le cas
--          general (§0 du contrat : Resend NE DOCUMENTE PAS d enumeration
--          exhaustive de `last_event`).
--
-- Ce que cette migration NE fait PAS : aucune destruction d octet ni de
-- ligne (E10.22b), aucun balayage des objets orphelins (E10.22c), aucun
-- declencheur `pg_cron` (geste d exploitation differe, meme motif et meme
-- forme que `20260908000000` — voir bloc "PLANIFICATION DIFFEREE" en pied de
-- fichier), aucun endpoint `/api/v1` neuf (contrat §8.22 §9 : un balayage n a
-- pas de tenant, CA4).
-- ============================================================================

-- ── 1. Colonnes de purge sur `commercial_order_files` ───────────────────────
alter table public.commercial_order_files
  add column if not exists purge_at timestamptz not null default (now() + interval '30 days'),
  add column if not exists purge_notice_1_id uuid,
  add column if not exists purge_notice_2_id uuid,
  add column if not exists purged_at timestamptz;

comment on column public.commercial_order_files.purge_at is
  'E10.22a — date A PARTIR DE LAQUELLE le fichier est destructible. Individuelle (30 jours apres deposited_at, JAMAIS apres la commande), FIGEE (ne se recalcule jamais a la lecture). PAS une echeance absolue : arbitrage Arnaud du 2026-09-10, la purge (E10.22b) exige EN PLUS que les deux rappels soient CONFIRMES DELIVRES (voir garde sur purge_notice_1_id/purge_notice_2_id ci-dessous).';
comment on column public.commercial_order_files.purge_notice_1_id is
  'E10.22a — rappel de palier "first" (J+20 avant purge_at) couvrant ce fichier. NULL = pas encore emis (aucun destinataire joignable, ou palier non atteint). Remis a NULL par api_expire_order_file_purge_notices si le rappel echoue (relance au tour suivant).';
comment on column public.commercial_order_files.purge_notice_2_id is
  'E10.22a — rappel de palier "second" (J+15 avant purge_at). Meme regime que purge_notice_1_id.';
comment on column public.commercial_order_files.purged_at is
  'E10.22b (reservee, colonne posee ICI pour eviter une migration de plus) — instant de la destruction AUTOMATIQUE. Discriminant de deleted_at (meme leçon que deposited_via : ne jamais deduire un "type" d une colonne texte). Jamais publiee au contrat.';

-- ── BLOQUANT qa-review round 1 (B1), CORRIGE ICI — ORDRE NON NEGOCIABLE :
-- le trigger `commercial_order_files_set_updated_at()` DOIT etre desarme
-- AVANT la reprise du passif (UPDATE ci-dessous, SANS where, donc sur TOUTES
-- les lignes deja presentes). Tant que l ANCIEN trigger (pose par
-- `20260909060000`, qui bumpe `updated_at` INCONDITIONNELLEMENT) est encore
-- actif, cet UPDATE ferait sauter `updated_at` de TOUS les fichiers deja en
-- production (E10.17a/17b/20b) -- perimant leur ETag sans qu aucun
-- utilisateur n ait rien fait, EXACTEMENT le dommage que le contrat §8.22 §2
-- exige d empecher. Ce bloc etait a tort place APRES la reprise du passif
-- (round 1 de qa-review, prouve par rejeu reel en base locale) ; il est
-- desormais la PREMIERE chose que cette migration fait sur cette table,
-- avant toute ecriture de donnees.
-- ── 2. Trigger `updated_at` de `commercial_order_files`, DESARME sur les
-- quatre colonnes de purge (§2 du contrat, prescription OPPOSABLE) ─────────
create or replace function public.commercial_order_files_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  if (
    new.filename is distinct from old.filename
    or new.content_type is distinct from old.content_type
    or new.byte_size is distinct from old.byte_size
    or new.visibility is distinct from old.visibility
    or new.storage_path is distinct from old.storage_path
    or new.order_line_id is distinct from old.order_line_id
    or new.deleted_at is distinct from old.deleted_at
    or new.deleted_by is distinct from old.deleted_by
    or new.deleted_by_label is distinct from old.deleted_by_label
  ) then
    new.updated_at := now();
  else
    -- Uniquement des colonnes de purge (purge_at/purge_notice_1_id/
    -- purge_notice_2_id/purged_at) ont change : updated_at INCHANGE,
    -- sous peine de perimer un ETag pris par une tache de fond.
    new.updated_at := old.updated_at;
  end if;
  return new;
end;
$$;
-- Le trigger lui-meme (commercial_order_files_set_updated_at, pose par
-- 20260909060000) n a pas besoin d etre redecla re : `create or replace
-- function` suffit, le trigger reference la fonction par son nom.

-- Reprise du passif, PLANCHER EXPLICITE (meme piege documente par
-- 20260908000000) : le DEFAULT ci-dessus a deja pose une valeur PROVISOIRE
-- identique (now()+30j, evaluee UNE FOIS pour toute la table) sur les lignes
-- deja presentes -- ce UPDATE calcule la valeur REELLE, PAR FICHIER, avec un
-- plancher a horodatage LITTERAL (jamais now(), qui ferait glisser le
-- plancher a chaque rejeu de cette migration).
update public.commercial_order_files
   set purge_at = greatest(
     deposited_at + interval '30 days',
     '2026-09-10 00:00:00+00'::timestamptz + interval '30 days'
   );

create index if not exists commercial_order_files_purge_pending_idx
  on public.commercial_order_files (purge_at)
  where deleted_at is null and purged_at is null;

-- ── 3. Deux tables de suivi ──────────────────────────────────────────────────
create table if not exists public.commercial_order_file_purge_notices (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  stage        text not null check (stage in ('first', 'second')),
  purge_at     timestamptz not null,
  file_count   integer not null check (file_count >= 1),
  order_count  integer not null check (order_count >= 1),
  created_at   timestamptz not null default now(),
  accepted_at  timestamptz,
  confirmed_at timestamptz,
  failed_at    timestamptz,
  last_error   text
);

comment on table public.commercial_order_file_purge_notices is
  'E10.22a — un RAPPEL (un palier, un espace, une date annoncee), PAS un fichier : un fichier y pointe (commercial_order_files.purge_notice_1_id/2_id). confirmed_at = instant de la PREMIERE livraison CONFIRMEE parmi ses commercial_order_file_purge_notice_deliveries (E10.22a-bis) — c est CETTE colonne, jamais accepted_at, que la garde de purge d E10.22b devra lire (arbitrage Arnaud du 2026-09-10).';
comment on column public.commercial_order_file_purge_notices.accepted_at is
  'Au moins UN destinataire ACCEPTE par Resend (id de message obtenu). NE PROUVE RIEN sur la livraison — "tentative faite", exactement ce qu Arnaud a refuse comme preuve le 2026-09-10.';
comment on column public.commercial_order_file_purge_notices.confirmed_at is
  'Au moins UNE livraison CONFIRMEE (GET /emails/{id} -> last_event = delivered, E10.22a-bis). SEULE colonne que la garde de purge d E10.22b doit lire.';

create index if not exists commercial_order_file_purge_notices_pending_idx
  on public.commercial_order_file_purge_notices (created_at)
  where confirmed_at is null and failed_at is null;

alter table public.commercial_order_files
  add constraint commercial_order_files_purge_notice_1_fkey
    foreign key (purge_notice_1_id) references public.commercial_order_file_purge_notices (id);
-- ^ pas de IF NOT EXISTS natif pour ADD CONSTRAINT sur cette version de
-- Postgres ; la table venant d etre creee au-dessus dans CETTE migration, la
-- contrainte ne peut pas deja exister ailleurs. Idempotence de la migration
-- entiere garantie par les CREATE TABLE/ADD COLUMN IF NOT EXISTS qui
-- precedent : si cette migration est rejouee sur une base qui l a deja vue
-- en entier, `create table if not exists` empeche d arriver jusqu ici.

alter table public.commercial_order_files
  add constraint commercial_order_files_purge_notice_2_fkey
    foreign key (purge_notice_2_id) references public.commercial_order_file_purge_notices (id);

create table if not exists public.commercial_order_file_purge_notice_deliveries (
  id                  uuid primary key default gen_random_uuid(),
  notice_id           uuid not null references public.commercial_order_file_purge_notices (id) on delete cascade,
  recipient_user_id   uuid references auth.users (id) on delete set null,
  recipient_email     text not null check (btrim(recipient_email) <> ''),
  provider_message_id text,
  accepted_at         timestamptz,
  confirmed_at        timestamptz,
  failed_at           timestamptz,
  last_status         text,
  check_attempts      integer not null default 0 check (check_attempts >= 0),
  next_check_at       timestamptz not null default now(),

  constraint commercial_order_file_purge_notice_deliveries_uniq
    unique (notice_id, recipient_email)
);

comment on table public.commercial_order_file_purge_notice_deliveries is
  'E10.22a-bis — UN message Resend PAR destinataire d un rappel. provider_message_id = id rendu par POST /emails (§0 du contrat : cet appel ne rend RIEN d autre, aucun statut). last_status = last_event relu par GET /emails/{id}. Unicite (notice_id, recipient_email) : un rejeu de l evenement outbox (au moins une fois) ne cree jamais une seconde ligne pour le meme destinataire.';
comment on column public.commercial_order_file_purge_notice_deliveries.recipient_email is
  'FIGEE au moment de l envoi (meme doctrine que deposited_by_label) : le proprietaire a pu changer depuis, l adresse qui a recu CE message reste celle-ci pour l audit.';

create index if not exists commercial_order_file_purge_deliveries_recheck_idx
  on public.commercial_order_file_purge_notice_deliveries (next_check_at)
  where accepted_at is not null and confirmed_at is null and failed_at is null;

-- ── Regime "append-only assoupli", IDENTIQUE a outbox_events ────────────────
create or replace function public.commercial_order_file_purge_notices_reject_mutation()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.confirmed_at is null and old.failed_at is null then
      raise exception using
        errcode = '42501',
        message = 'order_file_purge_notice_append_only: un rappel encore en cours (ni confirme ni en echec) ne peut pas etre supprime';
    end if;
    return old;
  end if;

  if new.id is distinct from old.id
     or new.tenant_id is distinct from old.tenant_id
     or new.stage is distinct from old.stage
     or new.purge_at is distinct from old.purge_at
     or new.file_count is distinct from old.file_count
     or new.order_count is distinct from old.order_count
     or new.created_at is distinct from old.created_at then
    raise exception using
      errcode = '42501',
      message = 'order_file_purge_notice_append_only: le contenu d un rappel est immuable';
  end if;

  -- Suivi de livraison, mutable : accepted_at, confirmed_at, failed_at, last_error.
  return new;
end;
$$;

drop trigger if exists commercial_order_file_purge_notices_reject_mutation on public.commercial_order_file_purge_notices;
create trigger commercial_order_file_purge_notices_reject_mutation
  before update or delete on public.commercial_order_file_purge_notices
  for each row execute function public.commercial_order_file_purge_notices_reject_mutation();

create or replace function public.commercial_order_file_purge_notice_deliveries_reject_mutation()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.confirmed_at is null and old.failed_at is null then
      raise exception using
        errcode = '42501',
        message = 'order_file_purge_notice_delivery_append_only: une livraison encore en cours ne peut pas etre supprimee';
    end if;
    return old;
  end if;

  if new.id is distinct from old.id
     or new.notice_id is distinct from old.notice_id
     or new.recipient_email is distinct from old.recipient_email then
    raise exception using
      errcode = '42501',
      message = 'order_file_purge_notice_delivery_append_only: le destinataire d une livraison est immuable';
  end if;

  -- Suivi mutable : recipient_user_id (un compte peut disparaitre/renaitre),
  -- provider_message_id, accepted_at, confirmed_at, failed_at, last_status,
  -- check_attempts, next_check_at.
  return new;
end;
$$;

drop trigger if exists commercial_order_file_purge_notice_deliveries_reject_mutation on public.commercial_order_file_purge_notice_deliveries;
create trigger commercial_order_file_purge_notice_deliveries_reject_mutation
  before update or delete on public.commercial_order_file_purge_notice_deliveries
  for each row execute function public.commercial_order_file_purge_notice_deliveries_reject_mutation();

-- ── RLS — lecture ouverte au tenant (visibilite operationnelle, §4 du
-- contrat), AUCUNE ecriture PostgREST directe (grants par defaut de
-- 20260811000100 revoques explicitement, seules les fonctions security
-- definer ci-dessous ecrivent) ─────────────────────────────────────────────
alter table public.commercial_order_file_purge_notices enable row level security;

drop policy if exists "commercial_order_file_purge_notices_select" on public.commercial_order_file_purge_notices;
create policy "commercial_order_file_purge_notices_select" on public.commercial_order_file_purge_notices for select using (
  is_super_admin()
  or tenant_id in (select public.current_user_tenant_ids())
);

revoke insert, update, delete on public.commercial_order_file_purge_notices from authenticated, anon;

alter table public.commercial_order_file_purge_notice_deliveries enable row level security;

drop policy if exists "commercial_order_file_purge_notice_deliveries_select" on public.commercial_order_file_purge_notice_deliveries;
create policy "commercial_order_file_purge_notice_deliveries_select" on public.commercial_order_file_purge_notice_deliveries for select using (
  is_super_admin()
  or exists (
    select 1 from public.commercial_order_file_purge_notices n
     where n.id = commercial_order_file_purge_notice_deliveries.notice_id
       and n.tenant_id in (select public.current_user_tenant_ids())
  )
);

revoke insert, update, delete on public.commercial_order_file_purge_notice_deliveries from authenticated, anon;

-- ── 4. Fonctions `security definer`, `service_role` SEUL ───────────────────

create or replace function public.api_resolve_order_file_purge_recipients(
  p_tenant_id uuid
)
returns table (recipient_user_id uuid, recipient_email text)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  -- ECART ASSUME avec la lettre du contrat §4 ("tous les owner, repli sur
  -- admin") : constate en verifiant CE lot, pas suppose -- voir le rapport de
  -- fin de story. `owner` n est plus une valeur ECRIVABLE de tenant_members
  -- depuis `20260814000200_admin_unique.sql` (CHECK limite a
  -- admin/member/partner) : il n y a plus de palier "owner" au-dessus de
  -- "admin" a partir duquel replier quoi que ce soit. TOUS les `admin`
  -- joignables du tenant sont donc DEJA le public le plus large qui porte ce
  -- droit -- exactement ce que la garde "au moins un destinataire" du
  -- contrat exige de verifier.
  select tm.user_id, u.email
    from public.tenant_members tm
    join auth.users u on u.id = tm.user_id
   where tm.tenant_id = p_tenant_id
     and tm.role = 'admin'
     and u.email is not null and btrim(u.email) <> '';
$$;

comment on function public.api_resolve_order_file_purge_recipients(uuid) is
  'E10.22a — TOUS les admin joignables (email non nul) du tenant. "owner" n existe plus comme valeur ecrivable de tenant_members depuis 20260814000200_admin_unique.sql -- ecart assume avec la lettre du contrat §4 ("owner puis repli admin"), voir rapport de fin de story. Fonction UNIQUE, appelee A LA RECLAMATION (existence seule) ET A LA REMISE (resolution reelle par le consommateur outbox) : la meme regle, jamais deux copies.';

revoke all on function public.api_resolve_order_file_purge_recipients(uuid) from public, anon, authenticated;
grant execute on function public.api_resolve_order_file_purge_recipients(uuid) to service_role;

create or replace function public.api_claim_order_file_purge_notices(
  p_stage text,
  p_lead_days integer
)
returns table (
  claimed_notice_id uuid,
  claimed_tenant_id uuid,
  claimed_file_count integer,
  claimed_order_count integer
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_group record;
  v_notice_id uuid;
  v_days_before integer;
  v_order_ids uuid[];
begin
  if p_stage not in ('first', 'second') then
    raise exception 'order_file_purge.invalid_stage: %', p_stage;
  end if;

  -- Les fichiers candidats sont RECLAMES (for update skip locked) AVANT
  -- d etre groupes : Postgres interdit FOR UPDATE combine a GROUP BY dans la
  -- MEME requete. Le groupe (tenant, purge_at) porte la MEME date annoncee
  -- pour tous ses fichiers, par construction (§4 du contrat).
  for v_group in
    with candidates as (
      select f.id, f.order_id, f.purge_at, o.tenant_id
        from public.commercial_order_files f
        join public.commercial_orders o on o.id = f.order_id
       where f.deleted_at is null
         and f.purged_at is null
         and f.purge_at - (p_lead_days || ' days')::interval <= now()
         and (case p_stage when 'first' then f.purge_notice_1_id else f.purge_notice_2_id end) is null
       order by f.id
       for update of f skip locked
    )
    select tenant_id, purge_at,
           array_agg(id) as file_ids,
           count(*)::integer as file_count,
           count(distinct order_id)::integer as order_count,
           array_agg(distinct order_id) as order_ids
      from candidates
     group by tenant_id, purge_at
     order by tenant_id, purge_at
  loop
    -- Aucun destinataire joignable : RIEN n est cree, RIEN n est emis (§4 du
    -- contrat) — les fichiers restent NON rattaches, repassent au tour
    -- suivant. C est la bonne defaillance (§1 du contrat).
    if not exists (select 1 from public.api_resolve_order_file_purge_recipients(v_group.tenant_id)) then
      continue;
    end if;

    v_days_before := greatest(0, ceil(extract(epoch from (v_group.purge_at - now())) / 86400.0))::integer;
    v_order_ids := (select coalesce(array_agg(x), array[]::uuid[]) from (select unnest(v_group.order_ids) as x limit 50) s);

    insert into public.commercial_order_file_purge_notices
      (tenant_id, stage, purge_at, file_count, order_count)
    values
      (v_group.tenant_id, p_stage, v_group.purge_at, v_group.file_count, v_group.order_count)
    returning id into v_notice_id;

    -- Rattachement des fichiers, DANS LA MEME transaction que la creation du
    -- rappel et l insertion de l evenement ci-dessous (§4 du contrat).
    execute format(
      'update public.commercial_order_files set %I = $1 where id = any($2)',
      case p_stage when 'first' then 'purge_notice_1_id' else 'purge_notice_2_id' end
    ) using v_notice_id, v_group.file_ids;

    insert into public.outbox_events
      (tenant_id, event_name, event_version, aggregate_type, aggregate_id, payload)
    values (
      v_group.tenant_id,
      'order_files.purge_scheduled',
      1,
      'tenant',
      v_group.tenant_id,
      jsonb_build_object(
        'notice_id', v_notice_id,
        'stage', p_stage,
        'file_count', v_group.file_count,
        'order_count', v_group.order_count,
        'purge_at', to_char(v_group.purge_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'days_before_purge', v_days_before,
        'order_ids', to_jsonb(v_order_ids)
      )
    );

    claimed_notice_id := v_notice_id;
    claimed_tenant_id := v_group.tenant_id;
    claimed_file_count := v_group.file_count;
    claimed_order_count := v_group.order_count;
    return next;
  end loop;
end;
$$;

comment on function public.api_claim_order_file_purge_notices(text, integer) is
  'E10.22a — balayage quotidien, un palier a la fois (stage in (first,second), lead_days = jours de recul depuis purge_at, JAMAIS depuis deposited_at). Groupe (tenant, purge_at), verifie un destinataire joignable, cree le rappel, rattache les fichiers, insere order_files.purge_scheduled -- transactionnel. service_role SEUL.';

revoke all on function public.api_claim_order_file_purge_notices(text, integer) from public, anon, authenticated;
grant execute on function public.api_claim_order_file_purge_notices(text, integer) to service_role;

create or replace function public.api_expire_order_file_purge_notices(
  p_window interval default interval '3 days'
)
returns setof public.commercial_order_file_purge_notices
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_notice_id uuid;
  v_deliveries_tried integer;
  v_row public.commercial_order_file_purge_notices;
begin
  for v_notice_id in
    select n.id from public.commercial_order_file_purge_notices n
     where n.confirmed_at is null
       and n.failed_at is null
       and n.created_at + p_window <= now()
     order by n.created_at
     for update of n skip locked
  loop
    select count(*) into v_deliveries_tried
      from public.commercial_order_file_purge_notice_deliveries d
     where d.notice_id = v_notice_id;

    update public.commercial_order_file_purge_notices
       set failed_at = now(),
           last_error = format(
             'order_file_purge_notice.delivery_window_expired: aucune livraison confirmee sous %s apres emission (%s destinataire(s) tente(s))',
             p_window,
             v_deliveries_tried
           )
     where id = v_notice_id
    returning * into v_row;

    -- Remise a NULL du rattachement : le balayage du lendemain (meme fonction
    -- de reclamation ci-dessus) considere de nouveau ces fichiers comme
    -- "palier non emis" et en cree un rappel NEUF, vers les destinataires DU
    -- MOMENT (§4 du contrat, arbitrage 2026-09-10).
    update public.commercial_order_files set purge_notice_1_id = null where purge_notice_1_id = v_notice_id;
    update public.commercial_order_files set purge_notice_2_id = null where purge_notice_2_id = v_notice_id;

    return next v_row;
  end loop;
end;
$$;

comment on function public.api_expire_order_file_purge_notices(interval) is
  'E10.22a-bis — un rappel sans AUCUNE livraison confirmee au bout de la fenetre est marque failed_at et son rattachement remis a NULL sur les fichiers (relance au tour suivant). service_role SEUL.';

revoke all on function public.api_expire_order_file_purge_notices(interval) from public, anon, authenticated;
grant execute on function public.api_expire_order_file_purge_notices(interval) to service_role;

create or replace function public.api_record_order_file_purge_notice_delivery_attempt(
  p_notice_id uuid,
  p_recipient_user_id uuid,
  p_recipient_email text,
  p_provider_message_id text
)
returns public.commercial_order_file_purge_notice_deliveries
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_row public.commercial_order_file_purge_notice_deliveries;
begin
  insert into public.commercial_order_file_purge_notice_deliveries
    (notice_id, recipient_user_id, recipient_email, provider_message_id, accepted_at, failed_at, last_status)
  values (
    p_notice_id,
    p_recipient_user_id,
    p_recipient_email,
    p_provider_message_id,
    case when p_provider_message_id is not null then now() end,
    case when p_provider_message_id is null then now() end,
    case when p_provider_message_id is null then 'send_failed' end
  )
  on conflict (notice_id, recipient_email) do update
     set recipient_user_id = excluded.recipient_user_id,
         provider_message_id = excluded.provider_message_id,
         accepted_at = excluded.accepted_at,
         failed_at = excluded.failed_at,
         last_status = excluded.last_status,
         check_attempts = 0,
         next_check_at = now()
   where public.commercial_order_file_purge_notice_deliveries.confirmed_at is null;

  -- L UPSERT ci-dessus est parfois SANS EFFET (rejeu de l evenement outbox
  -- APRES qu une livraison a deja ete confirmee, clause WHERE) : dans ce cas
  -- RETURNING ne rend rien. On relit systematiquement la ligne courante.
  select * into v_row
    from public.commercial_order_file_purge_notice_deliveries
   where notice_id = p_notice_id and recipient_email = p_recipient_email;

  if v_row.accepted_at is not null then
    update public.commercial_order_file_purge_notices
       set accepted_at = coalesce(accepted_at, now())
     where id = p_notice_id;
  end if;

  return v_row;
end;
$$;

comment on function public.api_record_order_file_purge_notice_delivery_attempt(uuid, uuid, text, text) is
  'E10.22a — appelee par le consommateur outbox order_files.purge_scheduled APRES POST /emails. p_provider_message_id NULL = echec d envoi immediat (accepted_at reste NULL). Upsert idempotent (notice_id, recipient_email) : un rejeu (au moins une fois) ne cree jamais une seconde ligne, et ne regresse jamais une livraison deja confirmee. service_role SEUL.';

revoke all on function public.api_record_order_file_purge_notice_delivery_attempt(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.api_record_order_file_purge_notice_delivery_attempt(uuid, uuid, text, text) to service_role;

create or replace function public.api_claim_order_file_purge_notice_deliveries_for_check(
  p_limit integer default 50,
  p_max_attempts integer default 20,
  p_recheck_interval interval default interval '4 hours'
)
returns table (
  delivery_id uuid,
  notice_id uuid,
  provider_message_id text
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  return query
  with candidates as (
    select d.id
      from public.commercial_order_file_purge_notice_deliveries d
     where d.accepted_at is not null
       and d.confirmed_at is null
       and d.failed_at is null
       and d.provider_message_id is not null
       and d.check_attempts < p_max_attempts
       and d.next_check_at <= now()
     order by d.next_check_at
     limit greatest(p_limit, 0)
     for update skip locked
  ),
  claimed as (
    update public.commercial_order_file_purge_notice_deliveries d
       set check_attempts = d.check_attempts + 1,
           next_check_at = now() + p_recheck_interval
      from candidates c
     where d.id = c.id
    returning d.id, d.notice_id, d.provider_message_id
  )
  select claimed.id, claimed.notice_id, claimed.provider_message_id from claimed;
end;
$$;

comment on function public.api_claim_order_file_purge_notice_deliveries_for_check(integer, integer, interval) is
  'E10.22a-bis — reclame (for update skip locked) les livraisons ACCEPTEES pas encore CONFIRMEES, pour relecture GET /emails/{id}. Incremente check_attempts et repousse next_check_at A LA RECLAMATION, meme patron que api_claim_outbox_events. service_role SEUL.';

revoke all on function public.api_claim_order_file_purge_notice_deliveries_for_check(integer, integer, interval) from public, anon, authenticated;
grant execute on function public.api_claim_order_file_purge_notice_deliveries_for_check(integer, integer, interval) to service_role;

create or replace function public.api_record_order_file_purge_notice_delivery_check(
  p_delivery_id uuid,
  p_last_status text
)
returns public.commercial_order_file_purge_notice_deliveries
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_row public.commercial_order_file_purge_notice_deliveries;
  v_confirmed boolean := p_last_status = 'delivered';
  -- 'bounced' est la SEULE valeur negative litteralement presente sur la
  -- specification publiee par Resend (https://resend.com/openapi.json,
  -- verifiee le 2026-09-10 -- exemple d evenement de webhook, PAS une
  -- enumeration de last_event, qui n en documente aucune). Toute AUTRE
  -- valeur (y compris inconnue) reste PENDANTE jusqu a expiration de la
  -- fenetre de relecture (api_expire_order_file_purge_notices) : c est la
  -- fenetre, jamais une liste de statuts devinee, qui debloque le cas
  -- general.
  v_terminal_failure boolean := p_last_status = 'bounced';
begin
  update public.commercial_order_file_purge_notice_deliveries
     set last_status = p_last_status,
         confirmed_at = case when v_confirmed then coalesce(confirmed_at, now()) else confirmed_at end,
         failed_at = case when v_terminal_failure then coalesce(failed_at, now()) else failed_at end
   where id = p_delivery_id
  returning * into v_row;

  if not found then
    raise exception 'order_file_purge_notice_delivery.not_found: %', p_delivery_id;
  end if;

  -- qa-review round 1 (N2) : `and failed_at is null` -- une relecture TARDIVE
  -- "delivered" arrivant APRES qu api_expire_order_file_purge_notices a deja
  -- marque CE rappel en echec (fenetre de 3 jours ecoulee, rattachement des
  -- fichiers deja remis a null, un rappel NEUF potentiellement deja emis) ne
  -- doit PAS reecrire confirmed_at sur le rappel EXPIRE : la garde de purge
  -- future (E10.22b) reste saine par un autre chemin (elle exige LES DEUX
  -- rappels confirmes, et celui-ci n est plus rattache a aucun fichier), mais
  -- laisser confirmed_at se poser ici polluerait le suivi operationnel (un
  -- rappel `failed_at` ET `confirmed_at` tous deux non nuls n a aucun sens
  -- metier).
  if v_confirmed then
    update public.commercial_order_file_purge_notices
       set confirmed_at = coalesce(confirmed_at, now())
     where id = v_row.notice_id
       and failed_at is null;
  end if;

  return v_row;
end;
$$;

comment on function public.api_record_order_file_purge_notice_delivery_check(uuid, text) is
  'E10.22a-bis — ecrit last_event releve par GET /emails/{id}. delivered -> confirmed_at (propage sur le rappel, SAUF si le rappel est deja failed_at -- qa-review N2) ; bounced -> failed_at DE CETTE LIVRAISON seulement (le rappel, lui, n est en echec qu a expiration de la fenetre, voir api_expire_order_file_purge_notices) ; tout autre statut -> last_status seul, relecture au tour suivant. service_role SEUL.';

revoke all on function public.api_record_order_file_purge_notice_delivery_check(uuid, text) from public, anon, authenticated;
grant execute on function public.api_record_order_file_purge_notice_delivery_check(uuid, text) to service_role;

notify pgrst, 'reload schema';

-- ============================================================================
-- PLANIFICATION DIFFEREE DU DECLENCHEUR pg_cron — meme motif et meme forme
-- que `20260908000000` (partie "PLANIFICATION DIFFEREE DU DECLENCHEUR") :
-- cette migration NE PLANIFIE RIEN elle-meme (elle ne peut pas connaitre a
-- l avance les secrets Vault de la NOUVELLE Edge Function
-- `magrit-order-file-purge`, distincte de `magrit-outbox-dispatcher` — §3 du
-- contrat : SECOND pg_cron, QUOTIDIEN, dedie). A executer UNE FOIS les
-- secrets `magrit_order_file_purge_url` / `magrit_order_file_purge_secret`
-- poses (`vault.create_secret`), dans une session psql/SQL editor :
--
--   do $$
--   declare
--     v_url text;
--     v_secret text;
--   begin
--     select decrypted_secret into v_url
--       from vault.decrypted_secrets where name = 'magrit_order_file_purge_url';
--     select decrypted_secret into v_secret
--       from vault.decrypted_secrets where name = 'magrit_order_file_purge_secret';
--
--     if v_url is null or v_secret is null then
--       raise exception 'E10.22a: secrets Vault magrit_order_file_purge_url / magrit_order_file_purge_secret absents.';
--     end if;
--
--     if exists (select 1 from cron.job where jobname = 'magrit-order-file-purge') then
--       perform cron.unschedule('magrit-order-file-purge');
--     end if;
--
--     -- Cadence QUOTIDIENNE, heure d exploitation a confirmer (reserve (c) du
--     -- contrat) -- 05:00 UTC propose (avant l ouverture de l atelier).
--     perform cron.schedule(
--       'magrit-order-file-purge',
--       '0 5 * * *',
--       format(
--         $cron$select net.http_post(
--           url := %L,
--           headers := jsonb_build_object(
--             'Content-Type', 'application/json',
--             'X-Magrit-Order-File-Purge-Secret', %L
--           ),
--           body := '{}'::jsonb,
--           timeout_milliseconds := 60000
--         );$cron$,
--         v_url,
--         v_secret
--       )
--     );
--   end;
--   $$;
--
-- pg_cron/pg_net sont DEJA actives par 20260908000000 : cette migration ne
-- les active pas une seconde fois.
-- ============================================================================

-- ============================================================================
-- REVERSIBILITE — le CLI Supabase ne gere pas de bloc `down`. SQL de retrait,
-- a jouer tel quel dans une migration inverse si la story est annulee :
--
--   select cron.unschedule('magrit-order-file-purge')
--     where exists (select 1 from cron.job where jobname = 'magrit-order-file-purge');
--
--   revoke execute on function public.api_record_order_file_purge_notice_delivery_check(uuid, text) from service_role;
--   drop function if exists public.api_record_order_file_purge_notice_delivery_check(uuid, text);
--   revoke execute on function public.api_claim_order_file_purge_notice_deliveries_for_check(integer, integer, interval) from service_role;
--   drop function if exists public.api_claim_order_file_purge_notice_deliveries_for_check(integer, integer, interval);
--   revoke execute on function public.api_record_order_file_purge_notice_delivery_attempt(uuid, uuid, text, text) from service_role;
--   drop function if exists public.api_record_order_file_purge_notice_delivery_attempt(uuid, uuid, text, text);
--   revoke execute on function public.api_expire_order_file_purge_notices(interval) from service_role;
--   drop function if exists public.api_expire_order_file_purge_notices(interval);
--   revoke execute on function public.api_claim_order_file_purge_notices(text, integer) from service_role;
--   drop function if exists public.api_claim_order_file_purge_notices(text, integer);
--   revoke execute on function public.api_resolve_order_file_purge_recipients(uuid) from service_role;
--   drop function if exists public.api_resolve_order_file_purge_recipients(uuid);
--
--   drop trigger if exists commercial_order_file_purge_notice_deliveries_reject_mutation on public.commercial_order_file_purge_notice_deliveries;
--   drop function if exists public.commercial_order_file_purge_notice_deliveries_reject_mutation();
--   drop trigger if exists commercial_order_file_purge_notices_reject_mutation on public.commercial_order_file_purge_notices;
--   drop function if exists public.commercial_order_file_purge_notices_reject_mutation();
--
--   drop policy if exists "commercial_order_file_purge_notice_deliveries_select" on public.commercial_order_file_purge_notice_deliveries;
--   drop table if exists public.commercial_order_file_purge_notice_deliveries;
--   drop policy if exists "commercial_order_file_purge_notices_select" on public.commercial_order_file_purge_notices;
--
--   alter table public.commercial_order_files drop constraint if exists commercial_order_files_purge_notice_2_fkey;
--   alter table public.commercial_order_files drop constraint if exists commercial_order_files_purge_notice_1_fkey;
--   drop table if exists public.commercial_order_file_purge_notices;
--
--   drop index if exists public.commercial_order_files_purge_pending_idx;
--   alter table public.commercial_order_files drop column if exists purged_at;
--   alter table public.commercial_order_files drop column if exists purge_notice_2_id;
--   alter table public.commercial_order_files drop column if exists purge_notice_1_id;
--   alter table public.commercial_order_files drop column if exists purge_at;
--
--   -- Restaure commercial_order_files_set_updated_at() a sa forme
--   -- 20260909060000 (bump inconditionnel) -- voir ce fichier pour le corps
--   -- exact.
--
--   notify pgrst, 'reload schema';
-- ============================================================================
