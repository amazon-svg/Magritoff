import { describe, expect, it } from 'vitest';
import { ClariprintApiClient } from '@/modules/clariprint/api/client';
import type { ClariprintQuoteGateway } from '@/modules/clariprint/application/clariprint-quote-gateway';
import { ClariprintService } from '@/modules/clariprint/application/clariprint-service';
import { FetchApiClient } from '@/platform/api';
import { createApiV1Application } from '@/server/api/composition';
import { createClariprintRoutes } from '@/server/api/clariprint-routes';

describe('route API devis Clariprint', () => {
  it('partage le contrat avec le client navigateur et reste disponible au storefront public', async () => {
    const gateway: ClariprintQuoteGateway = { async quote(command) { return { success: true, priceHT: command.clariprint.quantity === 500 ? 99 : 0 }; } };
    const handler = createApiV1Application({ routes: createClariprintRoutes(new ClariprintService(gateway)), requestIdFactory: () => 'clariprint-test' });
    const bridge = ((input: RequestInfo | URL, init?: RequestInit) => handler(new Request(input, init))) as typeof fetch;
    const client = new ClariprintApiClient(new FetchApiClient('https://magrit.test', bridge));
    await expect(client.quote({ clariprint: { quantity: 500 } })).resolves.toEqual({ success: true, priceHT: 99 });
  });

  it('rejette une configuration absente avant le fournisseur', async () => {
    let called = false;
    const gateway: ClariprintQuoteGateway = { async quote() { called = true; return { success: true, priceHT: 1 }; } };
    const handler = createApiV1Application({ routes: createClariprintRoutes(new ClariprintService(gateway)), requestIdFactory: () => 'clariprint-invalid' });
    const response = await handler(new Request('http://localhost/api/v1/clariprint/quote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }));
    expect(response.status).toBe(422);
    expect(called).toBe(false);
  });
});
