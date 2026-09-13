/**
 * Edge Function `magrit-order-file-purge` (stories E10.22a/E10.22a-bis/
 * E10.22b/E10.22c, docs/api/CONVENTIONS.md §8.22 §3, §5, §6 — ETENDUE PAR
 * E10.18c, contrat §8.24 point 3(e), qa-review round 1 PUIS round 2 PUIS
 * round 3, 2026-09-13, pour la purge de retention DES FICHIERS D EXPORT
 * COMPTABLE, EN DEUX ETAGES depuis le round 3 — reclamation normale PUIS
 * balayage d objets orphelins, SOLUTION PORTEUSE, voir
 * `OrderExportPurgeService`).
 *
 * Balayage QUOTIDIEN, ETENDU par E10.22b/E10.22c PUIS par E10.18c (PAS une
 * nouvelle fonction a chaque fois, meme fichier, meme declencheur) : reclame
 * les rappels des DEUX paliers (`first` J+20, `second` J+15), expire les
 * rappels sans livraison confirmee au bout de la fenetre, relit
 * `GET /emails/{id}` pour les livraisons en attente de confirmation, PURGE
 * REELLEMENT les fichiers de COMMANDE dont les DEUX rappels sont CONFIRMES
 * DELIVRES (E10.22b : octets detruits, ligne conservee, objets retires par
 * lot), compte et JOURNALISE les fichiers BLOQUES par la garde (B1,
 * qa-review round 1 d E10.22b, BLOQUANT -- voir plus bas), retire les objets
 * orphelins du bucket `commercial_order_files` (E10.22c, dette D7), PUIS
 * (E10.18c) PURGE REELLEMENT les fichiers D EXPORT COMPTABLE echus
 * (`commercial_order_exports`, bucket `order_exports` -- ressource et bucket
 * DISTINCTS de tout ce qui precede, meme declencheur quotidien seulement) EN
 * DEUX ETAGES : reclamation normale (confirmation CIBLEE sur ce que l API
 * Storage rend, round 3) PUIS balayage d objets orphelins DEDIE au bucket
 * `order_exports` (SOLUTION PORTEUSE, pas un complement — voir la migration
 * `20260913000000` section 9 et le port `order-export-purge-repository.ts`
 * pour le raisonnement complet).
 * Le rappel N ENVOIE AUCUN COURRIEL (§3 du contrat) -- l ecriture d
 * `order_files.purge_scheduled` dans `outbox_events` est remise au drain
 * EXISTANT (`magrit-outbox-dispatcher`, minute par minute), qui la porte au
 * `PurgeNoticeNotificationConsumer` (branche dans `outbox-dispatch-
 * composition.ts`). `order_files.purged` (E10.22b) est ecrit APRES le
 * retrait des objets, dans le meme bus, sans consommateur enregistre (§9 du
 * contrat). La purge des exports (E10.18c) N EMET AUCUN evenement (aucun
 * consommateur, meme motif que ci-dessus, et le registre `commercial_order_
 * exports` porte deja sa propre trace, contrat point 3(f)).
 *
 * qa-review round 1 (« REJETE »), corrige AVANT tout deploiement -- voir
 * `supabase/migrations/20260910000600` (garde durcie M1/N4, nettoyage
 * orphelins durci M2/N3, comptage des blocages B1) et
 * `supabase/migrations/20260910000700` (B2, BLOQUANT GRAVE : les fonctions
 * de confirmation de depot refusent desormais toute confirmation dont
 * l objet storage est deja plus vieux que le delai des orphelins -- ferme
 * PAR CONSTRUCTION la course entre une confirmation tardive et le nettoyage
 * des objets orphelins).
 *
 * Declenchee par un SECOND `pg_cron` + `pg_net`, DEDIE, QUOTIDIEN, DISTINCT
 * de celui de `magrit-outbox-dispatcher` (migration `20260910000500`, §3 du
 * contrat : "deux axes, deux cadences, deux declencheurs"). HORS de la
 * facade `/api/v1` -- un balayage n a pas de tenant, publier ce levier
 * d exploitation sur le contrat casserait le CA4 (meme raisonnement que
 * `magrit-outbox-dispatcher`, §8.13sexies point 2, repris ici §8.22 §9).
 *
 * Authentification ENTIEREMENT portee par le secret partage
 * `MAGRIT_ORDER_FILE_PURGE_SECRET` (en-tete `X-Magrit-Order-File-Purge-
 * Secret`), compare EN TEMPS CONSTANT (`timingSafeEqual`, REUTILISE depuis
 * `src/modules/_shared/application/outbox.ts` -- pas reimplemente ici, meme
 * discipline que `magrit-outbox-dispatcher`). Absent ou faux -> 401 SANS
 * CORPS, sans indiquer laquelle des deux causes. `verify_jwt = false`
 * (supabase/config.toml) : `pg_net` n a pas de JWT a presenter.
 *
 * Ne contient QUE l instanciation des adaptateurs (composition testable et
 * typecheckee = `createOrderFilePurgeSweepApplication()`,
 * src/server/api/order-file-purge-composition.ts, ET, depuis E10.18c,
 * `createOrderExportPurgeApplication()`,
 * src/server/api/order-export-purge-composition.ts) -- meme contre-mesure
 * que `createOutboxDispatchApplication()` pour la dette M1 (§8.2). Ce
 * fichier est HORS tsconfig (execution Deno requise), donc jamais
 * type-checke ici.
 *
 * LES DEUX APPLICATIONS S EXECUTENT INDEPENDAMMENT (chacune dans son propre
 * `try/catch`) : ce sont deux RESSOURCES distinctes (fichiers de commande vs.
 * fichiers d export), un echec de l une ne doit JAMAIS empecher l autre de
 * tourner -- meme raisonnement que les etapes internes de `PurgeSweepService`,
 * applique ICI a deux applications completes plutot qu a deux etapes d une
 * seule.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { timingSafeEqual } from '../../../src/modules/_shared/application/outbox.ts';
import { createOrderFilePurgeSweepApplication } from '../../../src/server/api/order-file-purge-composition.ts';
import { createOrderExportPurgeApplication } from '../../../src/server/api/order-export-purge-composition.ts';

const SECRET_HEADER = 'x-magrit-order-file-purge-secret';

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method !== 'POST') {
    return new Response(null, { status: 405 });
  }

  const expectedSecret = Deno.env.get('MAGRIT_ORDER_FILE_PURGE_SECRET');
  const presentedSecret = request.headers.get(SECRET_HEADER);
  if (!expectedSecret || !presentedSecret || !timingSafeEqual(expectedSecret, presentedSecret)) {
    // Sans corps, sans distinguer secret absent / secret faux (memes deux
    // causes que decrites en en-tete de fichier).
    return new Response(null, { status: 401 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[magrit-order-file-purge] SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY absents');
    return new Response(JSON.stringify({ ok: false, error: 'configuration serveur absente' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const serviceRoleClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let orderFilesReport: Readonly<{ blockedFiles: readonly unknown[] }> | null = null;
  let orderFilesError: string | null = null;
  try {
    const app = createOrderFilePurgeSweepApplication({
      serviceRoleClient,
      resendApiKey: Deno.env.get('RESEND_API_KEY') ?? null,
    });
    orderFilesReport = await app.runOnce();
    // B1 (qa-review round 1, BLOQUANT) — §5 du contrat : "l Edge Function
    // journalise ce compte a chaque tour". Le corps de reponse HTTP (ci-dessous)
    // n est pas un canal d observabilite fiable (reponse `pg_net` typiquement
    // non relue) : c est ce `console.warn`, visible dans les logs de l Edge
    // Function, qui rend le blocage REELLEMENT observable.
    if (orderFilesReport.blockedFiles.length > 0) {
      console.warn('[magrit-order-file-purge] fichiers bloques par la garde de purge, par espace et par motif', {
        blockedFiles: orderFilesReport.blockedFiles,
      });
    }
  } catch (error) {
    console.error('[magrit-order-file-purge] tour (fichiers de commande) en erreur', error);
    orderFilesError = error instanceof Error ? error.message : 'erreur inattendue';
  }

  // E10.18c — purge des fichiers D EXPORT COMPTABLE, RESSOURCE DISTINCTE,
  // dans son PROPRE try/catch (composition COMPRISE, qa-review round 2 : une
  // instanciation qui leverait ne doit pas non plus faire disparaitre le
  // rapport du balayage precedent) : un echec ici ne doit jamais empecher
  // le rapport du balayage precedent d etre rendu (et inversement). DEUX
  // etages depuis le round 3 (voir `OrderExportPurgeService`) : reclamation
  // normale (`filesMarkedExpired`/`objectsRemoved`) PUIS balayage d objets
  // orphelins, SOLUTION PORTEUSE (`orphanObjectsRemoved`).
  let orderExportsReport: Readonly<{
    filesMarkedExpired: number;
    objectsRemoved: number;
    orphanObjectsRemoved: number;
  }> | null = null;
  let orderExportsError: string | null = null;
  try {
    const exportPurgeApp = createOrderExportPurgeApplication({ serviceRoleClient });
    orderExportsReport = await exportPurgeApp.runOnce();
    // qa-review round 2, 3 PUIS 4 — meme discipline que `blockedFiles`
    // ci-dessus. `objectsRemoved` est une APPROXIMATION (filtrage sur la
    // reponse de l API Storage, jamais une preuve — voir
    // `order-export-purge-repository.ts`).
    //
    // CE QUE CETTE CONDITION COMPARE, ET RIEN DE PLUS (round 4) : les deux
    // chiffres portent sur l ETAGE 1 (reclamation normale) du TOUR COURANT.
    // Un ecart signale donc que, A CET ETAGE ET CE TOUR, des retraits n ont
    // pas ete confirmes. Elle ne dit RIEN de l etat residuel de ces lignes,
    // et deux raisons l en empechent :
    //   - l ETAGE 2 (balayage d objets orphelins) tourne JUSTE APRES et peut
    //     retirer ET confirmer une partie de ces memes lignes — leur
    //     `storage_path` est alors nul, contrairement a ce qu un lecteur
    //     deduirait de cet avertissement ;
    //   - les lignes DEJA au plafond `purge_attempts` ne sont plus reclamees,
    //     donc plus comptees dans `filesMarkedExpired` : cette condition est
    //     STRUCTURELLEMENT AVEUGLE a la population que le plafond cree, qui
    //     ne se lit qu en base (`status='expired' and storage_path is not
    //     null and purge_attempts >= 3`).
    // Observable uniquement ici : `pg_net` ne relit pas le corps HTTP.
    if (orderExportsReport.objectsRemoved < orderExportsReport.filesMarkedExpired) {
      console.warn(
        '[magrit-order-file-purge] etage 1 (reclamation normale), ce tour : des retraits Storage d exports comptables n ont pas ete confirmes. Le balayage d objets orphelins de ce meme tour a pu en rattraper une partie. Population au plafond a lire en base : status=expired and storage_path is not null and purge_attempts >= 3',
        {
          filesMarkedExpired: orderExportsReport.filesMarkedExpired,
          objectsRemoved: orderExportsReport.objectsRemoved,
          orphanObjectsRemoved: orderExportsReport.orphanObjectsRemoved,
        },
      );
    }
  } catch (error) {
    console.error('[magrit-order-file-purge] tour (fichiers d export comptable, E10.18c) en erreur', error);
    orderExportsError = error instanceof Error ? error.message : 'erreur inattendue';
  }

  const ok = orderFilesError === null && orderExportsError === null;
  return new Response(
    JSON.stringify({
      ok,
      orderFiles: orderFilesReport ?? { error: orderFilesError },
      orderExports: orderExportsReport ?? { error: orderExportsError },
    }),
    { status: ok ? 200 : 500, headers: { 'Content-Type': 'application/json' } },
  );
});
