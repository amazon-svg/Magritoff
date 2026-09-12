/**
 * Edge Function `magrit-notification-sender` (story E10.15c, contrat §8.23
 * §3(c)).
 *
 * Drain d ENVOI reel de `notification_logs` : reclame un lot borne, remet
 * chaque message a l adaptateur de SON canal (aujourd hui : `email`, via
 * Resend), rend la main. Declenchee de l EXTERIEUR par SON PROPRE `pg_cron`
 * + `pg_net`, A LA MINUTE (planification differee, meme motif que
 * `magrit-outbox-dispatcher` : secrets Vault inconnus a l ecriture de la
 * migration — voir `supabase/migrations/20260912000100_gescom_e10_15c_
 * notification_dispatch.sql`).
 *
 * DISTINCTE de `magrit-outbox-dispatcher` (§8.23 §3(c), « pas dans le tour
 * du drain outbox, qui ferait attendre la publication des faits metier
 * derriere vingt-cinq appels reseau ») : deux axes, deux isolats, MEME
 * cadence cette fois (la promptitude est ici la qualite recherchee).
 *
 * HORS de la facade `/api/v1` (`magrit-api`) : un drain n a pas de tenant,
 * il balaie TOUS les espaces (meme raisonnement que `magrit-outbox-
 * dispatcher`, §8.13sexies point 2). N accepte qu un appel portant
 * `X-Magrit-Notification-Send-Secret` (secret `MAGRIT_NOTIFICATION_SEND_SECRET`),
 * compare EN TEMPS CONSTANT (`timingSafeEqual`, reutilise depuis
 * `src/modules/_shared/application/outbox.ts` — pas reimplemente ici).
 * Absent ou faux -> 401 SANS CORPS, sans indiquer laquelle des deux causes.
 * `verify_jwt = false` (supabase/config.toml) : pg_net n a pas de JWT a
 * presenter, l authentification est ENTIEREMENT portee par ce secret.
 *
 * Ne contient QUE l instanciation des adaptateurs (composition testable et
 * typecheckee = `createNotificationSendApplication()`,
 * src/server/api/notification-send-composition.ts) — meme contre-mesure que
 * `createOutboxDispatchApplication()` pour la dette M1 (§8.2). Ce fichier
 * est HORS tsconfig (execution Deno requise), donc jamais type-checke ici :
 * toute logique de composition testable vit dans le fichier ci-dessus.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { timingSafeEqual } from '../../../src/modules/_shared/application/outbox.ts';
import { createNotificationSendApplication } from '../../../src/server/api/notification-send-composition.ts';

const SECRET_HEADER = 'x-magrit-notification-send-secret';

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method !== 'POST') {
    return new Response(null, { status: 405 });
  }

  const expectedSecret = Deno.env.get('MAGRIT_NOTIFICATION_SEND_SECRET');
  const presentedSecret = request.headers.get(SECRET_HEADER);
  if (!expectedSecret || !presentedSecret || !timingSafeEqual(expectedSecret, presentedSecret)) {
    // Sans corps, sans distinguer secret absent / secret faux (memes deux
    // causes que decrites en en-tete de fichier).
    return new Response(null, { status: 401 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[magrit-notification-sender] SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY absents');
    return new Response(JSON.stringify({ ok: false, error: 'configuration serveur absente' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const serviceRoleClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const app = createNotificationSendApplication({
    serviceRoleClient,
    resendApiKey: Deno.env.get('RESEND_API_KEY') ?? null,
    fromEmail: Deno.env.get('MAGRIT_FROM_EMAIL') ?? 'Magrit <devis@magritapp.com>',
    onUnhandledError: (error, message) => {
      console.error('[magrit-notification-sender] adaptateur en erreur', message.channel, message.id, error);
    },
  });

  try {
    const report = await app.runOnce();
    return new Response(JSON.stringify({ ok: true, ...report }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[magrit-notification-sender] tour en erreur', error);
    return new Response(
      JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'erreur inattendue' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
});
