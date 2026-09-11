-- ============================================================================
-- Sprint 5 Gestion commerciale — story E10.15a : socle configurable des
-- notifications multicanal (AUCUN ENVOI). Contrat :
-- openapi/magrit-core.v1.yaml (deja ecrit par l architecte), docs/api/
-- CONVENTIONS.md §8.23.
-- ----------------------------------------------------------------------------
-- PERIMETRE STRICT DE CE LOT (§8.23 §8, decoupage en cinq sous-stories) :
--
--   1. Table NEUVE `public.notification_templates` — la configuration (« quand
--      CE fait se produit, envoyer CE texte a CETTE audience par CE canal »).
--      `public.notification_logs` (la file d envoi ET le journal) N EST PAS
--      POSEE ICI : le contrat l assigne EXPLICITEMENT a E10.15c
--      (« Migration notification_logs [...], GET /notification-logs »).
--
--   2. Trois colonnes neuves sur `public.commercial_settings` (E10.10a) :
--      `notification_retention_days`, `notification_sms_enabled`,
--      `notification_sms_daily_cap` — memes trois reglages que le contrat
--      decrit au §8.23 §2 sur `CommercialSettings`.
--
--   3. RLS + trigger `notification_templates_guard` : plafond de 100
--      modeles par tenant SOUS VERROU CONSULTATIF (pas un `check`, « qui ne
--      sait pas compter ses voisins », contrat), immuabilite de `event_name`/
--      `channel` apres creation, horodatage/auteur poses cote base. AUCUNE
--      fonction `security definer` dediee (a la difference de
--      `production_steps`) : le trigger s applique QUEL QUE SOIT le chemin
--      d ecriture (RPC ou table directe), un `INSERT`/`UPDATE` PostgREST
--      garde par la RLS suffit (meme parti que `updateProductionStep`).
--
--   4. Trigger `commercial_settings_guard_notification_fields` — REFUS AU
--      CHAMP (pas a l operation) d un acteur qui porte `can_manage_pricing`
--      (droit MINIMAL de `updateCommercialSettings`) mais pas
--      `can_manage_notifications`, EN BASE, en defense en profondeur du
--      controle deja pose par le SERVICE
--      (`CommercialSettingsService.assertCanManageNotificationFields()`).
--
-- CE QUE CE LOT NE FAIT PAS (perimetre des lots suivants, §8.23 §8) :
--   - AUCUN consumer outbox, AUCUNE Edge Function d envoi, AUCUN appel reseau
--     reel (E10.15c) ;
--   - AUCUNE table `notification_logs`, AUCUN `api_claim_notification_messages`,
--     AUCUNE purge de retention (E10.15c) ;
--   - AUCUN branchement sur `quote.sent`/`quote.converted`/`customer.created`/
--     `order.files_submitted` — ce lot pose le SOCLE (catalogue + validation),
--     pas la consommation (E10.15c/d).
-- ============================================================================

-- ── 1. Table `notification_templates` ───────────────────────────────────────
create table if not exists public.notification_templates (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants(id) on delete cascade,
  -- Sous-ensemble NOTIFIABLE d `EventName` (5 valeurs, contrat
  -- `NotificationEventName`). PAS D ENUM POSTGRES : une enum se modifie mal
  -- et la liste est ADDITIVE (meme motif que `production_steps.color`).
  event_name         text not null check (event_name in (
                        'quote.sent', 'quote.converted', 'order.step_changed',
                        'order.files_submitted', 'customer.created'
                      )),
  channel            text not null check (channel in ('email', 'sms')),
  audience           text not null check (audience in ('customer', 'explicit')),
  recipients         text[],
  production_step_id uuid references public.production_steps(id) on delete cascade,
  name               text not null check (btrim(name) <> '' and char_length(name) <= 120),
  subject            text,
  body               text not null check (char_length(body) >= 1 and char_length(body) <= 4000),
  is_active          boolean not null default false,
  created_by         uuid references auth.users(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_by         uuid references auth.users(id) on delete set null,
  updated_at         timestamptz not null default now(),

  -- `recipients` EXIGE ssi audience = 'explicit' (borne a 10 entrees, contrat),
  -- INTERDIT ssi audience = 'customer' — equivalence DANS LES DEUX SENS, meme
  -- discipline que `price_rules_scope_customer_coherence` (E10.6). Postgres
  -- REFUSE une sous-requete dans un `check` (SQLSTATE 0A000, constate a
  -- l execution reelle de ce fichier) : la longueur PAR ENTREE (3 a 320
  -- caracteres) reste donc portee par les schemas Zod
  -- (`notificationRecipientsSchema`) seuls, pas par un backstop EN BASE ici —
  -- seules l EXIGENCE/INTERDICTION selon l audience et la BORNE DE COMPTE
  -- (1 a 10) sont des invariants d ENSEMBLE exprimables sans sous-requete.
  constraint notification_templates_recipients_coherence check (
    (audience = 'explicit' and recipients is not null and array_length(recipients, 1) between 1 and 10)
    or (audience = 'customer' and recipients is null)
  ),
  -- `production_step_id` valide sur `order.step_changed` SEUL (contrat).
  constraint notification_templates_step_filter_coherence check (
    production_step_id is null or event_name = 'order.step_changed'
  ),
  -- `subject` OBLIGATOIRE sur `email`, INTERDIT (`null`) sur `sms` (contrat).
  constraint notification_templates_subject_coherence check (
    (channel = 'email' and subject is not null and char_length(subject) between 1 and 200)
    or (channel = 'sms' and subject is null)
  ),
  -- PLAFOND PAR CANAL AU MODELE (contrat §8.23 §4) : 480 caracteres en `sms`,
  -- deja borne a 4000 en `email` par le `check` de la colonne `body`
  -- ci-dessus. Backstop EN BASE de la meme regle deja posee par
  -- `createNotificationTemplateCommandSchema`/`updateNotificationTemplateCommandSchema`
  -- (Zod, `.superRefine`) — un appel PostgREST direct doit lui aussi etre
  -- refuse (regle 4, `.claude/rules/db.md`).
  constraint notification_templates_sms_body_length check (
    channel <> 'sms' or char_length(body) <= 480
  )
);

comment on table public.notification_templates is
  'E10.15a — modele de notification : « quand CE fait se produit, envoyer CE texte a CETTE audience par CE canal ». AUCUN ENVOI ne passe par cette table (elle porte la CONFIGURATION, pas la file) ; la file/journal est notification_logs, posee par E10.15c. Plafond de 100 modeles par tenant tenu par le trigger notification_templates_guard, PAS par un check.';
comment on column public.notification_templates.event_name is
  'Fait metier declencheur, sous-ensemble NOTIFIABLE de EventName (src/modules/_shared/api/contracts.ts, OUTBOX_EVENT_NAMES). NON MODIFIABLE apres creation (garde EN BASE : trigger notification_templates_guard).';
comment on column public.notification_templates.channel is
  'Canal d acheminement. NON MODIFIABLE apres creation (meme garde que event_name).';
comment on column public.notification_templates.recipients is
  'Destinataires explicites (email ou +33... selon le canal), UNIQUEMENT pour audience = explicit. Borne a 10 entrees : un modele qui arrose vingt adresses est une liste de diffusion, pas un modele de message.';
comment on column public.notification_templates.production_step_id is
  'Restreint le modele a UNE etape d arrivee (OrderStepChangedPayload.to_step_id), valide sur order.step_changed SEUL. SUPPRESSION EN CASCADE : une etape supprimee ne peut plus etre atteinte par aucune commande, le modele attache serait une regle morte.';
comment on column public.notification_templates.is_active is
  '`false` = le modele existe mais ne declenche rien. ETAT INITIAL par defaut (creer arme n est pas interdit, mais ce n est pas le defaut). SEULE facon d arreter un modele : il n existe PAS de DELETE (contrat) — un modele cite par un futur journal doit rester lisible.';

create index if not exists notification_templates_tenant_event_name_idx
  on public.notification_templates (tenant_id, event_name, name);
create index if not exists notification_templates_production_step_idx
  on public.notification_templates (production_step_id) where production_step_id is not null;

-- ── 2. Trigger `notification_templates_guard` — plafond SOUS VERROU,
-- immuabilite event_name/channel, horodatage/auteur ─────────────────────────
-- Une SEULE fonction, PAS de fonction security definer dediee (a la
-- difference de production_steps, qui doit affecter une `position`) : un
-- trigger BEFORE INSERT OR UPDATE s applique QUEL QUE SOIT le chemin
-- d ecriture (RPC futur ou, comme ici, un INSERT/UPDATE PostgREST direct
-- garde par la RLS), contrairement a une garde portee par une seule fonction
-- `api_*` qu un appel PostgREST direct contournerait.
create or replace function public.notification_templates_guard()
returns trigger
language plpgsql
as $$
declare
  v_count integer;
begin
  if tg_op = 'INSERT' then
    -- Verrou consultatif PAR TENANT (meme patron que
    -- api_create_production_step, hashtextextended) : deux creations
    -- concurrentes sur le MEME tenant ne se chevauchent jamais, ce qui rend
    -- le plafond de 100 fiable sans routine de reconciliation.
    perform pg_advisory_xact_lock(hashtextextended('notification_templates:' || new.tenant_id::text, 0));

    select count(*) into v_count from public.notification_templates where tenant_id = new.tenant_id;
    if v_count >= 100 then
      raise exception 'notification_template.limit_reached: tenant % a deja 100 modeles de notification', new.tenant_id;
    end if;

    new.created_by := coalesce(new.created_by, auth.uid());
    new.created_at := coalesce(new.created_at, now());
    new.updated_by := auth.uid();
    new.updated_at := now();
    return new;
  end if;

  -- UPDATE : event_name/channel IMMUABLES (contrat, updateNotificationTemplate)
  -- — defense en profondeur EN BASE, la commande applicative
  -- (UpdateNotificationTemplateCommand) ne propose meme pas ces deux champs.
  if new.event_name is distinct from old.event_name or new.channel is distinct from old.channel then
    raise exception 'notification_template.immutable_field: event_name et channel ne sont pas modifiables apres creation';
  end if;

  -- created_at/created_by ne bougent JAMAIS apres creation (meme discipline
  -- que commercial_settings_track_purge_activation sur ses propres colonnes).
  new.created_at := old.created_at;
  new.created_by := old.created_by;
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

comment on function public.notification_templates_guard() is
  'E10.15a — BEFORE INSERT OR UPDATE sur notification_templates : plafond de 100 modeles/tenant sous verrou consultatif (INSERT), immuabilite de event_name/channel (UPDATE), created_at/created_by fixes a la creation, updated_at/updated_by rafraichis a chaque ecriture. S applique QUEL QUE SOIT le chemin d ecriture (RLS + trigger, pas une fonction security definer dediee).';

drop trigger if exists notification_templates_guard on public.notification_templates;
create trigger notification_templates_guard
  before insert or update on public.notification_templates
  for each row execute function public.notification_templates_guard();

-- ── 2bis. Trigger `notification_templates_assert_same_tenant` — DEFENSE EN
-- PROFONDEUR : `production_step_id` doit appartenir au MEME tenant que le
-- modele (qa-review B2, MAJEUR). Meme patron EXACT que
-- `project_tag_links_assert_same_tenant` (20260902000100) et
-- `document_pdf_template_fields_assert_same_tenant` (20260909030000) : un
-- `references ... on delete cascade` SEUL n empeche pas un tenant A de
-- pointer vers une etape du tenant B, et si ce tenant B supprime SON etape,
-- la ligne du tenant A serait DETRUITE PAR CASCADE — alors que le contrat
-- garantit qu il n existe PAS de DELETE sur `notification_templates`. Sans ce
-- trigger, un tenant tiers pouvait donc detruire indirectement une ligne
-- qui ne lui appartient pas, dans une table ou personne n a le droit de
-- DELETE par construction. Le SERVICE applicatif verifie deja la meme regle
-- AVANT d ecrire (`NotificationTemplatesRepository.stepBelongsToTenant`,
-- 422 propre) : ce trigger ferme le meme trou pour un appel PostgREST direct.
create or replace function public.notification_templates_assert_same_tenant()
returns trigger
language plpgsql
as $$
declare
  v_step_tenant uuid;
begin
  if new.production_step_id is null then
    return new;
  end if;

  select tenant_id into v_step_tenant from public.production_steps where id = new.production_step_id;

  if v_step_tenant is null or v_step_tenant <> new.tenant_id then
    raise exception
      'notification_templates_assert_same_tenant: le modele (tenant %) et l etape de production (%) doivent appartenir au meme tenant',
      new.tenant_id, new.production_step_id;
  end if;

  return new;
end;
$$;

comment on function public.notification_templates_assert_same_tenant() is
  'E10.15a (qa-review B2) — refuse EN BASE un production_step_id qui n appartient pas au MEME tenant que le modele. Meme patron que project_tag_links_assert_same_tenant/document_pdf_template_fields_assert_same_tenant : sans cette garde, la FK on delete cascade laissait un tenant tiers detruire indirectement une ligne notification_templates qui ne lui appartient pas, alors que cette table n a AUCUN DELETE applicatif.';

drop trigger if exists notification_templates_same_tenant on public.notification_templates;
create trigger notification_templates_same_tenant
  before insert or update on public.notification_templates
  for each row execute function public.notification_templates_assert_same_tenant();

-- ── 3. RLS — lecture ouverte au tenant, ecriture gardee EN BASE par
-- can_manage_notifications, AUCUN DELETE (contrat : pas de suppression) ─────
alter table public.notification_templates enable row level security;

drop policy if exists "notification_templates_select" on public.notification_templates;
create policy "notification_templates_select" on public.notification_templates for select using (
  is_super_admin()
  or tenant_id in (select public.current_user_tenant_ids())
);

-- Deux policies distinctes (INSERT/UPDATE), PAS `for all` : sans policy pour
-- DELETE et sans policy `for all`, un DELETE est refuse PAR DEFAUT sous RLS
-- active — c est la garde EN BASE de « pas de DELETE de modele » (contrat),
-- pas seulement l absence d un endpoint pratique.
drop policy if exists "notification_templates_insert" on public.notification_templates;
create policy "notification_templates_insert" on public.notification_templates for insert with check (
  is_super_admin()
  or public.user_has_capability(tenant_id, 'can_manage_notifications')
);

drop policy if exists "notification_templates_update" on public.notification_templates;
create policy "notification_templates_update" on public.notification_templates for update using (
  is_super_admin()
  or public.user_has_capability(tenant_id, 'can_manage_notifications')
) with check (
  is_super_admin()
  or public.user_has_capability(tenant_id, 'can_manage_notifications')
);

-- ── 4. `commercial_settings` gagne les trois reglages de notification
-- (contrat §8.23 §2) ─────────────────────────────────────────────────────────
alter table public.commercial_settings
  add column if not exists notification_retention_days int not null default 90,
  add column if not exists notification_sms_enabled     boolean not null default false,
  add column if not exists notification_sms_daily_cap   int not null default 200;

alter table public.commercial_settings
  drop constraint if exists commercial_settings_notification_retention_days_range;
alter table public.commercial_settings
  add constraint commercial_settings_notification_retention_days_range
    check (notification_retention_days between 7 and 730);

alter table public.commercial_settings
  drop constraint if exists commercial_settings_notification_sms_daily_cap_range;
alter table public.commercial_settings
  add constraint commercial_settings_notification_sms_daily_cap_range
    check (notification_sms_daily_cap between 0 and 10000);

comment on column public.commercial_settings.notification_retention_days is
  'E10.15a — duree de conservation du journal de notifications (notification_logs, posee par E10.15c), en jours glissants. DEFAUT 90 JOURS : valeur PROPOSEE par le contrat, reserve RGPD (a) NON TRANCHEE par Arnaud a ce jour (docs/api/CONVENTIONS.md §8.23 §9) -- ce lot implemente le defaut ecrit au contrat, il ne tranche pas la reserve. Reglable de 7 a 730 jours par tenant. PAS DE null : aucune conservation illimitee sur ce journal.';
comment on column public.commercial_settings.notification_sms_enabled is
  'E10.15a — canal SMS arme ou a l arret POUR CET ESPACE. false par defaut (meme doctrine que order_file_purge_enabled) : le SMS coute de l argent a chaque message. A l arret, un modele sms peut etre ecrit/previsualise mais aucun message n est mis en file (mecanisme pose par E10.15c).';
comment on column public.commercial_settings.notification_sms_daily_cap is
  'E10.15a — plafond de SMS par espace et par jour (fenetre glissante de 24h, mecanisme de reclamation pose par E10.15c/e). 200 par defaut. 0 bloque tout envoi SMS SANS desarmer le canal.';

-- qa-review E10.22d (round 1/2, B1/M3) : re-etablir le grant colonne-par-
-- colonne en INCLUANT les trois colonnes neuves, meme discipline que
-- `20260911000000` -- un simple GRANT additif suffirait, mais REVOKE puis
-- GRANT explicite du jeu COMPLET evite toute divergence silencieuse entre ce
-- que la table autorise et ce que cette migration documente.
revoke insert, update on public.commercial_settings from authenticated, anon;
grant insert (tenant_id, default_validity_days, order_file_purge_enabled,
              notification_retention_days, notification_sms_enabled, notification_sms_daily_cap),
      update (default_validity_days, order_file_purge_enabled,
              notification_retention_days, notification_sms_enabled, notification_sms_daily_cap)
  on public.commercial_settings to authenticated;

-- ── 5. Trigger `commercial_settings_guard_notification_fields` — REFUS AU
-- CHAMP (contrat §8.23 §2), EN BASE, en defense en profondeur du controle
-- deja pose par CommercialSettingsService.assertCanManageNotificationFields()
-- ────────────────────────────────────────────────────────────────────────────
-- Cohabite avec commercial_settings_set_updated_at (BEFORE UPDATE) et
-- commercial_settings_track_purge_activation (BEFORE INSERT OR UPDATE,
-- 20260911000000) : trois triggers distincts sur des colonnes disjointes,
-- executes par ordre alphabetique de nom (guard_notification_fields <
-- set_updated_at < track_purge_activation), sans effet de bord entre eux.
create or replace function public.commercial_settings_guard_notification_fields()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    -- A l INSERT, seul un ecart par rapport au DEFAUT trahit une intention
    -- d ecrire les reglages de notification (l INSERT implicite de
    -- api_get_commercial_settings, security definer, n en fournit aucun et
    -- n est donc jamais concerne).
    if (
      new.notification_retention_days is distinct from 90
      or new.notification_sms_enabled is distinct from false
      or new.notification_sms_daily_cap is distinct from 200
    ) and not (
      is_super_admin() or public.user_has_capability(new.tenant_id, 'can_manage_notifications')
    ) then
      raise exception 'permission_denied: can_manage_notifications required for notification settings';
    end if;
    return new;
  end if;

  if (
    new.notification_retention_days is distinct from old.notification_retention_days
    or new.notification_sms_enabled is distinct from old.notification_sms_enabled
    or new.notification_sms_daily_cap is distinct from old.notification_sms_daily_cap
  ) and not (
    is_super_admin() or public.user_has_capability(new.tenant_id, 'can_manage_notifications')
  ) then
    raise exception 'permission_denied: can_manage_notifications required for notification settings';
  end if;
  return new;
end;
$$;

comment on function public.commercial_settings_guard_notification_fields() is
  'E10.15a — refuse toute ecriture des trois champs de notification (notification_retention_days/notification_sms_enabled/notification_sms_daily_cap) par un acteur depourvu de can_manage_notifications, MEME s il porte can_manage_pricing (droit MINIMAL de updateCommercialSettings). Defense en profondeur EN BASE du controle deja pose par CommercialSettingsService.assertCanManageNotificationFields() -- contrat §8.23 §2, "un droit dedie, refuse au champ pres, est le chemin".';

drop trigger if exists commercial_settings_guard_notification_fields on public.commercial_settings;
create trigger commercial_settings_guard_notification_fields
  before insert or update on public.commercial_settings
  for each row execute function public.commercial_settings_guard_notification_fields();

notify pgrst, 'reload schema';

-- ============================================================================
-- REVERSIBILITE — le CLI Supabase ne gere pas de bloc `down`. SQL de retrait,
-- a jouer tel quel dans une migration inverse si la story est annulee.
--
--   drop trigger if exists commercial_settings_guard_notification_fields on public.commercial_settings;
--   drop function if exists public.commercial_settings_guard_notification_fields();
--
--   revoke insert, update on public.commercial_settings from authenticated, anon;
--   grant insert (tenant_id, default_validity_days, order_file_purge_enabled),
--         update (default_validity_days, order_file_purge_enabled)
--     on public.commercial_settings to authenticated;
--
--   alter table public.commercial_settings
--     drop constraint if exists commercial_settings_notification_sms_daily_cap_range,
--     drop constraint if exists commercial_settings_notification_retention_days_range,
--     drop column if exists notification_sms_daily_cap,
--     drop column if exists notification_sms_enabled,
--     drop column if exists notification_retention_days;
--
--   drop policy if exists "notification_templates_update" on public.notification_templates;
--   drop policy if exists "notification_templates_insert" on public.notification_templates;
--   drop policy if exists "notification_templates_select" on public.notification_templates;
--   drop trigger if exists notification_templates_same_tenant on public.notification_templates;
--   drop function if exists public.notification_templates_assert_same_tenant();
--   drop trigger if exists notification_templates_guard on public.notification_templates;
--   drop function if exists public.notification_templates_guard();
--   drop table if exists public.notification_templates;
--
--   notify pgrst, 'reload schema';
-- ============================================================================
