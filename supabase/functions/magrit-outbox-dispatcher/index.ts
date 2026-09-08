/**
 * Edge Function `magrit-outbox-dispatcher` (story E10.10b-3,
 * docs/api/CONVENTIONS.md §8.13sexies).
 *
 * Drain periodique de `outbox_events` : reclame un lot borne, remet chaque
 * evenement au consommateur enregistre (aujourd hui : `quote.sent` -> client,
 * via Resend), rend la main. Declenchee de l EXTERIEUR par `pg_cron` +
 * `pg_net` (migration 20260908000000) — le declencheur est interchangeable,
 * cette fonction n en connait rien.
 *
 * HORS de la facade `/api/v1` (`magrit-api`) : un drain n a pas de tenant, il
 * balaie TOUS les espaces. Publier ce levier d exploitation sur le contrat
 * `/api/v1` serait une entorse au CA4 (§8.13sexies point 2). Ce n est PAS un
 * endpoint public au sens de R1 : elle n accepte qu un appel portant
 * `X-Magrit-Outbox-Secret` (nouveau secret `MAGRIT_OUTBOX_DISPATCH_SECRET`),
 * compare EN TEMPS CONSTANT (`timingSafeEqual`, reutilise depuis
 * `src/modules/_shared/application/outbox.ts` — pas reimplemente ici).
 * Absent ou faux -> 401 SANS CORPS, sans indiquer laquelle des deux causes.
 * `verify_jwt = false` (supabase/config.toml) : pg_net n a pas de JWT a
 * presenter, l authentification est ENTIEREMENT portee par ce secret.
 *
 * Ne contient QUE l instanciation des adaptateurs (composition testable et
 * typecheckee = `createOutboxDispatchApplication()`,
 * src/server/api/outbox-dispatch-composition.ts) — meme contre-mesure que
 * `createMagritApiApplication()` pour la dette M1 (§8.2). Ce fichier est
 * HORS tsconfig (execution Deno requise), donc jamais type-checke ici :
 * toute logique de composition testable vit dans le fichier ci-dessus.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { timingSafeEqual } from '../../../src/modules/_shared/application/outbox.ts';
import { createOutboxDispatchApplication } from '../../../src/server/api/outbox-dispatch-composition.ts';

const SECRET_HEADER = 'x-magrit-outbox-secret';

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method !== 'POST') {
    return new Response(null, { status: 405 });
  }

  const expectedSecret = Deno.env.get('MAGRIT_OUTBOX_DISPATCH_SECRET');
  const presentedSecret = request.headers.get(SECRET_HEADER);
  if (!expectedSecret || !presentedSecret || !timingSafeEqual(expectedSecret, presentedSecret)) {
    // Sans corps, sans distinguer secret absent / secret faux (memes deux
    // causes que decrites en en-tete de fichier).
    return new Response(null, { status: 401 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[magrit-outbox-dispatcher] SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY absents');
    return new Response(JSON.stringify({ ok: false, error: 'configuration serveur absente' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const serviceRoleClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const app = createOutboxDispatchApplication({
    serviceRoleClient,
    resendApiKey: Deno.env.get('RESEND_API_KEY') ?? null,
    fromEmail: Deno.env.get('MAGRIT_FROM_EMAIL') ?? 'Magrit <devis@magritapp.com>',
    publicAppUrl: Deno.env.get('MAGRIT_PUBLIC_APP_URL') ?? null,
    onUnhandledError: (error, event) => {
      console.error('[magrit-outbox-dispatcher] consommateur en erreur', event.name, event.id, error);
    },
  });

  try {
    const report = await app.runOnce();
    return new Response(JSON.stringify({ ok: true, ...report }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[magrit-outbox-dispatcher] tour en erreur', error);
    return new Response(
      JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'erreur inattendue' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
});
