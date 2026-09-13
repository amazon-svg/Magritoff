/**
 * Edge Function `magrit-order-export-runner` (story E10.18c, contrat §8.24
 * §3(b)).
 *
 * Drain de GENERATION reel de `commercial_order_exports` : reclame un lot
 * borne, lit chaque export par pages (`api_read_order_export_rows`), rend
 * le fichier (CSV aujourd hui, XLSX en E10.18d) et le depose. Declenchee de
 * l EXTERIEUR par SON PROPRE `pg_cron` + `pg_net`, A LA MINUTE
 * (planification differee, meme motif que `magrit-notification-sender` :
 * secrets Vault inconnus a l ecriture de la migration
 * `20260913000000_gescom_e10_18c_order_exports.sql`).
 *
 * DISTINCTE de `magrit-notification-sender` ET de
 * `magrit-outbox-dispatcher` (meme raisonnement que §8.23 §3(c) : un export
 * peut occuper l isolat plusieurs secondes, le faire passer dans le tour
 * qui envoie les courriels ferait attendre une notification client derriere
 * un tableur). Trois axes, trois isolats.
 *
 * HORS de la facade `/api/v1` (`magrit-api`) : un drain n a pas de tenant,
 * il balaie TOUS les espaces. N accepte qu un appel portant
 * `X-Magrit-Order-Export-Run-Secret` (secret `MAGRIT_ORDER_EXPORT_RUN_SECRET`),
 * compare EN TEMPS CONSTANT (`timingSafeEqual`, REUTILISE depuis
 * `src/modules/_shared/application/outbox.ts`, JAMAIS reimplemente). Absent
 * ou faux -> 401 SANS CORPS, sans indiquer laquelle des deux causes.
 * `verify_jwt = false` (supabase/config.toml) : pg_net n a pas de JWT a
 * presenter, l authentification est ENTIEREMENT portee par ce secret.
 *
 * Ne contient QUE l instanciation des adaptateurs (composition testable et
 * typecheckee = `createOrderExportRunApplication()`,
 * src/server/api/order-export-composition.ts) — meme contre-mesure que les
 * deux autres drains pour la dette M1 (§8.2). Ce fichier est HORS tsconfig
 * (execution Deno requise), donc jamais type-checke ici : toute logique de
 * composition testable vit dans le fichier ci-dessus.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { timingSafeEqual } from '../../../src/modules/_shared/application/outbox.ts';
import { createOrderExportRunApplication } from '../../../src/server/api/order-export-composition.ts';

const SECRET_HEADER = 'x-magrit-order-export-run-secret';

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method !== 'POST') {
    return new Response(null, { status: 405 });
  }

  const expectedSecret = Deno.env.get('MAGRIT_ORDER_EXPORT_RUN_SECRET');
  const presentedSecret = request.headers.get(SECRET_HEADER);
  if (!expectedSecret || !presentedSecret || !timingSafeEqual(expectedSecret, presentedSecret)) {
    return new Response(null, { status: 401 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[magrit-order-export-runner] SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY absents');
    return new Response(JSON.stringify({ ok: false, error: 'configuration serveur absente' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const serviceRoleClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const app = createOrderExportRunApplication({
    serviceRoleClient,
    onUnhandledError: (error, exportId) => {
      console.error('[magrit-order-export-runner] export en erreur', exportId, error);
    },
  });

  try {
    const report = await app.runOnce();
    return new Response(JSON.stringify({ ok: true, ...report }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[magrit-order-export-runner] tour en erreur', error);
    return new Response(
      JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'erreur inattendue' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
});
