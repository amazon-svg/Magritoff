/**
 * Edge Function `magrit-order-file-purge` (stories E10.22a/E10.22a-bis/
 * E10.22b/E10.22c, docs/api/CONVENTIONS.md §8.22 §3, §5, §6).
 *
 * Balayage QUOTIDIEN, ETENDU par E10.22b/E10.22c (PAS une nouvelle fonction,
 * meme fichier, meme declencheur -- voir `PurgeSweepService`) : reclame les
 * rappels des DEUX paliers (`first` J+20, `second` J+15), expire les rappels
 * sans livraison confirmee au bout de la fenetre, relit `GET /emails/{id}`
 * pour les livraisons en attente de confirmation, PURGE REELLEMENT les
 * fichiers dont les DEUX rappels sont CONFIRMES DELIVRES (E10.22b : octets
 * detruits, ligne conservee, objets retires par lot), compte et JOURNALISE
 * les fichiers BLOQUES par la garde (B1, qa-review round 1, BLOQUANT -- voir
 * plus bas), puis retire les objets orphelins du bucket (E10.22c, dette D7).
 * Le rappel N ENVOIE AUCUN COURRIEL (§3 du contrat) -- l ecriture d
 * `order_files.purge_scheduled` dans `outbox_events` est remise au drain
 * EXISTANT (`magrit-outbox-dispatcher`, minute par minute), qui la porte au
 * `PurgeNoticeNotificationConsumer` (branche dans `outbox-dispatch-
 * composition.ts`). `order_files.purged` (E10.22b) est ecrit APRES le
 * retrait des objets, dans le meme bus, sans consommateur enregistre (§9 du
 * contrat).
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
 * src/server/api/order-file-purge-composition.ts) -- meme contre-mesure que
 * `createOutboxDispatchApplication()` pour la dette M1 (§8.2). Ce fichier
 * est HORS tsconfig (execution Deno requise), donc jamais type-checke ici.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { timingSafeEqual } from '../../../src/modules/_shared/application/outbox.ts';
import { createOrderFilePurgeSweepApplication } from '../../../src/server/api/order-file-purge-composition.ts';

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

  const app = createOrderFilePurgeSweepApplication({
    serviceRoleClient,
    resendApiKey: Deno.env.get('RESEND_API_KEY') ?? null,
  });

  try {
    const report = await app.runOnce();
    // B1 (qa-review round 1, BLOQUANT) — §5 du contrat : "l Edge Function
    // journalise ce compte a chaque tour". Le corps de reponse HTTP (ci-dessous)
    // n est pas un canal d observabilite fiable (reponse `pg_net` typiquement
    // non relue) : c est ce `console.warn`, visible dans les logs de l Edge
    // Function, qui rend le blocage REELLEMENT observable.
    if (report.blockedFiles.length > 0) {
      console.warn('[magrit-order-file-purge] fichiers bloques par la garde de purge, par espace et par motif', {
        blockedFiles: report.blockedFiles,
      });
    }
    return new Response(JSON.stringify({ ok: true, ...report }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[magrit-order-file-purge] tour en erreur', error);
    return new Response(
      JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'erreur inattendue' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
});
