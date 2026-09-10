/**
 * Edge Function `magrit-order-file-purge` (stories E10.22a/E10.22a-bis,
 * docs/api/CONVENTIONS.md §8.22 §3).
 *
 * Balayage QUOTIDIEN : reclame les rappels des DEUX paliers (`first` J+20,
 * `second` J+15), expire les rappels sans livraison confirmee au bout de la
 * fenetre, relit `GET /emails/{id}` pour les livraisons en attente de
 * confirmation. N ENVOIE AUCUN COURRIEL (§3 du contrat) -- l ecriture d
 * `order_files.purge_scheduled` dans `outbox_events` est remise au drain
 * EXISTANT (`magrit-outbox-dispatcher`, minute par minute), qui la porte au
 * `PurgeNoticeNotificationConsumer` (branche dans
 * `outbox-dispatch-composition.ts`).
 *
 * AUCUNE DESTRUCTION ICI (E10.22b, hors perimetre de ce lot) : rien n est
 * retire de `storage.objects`, aucune ligne n est marquee `purged_at`.
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
