-- ============================================================================
-- Sprint 5 Gestion commerciale — story E10.15d-2 : rendu DIFFERE de
-- `{{files.count}}`, scelle a la remise (arbitrage architecte du 2026-09-12,
-- §8.23 point 11, qui LEVE la reserve (i)).
-- Contrat : openapi/magrit-core.v1.yaml, docs/api/CONVENTIONS.md §8.23 point
-- 11.4 (detail exact de ce qui suit — a relire avant toute retouche).
-- ----------------------------------------------------------------------------
-- ADDITIVE : cette migration NE MODIFIE PAS `20260912000100_gescom_e10_15c_
-- notification_dispatch.sql`, deja deployee en production le 2026-09-12.
-- ----------------------------------------------------------------------------
-- CE QUE CE LOT FAIT (§8.23 point 11.4, 1 a 7) :
--
--   1. `notification_logs.deferred_render jsonb` — colonne NEUVE, nullable,
--      INTERNE (jamais exposee par l API : `NotificationLog` est
--      `additionalProperties: false`, elle en est exclue par construction).
--      `null` sur l immense majorite des lignes (tout message SANS balise
--      `delivery`, c est a dire E10.15c/d-1 en integralite, et la plupart des
--      messages `order.files_submitted`).
--
--   2. `grant update (subject, body, deferred_render) ... to service_role` —
--      EN AJOUT du grant de colonnes existant (E10.15c grantait deja `status,
--      attempts, next_attempt_at, provider_message_id, last_error, sent_at,
--      occurrence_count`). SANS ce grant, le sceau (§4 ci-dessous) echoue en
--      42501, pris a tort pour un probleme de trigger.
--
--   3. `notification_logs_reject_mutation()` — `create or replace`, TROIS
--      ajouts, tout le reste IDENTIQUE (y compris la tolerance `template_id`
--      non nul -> `null` d E10.15c, conservee MOT POUR MOT — voir le test SQL,
--      scenario 4, qui la reprouve) :
--        (a) `subject`/`body` deviennent modifiables SI ET SEULEMENT SI
--            `old.status = 'pending' and new.status is distinct from
--            'pending'` — exactement la transition de SCELLEMENT, une fois
--            par ligne et jamais plus ;
--        (b) `deferred_render` : SEULE la transition non nul -> `null` est
--            toleree ; `null` -> non nul et toute autre reecriture sont
--            refusees ;
--        (c) `new.status = 'pending' and old.status is distinct from
--            'pending'` est REFUSE — un statut terminal ne redevient JAMAIS
--            `pending`, le sceau ne peut donc jamais etre rouvert.
--
--   4. Index de regroupement — `drop index` PUIS `create unique index` avec
--      le predicat elargi `and attempts = 0` : la fenetre de regroupement se
--      ferme desormais A LA RECLAMATION (§8.23 point 11.2), pas seulement par
--      le temps — un fichier depose ENTRE la reclamation et l accuse de
--      remise ne doit plus etre fondu, silencieusement, dans un message DEJA
--      en cours d envoi.
--
--   5. `api_enqueue_notification_message` — `DROP FUNCTION` PUIS `CREATE
--      FUNCTION` (JAMAIS `create or replace` : le parametre neuf
--      `p_deferred_render jsonb default null` CHANGE la signature — un
--      `create or replace` creerait une SECONDE surcharge a 14 arguments
--      cohabitant avec celle a 13, PostgREST choisirait l une ou l autre selon
--      les cles envoyees, panne INTERMITTENTE). `revoke`/`grant`/`comment on
--      function` REFAITS avec la nouvelle signature (attaches a la signature,
--      le `drop` les emporte). Deux changements dans le corps : la recherche
--      de la branche (b) gagne `and attempts = 0` ; l insertion de la branche
--      (c) ecrit `deferred_render = p_deferred_render`.
--
--   6. `api_claim_notification_messages` — AUCUNE MODIFICATION (rend `setof
--      public.notification_logs`, la colonne neuve la traverse SANS
--      changement de signature, §8.23 point 11.4 §6).
--
--   7. `notify pgrst, 'reload schema';` en fin de fichier.
--
-- CE QUE CE LOT NE FAIT PAS :
--   - AUCUN branchement d evenement (fait par le module applicatif,
--     NotificationDispatchConsumer/NotificationSender, meme lot cote code) ;
--   - AUCUNE colonne neuve sur `commercial_settings` ;
--   - AUCUNE modification du canal SMS.
-- ============================================================================

-- ── 1. Colonne neuve, INTERNE ────────────────────────────────────────────────
alter table public.notification_logs
  add column if not exists deferred_render jsonb;

comment on column public.notification_logs.deferred_render is
  'E10.15d-2 (§8.23 point 11) — RENDU DIFFERE de la (des) balise(s) render_stage=delivery (files.count SEULE aujourd hui) : { "subject": [...] | null, "body": [...] }, tableau de segments (litteral | balise differee) produit par renderNotificationTagsWithDeferred. INTERNE, JAMAIS expose par l API (NotificationLog est additionalProperties:false). NULL sur l immense majorite des lignes. Non-NULL UNIQUEMENT tant que le message est pending ET a ete insere avec une fenetre de regroupement active ET porte une balise delivery : scelle (remis a NULL) par la MEME UPDATE qui pose le statut terminal (sent/failed) — voir notification_logs_reject_mutation().';

-- ── 2. Grant de colonnes — EN AJOUT ─────────────────────────────────────────
-- Sans ce grant, l UPDATE du sceau (subject/body/deferred_render dans la
-- meme transition que status) echoue en 42501.
grant update (subject, body, deferred_render)
  on table public.notification_logs to service_role;

-- ── 3. Trigger d immuabilite — CREATE OR REPLACE, 3 ajouts ──────────────────
create or replace function public.notification_logs_reject_mutation()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    -- Purge de retention : toujours autorisee, quel que soit le statut.
    return old;
  end if;

  -- CORRIGE 2026-09-12 (§8.23 point 11.4 §3(c)) : un statut TERMINAL ne
  -- redevient JAMAIS pending — le sceau ne peut donc jamais etre rouvert.
  -- INDEPENDANT du reste : verifie AVANT les exceptions ponctuelles
  -- subject/body/deferred_render ci-dessous.
  if new.status = 'pending' and old.status is distinct from 'pending' then
    raise exception using
      errcode = '42501',
      message = 'notification_logs_immutable: un statut terminal (sent/failed/dropped) ne peut jamais redevenir pending — le sceau du texte final est definitif';
  end if;

  if new.id is distinct from old.id
     or new.tenant_id is distinct from old.tenant_id
     or new.event_id is distinct from old.event_id
     or new.event_name is distinct from old.event_name
     or new.aggregate_type is distinct from old.aggregate_type
     or new.aggregate_id is distinct from old.aggregate_id
     -- Tolerance E10.15c, CONSERVEE MOT POUR MOT : `template_id` est declare
     -- `on delete set null` precisement pour que « l entree survive au
     -- modele » (suppression d une etape de production, qui emporte ses
     -- modeles en cascade). Cette action de cle etrangere est une UPDATE
     -- executee par le SYSTEME, pas une tentative de contournement
     -- applicatif : refuser tout changement de `template_id` ferait echouer
     -- la cascade, donc la suppression de l etape de production elle-meme.
     -- SEULE la transition non-nul -> null est toleree ; toute autre
     -- reecriture (vers un AUTRE modele) reste refusee.
     or (
       new.template_id is distinct from old.template_id
       and not (old.template_id is not null and new.template_id is null)
     )
     or new.channel is distinct from old.channel
     or new.recipient is distinct from old.recipient
     -- CORRIGE 2026-09-12 (§8.23 point 11.4 §3(a)) : `subject`/`body`
     -- deviennent modifiables SI ET SEULEMENT SI la ligne QUITTE `pending`
     -- (le SCEAU du rendu differe, une fois par ligne et jamais plus) — le
     -- refus explicite ci-dessus (`new.status = 'pending' and old.status is
     -- distinct from 'pending'`) empeche deja tout retour a `pending` qui
     -- rouvrirait cette fenetre.
     or (
       new.subject is distinct from old.subject
       and not (old.status = 'pending' and new.status is distinct from 'pending')
     )
     or (
       new.body is distinct from old.body
       and not (old.status = 'pending' and new.status is distinct from 'pending')
     )
     -- NEUF (§8.23 point 11.4 §3(b)) : `deferred_render` n est modifiable QUE
     -- de non-nul vers `null` (le sceau le remet a `null`) — `null` -> non nul
     -- et toute autre reecriture restent refusees.
     or (
       new.deferred_render is distinct from old.deferred_render
       and not (old.deferred_render is not null and new.deferred_render is null)
     )
     or new.created_at is distinct from old.created_at then
    raise exception using
      errcode = '42501',
      message = 'notification_logs_immutable: seules status/attempts/next_attempt_at/provider_message_id/last_error/sent_at/occurrence_count sont modifiables (template_id: seule la transition non-nul -> null, via cascade FK, est toleree ; subject/body: seule la transition de scellement pending -> statut terminal les rend modifiables ; deferred_render: seule la transition non-nul -> null est toleree)';
  end if;

  return new;
end;
$$;

comment on function public.notification_logs_reject_mutation() is
  'E10.15c/E10.15d-2 — refuse toute modification hors des colonnes de suivi. DELETE toujours autorise (purge de retention). Tolerances : template_id non-nul -> null (cascade FK, E10.15c) ; subject/body modifiables UNIQUEMENT a la transition pending -> statut terminal (le SCEAU du rendu differe, E10.15d-2) ; deferred_render modifiable UNIQUEMENT non-nul -> null (le meme sceau) ; un statut terminal ne peut JAMAIS redevenir pending (E10.15d-2, rend le sceau irreversible EN BASE).';

-- ── 4. Index de regroupement — DROP puis CREATE, predicat elargi ───────────
-- §8.23 point 11.2 : la fenetre de regroupement se ferme A LA RECLAMATION
-- (attempts > 0 sort l entree du regroupement), pas seulement par le temps —
-- sans ce predicat, un fichier depose ENTRE la reclamation et l accuse de
-- remise du prestataire serait absorbe, SILENCIEUSEMENT, dans un message DEJA
-- en cours d envoi : jamais annonce, jamais retrace.
drop index if exists public.notification_logs_grouping_uidx;

create unique index notification_logs_grouping_uidx
  on public.notification_logs (template_id, aggregate_id, (coalesce(recipient, '')))
  where status = 'pending' and coalescing_window_minutes > 0 and attempts = 0;

-- ── 5. Mise en file — DROP FUNCTION puis CREATE FUNCTION (PAS create or replace) ──
-- La signature CHANGE (p_deferred_render, 14e argument) : un `create or
-- replace` creerait une SECONDE surcharge a 14 arguments cohabitant avec
-- celle a 13 (E10.15c), et PostgREST choisirait l une ou l autre selon les
-- cles envoyees — panne INTERMITTENTE, tres couteuse a diagnostiquer.
drop function if exists public.api_enqueue_notification_message(
  uuid, uuid, text, text, uuid, uuid, text, text, text, text, text, text, integer
);

create function public.api_enqueue_notification_message(
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
  p_coalescing_window_minutes integer default 0,
  p_deferred_render jsonb default null
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
  -- destinataire deja traite. INCHANGE depuis E10.15c.
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
  -- `p_coalescing_window_minutes > 0`. NEUF (§8.23 point 11.2) : `and
  -- attempts = 0` — une ligne DEJA reclamee (attempts >= 1) n accueille plus
  -- aucune occurrence, un fait survenu apres la reclamation ouvre une entree
  -- NEUVE avec sa propre fenetre. Seul `occurrence_count` est touche —
  -- `next_attempt_at` n est JAMAIS repoussee par une occurrence
  -- supplementaire (comportement E10.15c inchange).
  if p_status = 'pending' and p_coalescing_window_minutes > 0 then
    select * into v_pending
      from public.notification_logs
     where template_id = p_template_id
       and aggregate_id = p_aggregate_id
       and coalesce(recipient, '') = coalesce(p_recipient, '')
       and status = 'pending'
       and coalescing_window_minutes > 0
       and attempts = 0
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

  -- (c) Sinon, nouvelle entree. NEUF : `deferred_render = p_deferred_render`
  -- (`null` sur tout message E10.15c/d-1, non nul UNIQUEMENT sur
  -- `order.files_submitted` quand le modele emploie une balise `delivery`).
  begin
    insert into public.notification_logs (
      tenant_id, event_id, event_name, aggregate_type, aggregate_id,
      template_id, channel, status, recipient, subject, body, last_error,
      coalescing_window_minutes, next_attempt_at, deferred_render
    ) values (
      p_tenant_id, p_event_id, p_event_name, p_aggregate_type, p_aggregate_id,
      p_template_id, p_channel, p_status, p_recipient, p_subject, p_body, p_last_error,
      p_coalescing_window_minutes,
      now() + make_interval(mins => p_coalescing_window_minutes),
      p_deferred_render
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
      -- active, ET NON RECLAMEE).
      select * into v_result
        from public.notification_logs
       where template_id = p_template_id
         and aggregate_id = p_aggregate_id
         and coalesce(recipient, '') = coalesce(p_recipient, '')
         and status = 'pending'
         and coalescing_window_minutes > 0
         and attempts = 0
       limit 1;
    end if;
  end;

  return v_result;
end;
$$;

comment on function public.api_enqueue_notification_message(uuid, uuid, text, text, uuid, uuid, text, text, text, text, text, text, integer, jsonb) is
  'E10.15c/E10.15d-2 — mise en file IDEMPOTENTE (event_id, template_id, destinataire) ET REGROUPANTE (un message pending, NON RECLAME (attempts = 0), du meme modele, sur le meme objet metier, pour le meme destinataire, accueille l occurrence — SEULEMENT si coalescing_window_minutes > 0). p_deferred_render (E10.15d-2, §8.23 point 11) : segments de rendu differe pour les balises render_stage=delivery, NULL sur tout message SANS balise differee. Appelee par NotificationDispatchConsumer. security definer, service_role SEUL.';

revoke all on function public.api_enqueue_notification_message(uuid, uuid, text, text, uuid, uuid, text, text, text, text, text, text, integer, jsonb) from public, anon, authenticated;
grant execute on function public.api_enqueue_notification_message(uuid, uuid, text, text, uuid, uuid, text, text, text, text, text, text, integer, jsonb) to service_role;

-- ── 6. api_claim_notification_messages : AUCUNE MODIFICATION ────────────────
-- Rend `setof public.notification_logs` — la colonne neuve la traverse SANS
-- changement de signature (§8.23 point 11.4 §6). Rien a faire ici.

notify pgrst, 'reload schema';

-- ============================================================================
-- REVERSIBILITE — le CLI Supabase ne gere pas de bloc `down`. SQL de retrait,
-- a jouer tel quel dans une migration inverse si la story est annulee :
--
--   -- Revenir a la fonction/signature d E10.15c (13 arguments) :
--   drop function if exists public.api_enqueue_notification_message(
--     uuid, uuid, text, text, uuid, uuid, text, text, text, text, text, text, integer, jsonb
--   );
--   -- (recreer ici la version a 13 arguments de 20260912000100 si necessaire)
--
--   drop index if exists public.notification_logs_grouping_uidx;
--   create unique index notification_logs_grouping_uidx
--     on public.notification_logs (template_id, aggregate_id, (coalesce(recipient, '')))
--     where status = 'pending' and coalescing_window_minutes > 0;
--
--   -- Revenir au trigger d immuabilite d E10.15c (sans les tolerances
--   -- subject/body/deferred_render, sans le refus de retour a pending) :
--   -- (recreer ici le corps de notification_logs_reject_mutation() de
--   -- 20260912000100 si necessaire)
--
--   revoke update (subject, body, deferred_render) on public.notification_logs from service_role;
--
--   alter table public.notification_logs drop column if exists deferred_render;
--
--   notify pgrst, 'reload schema';
-- ============================================================================
