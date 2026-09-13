-- ============================================================================
-- Sprint 5 Gestion commerciale — story E10.18c : « la ressource, la file, LE
-- CHEMIN DE LECTURE et le CSV » — troisieme et plus gros lot de l export
-- comptable des commandes (E10.18).
-- Contrat : docs/api/CONVENTIONS.md §8.24 (cadrage complet, commit bc4b8333),
-- points 3/4/5/6/8 (ligne E10.18c du tableau). openapi/magrit-core.v1.yaml
-- decrit deja les trois operations (`listCommercialOrderExports`,
-- `requestCommercialOrderExport`, `getCommercialOrderExport`) — proprietes
-- exclusives de l architecte, NON touchees ici.
-- ----------------------------------------------------------------------------
-- CE QUE CE LOT FAIT, ET RIEN D AUTRE :
--   1. La table `commercial_order_exports` (registre des demandes ET file
--      d execution, meme precedent qu `outbox_events`/`notification_logs`),
--      son trigger d immuabilite, sa RLS (lecture SEULE, testee) ;
--   2. `public.api_request_order_export(...)` — creation, security definer,
--      grantee au SEUL `authenticated` (calque sur
--      `api_create_document_pdf_template`) ;
--   3. `public.api_claim_order_exports(...)` — reclamation atomique,
--      COPIE CONFORME du patron `api_claim_notification_messages` ;
--   4. `public.api_read_order_export_rows(p_export_id, p_after, p_limit)` —
--      DESCENDUE du lot (b) ICI (CINQUIEME CORRECTION du cadrage, 2026-09-12) :
--      elle resout le tenant DEPUIS LA LIGNE D EXPORT, jamais d un parametre.
--      C EST ICI, ET SEULEMENT ICI, QUE L ISOLATION DE TENANT SE PROUVE
--      (le lot (b) ne pouvait pas : rien ne lisait).
--   5. Le bucket Storage prive `order_exports` (aucune policy
--      `storage.objects`, meme patron que `document_pdf_templates`) ;
--   6. La purge de retention 7 jours, EN DEUX ETAGES (arbitrage architecte,
--      qa-review round 3) : `public.api_claim_order_exports_for_purge()` —
--      RECLAME et MARQUE (`ready`/`expired` -> `expired`, transactionnel,
--      SQL pur, plafonnee a TROIS reclamations par `purge_attempts`) ET REND
--      les chemins de stockage des fichiers dont l objet N EST PAS ENCORE
--      confirme retire ; `public.api_confirm_order_export_files_purged()`
--      efface `storage_path` UNIQUEMENT pour les chemins CONFIRMES retires
--      cote Storage (jamais tout un lot en bloc — corrige qa-review round 3,
--      le filtrage sur `data` est une APPROXIMATION, jamais une preuve) ;
--      PUIS `public.api_claim_orphan_order_export_objects()` — SOLUTION
--      PORTEUSE, pas un complement (section 9), balayage independant du
--      bucket qui rattrape TOUT ce que le premier etage n a pas confirme,
--      y compris une fois `purge_attempts` epuise. C EST L EDGE FUNCTION
--      `magrit-order-file-purge` (E10.22b, ETENDUE ICI, PAS une troisieme
--      Edge Function) qui retire REELLEMENT les objets par lot,
--      best-effort, sur son declencheur QUOTIDIEN DEJA EN PLACE. Regle
--      opposable (qa-review round 1 d E10.18c, point 3(e) du contrat) :
--      une purge de LIGNES se fait en SQL direct, une purge d OBJETS DE
--      STOCKAGE passe par l API Storage, donc par une Edge Function — voir
--      sections 8 et 9 ci-dessous pour le detail complet ;
--   7. La planification DIFFEREE du declencheur `pg_cron`/`pg_net` de la
--      future Edge Function `magrit-order-export-runner` (secrets Vault
--      inconnus a l ecriture de cette migration, meme motif que
--      `20260908000000`/`20260910000500`/`20260912000100`).
--
-- CE QUE CE LOT NE FAIT PAS : aucun rendu XLSX (E10.18d), aucun ecran
-- (E10.18e), aucun `net.http_post` de reveil immediat POSE PAR CETTE
-- MIGRATION (E10.18f, optionnel — la primitive existe deja, cf. point 7).
--
-- ----------------------------------------------------------------------------
-- ⚠️ POINT SIGNALE A L ARCHITECTE — TRANCHE LE 2026-09-13, APPLIQUE ICI.
-- `openapi/magrit-core.v1.yaml` (`OrderExportGranularity`) citait trois
-- colonnes que les vues du lot (b) (migration 20260912000400) NE
-- SELECTIONNAIENT PAS. Arbitrage : « Courriel interlocuteur » ENTRE dans les
-- deux vues par la migration ADDITIVE ci-dessous (section 1bis) — colonne
-- reelle (`customer_contacts.email`) sur un `left join` DEJA present, jointe
-- par cle primaire, aucun risque de multiplication de lignes (propriete
-- prouvee en (b), non retestee). « Date de livraison prevue » et « Origine
-- de la ligne » SORTENT DEFINITIVEMENT du contrat (aucun chemin d ecriture
-- pour la premiere, aucun usage comptable pour la seconde) : rien a faire
-- ici, `openapi/magrit-core.v1.yaml` ne les cite plus. Le catalogue de
-- colonnes de ce lot (`order-export-columns.ts`) est desormais ALIGNE, au
-- caractere pres, sur le catalogue narratif de l OpenAPI, qui est la SEULE
-- source d ordre (voir ce fichier pour le detail).
-- ----------------------------------------------------------------------------
-- PATRONS REPRIS A L IDENTIQUE (contrat, point 6 : « a lire avant d ecrire ») :
--   - table+trigger+RLS : notification_logs (20260912000100), MAIS delete
--     REFUSE (cette table n a pas de retention par DELETE, contrairement a
--     notification_logs — voir point 3(f)/(e) du contrat : la ligne SURVIT,
--     seul le fichier expire) ;
--   - api_claim_order_exports : COPIE CONFORME de
--     api_claim_notification_messages (for update skip locked, incrément
--     des tentatives A LA RECLAMATION) ;
--   - api_request_order_export : calque sur
--     api_create_document_pdf_template (security definer, grant a
--     `authenticated`, verification de capability et de plafond SOUS
--     VERROU implicite du `select ... for update`? — non necessaire ici,
--     voir commentaire sur la fonction) ;
--   - bucket prive : document_pdf_templates (20260909020000) ;
--   - purge de LIGNES en SQL direct : purge_expired_notification_logs
--     (20260912000100) — NE VAUT PLUS pour la destruction de l OBJET Storage
--     de ce lot, voir section 8 ;
--   - purge D OBJETS DE STOCKAGE : magrit-order-file-purge / E10.22b
--     (`src/adapters/supabase/order-file-purge-repository.ts:203`,
--     `storage.from(BUCKET).remove(paths)`), c est LUI le bon precedent pour
--     la section 8, PAS `purge_expired_notification_logs` ;
--   - balayage d objets orphelins : `api_claim_orphan_order_file_objects`
--     (E10.22c, `20260910000600`), REPRIS section 9 en le SIMPLIFIANT (voir
--     cette section pour le detail) — PORTEUR ici (round 3), pas un
--     complement, contrairement a son role d appoint sur
--     `commercial_order_files`.
-- ============================================================================

-- ── 1bis. Migration ADDITIVE — colonne « Courriel interlocuteur » ───────────
-- Arbitrage architecte du 2026-09-13 (qa-review round 1 d E10.18c) : le
-- contrat (`OrderExportGranularity`) place cette colonne EN RANG 9 DU
-- FICHIER FINAL, immediatement apres « Interlocuteur » — mais l ORDRE DE
-- SORTIE DE LA VUE N EST PAS l ordre du fichier : `create or replace view`
-- REFUSE de renommer/deplacer une colonne EXISTANTE (Postgres, SQLSTATE
-- 42P16 -- teste EN EXECUTION contre Supabase local, confirme), il ne peut
-- qu EN AJOUTER a LA FIN. La colonne est donc AJOUTEE EN DERNIERE POSITION
-- du `select`, et sa place au RANG 9 du fichier est reconstruite par
-- `order-export-columns.ts`, qui lit ses colonnes PAR NOM (jamais par
-- position) -- l ordre physique de sortie de la vue n a JAMAIS ete un
-- contrat, seul le nom des colonnes l est.
--
-- (b) est CLOS et REVU : on n y touche pas, on ETEND ses deux vues ici, par
-- un `create or replace view` qui ajoute UNE SEULE colonne sur un
-- `left join` DEJA PRESENT (`cc.id = o.customer_contact_id`, jointure par
-- CLE PRIMAIRE) — aucun risque de multiplication de lignes, la propriete est
-- deja prouvee en (b) (test SQL de ce lot, scenario 5, ne la reteste pas :
-- rejouer une preuve deja faite n ajoute rien). Motif produit : exporter le
-- nom d un interlocuteur SANS moyen de le joindre est un demi-renseignement
-- — un service comptable qui relance un impaye a besoin de l adresse.
create or replace view private.commercial_order_export_headers as
select
  o.tenant_id                as tenant_id,
  o.id                       as order_id,

  o.number                   as order_number,
  q.number                   as quote_number,
  o.created_at               as order_created_at,
  c.type                     as customer_type,
  case
    when c.type = 'company' then c.company_name
    else btrim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, ''))
  end                        as customer_name,
  c.siret                    as customer_siret,
  c.vat_number               as customer_vat_number,
  case
    when cc.id is not null
      then btrim(coalesce(cc.first_name, '') || ' ' || coalesce(cc.last_name, ''))
    else null
  end                        as customer_contact_name,
  o.status                   as order_status,
  ps.label                   as production_step_label,

  o.lines_subtotal           as lines_subtotal,
  o.global_discount          as global_discount,
  o.effective_discount_rate  as effective_discount_rate,
  o.net_total                as net_total,
  o.vat_rate                 as vat_rate,
  o.vat_regime               as vat_regime,
  o.vat_amount               as vat_amount,
  o.total_incl_tax           as total_incl_tax,

  -- AJOUTEE EN DERNIERE POSITION (E10.18c, migration additive) — SEULE
  -- position que `create or replace view` autorise pour une colonne
  -- nouvelle (voir avertissement en tete de section). Meme jointure `cc`
  -- que `customer_contact_name` ci-dessus, colonne REELLE et NON NULLE de
  -- `customer_contacts` (contrainte deja en place, E10.4). Sa place au RANG
  -- 9 du FICHIER est reconstruite par `order-export-columns.ts`.
  cc.email                   as customer_contact_email
from public.commercial_orders o
join public.customers c
  on c.id = o.customer_id
join public.commercial_quotes q
  on q.id = o.quote_id
left join public.customer_contacts cc
  on cc.id = o.customer_contact_id
left join public.production_steps ps
  on ps.id = o.current_production_step_id;

comment on view private.commercial_order_export_headers is
  'E10.18b/E10.18c — jeu de donnees ENTETE (une ligne par commande) de l export comptable, catalogue de colonnes FIGE (openapi/magrit-core.v1.yaml, OrderExportGranularity, SEULE source d ordre -- l ordre PHYSIQUE de sortie de cette vue n en fait PAS partie, create or replace view impose customer_contact_email en DERNIERE position). Schema `private`, NON expose par PostgREST. `customer_contact_email` AJOUTEE par migration additive E10.18c sur le left join deja present vers customer_contacts, cle primaire, aucun risque de multiplication. `customer_type`/`vat_regime`/`order_status` sortent BRUTS : la traduction est a la charge du generateur de cellule (c)/(d), jamais de cette vue. Precedent : private.legacy_shop_customer_migration_plan.';

revoke all on private.commercial_order_export_headers from public, anon, authenticated;

create or replace view private.commercial_order_export_lines as
select
  o.tenant_id                as tenant_id,
  o.id                       as order_id,
  l.id                       as line_id,

  o.number                   as order_number,
  q.number                   as quote_number,
  o.created_at               as order_created_at,
  c.type                     as customer_type,
  case
    when c.type = 'company' then c.company_name
    else btrim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, ''))
  end                        as customer_name,
  c.siret                    as customer_siret,
  c.vat_number               as customer_vat_number,
  case
    when cc.id is not null
      then btrim(coalesce(cc.first_name, '') || ' ' || coalesce(cc.last_name, ''))
    else null
  end                        as customer_contact_name,
  o.status                   as order_status,
  ps.label                   as production_step_label,

  l.position                          as line_position,
  l.label                             as line_label,
  l.quantity                          as quantity,
  l.customer_price                    as bracket_amount_excl_tax,
  l.discount_rate                     as discount_rate,
  round(l.sale_price / l.quantity, 4) as unit_price_indicative,
  l.sale_price                        as sale_price,

  -- AJOUTEE EN DERNIERE POSITION — voir commentaire jumeau ci-dessus sur
  -- `_headers` (meme contrainte `create or replace view`, meme motif).
  cc.email                             as customer_contact_email
from public.commercial_order_lines l
join public.commercial_orders o
  on o.id = l.order_id
join public.customers c
  on c.id = o.customer_id
join public.commercial_quotes q
  on q.id = o.quote_id
left join public.customer_contacts cc
  on cc.id = o.customer_contact_id
left join public.production_steps ps
  on ps.id = o.current_production_step_id;

comment on view private.commercial_order_export_lines is
  'E10.18b/E10.18c — jeu de donnees LIGNES (une ligne par ligne de commande) de l export comptable, catalogue de colonnes FIGE (openapi/magrit-core.v1.yaml, OrderExportGranularity, SEULE source d ordre -- l ordre PHYSIQUE de sortie de cette vue n en fait PAS partie, create or replace view impose customer_contact_email en DERNIERE position). AUCUN total d entete reconduit ici. `bracket_amount_excl_tax` (ex-`customer_price`) est un TOTAL pour `quantity`, pas un prix unitaire. `customer_contact_email` AJOUTEE par migration additive E10.18c, meme discipline que `_headers` ci-dessus. `customer_type`/`order_status` sortent BRUTS : la traduction est a la charge du generateur de cellule (c)/(d), jamais de cette vue. Schema `private`, NON expose par PostgREST. Precedent : private.legacy_shop_customer_migration_plan.';

revoke all on private.commercial_order_export_lines from public, anon, authenticated;

notify pgrst, 'reload schema';

-- ── 1. Table `commercial_order_exports` ─────────────────────────────────────
create table if not exists public.commercial_order_exports (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  status              text not null default 'pending'
                        check (status in ('pending', 'running', 'ready', 'failed', 'expired')),
  format              text not null check (format in ('xlsx', 'csv')),
  granularity         text not null check (granularity in ('order', 'line')),
  -- Filtres ENREGISTRES A LA DEMANDE, republies A L IDENTIQUE (contrat,
  -- `OrderExport.filters`) : memes noms/types que `OrderExportFilters`
  -- (`customer_id`, `quote_id`, `status`, `current_production_step_id`,
  -- `created_from`, `created_to`), JAMAIS de bornes deja resolues en UTC —
  -- la conversion Europe/Paris -> UTC est refaite PAR
  -- `api_read_order_export_rows` a chaque lecture (voir cette fonction,
  -- section 4), en SQL natif (`at time zone`), PAS en TypeScript : la
  -- fonction n a que trois parametres (p_export_id/p_after/p_limit,
  -- contrat point 4) et ne peut donc pas recevoir de bornes deja resolues
  -- sans reintroduire un parametre de filtre — exactement ce que le contrat
  -- interdit. Postgres porte NATIVEMENT le meme referentiel IANA tzdata
  -- qu `Intl.DateTimeFormat` cote TypeScript (`src/kernel/clock/timezone.ts`) ;
  -- AUCUNE validation de calendrier n est refaite ici ni dans la fonction de
  -- lecture (elle a deja eu lieu cote route, via `civilDateToUtc`, avant
  -- l ecriture de cette ligne — seule une CONVERSION est effectuee, sur une
  -- valeur DEJA garantie valide).
  filters             jsonb not null default '{}'::jsonb,
  -- `1` = la forme decrite par `OrderExportGranularity` a la date de ce lot.
  layout_version      integer not null default 1,
  requested_by        uuid references auth.users(id) on delete set null,
  requested_by_label  text,
  requested_at        timestamptz not null default now(),
  started_at          timestamptz,
  completed_at        timestamptz,
  row_count           bigint check (row_count >= 0),
  storage_path        text,
  file_name           text,
  byte_size           bigint check (byte_size >= 1),
  sha256              text check (sha256 ~ '^[0-9a-f]{64}$'),
  content_type        text check (content_type in (
                        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                        'text/csv'
                      )),
  expires_at          timestamptz,
  attempts            integer not null default 0 check (attempts >= 0),
  next_attempt_at     timestamptz not null default now(),
  error_code          text,
  error_detail        text,
  -- qa-review round 3 — DISTINCT d `attempts` (qui compte les RECLAMATIONS
  -- DE GENERATION, `api_claim_order_exports`). Compte les RECLAMATIONS DE
  -- PURGE (`api_claim_order_exports_for_purge`), incremente A CHAQUE
  -- RECLAMATION (ready OU expired), jamais au verdict. Plafond a TROIS,
  -- ALIGNE sur `attempts` (meme motif : un echec de retrait Storage est
  -- presque toujours DETERMINISTE). Epuise, la ligne N EST PLUS RECLAMEE
  -- par cette fonction (voir son filtre) MAIS RESTE `expired` avec
  -- `storage_path` NON NUL -- c est CET ETAT, lisible en une requete, qui
  -- signale un ménage a bout de tentatives, jamais un nouveau statut ni un
  -- changement de contrat (`OrderExport.status` reste sur le cycle de vie
  -- de la DEMANDE, jamais la sante du menage). Le filet de dernier ressort
  -- est le balayage d objets orphelins ci-dessous (section 9), qui ne
  -- passe PAS par cette colonne.
  purge_attempts      integer not null default 0 check (purge_attempts >= 0)
);

comment on table public.commercial_order_exports is
  'E10.18c — registre ET file d execution des exports comptables de commandes (contrat §8.24). Filtres et mise en page IMMUABLES apres insertion (trigger commercial_order_exports_reject_mutation) ; seules les colonnes de suivi evoluent. AUCUNE policy RLS d ecriture : une seule voie, api_request_order_export (security definer). NE SE PURGE JAMAIS PAR DELETE (contrairement a notification_logs) : la ligne est la seule preuve durable d un acces massif au chiffre d affaires ; seul le FICHIER expire. api_claim_order_exports_for_purge() marque status=expired (transition a sens unique) et incremente purge_attempts A CHAQUE reclamation (plafond 3) ; storage_path reste NON NUL tant que magrit-order-file-purge n a pas CONFIRME le retrait de l objet (api_confirm_order_export_files_purged, UNIQUEMENT sur les chemins confirmes -- round 3) -- une ligne expired avec storage_path non nul est RE-RECLAMEE au tour suivant jusqu a epuisement de purge_attempts, puis rattrapee par le balayage d objets orphelins (api_claim_orphan_order_export_objects, section 9, SOLUTION PORTEUSE). La ligne survit sans limite.';
comment on column public.commercial_order_exports.filters is
  'OrderExportFilters ENREGISTRE tel quel (memes noms/types que les parametres de listCommercialOrders) : customer_id, quote_id, status, current_production_step_id, created_from (YYYY-MM-DD), created_to (YYYY-MM-DD). Republie A L IDENTIQUE par getCommercialOrderExport/listCommercialOrderExports (additionalProperties:false cote contrat -> JAMAIS de cle interne ajoutee ici).';
comment on column public.commercial_order_exports.requested_by is
  'Membre demandeur. on delete set null : la ligne survit a la suppression du compte (meme modele que OrderFile/OrderDocument). C EST AUSSI LA CLE DU TELECHARGEMENT (download_url reserve a ce demandeur, cote application).';
comment on column public.commercial_order_exports.attempts is
  'Nombre de RECLAMATIONS par le generateur, incremente A LA RECLAMATION (api_claim_order_exports), jamais au verdict. Plafonne a TROIS cote contrat (echec de generation presque toujours DETERMINISTE, contrairement a un echec d envoi de notification).';
comment on column public.commercial_order_exports.expires_at is
  'Instant de DESTRUCTION du fichier : completed_at + 7 jours, NON CONFIGURABLE. `null` tant que la demande n a pas abouti. Passe cette echeance, api_claim_order_exports_for_purge() marque la ligne expired (transition a SENS UNIQUE, jamais un echec) ET REND son storage_path (tant qu il n est pas encore null), que magrit-order-file-purge (Edge Function, E10.22b ETENDUE) utilise pour retirer REELLEMENT l objet Storage, par lot, best-effort. UNE LIGNE expired DONT LE RETRAIT A ECHOUE EST RE-RECLAMEE AU TOUR SUIVANT (storage_path reste non nul jusqu a confirmation par api_confirm_order_export_files_purged — corrige qa-review round 2, ce n etait pas le cas dans la version precedente).';

create index if not exists commercial_order_exports_tenant_requested_idx
  on public.commercial_order_exports (tenant_id, requested_at desc);

-- Reclamation : ne cible que les demandes `pending` dues.
create index if not exists commercial_order_exports_pending_due_idx
  on public.commercial_order_exports (next_attempt_at)
  where status = 'pending';

-- Plafond de trois demandes non terminees par acteur (422
-- `order_export.pending_limit_reached`, verifie par api_request_order_export
-- via un COUNT — cet index le rend rapide, il ne remplace pas le controle).
create index if not exists commercial_order_exports_requester_open_idx
  on public.commercial_order_exports (tenant_id, requested_by)
  where status in ('pending', 'running');

-- Purge : couvre les DEUX statuts que le predicat de reclamation parcourt
-- (`status in ('ready','expired')`, elargi au round 2 pour que la reprise
-- d un retrait echoue soit possible). Un index reste sur `ready` seul
-- laisserait les lignes `expired` en attente de confirmation balayees SANS
-- index — c est precisement la population que la reprise fait vivre, donc
-- celle qui grossit quand le Storage va mal (qa-review round 4, R2).
create index if not exists commercial_order_exports_expiring_idx
  on public.commercial_order_exports (expires_at)
  where status in ('ready', 'expired');

-- Un chemin de stockage ne designe qu UNE ligne, et c est desormais garanti
-- EN BASE et non plus deduit (qa-review round 4, R3). Le raisonnement qui le
-- rendait vrai — `<tenant_id>/<export_id>.<ext>` avec un uuid neuf a chaque
-- demande, depose en `upsert:false` — restait une propriete du code : rien
-- n empechait un futur chemin construit autrement de faire lever
-- `more than one row returned by a subquery` a la sous-requete scalaire du
-- balayage d objets orphelins (section 9), en plein menage nocturne.
create unique index if not exists commercial_order_exports_storage_path_uidx
  on public.commercial_order_exports (storage_path)
  where storage_path is not null;

-- ── 2. Immuabilite : trigger, PAS revoke, ET AUCUN DELETE ───────────────────
-- Ecart deliberer et documente avec notification_logs_reject_mutation()
-- (dont le DELETE est TOUJOURS autorise, pour sa propre retention RGPD) :
-- cette table n a PAS de retention par DELETE (point 3(f) du contrat, « la
-- ligne survit sans limite ») -- le DELETE est donc REFUSE ici, meme
-- discipline qu `outbox_events_reject_mutation()`.
create or replace function public.commercial_order_exports_reject_mutation()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception using
      errcode = '42501',
      message = 'commercial_order_exports_immutable: suppression interdite — ce registre est la seule preuve durable d un acces massif au chiffre d affaires (contrat §8.24 point 3(f)), il n expire jamais par DELETE.';
  end if;

  -- Colonnes de DEFINITION de l export : figees des l insertion. Meme
  -- exception que notification_logs pour `requested_by` (on delete set
  -- null -> transition non-nul -> null TOLEREE, produite par le SYSTEME,
  -- jamais par l application).
  if new.id is distinct from old.id
     or new.tenant_id is distinct from old.tenant_id
     or new.format is distinct from old.format
     or new.granularity is distinct from old.granularity
     or new.filters is distinct from old.filters
     or new.layout_version is distinct from old.layout_version
     or (
       new.requested_by is distinct from old.requested_by
       and not (old.requested_by is not null and new.requested_by is null)
     )
     or new.requested_by_label is distinct from old.requested_by_label
     or new.requested_at is distinct from old.requested_at then
    raise exception using
      errcode = '42501',
      message = 'commercial_order_exports_immutable: seules status/started_at/completed_at/row_count/storage_path/file_name/byte_size/sha256/content_type/expires_at/attempts/next_attempt_at/error_code/error_detail/purge_attempts sont modifiables (requested_by : seule la transition non-nul -> null, via cascade FK, est toleree).';
  end if;

  -- Machine a etats du statut (contrat, `OrderExportStatus`) : `expired` est
  -- un puits (aucune sortie), `ready`/`failed` sont terminaux SAUF la seule
  -- transition `ready` -> `expired`, et on ne revient JAMAIS a `pending`
  -- depuis un statut terminal (une demande deja jugee ne redevient pas une
  -- demande en file — un rejeu explicite cree une AUTRE ligne).
  if old.status = 'expired' and new.status is distinct from 'expired' then
    raise exception using
      errcode = '42501',
      message = 'commercial_order_exports_status_terminal: un export expire ne change plus de statut.';
  end if;
  if old.status = 'failed' and new.status is distinct from 'failed' then
    raise exception using
      errcode = '42501',
      message = 'commercial_order_exports_status_terminal: un export failed ne change plus de statut.';
  end if;
  if old.status = 'ready' and new.status not in ('ready', 'expired') then
    raise exception using
      errcode = '42501',
      message = 'commercial_order_exports_status_terminal: un export ready ne peut plus que passer expired.';
  end if;
  if old.status in ('running') and new.status = 'pending' and new.attempts <= old.attempts then
    -- Un retour running -> pending est LEGITIME (echec retentable, meme
    -- discipline que notification_logs) MAIS doit toujours porter un
    -- attempts strictement croissant (deja garanti par api_claim_order_exports,
    -- controle ici en DEFENSE EN PROFONDEUR contre une ecriture directe).
    raise exception using
      errcode = '42501',
      message = 'commercial_order_exports_status_transition: un retour a pending doit porter attempts strictement croissant.';
  end if;

  return new;
end;
$$;

comment on function public.commercial_order_exports_reject_mutation() is
  'E10.18c — calque sur notification_logs_reject_mutation() pour les colonnes figees, MAIS DELETE TOUJOURS REFUSE (contrairement a notification_logs) : cette table n a pas de retention par DELETE. Impose en outre la machine a etats de OrderExportStatus (expired/failed/ready sont des puits, sauf ready->expired).';

drop trigger if exists commercial_order_exports_append_only on public.commercial_order_exports;
create trigger commercial_order_exports_append_only
  before update or delete on public.commercial_order_exports
  for each row execute function public.commercial_order_exports_reject_mutation();

-- ── 3. RLS — lecture GARDEE PAR CAPABILITY (pas juste le tenant) ────────────
-- Ecart avec la plupart des tables E10 (RLS = simple appartenance) : le
-- contrat exige `can_export_orders` sur LA LECTURE AUSSI (x-required-
-- capabilities sur les trois operations). La RLS applique la MEME garde que
-- le controle applicatif (`OrderExportsService.assertCanExportOrders`,
-- defense en profondeur : la RLS empeche un appel PostgREST direct qui
-- contournerait le service).
alter table public.commercial_order_exports enable row level security;

drop policy if exists "commercial_order_exports_select" on public.commercial_order_exports;
create policy "commercial_order_exports_select" on public.commercial_order_exports for select using (
  is_super_admin()
  or (
    -- TRACE (qa-review round 1, point moyen, NON corrige sur decision
    -- explicite) : `tenant_id in (select current_user_tenant_ids())` est
    -- REDONDANT avec `user_has_capability(tenant_id, ...)` ci-dessous, qui
    -- controle deja l appartenance au tenant avant de statuer sur la
    -- capability — retirer cette clause ne ferait tomber aucun test. CE N
    -- EST PAS UN TROU : c est une defense en profondeur LEGITIME (deux
    -- verifications independantes de la meme propriete), gardee telle
    -- quelle plutot que simplifiee.
    tenant_id in (select public.current_user_tenant_ids())
    and public.user_has_capability(tenant_id, 'can_export_orders')
  )
);

-- Aucune policy d ecriture : la SEULE creation applicative passe par
-- api_request_order_export (security definer, execute AS son proprietaire,
-- n a besoin d aucun grant table). Le service_role (runner) ecrit les
-- colonnes de suivi par un grant COLONNE, pas une policy (il bypasse RLS de
-- toute facon, comme tout service_role).
revoke all on table public.commercial_order_exports from public, anon, authenticated;
grant select on table public.commercial_order_exports to authenticated;

grant select on table public.commercial_order_exports to service_role;
grant update (
  status, started_at, completed_at, row_count, storage_path, file_name,
  byte_size, sha256, content_type, expires_at, attempts, next_attempt_at,
  error_code, error_detail, purge_attempts
) on table public.commercial_order_exports to service_role;

-- ── 4. Creation — api_request_order_export ──────────────────────────────────
-- Calque sur api_create_document_pdf_template (security definer, grant a
-- `authenticated`, capability verifiee A L INTERIEUR de la fonction —
-- DEFENSE EN PROFONDEUR : le service applicatif verifie deja
-- `can_export_orders` avant d appeler cette RPC, mais la fonction est
-- directement joignable par tout jeton `authenticated` via PostgREST, elle
-- doit donc se garder elle-meme). AUCUNE validation de calendrier ici :
-- `p_filters` est deja passe VALIDE par la route (created_from/created_to
-- verifies calendrier via civilDateToUtc AVANT l appel, contrat point 5
-- regle 7 — "RequestOrderExportCommand en herite sans une ligne de plus").
create or replace function public.api_request_order_export(
  p_tenant_id   uuid,
  p_format      text,
  p_granularity text,
  p_filters     jsonb
)
returns public.commercial_order_exports
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_label text;
  v_pending_count integer;
  v_row public.commercial_order_exports;
begin
  if v_actor is null then
    raise exception 'authentication_required';
  end if;
  if not (
    public.is_super_admin()
    or public.user_has_capability(p_tenant_id, 'can_export_orders')
  ) then
    raise exception 'permission_denied: can_export_orders required';
  end if;

  if p_format not in ('xlsx', 'csv') then
    raise exception 'api.validation_failed: format doit valoir xlsx ou csv';
  end if;
  if p_granularity not in ('order', 'line') then
    raise exception 'api.validation_failed: granularity doit valoir order ou line';
  end if;

  -- Plafond de trois demandes non terminees PAR ACTEUR (contrat : « la file
  -- est partagee, un membre qui enchaine les clics ne doit pas faire
  -- attendre tout l espace »). Pas de verrou explicite : une course rare
  -- entre deux clics du MEME acteur peut au pire laisser passer une
  -- quatrieme demande UNE fois, cout accepte (meme discipline que le
  -- plafond de 20 gabarits, qui verrouille par avisory lock — ici le cout
  -- d un depassement ponctuel est nul, contrairement a un nom duplique).
  select count(*) into v_pending_count
    from public.commercial_order_exports
   where tenant_id = p_tenant_id
     and requested_by = v_actor
     and status in ('pending', 'running');
  if v_pending_count >= 3 then
    raise exception 'order_export.pending_limit_reached: trois demandes non terminees deja en file pour cet acteur';
  end if;

  select email into v_actor_label from auth.users where id = v_actor;

  insert into public.commercial_order_exports (
    tenant_id, status, format, granularity, filters, layout_version,
    requested_by, requested_by_label, requested_at, attempts, next_attempt_at
  ) values (
    p_tenant_id, 'pending', p_format, p_granularity, coalesce(p_filters, '{}'::jsonb), 1,
    v_actor, v_actor_label, now(), 0, now()
  )
  returning * into v_row;

  return v_row;
end;
$$;

comment on function public.api_request_order_export(uuid, text, text, jsonb) is
  'E10.18c — POST /commercial-order-exports. Cree une demande pending, filtres et mise en page FIGES a l insertion. 422 order_export.pending_limit_reached au-dela de 3 demandes non terminees par acteur. security definer, grantee a authenticated SEUL (capability can_export_orders verifiee EN INTERNE, defense en profondeur).';

revoke all on function public.api_request_order_export(uuid, text, text, jsonb) from public, anon, service_role;
grant execute on function public.api_request_order_export(uuid, text, text, jsonb) to authenticated;

-- ── 5. Reclamation atomique du drain de generation ──────────────────────────
-- COPIE CONFORME du patron api_claim_notification_messages (E10.15c),
-- adaptee aux colonnes de commercial_order_exports. Rebut par fraicheur ->
-- status=failed SANS jamais avoir ete generee (une demande pending depuis
-- plus de p_max_age n a jamais ete prise par un runner en vie).
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
  'E10.18c — reclamation atomique du drain de generation (for update skip locked), copie conforme du patron api_claim_notification_messages. Passe status=running et incremente attempts A LA RECLAMATION (pas au verdict). Rebut (fraicheur depassee) -> status=failed sans jamais generer. service_role SEUL.';

revoke all on function public.api_claim_order_exports(integer, integer, interval) from public, anon, authenticated;
grant execute on function public.api_claim_order_exports(integer, integer, interval) to service_role;

-- ── 6. Lecture GARDEE des lignes — api_read_order_export_rows ───────────────
-- DESCENDUE du lot (b) ICI (contrat §8.24 point 4, CINQUIEME CORRECTION) :
-- signature EXACTEMENT (p_export_id, p_after, p_limit) — AUCUN parametre de
-- tenant, AUCUN parametre de filtre. Le tenant ET les filtres sont RESOLUS
-- DEPUIS LA LIGNE D EXPORT elle-meme : le runner ne peut donc PAS demander
-- les lignes d un autre espace, meme par erreur de programmation, le
-- parametre n existe meme pas.
--
-- CHEMIN D ACCES : cette fonction lit `private.commercial_order_export_headers`/
-- `_lines` (schema NON expose par PostgREST, migration 20260912000400) SANS
-- AUCUN GRANT — elle s execute avec les privileges de son PROPRIETAIRE
-- (`postgres`), jamais ceux de l appelant. Si un `from()` cote application
-- echoue sur ces vues, la reponse n est JAMAIS un `grant on schema private`
-- (cela detruirait la garde entiere d une ligne) : c est que l appel est au
-- mauvais endroit — le SEUL chemin est `rpc('api_read_order_export_rows', ...)`.
--
-- FILTRAGE : les vues du lot (b) n exposent QUE des colonnes DESTINEES AU
-- FICHIER (jamais customer_id/quote_id/current_production_step_id bruts) —
-- cette fonction rejoint donc `public.commercial_orders` PAR LA COLONNE
-- TECHNIQUE `order_id` (exposee par les deux vues, "reservee au futur
-- chemin de lecture", contrat point 4) pour appliquer les filtres
-- enregistres sur `commercial_order_exports.filters`, SANS jamais exposer
-- ces colonnes brutes dans la charge utile rendue (`to_jsonb(...) - 'order_id'
-- - 'tenant_id' [- 'line_id']`).
--
-- FUSEAU : Europe/Paris est INTERPRETE ICI, EN SQL NATIF (`at time zone`),
-- PAS recopie depuis le kernel TypeScript (impossible, deux runtimes
-- distincts) — voir avertissement en tete de fichier sur ce choix.
--
-- PAGINATION : par CLE (p_after, jsonb opaque cote appelant — le runner
-- transmet tel quel le `cursor` du dernier lot recu), jamais par offset :
-- le generateur ecrit au fil de l eau (contrat point 4, "pour que le
-- generateur ecrive au fil de l eau plutot que de charger cent mille lignes
-- dans un isolate").
create or replace function public.api_read_order_export_rows(
  p_export_id uuid,
  p_after     jsonb,
  p_limit     integer
)
returns table(cursor jsonb, payload jsonb)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_export public.commercial_order_exports;
  v_filters jsonb;
  v_customer_id uuid;
  v_quote_id uuid;
  v_step_id uuid;
  v_status text;
  v_created_from date;
  v_created_to date;
  v_after_created_at timestamptz;
  v_after_order_number text;
  v_after_line_position integer;
begin
  select * into v_export from public.commercial_order_exports where id = p_export_id;
  if not found then
    return;
  end if;

  v_filters := coalesce(v_export.filters, '{}'::jsonb);
  v_customer_id := nullif(v_filters->>'customer_id', '')::uuid;
  v_quote_id := nullif(v_filters->>'quote_id', '')::uuid;
  v_step_id := nullif(v_filters->>'current_production_step_id', '')::uuid;
  v_status := nullif(v_filters->>'status', '');
  v_created_from := nullif(v_filters->>'created_from', '')::date;
  v_created_to := nullif(v_filters->>'created_to', '')::date;

  if p_after is not null then
    v_after_created_at := (p_after->>'order_created_at')::timestamptz;
    v_after_order_number := p_after->>'order_number';
    v_after_line_position := nullif(p_after->>'line_position', '')::integer;
  end if;

  if v_export.granularity = 'order' then
    return query
    select
      jsonb_build_object('order_created_at', h.order_created_at, 'order_number', h.order_number) as cursor,
      -- Chaque `numeric` est explicitement caste en `::text` AVANT d entrer
      -- dans le jsonb (contrat §8.24 point 5, regle 1 : le SEUL point de
      -- conversion `string -> number` vit dans `toSpreadsheetNumber()`, cote
      -- generateur). `to_jsonb()` seul aurait produit un NOMBRE JSON natif
      -- (jsonb preserve la representation decimale ecrite, mais tout
      -- `JSON.parse` cote Deno la refond en `number` IEEE754 AVANT que le
      -- generateur ne la voie) : caster en texte ICI garantit que le
      -- generateur recoit toujours la CHAINE decimale, jamais un flottant
      -- deja arrondi par un intermediaire. `to_jsonb(timestamptz)` reste
      -- INCHANGE (chaine ISO avec decalage explicite, ex. `+00:00` — la
      -- forme que `toIsoTimestamp()` normalise deja).
      jsonb_build_object(
        'order_number', h.order_number,
        'quote_number', h.quote_number,
        'order_created_at', to_jsonb(h.order_created_at),
        'customer_type', h.customer_type,
        'customer_name', h.customer_name,
        'customer_siret', h.customer_siret,
        'customer_vat_number', h.customer_vat_number,
        'customer_contact_name', h.customer_contact_name,
        'customer_contact_email', h.customer_contact_email,
        'order_status', h.order_status,
        'production_step_label', h.production_step_label,
        'lines_subtotal', h.lines_subtotal::text,
        'global_discount', h.global_discount::text,
        'effective_discount_rate', h.effective_discount_rate::text,
        'net_total', h.net_total::text,
        'vat_rate', h.vat_rate::text,
        'vat_regime', h.vat_regime,
        'vat_amount', h.vat_amount::text,
        'total_incl_tax', h.total_incl_tax::text
      ) as payload
    from private.commercial_order_export_headers h
    join public.commercial_orders o on o.id = h.order_id
    where h.tenant_id = v_export.tenant_id
      and (v_customer_id is null or o.customer_id = v_customer_id)
      and (v_quote_id is null or o.quote_id = v_quote_id)
      and (v_step_id is null or o.current_production_step_id = v_step_id)
      and (v_status is null or h.order_status = v_status)
      and (v_created_from is null or h.order_created_at >= (v_created_from::timestamp at time zone 'Europe/Paris'))
      and (v_created_to is null or h.order_created_at < ((v_created_to + 1)::timestamp at time zone 'Europe/Paris'))
      and (
        p_after is null
        or (h.order_created_at, h.order_number) > (v_after_created_at, v_after_order_number)
      )
    order by h.order_created_at asc, h.order_number asc
    limit greatest(p_limit, 0);
  else
    return query
    select
      jsonb_build_object(
        'order_created_at', l.order_created_at,
        'order_number', l.order_number,
        'line_position', l.line_position
      ) as cursor,
      -- Meme discipline que ci-dessus : tout `numeric` est caste en `::text`
      -- avant d entrer dans le jsonb. `line_position`/`quantity` restent des
      -- ENTIERS jsonb natifs (aucune ambiguite de decimales sur un entier).
      jsonb_build_object(
        'order_number', l.order_number,
        'quote_number', l.quote_number,
        'order_created_at', to_jsonb(l.order_created_at),
        'customer_type', l.customer_type,
        'customer_name', l.customer_name,
        'customer_siret', l.customer_siret,
        'customer_vat_number', l.customer_vat_number,
        'customer_contact_name', l.customer_contact_name,
        'customer_contact_email', l.customer_contact_email,
        'order_status', l.order_status,
        'production_step_label', l.production_step_label,
        'line_position', l.line_position,
        'line_label', l.line_label,
        'quantity', l.quantity,
        'bracket_amount_excl_tax', l.bracket_amount_excl_tax::text,
        'discount_rate', l.discount_rate::text,
        'unit_price_indicative', l.unit_price_indicative::text,
        'sale_price', l.sale_price::text
      ) as payload
    from private.commercial_order_export_lines l
    join public.commercial_orders o on o.id = l.order_id
    where l.tenant_id = v_export.tenant_id
      and (v_customer_id is null or o.customer_id = v_customer_id)
      and (v_quote_id is null or o.quote_id = v_quote_id)
      and (v_step_id is null or o.current_production_step_id = v_step_id)
      and (v_status is null or l.order_status = v_status)
      and (v_created_from is null or l.order_created_at >= (v_created_from::timestamp at time zone 'Europe/Paris'))
      and (v_created_to is null or l.order_created_at < ((v_created_to + 1)::timestamp at time zone 'Europe/Paris'))
      and (
        p_after is null
        or (l.order_created_at, l.order_number, l.line_position) > (v_after_created_at, v_after_order_number, v_after_line_position)
      )
    order by l.order_created_at asc, l.order_number asc, l.line_position asc
    limit greatest(p_limit, 0);
  end if;
end;
$$;

comment on function public.api_read_order_export_rows(uuid, jsonb, integer) is
  'E10.18c — SEUL chemin de lecture des vues privees de l export (contrat §8.24 point 4/5). Resout le TENANT et les FILTRES depuis commercial_order_exports.id (p_export_id) — AUCUN parametre de tenant ni de filtre : le runner ne peut pas demander les lignes d un autre espace. Pagination par cle (p_after), fuseau Europe/Paris interprete en SQL natif. security definer, service_role SEUL, lit private.* SANS AUCUN GRANT (privileges du proprietaire).';

revoke all on function public.api_read_order_export_rows(uuid, jsonb, integer) from public, anon, authenticated;
grant execute on function public.api_read_order_export_rows(uuid, jsonb, integer) to service_role;

-- ── 7. Bucket Storage prive `order_exports` ─────────────────────────────────
-- Meme patron que `document_pdf_templates` (20260909020000) : AUCUNE policy
-- `storage.objects`, RLS de storage active par defaut chez Supabase -> rejet
-- implicite pour anon/authenticated, service_role bypass toujours RLS.
-- `file_size_limit` : 20 Mo — aucune mesure fournie par le cadrage pour ce
-- chiffre (contrairement au plafond de 50 000 LIGNES, MESURE), pose large
-- par rapport aux tailles observees sur le banc XLSX (50k lignes : 22 Mo EN
-- MEMOIRE avant compression ZIP, un .xlsx compresse est nettement plus
-- petit ; un CSV 50k lignes x ~200 octets est de l ordre du Mo) — a
-- REVISER si un tenant tres charge le heurte, sans consequence de securite.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'order_exports',
  'order_exports',
  false,
  20971520,
  array[
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv'
  ]::text[]
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ── 8. Purge de retention — 7 jours, RECLAMATION SQL + DESTRUCTION Storage ──
-- ARBITRAGE ARCHITECTE DU 2026-09-13 (qa-review round 1 d E10.18c),
-- CORRIGEANT DEUX AFFIRMATIONS FAUSSES de la version precedente de ce
-- commentaire et de cette fonction.
--
-- (1) `storage.protect_delete()` NE REJETTE PAS tout `DELETE` direct sur
-- `storage.objects` INCONDITIONNELLEMENT — c etait FAUX. La garde est
-- CONDITIONNELLE :
--
--   if coalesce(current_setting('storage.allow_delete_query', true), 'false')
--      != 'true' then raise exception '...';
--
-- Verifie par EXECUTION REELLE, dans les deux sens : sans le reglage, le
-- `DELETE` echoue (`ERROR: Direct deletion from storage tables is not
-- allowed`) ; avec `set local storage.allow_delete_query = 'true'` en tete
-- de transaction, le `DELETE` REUSSIT (`DELETE 0` sur une table vide, aucune
-- exception). Ce qui a ete prouve la premiere fois, c est le COMPORTEMENT
-- PAR DEFAUT, pas une impossibilite.
--
-- (2) On N EMPRUNTE PAS cette porte pour autant, et le motif est plus fort
-- qu une preference de style : supprimer la LIGNE de `storage.objects`
-- retire la METADONNEE, jamais l OBJET STOCKE lui-meme. Le fichier
-- deviendrait ORPHELIN — physiquement present, plus rien pour le tracer ni
-- le retrouver. Sur un fichier qui porte le chiffre d affaires complet et le
-- SIRET de tous les clients d un imprimeur, ce serait PIRE que de ne rien
-- purger : la retention serait tenue dans le registre et violee sur le
-- disque, c est-a-dire une promesse de protection des donnees qui aurait
-- l air remplie. Le VRAI obstacle a `DELETE` direct n est donc PAS une
-- impossibilite technique : c est que ce chemin ne detruit pas ce qu il
-- pretend detruire.
--
-- (3) Regle CORRIGEE et opposable : une purge de LIGNES se fait en SQL
-- direct ; une purge d OBJETS DE STOCKAGE passe par l API Storage, donc par
-- une Edge Function. Le bon precedent n etait PAS
-- `purge_expired_notification_logs()` (une purge de LIGNES) mais
-- `magrit-order-file-purge` (E10.22b, docs/api/CONVENTIONS.md §8.22) qui
-- DETRUIT DEJA des objets Storage sur planification QUOTIDIENNE :
-- `pg_cron` -> Edge Function -> `storage.from(BUCKET).remove(paths)`
-- (`src/adapters/supabase/order-file-purge-repository.ts:203`), sur le
-- bucket `commercial_order_files` — DISTINCT du bucket `order_exports` de ce
-- lot (deux buckets, deux tables, un seul et meme MECANISME quotidien
-- reutilise).
--
-- (4) `magrit-order-export-runner` N EST PAS ETENDU pour cela : c est
-- `magrit-order-file-purge` qui l est (dette fermee dans CE lot, voir
-- `src/server/api/order-export-purge-composition.ts` et l Edge Function
-- elle-meme) — PAS une troisieme Edge Function. Motif : deux menages
-- QUOTIDIENS (un par bucket) se fondent naturellement dans le mecanisme
-- QUI EXISTE DEJA pour "le menage des fichiers" ; c est l inverse du
-- raisonnement du point 3(b) du contrat, ou deux DRAINS A LA MINUTE, dont un
-- ouvre des connexions reseau lentes, restent separes.
--
-- ⚠️ CORRECTION qa-review ROUND 2 (2026-09-13) — LA REPRISE N ETAIT PAS
-- REELLE, contrairement a CE QUE DISAIENT QUATRE COMMENTAIRES (celui-ci
-- inclus, dans sa version precedente, et le port TypeScript
-- `order-export-purge-repository.ts`). Le defaut : la ligne passait
-- `expired` des sa RECLAMATION (avant meme la tentative de retrait), et le
-- trigger d immuabilite interdit TOUTE sortie de `expired` — un export
-- `expired` n est donc PLUS JAMAIS reclame, meme si `storage.remove()`
-- echoue ou ne retire qu une partie du lot. Le filet qui rend ce patron sur
-- sur `commercial_order_files` (le balayage d objets orphelins d E10.22c,
-- `api_claim_orphan_order_file_objects`) est **code en dur sur cet autre
-- bucket** (migration `20260910000600`, `where o.bucket_id =
-- 'commercial_order_files'`) : RIEN ne balaie `order_exports`. Consequence
-- non hypothetique : un `remove()` en 5xx ou partiel laisse des fichiers
-- portant le CA complet, le SIRET et le numero de TVA de tous les clients
-- de l espace physiquement dans le bucket, POUR TOUJOURS, sans aucun signal
-- (le corps de reponse HTTP n est pas relu par `pg_net`) — exactement ce que
-- l arbitrage de purge existe pour interdire (« la retention serait tenue
-- dans le registre et violee sur le disque »).
--
-- CORRECTION round 2, SANS FONCTION NI ETAT SUPPLEMENTAIRE : l invariant
-- devient AUTO-PORTEUR — « une ligne `expired` avec `storage_path` NON NUL
-- = l objet est ENCORE present ». `storage_path` (deja dans la liste des
-- colonnes MUTABLES du trigger) n est mis a `null` que par
-- `api_confirm_order_export_files_purged()`, APRES un retrait CONFIRME
-- cote Storage — jamais par cette fonction de reclamation. Le predicat de
-- reclamation s ELARGIT en consequence a `status in ('ready', 'expired')` :
-- une ligne DEJA `expired` mais dont l objet n a JAMAIS ete confirme retire
-- (`storage_path` toujours non nul) EST RE-RECLAMEE au tour suivant — la
-- transition `expired -> expired` passe le trigger, aucune exception. La
-- ligne SURVIT toujours indefiniment (point 3(f) du contrat, inchange) :
-- seul `storage_path` change, jamais `status` une fois `expired`.
--
-- ⚠️ CORRECTION qa-review ROUND 3 (2026-09-13) — LE RETRAIT PARTIEL, QUI NE
-- LEVE AUCUNE ERREUR, CONTOURNAIT ENCORE LA REPRISE round 2. La correction
-- round 2 fermait le cas « `remove()` en ERREUR » mais l adaptateur
-- confirmait ENSUITE **tous** les ids reclames des que `remove()` rendait
-- `error: null` — MEME si `data` ne portait qu UNE partie des chemins
-- demandes (retrait S3 PARTIEL, HTTP 200 avec des erreurs PAR CLE). Un lot
-- de 3, `remove()` rendant `{data: [1 element], error: null}`, effacait les
-- TROIS `storage_path` : DEUX fichiers devenaient orphelins DEFINITIFS,
-- SANS AUCUN SIGNAL (le `console.warn` ne se declenche pas non plus dans ce
-- cas : `objectsRemoved` ETAIT compte comme egal a `filesMarkedExpired`,
-- puisque la confirmation portait sur les TROIS ids).
--
-- LE FAIT ETABLI (verifie sur le code source du serveur Storage, pas de
-- memoire) qui rend tout FILTRAGE sur `data` une APPROXIMATION, jamais une
-- preuve : `data` = les lignes REELLEMENT supprimees de `storage.objects`
-- (`DELETE ... RETURNING *`), MAIS (i) la RLS filtre SILENCIEUSEMENT ce qui
-- n est pas visible — un objet peut manquer de `data` sans qu il ait jamais
-- existe OU sans qu il soit lisible ; (ii) quand le backend S3 sous-jacent
-- rend un 200 avec des erreurs PAR CLE, l adaptateur serveur Storage
-- N INSPECTE PAS `result.Errors` — un chemin peut donc figurer dans `data`
-- ALORS QUE L OBJET BINAIRE SURVIT. L ambiguite joue DONC DANS LES DEUX
-- SENS : absence de `data` = « inexistant » OU « invisible » (faux
-- negatif) ; PRESENCE dans `data` = ligne DB supprimee A COUP SUR, objet
-- BINAIRE supprime SEULEMENT PROBABLEMENT (faux positif possible).
--
-- ARBITRAGE ARCHITECTE : (c) EST LA SOLUTION PORTEUSE, PAS UN COMPLEMENT —
-- un balayage d objets orphelins INDEPENDANT sur le bucket `order_exports`
-- (section 9 ci-dessous), parce que TOUTE solution, y compris un filtre
-- parfait sur `data`, finit par un cas ou l on n a pas pu confirmer et ou il
-- faut bien s arreter : a cet instant il reste des octets et plus aucune
-- boucle qui les reclame. (a) VIENT PAR-DESSUS : un compteur
-- `purge_attempts` (colonne ajoutee ci-dessus), incremente A CHAQUE
-- RECLAMATION, PLAFONNE A TROIS (aligne sur `attempts`, meme motif : un
-- echec de purge est presque toujours DETERMINISTE). EPUISE, cette fonction
-- CESSE DE RECLAMER LA LIGNE, SANS RIEN CONFIRMER — elle reste `expired`,
-- `storage_path` NON NUL, `purge_attempts` au plafond : c est CET ETAT,
-- lisible en une seule requete, qui signale un ménage a bout de tentatives
-- de reclamation NORMALE, PAS un nouveau statut (`OrderExport.status`
-- continue de decrire le cycle de vie de la DEMANDE, jamais la sante du
-- menage). Le balayage d objets orphelins (section 9) est alors LE SEUL
-- chemin qui continue de tenter le retrait pour ces lignes-la.
--
-- CE FILET EST SUR ICI D UNE FACON QU IL NE L ETAIT PAS POUR
-- `commercial_order_files` (E10.22c, migration `20260910000700` documente
-- une COURSE REELLE sur ce bucket-la) : IMPOSSIBLE ICI, le chemin d objet
-- vaut `<tenant_id>/<export_id>.<ext>` avec un `export_id` NEUF a CHAQUE
-- DEMANDE (`gen_random_uuid()` par defaut sur `id`, jamais reutilise entre
-- deux demandes) — aucun chemin n est donc jamais reattribue a un AUTRE
-- export apres coup. La seule fenetre residuelle est entre le DEPOT de
-- l objet (upload reussi) et l ecriture de `storage_path` par `markReady()`
-- (seul endroit qui l ecrit) : une generation qui echoue AVANT ce point
-- laisse `status=failed` et `storage_path` NUL (jamais un objet orphelin
-- avec `storage_path` renseigne) — cette fenetre se ferme en QUELQUES
-- SECONDES (temps de generation), la marge de 24h ci-dessous (section 9) la
-- couvre tres largement, PAS PAR SYMETRIE avec E10.22c mais pour CE motif
-- precis.
create or replace function public.api_claim_order_exports_for_purge(
  p_limit integer default 500
)
returns table(purged_export_id uuid, purged_tenant_id uuid, purged_storage_path text)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  return query
  with candidates as (
    select e.id
      from public.commercial_order_exports e
     where e.status in ('ready', 'expired')
       and e.expires_at is not null
       and e.expires_at < now()
       -- REPRISE (corrige qa-review round 2) : `storage_path` non nul est
       -- desormais la SEULE condition qui compte pour un export deja
       -- `expired` -- c est elle qui distingue « deja purge » (storage_path
       -- null, plus jamais reclame) de « retrait pas encore confirme »
       -- (storage_path non nul, RE-reclame). Pour un export `ready`, cette
       -- clause reste une defense en profondeur (storage_path garanti non
       -- nul par markReady, applicatif).
       and e.storage_path is not null
       -- PLAFOND (corrige qa-review round 3) : au-dela de TROIS
       -- reclamations, cette fonction CESSE de rendre la ligne -- voir le
       -- commentaire de tete de section pour l etat que cela laisse (expired,
       -- storage_path non nul, purge_attempts=3) et le filet qui prend le
       -- relais (section 9).
       and e.purge_attempts < 3
     order by e.expires_at asc
     limit greatest(p_limit, 0)
     for update skip locked
  ),
  claimed as (
    update public.commercial_order_exports e
       set status = 'expired',
           purge_attempts = e.purge_attempts + 1
      from candidates c
     where e.id = c.id
    returning e.id, e.tenant_id, e.storage_path
  )
  select claimed.id, claimed.tenant_id, claimed.storage_path from claimed;
end;
$$;

comment on function public.api_claim_order_exports_for_purge(integer) is
  'E10.18c — RECLAMATION de la purge de retention (contrat §8.24 point 3(e), CORRIGE qa-review round 1 PUIS round 2 PUIS round 3 : voir commentaire de tete de section pour l historique complet). Marque ready/expired -> expired (idempotent), incremente purge_attempts A CHAQUE RECLAMATION, REND storage_path pour que magrit-order-file-purge (E10.22b, ETENDUE) retire REELLEMENT l objet, PAR LOT, best-effort. storage_path N EST PAS mis a null ici : seule api_confirm_order_export_files_purged() le fait, APRES un retrait CONFIRME. purge_attempts >= 3 EXCLUT la ligne de toute reclamation future PAR CETTE FONCTION (le balayage d objets orphelins, section 9, prend alors le relais). service_role SEUL.';

revoke all on function public.api_claim_order_exports_for_purge(integer) from public, anon, authenticated;
grant execute on function public.api_claim_order_exports_for_purge(integer) to service_role;

-- Confirmation du retrait REEL de l objet Storage, APPELEE UNIQUEMENT apres
-- un `remove()` SANS ERREUR cote adaptateur TypeScript
-- (`SupabaseOrderExportPurgeRepository`) -- et, CORRIGE round 3, UNIQUEMENT
-- POUR LES IDS DONT LE CHEMIN FIGURE DANS `data` (jamais tous les ids
-- reclames en bloc : c est exactement le defaut du round 2, voir
-- commentaire de tete de section). C EST CETTE FONCTION, ET ELLE SEULE, qui
-- met `storage_path` a `null` -- c est ce qui ferme l invariant de reprise
-- (voir commentaire de `api_claim_order_exports_for_purge` ci-dessus) :
-- tant qu elle n a pas ete appelee avec succes pour un `purged_export_id`
-- donne, la ligne reste eligible a une NOUVELLE reclamation (jusqu au
-- plafond de `purge_attempts`, puis c est au balayage d objets orphelins,
-- section 9, de prendre le relais). Un appel sur une ligne DEJA nettoyee
-- (storage_path deja null) ou non `expired` est un NO-OP silencieux
-- (compte rendu = 0), jamais une erreur : un double appel (retry cote
-- adaptateur) ne doit jamais faire echouer le tour.
create or replace function public.api_confirm_order_export_files_purged(
  p_export_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_count integer;
begin
  update public.commercial_order_exports e
     set storage_path = null
   where e.id = any(coalesce(p_export_ids, array[]::uuid[]))
     and e.status = 'expired'
     and e.storage_path is not null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function public.api_confirm_order_export_files_purged(uuid[]) is
  'E10.18c, qa-review round 2 PUIS round 3 — met storage_path a NULL pour les exports dont l objet Storage vient d etre REELLEMENT retire. A appeler par l appelant UNIQUEMENT sur les ids dont le chemin figure dans data (round 3 : jamais tous les ids reclames en bloc -- data est une APPROXIMATION, voir section 8, mais la seule disponible). Rend le nombre de lignes effectivement mises a jour (0 si deja nettoyees ou non expired -- NO-OP, jamais une erreur). Ferme l invariant de reprise : storage_path non nul + status=expired = objet ENCORE present, reclamable a nouveau (jusqu au plafond purge_attempts). service_role SEUL.';

revoke all on function public.api_confirm_order_export_files_purged(uuid[]) from public, anon, authenticated;
grant execute on function public.api_confirm_order_export_files_purged(uuid[]) to service_role;

-- ── 9. Balayage d objets orphelins — bucket `order_exports`, SOLUTION PORTEUSE ──
-- ARBITRAGE ARCHITECTE (qa-review round 3, 2026-09-13) : PAS un complement
-- au filtrage sur `data` (section 8) mais LA solution porteuse -- voir le
-- raisonnement complet en tete de section 8 (« toute solution, y compris un
-- filtre parfait, finit sur un cas ou l on n a pas pu detruire »).
--
-- MEME PATRON que `api_claim_orphan_order_file_objects` (E10.22c, migration
-- `20260910000600`), mais SIMPLIFIE : le chemin d objet de ce bucket
-- (`<tenant_id>/<export_id>.<ext>`) est stocke A L IDENTIQUE dans
-- `commercial_order_exports.storage_path` (voir
-- `src/adapters/supabase/order-exports-storage.ts`, `markReady()`) --
-- AUCUN `split_part` necessaire, une EGALITE DIRECTE `e.storage_path =
-- o.name` suffit a faire la jointure, contrairement au bucket
-- `commercial_order_files` qui n a pas cette colonne et doit ISOLER un
-- segment du chemin.
--
-- DEUX categories UNIES par un OR, AUCUNE ligne n est ECRITE par cette
-- fonction (lecture seule, le retrait reste du ressort de l adaptateur) :
--   a. Objet SANS AUCUNE ligne `commercial_order_exports` dont
--      `storage_path` le reference -- fenetre residuelle entre le depot et
--      `markReady()` (voir section 8, close en quelques secondes en usage
--      normal), plus vieux que le delai de securite (24h, PARAMETRE de la
--      fonction, jamais un litteral fige) ;
--   b. Objet dont la ligne correspondante est `expired` ET a EPUISE son
--      plafond de reclamation (`purge_attempts >= 3`, section 8) --
--      rattrape SANS delai supplementaire : l epuisement du plafond de
--      reclamation normale ATTESTE DEJA que plusieurs tentatives ont eu
--      lieu, attendre davantage ne protege plus rien. AUCUNE course
--      possible avec une confirmation legitime (contrairement a E10.22c,
--      migration `20260910000700`) : le chemin de CET export n est JAMAIS
--      reattribue a un autre (`export_id` neuf a chaque demande).
--
-- Cette fonction rend AUSSI `matched_export_id` (nullable) : non nul pour
-- la categorie (b), il permet a l adaptateur d appeler
-- `api_confirm_order_export_files_purged()` sur les objets de CETTE
-- categorie effectivement retires (fermant l invariant meme pour les lignes
-- a bout de tentatives) -- nul pour la categorie (a), ou aucune ligne
-- n existe pour recevoir une confirmation.
create or replace function public.api_claim_orphan_order_export_objects(
  p_older_than interval default interval '24 hours',
  p_limit integer default 200
)
returns table (
  orphan_object_id   uuid,
  orphan_object_path text,
  matched_export_id  uuid
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    o.id,
    o.name,
    (select e.id from public.commercial_order_exports e where e.storage_path = o.name)
  from storage.objects o
 where o.bucket_id = 'order_exports'
   and (
     (
       not exists (
         select 1 from public.commercial_order_exports e where e.storage_path = o.name
       )
       and o.created_at <= now() - greatest(p_older_than, interval '24 hours')
     )
     or exists (
       select 1 from public.commercial_order_exports e
        where e.storage_path = o.name
          and e.status = 'expired'
          and e.purge_attempts >= 3
     )
   )
 order by o.created_at
 limit greatest(p_limit, 0);
$$;

comment on function public.api_claim_orphan_order_export_objects(interval, integer) is
  'E10.18c, qa-review round 3 — SOLUTION PORTEUSE de la purge (pas un complement), DETTE fermee dans ce lot. Liste (SANS RIEN MARQUER) les objets du bucket order_exports SANS ligne commercial_order_exports dont storage_path le reference (fenetre depot->markReady, marge 24h) OU dont la ligne correspondante est expired avec purge_attempts >= 3 epuise (rattrape sans delai, aucune course possible : export_id jamais reutilise). matched_export_id permet a l adaptateur de confirmer (api_confirm_order_export_files_purged) les objets de la seconde categorie effectivement retires. Egalite DIRECTE sur storage_path (pas de split_part, contrairement a api_claim_orphan_order_file_objects). service_role SEUL.';

revoke all on function public.api_claim_orphan_order_export_objects(interval, integer) from public, anon, authenticated;
grant execute on function public.api_claim_orphan_order_export_objects(interval, integer) to service_role;

notify pgrst, 'reload schema';

-- ============================================================================
-- PLANIFICATION DIFFEREE DU DECLENCHEUR pg_cron DE `magrit-order-export-runner`
-- — meme motif et meme forme que `20260908000000`/`20260910000500`/
-- `20260912000100` : cette migration NE PLANIFIE RIEN elle-meme pour ce
-- declencheur (secrets Vault de la NOUVELLE Edge Function
-- `magrit-order-export-runner` inconnus a l ecriture de cette migration).
-- A executer UNE FOIS les secrets `magrit_order_export_run_url`/
-- `magrit_order_export_run_secret` poses (`vault.create_secret`), dans une
-- session psql/SQL editor :
--
--   do $$
--   declare
--     v_url text;
--     v_secret text;
--   begin
--     select decrypted_secret into v_url
--       from vault.decrypted_secrets where name = 'magrit_order_export_run_url';
--     select decrypted_secret into v_secret
--       from vault.decrypted_secrets where name = 'magrit_order_export_run_secret';
--
--     if v_url is null or v_secret is null then
--       raise exception 'E10.18c: secrets Vault magrit_order_export_run_url / magrit_order_export_run_secret absents.';
--     end if;
--
--     if exists (select 1 from cron.job where jobname = 'magrit-order-export-run') then
--       perform cron.unschedule('magrit-order-export-run');
--     end if;
--
--     -- A LA MINUTE, meme cadence que magrit-outbox-dispatch/magrit-
--     -- notification-send : la promptitude est ici aussi la qualite
--     -- recherchee (§8.24 §3(b)).
--     perform cron.schedule(
--       'magrit-order-export-run',
--       '* * * * *',
--       format(
--         $cron$select net.http_post(
--           url := %L,
--           headers := jsonb_build_object(
--             'Content-Type', 'application/json',
--             'X-Magrit-Order-Export-Run-Secret', %L
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
--
-- Le REVEIL IMMEDIAT depuis api_request_order_export (E10.18f, optionnel,
-- via net.http_post avec le MEME secret) N EST PAS pose par cette migration :
-- lot separe, son absence ne bloque rien (le pg_cron ci-dessus reste le
-- filet).
-- ============================================================================

-- ============================================================================
-- REVERSIBILITE — le CLI Supabase ne gere pas de bloc `down`. SQL de retrait,
-- a jouer tel quel dans une migration inverse si la story est annulee :
--
--   select cron.unschedule('magrit-order-export-run')
--     where exists (select 1 from cron.job where jobname = 'magrit-order-export-run');
--
--   revoke execute on function public.api_claim_orphan_order_export_objects(interval, integer) from service_role;
--   drop function if exists public.api_claim_orphan_order_export_objects(interval, integer);
--
--   revoke execute on function public.api_confirm_order_export_files_purged(uuid[]) from service_role;
--   drop function if exists public.api_confirm_order_export_files_purged(uuid[]);
--
--   revoke execute on function public.api_claim_order_exports_for_purge(integer) from service_role;
--   drop function if exists public.api_claim_order_exports_for_purge(integer);
--
--   delete from storage.buckets where id = 'order_exports';
--
--   revoke execute on function public.api_read_order_export_rows(uuid, jsonb, integer) from service_role;
--   drop function if exists public.api_read_order_export_rows(uuid, jsonb, integer);
--
--   revoke execute on function public.api_claim_order_exports(integer, integer, interval) from service_role;
--   drop function if exists public.api_claim_order_exports(integer, integer, interval);
--
--   revoke execute on function public.api_request_order_export(uuid, text, text, jsonb) from authenticated;
--   drop function if exists public.api_request_order_export(uuid, text, text, jsonb);
--
--   drop trigger if exists commercial_order_exports_append_only on public.commercial_order_exports;
--   drop function if exists public.commercial_order_exports_reject_mutation();
--   drop policy if exists "commercial_order_exports_select" on public.commercial_order_exports;
--   drop index if exists public.commercial_order_exports_expiring_idx;
--   drop index if exists public.commercial_order_exports_requester_open_idx;
--   drop index if exists public.commercial_order_exports_pending_due_idx;
--   drop index if exists public.commercial_order_exports_tenant_requested_idx;
--   drop table if exists public.commercial_order_exports;
--
--   -- Migration additive de la section 1bis (colonne customer_contact_email) :
--   -- `create or replace view` ne peut PAS retirer une colonne du MILIEU
--   -- d une vue (seule la derniere colonne serait retirable) -- le retrait
--   -- consiste a REJOUER TEL QUEL les deux `create or replace view` de
--   -- 20260912000400_gescom_e10_18b_order_export_views.sql (catalogue sans
--   -- customer_contact_email), PUIS a refaire les deux `revoke all` de ce
--   -- meme fichier (une vue recreee ne conserve pas necessairement ses
--   -- grants).
--
--   notify pgrst, 'reload schema';
--
-- AUCUN pg_cron SQL-seul n a ete planifie par ce lot pour la purge (section
-- 8, corrigee) : la destruction reelle des objets Storage passe par
-- l extension de `magrit-order-file-purge`, dont le declencheur pg_cron
-- existe/se planifie independamment de cette migration (20260910000500) —
-- rien a desactiver ICI pour ce mecanisme. pg_cron/pg_net NE SONT PAS
-- desactives (extension partagee).
-- ============================================================================
