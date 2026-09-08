/**
 * SupabaseQuoteNotificationGateway.resolveRecipients — garde-fou d isolation
 * tenant (qa-review E10.10b-3 round 1, B2).
 *
 * Ce client est `service_role` (voir commercial-quotes-repository.ts,
 * en-tete de section E10.10b-3) : la RLS est structurellement contournee,
 * la SEULE protection reelle tient a la requete PostgREST elle-meme —
 * `.eq('customer_contacts.customer_id', ...)`, `.eq('shops.tenant_id', ...)`
 * et `.in('status', ['active', 'invited'])`. Avant ce test, aucun faux
 * client du depot n observait ces appels : le faux de
 * `outbox-dispatch-composition.test.ts` accepte `.eq()`/`.in()` sans jamais
 * enregistrer colonne/valeur (il rend toujours `options.recipientRows`,
 * filtres ou non) — un code qui retirerait `.eq('shops.tenant_id', ...)`
 * resterait vert partout ailleurs. Ce test observe REELLEMENT les couples
 * (colonne, valeur) passes a `.eq()`/`.in()` sur la chaine de resolution,
 * pas seulement le resultat rendu.
 */
import { describe, expect, it } from 'vitest';
import { SupabaseQuoteNotificationGateway } from '@/adapters/supabase/commercial-quotes-repository';
import type { TenantId } from '@/kernel';

function brand<T extends string>(value: string): T {
  return value as T;
}

const TENANT = brand<TenantId>('7f0d2a1e-1c4b-4f8a-9c3d-5b6e7a8f9012');
const CUSTOMER_ID = '11111111-1111-4111-8111-111111111111';

/**
 * Faux client PostgREST DEDIE a `shop_customer_accounts` : contrairement au
 * faux de `outbox-dispatch-composition.test.ts`, `.eq()` et `.in()`
 * ENREGISTRENT chaque couple (colonne, valeur) recu — la structure de test
 * permet de distinguer "filtre pose et respecte" de "filtre ignore, bon
 * resultat par coincidence du fixture".
 */
function fakeServiceRoleClient(recipientRows: readonly Record<string, unknown>[]) {
  const eqCalls: Array<{ column: string; value: unknown }> = [];
  const inCalls: Array<{ column: string; values: readonly unknown[] }> = [];

  const client = {
    eqCalls,
    inCalls,
    from(table: string) {
      if (table !== 'shop_customer_accounts') {
        throw new Error(`table inattendue dans ce faux: ${table}`);
      }
      const builder = {
        select: (_columns: string) => builder,
        eq(column: string, value: unknown) {
          eqCalls.push({ column, value });
          return builder;
        },
        async in(column: string, values: readonly unknown[]) {
          inCalls.push({ column, values });
          return { data: recipientRows, error: null };
        },
      };
      return builder;
    },
  };

  return client;
}

describe('SupabaseQuoteNotificationGateway.resolveRecipients — garde-fou tenant (qa-review round 1, B2)', () => {
  it('pose les TROIS filtres reels — customer_contacts.customer_id, shops.tenant_id et le statut — pas seulement sur le resultat rendu', async () => {
    const client = fakeServiceRoleClient([
      {
        email: 'client@example.com',
        full_name: 'Jean Dupont',
        status: 'active',
        shops: { slug: 'atelier-test', name: 'Atelier Test' },
      },
    ]);
    const gateway = new SupabaseQuoteNotificationGateway(client as any);

    const recipients = await gateway.resolveRecipients(TENANT, CUSTOMER_ID);

    // Ordre et contenu EXACTS des appels `.eq()` — un correctif qui
    // retirerait `shops.tenant_id` (ou en changerait la valeur) fait
    // echouer cette assertion, meme si le fixture ne contient qu un seul
    // tenant et que le resultat rendu semblerait correct par coincidence.
    expect(client.eqCalls).toEqual([
      { column: 'customer_contacts.customer_id', value: CUSTOMER_ID },
      { column: 'shops.tenant_id', value: TENANT },
    ]);
    expect(client.inCalls).toEqual([{ column: 'status', values: ['active', 'invited'] }]);

    expect(recipients).toEqual([
      {
        email: 'client@example.com',
        customerName: 'Jean Dupont',
        shopSlug: 'atelier-test',
        shopName: 'Atelier Test',
      },
    ]);
  });

  it('pose les memes trois filtres meme quand la resolution ne rend aucun destinataire', async () => {
    const client = fakeServiceRoleClient([]);
    const gateway = new SupabaseQuoteNotificationGateway(client as any);

    const recipients = await gateway.resolveRecipients(TENANT, CUSTOMER_ID);

    expect(client.eqCalls).toEqual([
      { column: 'customer_contacts.customer_id', value: CUSTOMER_ID },
      { column: 'shops.tenant_id', value: TENANT },
    ]);
    expect(client.inCalls).toEqual([{ column: 'status', values: ['active', 'invited'] }]);
    expect(recipients).toEqual([]);
  });
});
