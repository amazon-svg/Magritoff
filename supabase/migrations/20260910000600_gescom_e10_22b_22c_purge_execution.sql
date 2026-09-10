-- ============================================================================
-- Sprint 5 Gestion commerciale — stories E10.22b (purge reelle) et E10.22c
-- (objets orphelins, ferme la dette D7 d E10.20b). Contrat :
-- openapi/magrit-core.v1.yaml (deja ecrit par l architecte -- webhook
-- `order_files.purged` et schema `OrderFilesPurgedPayload` DEJA PRESENTS,
-- AUCUNE modification apportee ici), docs/api/CONVENTIONS.md §8.22 §5 et §6.
-- ----------------------------------------------------------------------------
-- CORRIGEE EN QA-REVIEW ROUND 1 (« REJETE »), AVANT TOUT DEPLOIEMENT --
-- cette migration n a JAMAIS ete jouee ailleurs qu en session locale, le
-- correctif est donc applique DANS CE MEME FICHIER (pas une migration
-- inverse) :
--   - M1 (MODERE, garde de purge) : les DEUX `exists` de la garde
--     n excluaient pas un rappel `failed_at` (une relecture tardive
--     "delivered" arrivant apres expiration peut laisser un rappel avec
--     confirmed_at ET failed_at tous deux non nuls, cf. N2 d E10.22a-bis) et
--     rien n empechait `purge_notice_1_id = purge_notice_2_id` (le MEME
--     rappel compterait pour DEUX preuves). NI L UN NI L AUTRE N EST
--     ATTEIGNABLE PAR L API ACTUELLE (defense en profondeur), mais c est LA
--     garde la plus sensible du chantier : elle doit etre vraie PAR
--     ELLE-MEME. Corrige : `and n.failed_at is null` ajoute aux deux
--     `exists`, `and f.purge_notice_1_id is distinct from f.purge_notice_2_id`
--     ajoute au filtre des candidats.
--   - M2 (MODERE, fuite storage silencieuse) : la branche (b) du nettoyage
--     orphelins filtrait sur `purged_at is not null` (purge AUTOMATIQUE
--     seule) -- une suppression MANUELLE (E10.17a, `deleted_at` pose) dont le
--     retrait storage best-effort a echoue n etait JAMAIS rattrapee (la
--     branche (a) ne matche pas non plus : la ligne existe toujours). Le
--     contrat §6 parle de "l objet dont le retrait a echoue" sans distinguer
--     la cause de la suppression. Corrige : la branche (b) filtre desormais
--     sur `deleted_at is not null` (couvre purge automatique ET suppression
--     manuelle -- purged_at reste un sous-ensemble de deleted_at non nul par
--     construction).
--   - N3 (mineur) : un chemin a 2 segments ou un `.emptyFolderPlaceholder`
--     (troisieme segment vide) etaient candidats au nettoyage orphelins.
--     Corrige : `and split_part(o.name, '/', 3) <> ''` ajoute aux DEUX
--     branches.
--   - B1 (BLOQUANT, observabilite -- arbitrage Arnaud, §5 du contrat :
--     "le balayage de purge compte les fichiers echus qu il refuse de
--     detruire, par espace et par motif") : fonction NEUVE
--     `api_count_blocked_order_file_purges()`, voir section 1bis ci-dessous.
-- ----------------------------------------------------------------------------
-- PERIMETRE STRICT DE CE LOT : E10.22a/E10.22a-bis (echeance, rappels, preuve
-- de livraison -- migration `20260910000500`) sont DEJA en service et NE SONT
-- PAS MODIFIES ICI (ni colonne, ni fonction, ni trigger de cette migration
-- n est touche -- ce lot n AJOUTE que des fonctions neuves).
--
-- AUCUNE COLONNE NEUVE : `deleted_at`/`deleted_by`/`deleted_by_label`
-- (E10.17a, `20260909060000`) et `purged_at` (E10.22a, `20260910000500`)
-- existent DEJA. Ce lot ne fait qu ECRIRE dedans, via des fonctions
-- `security definer` neuves.
--
-- Ce que cette migration fait, dans l ordre :
--
--   1. `api_claim_order_files_for_purge(limit)` — LA garde non negociable
--      (§5 du contrat, arbitrage Arnaud du 2026-09-10) : un fichier n est
--      reclame QUE SI SES DEUX rappels (purge_notice_1_id ET
--      purge_notice_2_id, NECESSAIREMENT DISTINCTS -- M1) pointent chacun
--      vers un `commercial_order_file_purge_notice` dont `confirmed_at IS
--      NOT NULL` ET `failed_at IS NULL` (M1) -- preuve de LIVRAISON, jamais
--      de simple tentative (`accepted_at` n est JAMAIS lu ici). Reclame
--      (`for update skip locked`), MARQUE (`deleted_at`, `purged_at`,
--      `deleted_by = null`, `deleted_by_label = 'Purge automatique'`) —
--      MEME REGIME que la suppression manuelle d E10.17a
--      (`api_delete_order_file`, `20260909060000` : "OCTETS DETRUITS, LIGNE
--      CONSERVEE", JAMAIS un second regime de destruction sur cette table
--      (§5 du contrat, "deux regimes de destruction dans une seule table"
--      explicitement ecarte). Rend `tenant_id`/`order_id`/`file_id`/
--      `byte_size` PAR FICHIER — JAMAIS `storage_path` (meme discipline que
--      qa-review B1/N4 d E10.10b-4a et d E10.17a : un chemin de stockage
--      n est jamais rendu par une fonction SQL en DONNEE, il est TOUJOURS
--      recalcule cote adaptateur depuis tenant/order/file authentifies).
--
--   1bis. `api_count_blocked_order_file_purges()` — B1, BLOQUANT qa-review
--      round 1. Compte, PAR TENANT ET PAR MOTIF, les fichiers echus
--      (`purge_at <= now()`, vivants) que la garde du point 1 refuse de
--      detruire -- SANS RIEN MARQUER, lecture seule. Motif EXCLUSIVEMENT
--      l un de : `rappel_non_emis` (un des deux pointeurs est NULL),
--      `rappels_identiques` (les deux pointeurs sont IDENTIQUES -- defense
--      en profondeur M1, non atteignable aujourd hui), `rappel_en_echec`
--      (un des deux rappels porte `failed_at`), `rappel_non_confirme` (les
--      deux rappels existent, distincts, ni l un ni l autre en echec, mais
--      au moins un `confirmed_at` encore NULL). La NEGATION EXACTE de la
--      garde du point 1 : un fichier qui satisfait la garde n apparait
--      JAMAIS ici, meme s il n a pas encore ete traite ce tour (plafond
--      `p_limit` de la reclamation) -- il n est pas "bloque", il attend
--      simplement le tour suivant. Appelee par le service APRES la purge
--      reelle (le compte reflete alors le reliquat post-tour), journalisee
--      par l Edge Function a chaque tour (§5 du contrat : "rend le
--      mecanisme OBSERVABLE" -- c est la raison d etre des deux tables de
--      suivi construites en E10.22a).
--
--   2. `api_record_order_files_purged(tenant, file_count, order_count,
--      byte_size_freed, order_ids)` — insere UN evenement
--      `order_files.purged` (`outbox_events`, MEME table que
--      `order_files.purge_scheduled`, AUCUN nouveau bus). Appelee par
--      l adaptateur TS APRES le retrait PAR LOT des objets de stockage
--      (best-effort — §5 du contrat : "echouer tant qu echouer est encore
--      gratuit, jamais apres le point de non-retour" ; la ligne est DEJA
--      marquee purgee au moment de cet appel, le retrait de l objet est le
--      point de non-retour, l evenement vient APRES, quel que soit le
--      resultat du retrait — `byte_size_freed` compte les octets DECLARES EN
--      BASE, "un objet dont le retrait a echoue est compte alors qu il
--      occupe encore de la place", §9 du contrat, schema
--      `OrderFilesPurgedPayload`).
--
--   3. `api_claim_orphan_order_file_objects(older_than, limit)` — E10.22c,
--      DETTE D7. Lit `storage.objects` DIRECTEMENT (`storage.delete_object`
--      n existe pas comme fonction SQL appelable, §0/§3 du contrat -- deja
--      constate par E10.20b, `20260910000400`, meme patron de lecture
--      reprise ici a l identique : `security definer`, SELECT sur
--      `storage.objects`, AUCUNE policy RLS requise car ce role bypasse deja
--      la RLS de cette table systeme). DEUX categories UNIES par un OR (§6 du
--      contrat), toutes deux excluant desormais un chemin dont le troisieme
--      segment est vide (N3, dossier/placeholder) :
--        a. Objet SANS AUCUNE ligne `commercial_order_files` correspondante
--           (jamais confirme -- billet emis puis abandonne -- OU commande
--           supprimee, `on delete cascade` efface la ligne, JAMAIS l objet),
--           ET plus vieux que le delai de securite (24h PROPOSEES, reserve
--           (b) du contrat, NON arbitrees -- PARAMETRE de la fonction,
--           JAMAIS un litteral fige, pour rester ajustable sans migration
--           neuve -- meme doctrine de "reglage d exploitation" que le
--           lead_days des rappels). Le billet d upload vit ~2h maximum
--           (E10.17a/E10.20a) : la marge de 24h ne court JAMAIS contre une
--           confirmation en cours. **CETTE MARGE SEULE NE SUFFIT PLUS A
--           GARANTIR L INVARIANT "objet candidat => jamais reclame par une
--           confirmation legitime"** : voir la migration `20260910000700`
--           (B2, BLOQUANT qa-review round 1), qui ferme le trou cote
--           confirmation en refusant explicitement toute confirmation sur un
--           objet DEJA plus vieux que ce meme delai.
--        b. Objet dont la ligne correspondante porte DEJA `deleted_at IS NOT
--           NULL` (M2, qa-review round 1 -- COUVRE DESORMAIS purge
--           AUTOMATIQUE **ET** suppression MANUELLE, pas seulement
--           `purged_at`) -- retrait precedent echoue, rattrape SANS delai
--           supplementaire, la ligne atteste DEJA que la destruction est
--           autorisee, attendre ne protege plus rien.
--      Le chemin de l objet (`storage.objects.name`) est de la forme
--      `<tenant_id>/<order_id>/<file_id>` (SANS extension, contrat §8.19 §3,
--      `storagePathFor`) : `split_part(name, '/', 3)` isole le troisieme
--      segment (`file_id`) pour la jointure — AUCUNE ligne n est ECRITE par
--      cette fonction (rien a marquer pour un objet qui n a jamais eu de
--      ligne ; la ligne du cas (b) est DEJA marquee ailleurs), elle ne fait
--      QUE lister les chemins candidats, le retrait reste du ressort de
--      l adaptateur (storage, jamais SQL — meme raison qu au point 1).
--
-- Ce que cette migration NE fait PAS : aucun `pg_cron` neuf (l Edge Function
-- `magrit-order-file-purge`, DEJA CREEE par E10.22a, est ETENDUE avec ces
-- deux volets supplementaires cote applicatif — voir
-- `src/modules/order-files/application/purge-sweep-service.ts` — le
-- declencheur quotidien EXISTANT n a besoin d aucun changement de
-- planification) ; aucun endpoint `/api/v1` neuf (§9 du contrat, deja
-- justifie par E10.22a : "un balayage n a pas de tenant" -- inchange ici) ;
-- aucune modification d `openapi/magrit-core.v1.yaml` (le webhook
-- `order_files.purged` et son schema `OrderFilesPurgedPayload` sont DEJA
-- ECRITS par l architecte -- verifie ligne a ligne avant d ecrire ce fichier,
-- voir rapport de fin de story pour l ECART CONSTATE sur `OrderFile.
-- purge_at`, TOUJOURS optionnel au contrat malgre la note §9 qui prevoyait
-- sa promotion `required` par ce lot -- NON CORRIGE ICI, hors mandat de
-- `dev-story`).
-- ============================================================================

-- ── 1. La purge reelle (E10.22b) — garde des DEUX rappels confirmes ────────
create or replace function public.api_claim_order_files_for_purge(
  p_limit integer default 500
)
returns table (
  purged_file_id   uuid,
  purged_order_id  uuid,
  purged_tenant_id uuid,
  purged_byte_size bigint
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  return query
  with candidates as (
    select f.id, f.order_id, f.byte_size, o.tenant_id
      from public.commercial_order_files f
      join public.commercial_orders o on o.id = f.order_id
     where f.deleted_at is null
       and f.purged_at is null
       and f.purge_at <= now()
       -- GARDE NON NEGOCIABLE, forme PRESCRITE par le contrat (§5), DURCIE
       -- en qa-review round 1 (M1, defense en profondeur sur LA garde la
       -- plus sensible du chantier) : LES DEUX rappels existent, sont
       -- CONFIRMES DELIVRES, ET NI L UN NI L AUTRE N EST EN ECHEC (une
       -- relecture tardive peut laisser confirmed_at ET failed_at tous deux
       -- non nuls sur un rappel EXPIRE, cf. N2 d E10.22a-bis -- CE rappel ne
       -- doit jamais compter comme une preuve valide). Ecrite sur
       -- confirmed_at, JAMAIS accepted_at -- "tentative faite" n autorise
       -- rien. purge_notice_N_id IS NULL ne satisfait JAMAIS ces EXISTS
       -- (n.id = null ne matche aucune ligne).
       -- N4 (mineur, qa-review round 1) : le rappel POINTE doit appartenir
       -- au MEME tenant que le fichier (`n.tenant_id = o.tenant_id`). Non
       -- atteignable aujourd hui (un fichier ne peut recevoir de pointeur
       -- que via le rattachement transactionnel d `api_claim_order_file_
       -- purge_notices`, qui groupe deja par tenant), aucune contrainte ne
       -- l empechait explicitement -- ajoutee ici, cout nul.
       and exists (
             select 1 from public.commercial_order_file_purge_notices n
              where n.id = f.purge_notice_1_id and n.tenant_id = o.tenant_id
                and n.confirmed_at is not null and n.failed_at is null
           )
       and exists (
             select 1 from public.commercial_order_file_purge_notices n
              where n.id = f.purge_notice_2_id and n.tenant_id = o.tenant_id
                and n.confirmed_at is not null and n.failed_at is null
           )
       -- M1 (qa-review round 1) : LES DEUX pointeurs doivent designer DEUX
       -- rappels DISTINCTS -- un fichier ne peut pas etre "purgeable" parce
       -- que le MEME rappel confirme est compte deux fois. Non atteignable
       -- aujourd hui (l emission cree systematiquement une ligne neuve par
       -- palier), defense en profondeur assumee.
       and f.purge_notice_1_id is distinct from f.purge_notice_2_id
     order by f.id
     limit greatest(p_limit, 0)
     for update of f skip locked
  ),
  marked as (
    -- Ordre PRESCRIT par E10.17a et non renegociable : la LIGNE d abord
    -- (transactionnel, ICI), l objet de stockage ENSUITE (adaptateur TS,
    -- best-effort, apres le retour de cette fonction).
    update public.commercial_order_files f
       set deleted_at = now(),
           purged_at = now(),
           deleted_by = null,
           deleted_by_label = 'Purge automatique'
      from candidates c
     where f.id = c.id
    returning f.id as marked_id, c.order_id as marked_order_id, c.tenant_id as marked_tenant_id, c.byte_size as marked_byte_size
  )
  select marked_id, marked_order_id, marked_tenant_id, marked_byte_size from marked;
end;
$$;

comment on function public.api_claim_order_files_for_purge(integer) is
  'E10.22b — reclame (for update skip locked) et MARQUE (deleted_at/purged_at/deleted_by_label=''Purge automatique'') les fichiers echus (purge_at <= now()) dont LES DEUX rappels sont CONFIRMES DELIVRES (confirmed_at, jamais accepted_at), NI L UN NI L AUTRE EN ECHEC (failed_at, M1 qa-review round 1), DISTINCTS l un de l autre (M1) et DU MEME TENANT que le fichier (N4). Rend tenant_id/order_id/file_id/byte_size PAR FICHIER, JAMAIS storage_path (recalcule cote adaptateur). service_role SEUL.';

revoke all on function public.api_claim_order_files_for_purge(integer) from public, anon, authenticated;
grant execute on function public.api_claim_order_files_for_purge(integer) to service_role;

-- ── 1bis. Comptage des blocages (B1, BLOQUANT qa-review round 1) ───────────
-- Lecture SEULE (aucune ligne n est marquee) -- la NEGATION EXACTE de la
-- garde ci-dessus : un fichier qui la satisfait n apparait JAMAIS ici, meme
-- s il n a pas encore ete traite CE tour (plafond p_limit de la reclamation
-- ci-dessus) -- il n est pas "bloque", il attend simplement le tour suivant.
create or replace function public.api_count_blocked_order_file_purges()
returns table (
  blocked_tenant_id uuid,
  blocked_reason     text,
  blocked_count      integer
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select o.tenant_id,
         case
           -- Un des deux rappels n a jamais ete emis (palier non atteint,
           -- ou aucun destinataire joignable -- §4 du contrat : "rien n est
           -- cree, rien n est emis").
           when f.purge_notice_1_id is null or f.purge_notice_2_id is null
             then 'rappel_non_emis'
           -- Defense en profondeur M1 : les deux pointeurs designent le
           -- MEME rappel -- non atteignable aujourd hui, journalise a part
           -- pour ne jamais se confondre avec un vrai "non confirme".
           when f.purge_notice_1_id = f.purge_notice_2_id
             then 'rappels_identiques'
           -- Un des deux rappels est EXPIRE sans confirmation (fenetre de
           -- relecture ecoulee, E10.22a-bis) -- un rappel neuf sera emis au
           -- prochain tour de balayage des rappels.
           when n1.failed_at is not null or n2.failed_at is not null
             then 'rappel_en_echec'
           -- Les deux rappels existent, sont distincts, aucun n est en
           -- echec -- mais au moins une livraison n est pas encore
           -- CONFIRMEE (statut Resend pendant, ou relecture pas encore
           -- passee).
           else 'rappel_non_confirme'
         end as reason,
         count(*)::integer as blocked_count
    from public.commercial_order_files f
    join public.commercial_orders o on o.id = f.order_id
    -- N4 (qa-review round 1) : jointure QUALIFIEE au tenant du fichier, meme
    -- garde que api_claim_order_files_for_purge -- un rappel d un AUTRE
    -- tenant (non atteignable aujourd hui) ne compte pas comme confirme.
    left join public.commercial_order_file_purge_notices n1
      on n1.id = f.purge_notice_1_id and n1.tenant_id = o.tenant_id
    left join public.commercial_order_file_purge_notices n2
      on n2.id = f.purge_notice_2_id and n2.tenant_id = o.tenant_id
   where f.deleted_at is null
     and f.purged_at is null
     and f.purge_at <= now()
     -- NEGATION EXACTE de la garde de api_claim_order_files_for_purge --
     -- toute modification de la garde ci-dessus DOIT etre repercutee ici,
     -- sous peine de compter comme "bloque" un fichier qui, en realite,
     -- vient d etre purge (ou l inverse).
     and not (
       f.purge_notice_1_id is not null
       and f.purge_notice_2_id is not null
       and f.purge_notice_1_id is distinct from f.purge_notice_2_id
       and n1.confirmed_at is not null and n1.failed_at is null
       and n2.confirmed_at is not null and n2.failed_at is null
     )
   group by o.tenant_id, reason;
$$;

comment on function public.api_count_blocked_order_file_purges() is
  'E10.22b — B1 (qa-review round 1, BLOQUANT) : compte, par tenant et par motif (rappel_non_emis / rappels_identiques / rappel_en_echec / rappel_non_confirme), les fichiers echus que la garde de api_claim_order_files_for_purge refuse de detruire. Lecture SEULE, negation EXACTE de cette garde. Journalise par l Edge Function a chaque tour (§5 du contrat : rend le mecanisme observable). service_role SEUL.';

revoke all on function public.api_count_blocked_order_file_purges() from public, anon, authenticated;
grant execute on function public.api_count_blocked_order_file_purges() to service_role;

-- ── 2. Trace versionnee de la destruction (order_files.purged) ─────────────
create or replace function public.api_record_order_files_purged(
  p_tenant_id uuid,
  p_file_count integer,
  p_order_count integer,
  p_byte_size_freed bigint,
  p_order_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if p_file_count < 1 or p_order_count < 1 or p_byte_size_freed < 1 or coalesce(array_length(p_order_ids, 1), 0) < 1 then
    raise exception 'order_files_purged.invalid_summary: file_count=% order_count=% byte_size_freed=% order_ids=%',
      p_file_count, p_order_count, p_byte_size_freed, p_order_ids;
  end if;

  insert into public.outbox_events
    (tenant_id, event_name, event_version, aggregate_type, aggregate_id, payload)
  values (
    p_tenant_id,
    'order_files.purged',
    1,
    'tenant',
    p_tenant_id,
    jsonb_build_object(
      'file_count', p_file_count,
      'order_count', p_order_count,
      'byte_size_freed', p_byte_size_freed,
      'order_ids', to_jsonb(p_order_ids)
    )
  );
end;
$$;

comment on function public.api_record_order_files_purged(uuid, integer, integer, bigint, uuid[]) is
  'E10.22b — insere UN evenement order_files.purged (outbox_events, meme bus que order_files.purge_scheduled) PAR ESPACE, appele par l adaptateur APRES le retrait par lot (best-effort) des objets de stockage. byte_size_freed compte les octets DECLARES EN BASE (§9 du contrat, OrderFilesPurgedPayload) -- pas une mesure du stockage reel. order_ids DEJA borne a 50 par l appelant (application). service_role SEUL.';

revoke all on function public.api_record_order_files_purged(uuid, integer, integer, bigint, uuid[]) from public, anon, authenticated;
grant execute on function public.api_record_order_files_purged(uuid, integer, integer, bigint, uuid[]) to service_role;

-- ── 3. Les objets orphelins (E10.22c, dette D7) ─────────────────────────────
create or replace function public.api_claim_orphan_order_file_objects(
  p_older_than interval default interval '24 hours',
  p_limit integer default 200
)
returns table (
  orphan_object_id   uuid,
  orphan_object_path text
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select o.id, o.name
    from storage.objects o
   where o.bucket_id = 'commercial_order_files'
     -- N3 (qa-review round 1, mineur) : un chemin dont le troisieme segment
     -- est VIDE (dossier intermediaire, `.emptyFolderPlaceholder`) n est
     -- jamais une forme de chemin que ce mecanisme reconnait -- exclu des
     -- DEUX branches plutot que traite comme un file_id qui ne matchera
     -- jamais rien.
     and split_part(o.name, '/', 3) <> ''
     and (
       -- (a) jamais confirme (aucune ligne) OU commande supprimee (cascade a
       -- efface la ligne, jamais l objet) -- delai de securite : le billet
       -- d upload vit ~2h maximum (E10.17a/E10.20a), 24h ne court jamais
       -- contre une confirmation en cours. CETTE MARGE SEULE NE FERME PAS
       -- L INVARIANT (B1 qa-review round 1) : voir migration
       -- `20260910000700`, qui refuse desormais toute confirmation sur un
       -- objet DEJA plus vieux que ce meme delai -- l invariant "un objet
       -- candidat ici ne peut jamais devenir une ligne vivante ensuite"
       -- devient vrai PAR CONSTRUCTION, pas par hypothese de timing.
       (
         not exists (
           select 1 from public.commercial_order_files f
            where f.id::text = split_part(o.name, '/', 3)
         )
         -- M3 (qa-review round 2, garde-fou opposable) : plancher a 24h,
         -- QUEL QUE SOIT `p_older_than` demande par l appelant. Le refus de
         -- confirmation pose en 20260910000700 est ecrit contre le MEME
         -- litteral (24h), en dur, dans deux fonctions SQL distinctes -- rien
         -- ne les garde synchronisees. Sans ce plancher, abaisser ce reglage
         -- un jour (reserve (b) du contrat encore ouverte) rouvrirait
         -- integralement la course fermee en B2 : un objet listable ici
         -- AVANT que le refus de confirmation ne s applique. `greatest`
         -- rend baisser le bouton sans effet sous le plancher, plutot que de
         -- compter sur personne pour se souvenir de toucher aussi les deux
         -- autres fonctions.
         and o.created_at <= now() - greatest(p_older_than, interval '24 hours')
       )
       or
       -- (b) ligne DEJA marquee SUPPRIMEE -- M2 (qa-review round 1,
       -- MODERE) : `deleted_at is not null`, PAS `purged_at is not null`.
       -- Couvre desormais la purge AUTOMATIQUE (E10.22b, qui pose toujours
       -- les deux) **ET** la suppression MANUELLE par l atelier (E10.17a,
       -- `api_delete_order_file`, qui ne pose QUE deleted_at) dont le
       -- retrait storage best-effort a echoue -- le contrat §6 parle de
       -- "l objet dont le retrait a echoue" sans distinguer la cause de la
       -- suppression, et purged_at seul laissait fuir silencieusement tout
       -- objet residuel d une suppression manuelle ratee. Rattrape SANS
       -- delai supplementaire, la ligne atteste DEJA que la destruction est
       -- autorisee.
       exists (
         select 1 from public.commercial_order_files f
          where f.id::text = split_part(o.name, '/', 3)
            and f.deleted_at is not null
       )
     )
   order by o.created_at
   limit greatest(p_limit, 0);
$$;

comment on function public.api_claim_orphan_order_file_objects(interval, integer) is
  'E10.22c — DETTE D7 (qa-review E10.20b). Liste (SANS RIEN MARQUER, rien a marquer) les objets du bucket commercial_order_files SANS ligne commercial_order_files correspondante depuis plus de older_than (billet jamais confirme, ou commande supprimee), OU dont la ligne correspondante porte deja deleted_at (retrait precedent echoue -- purge automatique OU suppression manuelle, M2 qa-review round 1). Chemins a segment vide exclus (N3). Chemin isole par split_part(name, ''/'', 3) = file_id (forme <tenant>/<order>/<file>, SANS extension). Le retrait reste du ressort de l adaptateur (storage.delete_object n existe pas en SQL). L invariant de surete est FERME par la migration 20260910000700 (refus de confirmation sur un objet trop vieux), pas par cette seule fonction. service_role SEUL.';

revoke all on function public.api_claim_orphan_order_file_objects(interval, integer) from public, anon, authenticated;
grant execute on function public.api_claim_orphan_order_file_objects(interval, integer) to service_role;

notify pgrst, 'reload schema';

-- ============================================================================
-- REVERSIBILITE — le CLI Supabase ne gere pas de bloc `down`. SQL de retrait,
-- a jouer tel quel dans une migration inverse si la story est annulee :
--
--   revoke execute on function public.api_claim_orphan_order_file_objects(interval, integer) from service_role;
--   drop function if exists public.api_claim_orphan_order_file_objects(interval, integer);
--   revoke execute on function public.api_record_order_files_purged(uuid, integer, integer, bigint, uuid[]) from service_role;
--   drop function if exists public.api_record_order_files_purged(uuid, integer, integer, bigint, uuid[]);
--   revoke execute on function public.api_count_blocked_order_file_purges() from service_role;
--   drop function if exists public.api_count_blocked_order_file_purges();
--   revoke execute on function public.api_claim_order_files_for_purge(integer) from service_role;
--   drop function if exists public.api_claim_order_files_for_purge(integer);
--
--   notify pgrst, 'reload schema';
--
-- Aucune colonne, aucune table, aucun trigger neuf dans ce lot : rien d autre
-- a retirer. Les fichiers deja marques purged_at/deleted_at par cette
-- fonction AVANT un rollback restent marques (§5 du contrat : une ligne
-- purgee cesse simplement d etre rendue, aucune operation ne "depurge").
-- ============================================================================
