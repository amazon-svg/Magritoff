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

  // Correctif sécurité 2026-09-15 : même si une passerelle (celle en place ou
  // une future) construit encore `allResults`/`faultyProcess`, le contrat de
  // sortie de la route est la dernière barrière avant le client. Ce test porte
  // sur cette barrière elle-même (le schéma), pas sur l'implémentation
  // HTTP actuelle de la passerelle.
  it('ne laisse jamais passer allResults/faultyProcess vers le client, meme si la passerelle les construit encore', async () => {
    const gateway: ClariprintQuoteGateway = {
      async quote() {
        return {
          success: true,
          priceHT: 99,
          // @ts-expect-error — simule une passerelle non conforme, exactement le cas corrige
          allResults: [{ imprimeur: 'ImprimeurSecretGHI', external_id: 'INT-777' }],
          // @ts-expect-error — idem
          faultyProcess: { gamme_offset: 'FaultySecretJKL' },
        };
      },
    };
    const handler = createApiV1Application({ routes: createClariprintRoutes(new ClariprintService(gateway)), requestIdFactory: () => 'clariprint-leak-guard' });
    const response = await handler(new Request('http://localhost/api/v1/clariprint/quote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clariprint: { quantity: 500 } }) }));
    const text = await response.text();
    expect(text).not.toContain('ImprimeurSecretGHI');
    expect(text).not.toContain('INT-777');
    expect(text).not.toContain('FaultySecretJKL');
    expect(text).not.toContain('allResults');
    expect(text).not.toContain('faultyProcess');
  });

  // Correctif sécurité 2026-09-15 (mutation M8 survivante) : le contrat de
  // sortie de la route (`outputSchema: clariprintQuoteResultSchema`) délègue
  // la forme de `costs` au sous-schéma `clariprintCostsSchema`. Si ce
  // sous-schéma redevenait `.passthrough()`, un champ non documenté glissé
  // dans `costs` par n importe quelle passerelle (simulée ici, la vraie ou
  // une future) traverserait quand meme la barrière de sortie de la route,
  // meme si `allResults`/`faultyProcess` au niveau racine restent bloqués.
  it('ne laisse jamais passer un champ inconnu de costs vers le client, meme si la passerelle le construit', async () => {
    const gateway: ClariprintQuoteGateway = {
      async quote() {
        return {
          success: true,
          priceHT: 99,
          costs: {
            paper: 1,
            // @ts-expect-error — simule une passerelle qui glisse un champ non documente dans costs
            printer: 'TEMOIN_M8',
          },
        };
      },
    };
    const handler = createApiV1Application({ routes: createClariprintRoutes(new ClariprintService(gateway)), requestIdFactory: () => 'clariprint-costs-leak-guard' });
    const response = await handler(new Request('http://localhost/api/v1/clariprint/quote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clariprint: { quantity: 500 } }) }));
    const text = await response.text();
    expect(text).not.toContain('TEMOIN_M8');
  });
});
