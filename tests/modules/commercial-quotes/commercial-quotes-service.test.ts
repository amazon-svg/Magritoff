/**
 * Test unitaire de `CommercialQuotesService.send()` (story E10.10b-4c,
 * qa-review round 2), avec des FAUX pour TOUTES les dependances : verifie
 * l ORCHESTRATION exacte (ordre des appels, ce qui est transmis a qui),
 * sans passer par HTTP ni par le referentiel en memoire plus riche des
 * tests de contrat (`tests/contract/commercial-quotes.contract.test.ts`),
 * qui couvrent deja le comportement de bout en bout.
 *
 * Trois correctifs bloquants verifies ici precisement :
 *  - B2 : la generation n est declenchee QUE si `status === 'draft'` (jamais
 *    sur `accepted`/`rejected`/`converted`, que l ancienne condition
 *    `!isResend` couvrait a tort).
 *  - B4 : `resolveValidUntilForSend()` est appelee AVANT la generation, sa
 *    valeur transmise a la fois au moteur ET a `sendQuote()`.
 *  - B4-bis : `documents.persistRendered()` n est JAMAIS appelee tant que
 *    `repository.sendQuote()` n a pas REELLEMENT reussi — un envoi qui
 *    echoue apres une generation reussie ne laisse rien derriere lui.
 */
import { describe, expect, it, vi } from 'vitest';
import { CommercialQuotesService } from '@/modules/commercial-quotes/application/commercial-quotes-service';
import { QuoteSendForbiddenStatusError } from '@/modules/commercial-quotes/application/commercial-quotes-repository';
import type { TenantId, UserId } from '@/kernel';

const TENANT = 'tenant-1' as TenantId;
const ACTOR = 'user-1' as UserId;
const QUOTE_ID = 'quote-1';

function quoteSummary(status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'converted') {
  return {
    id: QUOTE_ID,
    tenant_id: TENANT,
    customer_id: 'customer-1',
    project_id: 'project-1',
    source_quote_id: null,
    number: 'DEV-2026-00042',
    status,
    valid_until: null,
    show_discounts: true,
    global_discount_rate: null,
    target_net_total: null,
    vat_rate: null,
    totals: {
      lines_subtotal: '120.00',
      global_discount: '0.00',
      effective_discount_rate: null,
      net_total: '120.00',
      vat_rate: '0.2000',
      vat_regime: 'metropole_fr',
      vat_amount: '24.00',
      total_incl_tax: '144.00',
    },
    warnings: [],
    sent_at: status === 'draft' ? null : '2026-09-01T10:00:00.000Z',
    last_sent_at: status === 'draft' ? null : '2026-09-01T10:00:00.000Z',
    sent_by: null,
    decided_at: null,
    decided_by_account_id: null,
    converted_at: null,
    created_by: ACTOR,
    created_at: '2026-09-01T09:00:00.000Z',
    updated_at: '2026-09-01T09:00:00.000Z',
  };
}

function quoteDetail(status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'converted') {
  return {
    ...quoteSummary(status),
    lines: [
      {
        id: 'line-1',
        quote_id: QUOTE_ID,
        origin: 'free' as const,
        project_item_id: null,
        label: 'Flyers A5',
        product_config: {},
        quantity: 200,
        position: 0,
        production_price: '60.00',
        public_price: '120.00',
        customer_price: '120.00',
        applied_margin_rate: '1.0000',
        applied_rule_id: null,
        sale_price: '120.00',
        sale_margin_rate: null,
        discount_rate: null,
        margin_variation: null,
        breakdown: [{ post: 'total' as const, cost: '60.00', margin_rate: '1.0000', price: '120.00', source: 'prix_marche' as const }],
        warnings: [],
        created_at: '2026-09-01T09:00:00.000Z',
      },
    ],
  };
}

function buildService(overrides: {
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'converted';
  resolvedValidUntil?: string | null;
  renderResult?: unknown;
  sendQuoteImpl?: () => Promise<any>;
  persistRenderedImpl?: () => Promise<any>;
}) {
  const findById = vi.fn(async () => quoteSummary(overrides.status));
  const findDetailById = vi.fn(async () => quoteDetail(overrides.status));
  const resolveValidUntilForSend = vi.fn(async () => overrides.resolvedValidUntil ?? null);
  const sendQuote = vi.fn(
    overrides.sendQuoteImpl ?? (async () => ({ ...quoteDetail('sent'), status: 'sent' as const })),
  );

  const repository = {
    findById,
    findDetailById,
    resolveValidUntilForSend,
    sendQuote,
  } as any;

  const outbox = { publish: vi.fn(async () => undefined) } as any;

  const renderForFirstSend = vi.fn(async () => overrides.renderResult ?? null);
  const persistRendered = vi.fn(
    overrides.persistRenderedImpl ?? (async () => ({ quote_id: QUOTE_ID, template_id: 'template-1' })),
  );
  const documents = { renderForFirstSend, persistRendered } as any;

  const service = new CommercialQuotesService({
    repository,
    outbox,
    projects: {} as any,
    priceRules: {} as any,
    pricingEngine: {} as any,
    documents,
    now: () => new Date('2026-09-09T10:00:00.000Z'),
  });

  return { service, findById, findDetailById, resolveValidUntilForSend, sendQuote, outbox, renderForFirstSend, persistRendered };
}

describe('CommercialQuotesService.send — qa-review B2 (generation strictement au premier envoi)', () => {
  it("appelle la generation quand le devis est 'draft' (premier envoi)", async () => {
    const { service, renderForFirstSend } = buildService({ status: 'draft' });
    await service.send(TENANT, ACTOR, QUOTE_ID, {});
    expect(renderForFirstSend).toHaveBeenCalledTimes(1);
  });

  it("N APPELLE PAS la generation sur un RENVOI ('sent') — deja couvert avant B2, non regresse", async () => {
    const { service, renderForFirstSend } = buildService({ status: 'sent' });
    await service.send(TENANT, ACTOR, QUOTE_ID, {});
    expect(renderForFirstSend).not.toHaveBeenCalled();
  });

  it("N APPELLE PAS la generation sur un devis 'accepted' — BUG B2 : l ancienne condition (!isResend) l aurait declenchee a tort", async () => {
    const { service, renderForFirstSend, sendQuote } = buildService({
      status: 'accepted',
      sendQuoteImpl: async () => {
        throw new QuoteSendForbiddenStatusError();
      },
    });

    await expect(service.send(TENANT, ACTOR, QUOTE_ID, {})).rejects.toBeInstanceOf(QuoteSendForbiddenStatusError);
    expect(renderForFirstSend).not.toHaveBeenCalled();
    expect(sendQuote).toHaveBeenCalledTimes(1);
  });

  it("N APPELLE PAS la generation sur un devis 'rejected'", async () => {
    const { service, renderForFirstSend } = buildService({
      status: 'rejected',
      sendQuoteImpl: async () => {
        throw new QuoteSendForbiddenStatusError();
      },
    });
    await expect(service.send(TENANT, ACTOR, QUOTE_ID, {})).rejects.toBeInstanceOf(QuoteSendForbiddenStatusError);
    expect(renderForFirstSend).not.toHaveBeenCalled();
  });

  it("N APPELLE PAS la generation sur un devis 'converted'", async () => {
    const { service, renderForFirstSend } = buildService({
      status: 'converted',
      sendQuoteImpl: async () => {
        throw new QuoteSendForbiddenStatusError();
      },
    });
    await expect(service.send(TENANT, ACTOR, QUOTE_ID, {})).rejects.toBeInstanceOf(QuoteSendForbiddenStatusError);
    expect(renderForFirstSend).not.toHaveBeenCalled();
  });
});

describe('CommercialQuotesService.send — qa-review B4 (valid_until resolue AVANT generation, transmise telle quelle)', () => {
  it('resout valid_until AVANT d appeler renderForFirstSend, et transmet la MEME valeur au moteur ET a sendQuote', async () => {
    const callOrder: string[] = [];
    const { service, resolveValidUntilForSend, renderForFirstSend, sendQuote } = buildService({
      status: 'draft',
      resolvedValidUntil: '2026-10-09',
    });
    resolveValidUntilForSend.mockImplementation(async () => {
      callOrder.push('resolveValidUntilForSend');
      return '2026-10-09';
    });
    renderForFirstSend.mockImplementation(async (_tenant: unknown, quote: any) => {
      callOrder.push('renderForFirstSend');
      expect(quote.validUntil).toBe('2026-10-09');
      return null;
    });
    sendQuote.mockImplementation(async (...args: any[]) => {
      callOrder.push('sendQuote');
      expect(args[4]).toBe('2026-10-09'); // p_resolved_valid_until
      return { ...quoteDetail('sent'), status: 'sent' as const };
    });

    await service.send(TENANT, ACTOR, QUOTE_ID, {});

    expect(callOrder).toEqual(['resolveValidUntilForSend', 'renderForFirstSend', 'sendQuote']);
  });

  it('ne resout PAS valid_until sur un renvoi (le mecanisme ne concerne que le premier envoi)', async () => {
    const { service, resolveValidUntilForSend } = buildService({ status: 'sent' });
    await service.send(TENANT, ACTOR, QUOTE_ID, {});
    expect(resolveValidUntilForSend).not.toHaveBeenCalled();
  });
});

describe('CommercialQuotesService.send — qa-review B4-bis (persistance UNIQUEMENT apres succes confirme)', () => {
  const rendered = { templateId: 'template-1', bytes: new Uint8Array([1, 2, 3]), pageCount: 1, generatedAt: '2026-09-09T10:00:00.000Z' };

  it('un envoi qui ECHOUE apres une generation REUSSIE ne persiste RIEN (aucun appel a persistRendered)', async () => {
    const { service, renderForFirstSend, persistRendered, sendQuote } = buildService({
      status: 'draft',
      renderResult: rendered,
      sendQuoteImpl: async () => {
        throw new Error('conflit de concurrence (If-Match perimee)');
      },
    });

    await expect(service.send(TENANT, ACTOR, QUOTE_ID, {})).rejects.toThrow('conflit de concurrence');

    expect(renderForFirstSend).toHaveBeenCalledTimes(1);
    expect(sendQuote).toHaveBeenCalledTimes(1);
    // LE COEUR DU CORRECTIF : rien n est jamais persiste si l envoi echoue.
    expect(persistRendered).not.toHaveBeenCalled();
  });

  it("un envoi REUSSI persiste le document APRES sendQuote, jamais avant (ordre verifie)", async () => {
    const callOrder: string[] = [];
    const { service, sendQuote, persistRendered } = buildService({ status: 'draft', renderResult: rendered });
    sendQuote.mockImplementation(async () => {
      callOrder.push('sendQuote');
      return { ...quoteDetail('sent'), status: 'sent' as const };
    });
    persistRendered.mockImplementation(async () => {
      callOrder.push('persistRendered');
      return { quote_id: QUOTE_ID, template_id: 'template-1' };
    });

    await service.send(TENANT, ACTOR, QUOTE_ID, {});

    expect(callOrder).toEqual(['sendQuote', 'persistRendered']);
    expect(persistRendered).toHaveBeenCalledWith(TENANT, ACTOR, QUOTE_ID, rendered);
  });

  it("un ECHEC de persistance APRES un envoi reussi ne fait pas echouer l operation entiere (best effort, devis deja reellement envoye)", async () => {
    const { service, outbox } = buildService({
      status: 'draft',
      renderResult: rendered,
      persistRenderedImpl: async () => {
        throw new Error('bucket indisponible');
      },
    });

    await expect(service.send(TENANT, ACTOR, QUOTE_ID, {})).resolves.toMatchObject({ status: 'sent' });
    // L evenement quote.sent part quand meme : le devis EST reellement envoye.
    expect(outbox.publish).toHaveBeenCalledTimes(1);
  });

  it('aucun gabarit eligible (renderForFirstSend rend null) : persistRendered jamais appelee, envoi normal', async () => {
    const { service, persistRendered, sendQuote } = buildService({ status: 'draft', renderResult: null });
    await service.send(TENANT, ACTOR, QUOTE_ID, {});
    expect(sendQuote).toHaveBeenCalledTimes(1);
    expect(persistRendered).not.toHaveBeenCalled();
  });
});
