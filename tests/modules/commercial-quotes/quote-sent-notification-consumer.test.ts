import { describe, expect, it, vi } from 'vitest';
import {
  buildAccountQuotesLink,
  formatFrenchDate,
  QuoteSentNotificationConsumer,
  type QuoteNotificationGateway,
  type QuoteSentEmailSender,
} from '@/modules/commercial-quotes/application/quote-sent-notification-consumer';
import { portalRuntimePaths } from '@/app/surfaces/portalRuntimePaths';
import type { ClaimedOutboxEvent } from '@/modules/_shared/application';
import type { TenantId } from '@/kernel';

const TENANT = 'tenant-1' as TenantId;

function baseEvent(overrides: Partial<ClaimedOutboxEvent['payload']> = {}): ClaimedOutboxEvent {
  return Object.freeze({
    id: 'event-1',
    tenantId: TENANT,
    name: 'quote.sent',
    version: 1,
    aggregateType: 'quote',
    aggregateId: 'quote-1',
    occurredAt: '2026-09-08T10:00:00.000Z',
    deliveryAttempts: 1,
    payload: Object.freeze({
      quote_id: 'quote-1',
      customer_id: 'customer-1',
      number: 'DEV-2026-00042',
      is_resend: false,
      ...overrides,
    }),
  });
}

const recipient = {
  email: 'client@example.com',
  customerName: 'Jean Dupont',
  shopSlug: 'atelier-test',
  shopName: 'Atelier Test',
};

function buildGateway(overrides: Partial<QuoteNotificationGateway> = {}): QuoteNotificationGateway {
  return {
    async getQuoteContext() {
      return { validUntil: '2026-09-12' };
    },
    async resolveRecipients() {
      return [recipient];
    },
    ...overrides,
  };
}

describe('buildAccountQuotesLink — parité avec portalRuntimePaths (piège explicitement signalé)', () => {
  it('produit EXACTEMENT le chemin décrit par le registre de surfaces côté navigateur', () => {
    const slug = 'atelier-test';
    const expectedPath = `/${portalRuntimePaths.shopRoot.replace(':slug', slug)}/${portalRuntimePaths.accountQuotes}`;

    const link = buildAccountQuotesLink('https://magritapp.com', slug);

    expect(new URL(link).pathname).toBe(expectedPath);
    // Si quelqu un renomme la route du portail (shopRoot ou accountQuotes)
    // sans mettre à jour le littéral serveur, cette assertion tombe.
    expect(expectedPath).toBe('/shop/atelier-test/account/quotes');
  });

  it('retire les barres obliques finales de la base et encode le slug', () => {
    expect(buildAccountQuotesLink('https://magritapp.com/', 'un slug')).toBe(
      'https://magritapp.com/shop/un%20slug/account/quotes',
    );
  });
});

describe('formatFrenchDate', () => {
  it('formate une date Postgres (YYYY-MM-DD) en français lisible', () => {
    expect(formatFrenchDate('2026-09-12')).toBe('12 septembre 2026');
    expect(formatFrenchDate('2026-01-01')).toBe('1 janvier 2026');
  });

  it('rend la valeur telle quelle si le format est inattendu (défensif)', () => {
    expect(formatFrenchDate('not-a-date')).toBe('not-a-date');
  });
});

describe('QuoteSentNotificationConsumer', () => {
  it('livre sans envoyer de courriel quand aucun destinataire ne correspond (cas nominal, pas un échec)', async () => {
    const send = vi.fn();
    const gateway = buildGateway({ async resolveRecipients() { return []; } });
    const consumer = new QuoteSentNotificationConsumer({
      gateway,
      emailSender: { send },
      baseUrl: 'https://magritapp.com',
    });

    await expect(consumer.consume(baseEvent())).resolves.toEqual({ delivered: true });
    expect(send).not.toHaveBeenCalled();
  });

  it('livre sans envoyer de courriel quand le devis est introuvable dans ce tenant (défensif, pas un échec)', async () => {
    const send = vi.fn();
    const gateway = buildGateway({ async getQuoteContext() { return null; } });
    const consumer = new QuoteSentNotificationConsumer({
      gateway,
      emailSender: { send },
      baseUrl: 'https://magritapp.com',
    });

    await expect(consumer.consume(baseEvent())).resolves.toEqual({ delivered: true });
    expect(send).not.toHaveBeenCalled();
  });

  it('échoue explicitement (pas de repli silencieux) quand MAGRIT_PUBLIC_APP_URL est absente', async () => {
    const send = vi.fn();
    const consumer = new QuoteSentNotificationConsumer({
      gateway: buildGateway(),
      emailSender: { send },
      baseUrl: null,
    });

    const result = await consumer.consume(baseEvent());
    expect(result.delivered).toBe(false);
    expect((result as { reason: string }).reason).toContain('MAGRIT_PUBLIC_APP_URL');
    expect(send).not.toHaveBeenCalled();
  });

  it('échoue sur une charge utile invalide (défense en profondeur)', async () => {
    const consumer = new QuoteSentNotificationConsumer({
      gateway: buildGateway(),
      emailSender: { send: vi.fn() },
      baseUrl: 'https://magritapp.com',
    });

    const malformed = baseEvent();
    const result = await consumer.consume({ ...malformed, payload: { quote_id: 'quote-1' } });
    expect(result.delivered).toBe(false);
  });

  it('envoie un courriel par destinataire, avec le lien et la date de validité résolus à la remise', async () => {
    const send = vi.fn(async () => ({ sent: true }));
    const gateway = buildGateway();
    const consumer = new QuoteSentNotificationConsumer({
      gateway,
      emailSender: { send },
      baseUrl: 'https://magritapp.com',
    });

    await expect(consumer.consume(baseEvent())).resolves.toEqual({ delivered: true });

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({
      to: recipient.email,
      customerName: recipient.customerName,
      shopName: recipient.shopName,
      quoteNumber: 'DEV-2026-00042',
      validUntilLabel: '12 septembre 2026',
      isResend: false,
      link: 'https://magritapp.com/shop/atelier-test/account/quotes',
    });
  });

  it("transmet is_resend tel que porté par l événement (aucune inférence côté relais)", async () => {
    const send = vi.fn(async () => ({ sent: true }));
    const consumer = new QuoteSentNotificationConsumer({
      gateway: buildGateway(),
      emailSender: { send },
      baseUrl: 'https://magritapp.com',
    });

    await consumer.consume(baseEvent({ is_resend: true }));

    expect(send).toHaveBeenCalledWith(expect.objectContaining({ isResend: true }));
  });

  it("n invente aucune date : validUntilLabel est null si le devis n a pas de valid_until", async () => {
    const send = vi.fn(async () => ({ sent: true }));
    const gateway = buildGateway({ async getQuoteContext() { return { validUntil: null }; } });
    const consumer = new QuoteSentNotificationConsumer({
      gateway,
      emailSender: { send },
      baseUrl: 'https://magritapp.com',
    });

    await consumer.consume(baseEvent());

    expect(send).toHaveBeenCalledWith(expect.objectContaining({ validUntilLabel: null }));
  });

  it('un client avec deux comptes dans deux boutiques reçoit DEUX courriels, chacun avec SON lien (jamais un courriel à deux liens)', async () => {
    const send = vi.fn(async () => ({ sent: true }));
    const gateway = buildGateway({
      async resolveRecipients() {
        return [
          recipient,
          { email: 'jean@boutique-2.example.com', customerName: 'Jean Dupont', shopSlug: 'boutique-2', shopName: 'Boutique 2' },
        ];
      },
    });
    const consumer = new QuoteSentNotificationConsumer({ gateway, emailSender: { send }, baseUrl: 'https://magritapp.com' });

    await consumer.consume(baseEvent());

    expect(send).toHaveBeenCalledTimes(2);
    const links = send.mock.calls.map((call) => call[0].link);
    expect(links).toEqual([
      'https://magritapp.com/shop/atelier-test/account/quotes',
      'https://magritapp.com/shop/boutique-2/account/quotes',
    ]);
  });

  it('échec PARTIEL sur plusieurs destinataires -> événement ENTIER en échec (unité de livraison)', async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({ sent: true })
      .mockResolvedValueOnce({ sent: false, reason: 'Resend 500' });
    const gateway = buildGateway({
      async resolveRecipients() {
        return [
          recipient,
          { email: 'autre@example.com', customerName: 'Autre', shopSlug: 'autre-boutique', shopName: 'Autre Boutique' },
        ];
      },
    });
    const consumer = new QuoteSentNotificationConsumer({ gateway, emailSender: { send }, baseUrl: 'https://magritapp.com' });

    const result = await consumer.consume(baseEvent());

    expect(result.delivered).toBe(false);
    expect((result as { reason: string }).reason).toContain('Resend 500');
  });
});
