import { describe, expect, it, vi } from 'vitest';
import {
  buildOrderDetailLink,
  formatFrenchPurgeDate,
  PurgeNoticeNotificationConsumer,
} from '@/modules/order-files/application/purge-notice-notification-consumer';
import type {
  PurgeNoticeDeliveryGateway,
  PurgeNoticeRecipient,
  PurgeNoticeRecipientGateway,
} from '@/modules/order-files/application/purge-notice-gateway';
import type { PurgeNoticeEmailSender } from '@/modules/order-files/application/purge-notice-email-sender';
import type { ClaimedOutboxEvent } from '@/modules/_shared/application';
import type { TenantId } from '@/kernel';
import { workspaceSurface } from '@/surfaces/workspace';

const TENANT = 'tenant-1' as TenantId;
const BASE_URL = 'https://magritapp.com';

function baseEvent(overrides: Partial<ClaimedOutboxEvent['payload']> = {}): ClaimedOutboxEvent {
  return Object.freeze({
    id: 'event-1',
    tenantId: TENANT,
    name: 'order_files.purge_scheduled' as ClaimedOutboxEvent['name'],
    version: 1,
    aggregateType: 'tenant',
    aggregateId: TENANT,
    occurredAt: '2026-09-10T05:00:00.000Z',
    deliveryAttempts: 1,
    payload: Object.freeze({
      notice_id: 'notice-1',
      stage: 'first',
      file_count: 2,
      order_count: 1,
      purge_at: '2026-10-12T00:00:00Z',
      days_before_purge: 20,
      order_ids: ['order-1'],
      ...overrides,
    }),
  });
}

const recipientA: PurgeNoticeRecipient = { userId: 'user-1', email: 'admin-a@example.com' };
const recipientB: PurgeNoticeRecipient = { userId: 'user-2', email: 'admin-b@example.com' };

function buildRecipients(overrides: Partial<PurgeNoticeRecipientGateway> = {}): PurgeNoticeRecipientGateway {
  return {
    async resolveRecipients() {
      return [recipientA];
    },
    async getTenantSlug() {
      return 'atelier-test';
    },
    ...overrides,
  };
}

function buildDeliveries(overrides: Partial<PurgeNoticeDeliveryGateway> = {}): PurgeNoticeDeliveryGateway {
  return {
    async recordDeliveryAttempt() {
      return { id: 'delivery-1', accepted: true };
    },
    ...overrides,
  };
}

describe('formatFrenchPurgeDate', () => {
  it('formate un Timestamp du contrat (ISO 8601 UTC) en francais lisible', () => {
    expect(formatFrenchPurgeDate('2026-10-12T00:00:00Z')).toBe('12 octobre 2026');
    expect(formatFrenchPurgeDate('2026-01-01T00:00:00.000Z')).toBe('1 janvier 2026');
  });

  it('rend la valeur telle quelle si le format est inattendu (defensif)', () => {
    expect(formatFrenchPurgeDate('not-a-date')).toBe('not-a-date');
  });
});

describe('buildOrderDetailLink — parité avec le registre de surfaces (qa-review round 1, B2)', () => {
  it("produit EXACTEMENT le chemin monte par routes.tsx (/t/:tenantSlug/dashboard/<route registre>)", () => {
    const route = workspaceSurface.routes.find((r) => r.id === 'commercial-orders.workspace.detail');
    if (!route) throw new Error('Route commercial-orders.workspace.detail absente du registre workspace.');
    // Si quelqu un renomme la route ou son chemin dans le registre sans
    // mettre a jour le littéral serveur ci-dessous, cette assertion tombe.
    expect(route.path).toBe('commercial-orders/:orderId');

    const link = buildOrderDetailLink(BASE_URL, 'atelier-test', 'order-1');
    const expectedPath = `/t/atelier-test/dashboard/${route.path.replace(':orderId', 'order-1')}`;

    expect(new URL(link).pathname).toBe(expectedPath);
    // Meme discipline que buildAccountQuotesLink (E10.10b-3) : le littéral
    // COMPLET, hardcode, pour que renommer /t/:tenantSlug ou /dashboard dans
    // routes.tsx SANS mettre a jour ce test soit visible.
    expect(expectedPath).toBe('/t/atelier-test/dashboard/commercial-orders/order-1');
  });

  it('retire les barres obliques finales de la base et encode le slug/l id de commande', () => {
    expect(buildOrderDetailLink('https://magritapp.com/', 'un slug', 'order avec espace')).toBe(
      'https://magritapp.com/t/un%20slug/dashboard/commercial-orders/order%20avec%20espace',
    );
  });
});

describe('PurgeNoticeNotificationConsumer', () => {
  it('echoue sur une charge utile invalide (defense en profondeur)', async () => {
    const consumer = new PurgeNoticeNotificationConsumer({
      recipients: buildRecipients(),
      deliveries: buildDeliveries(),
      emailSender: { send: vi.fn() },
      publicAppUrl: BASE_URL,
    });

    const malformed = baseEvent();
    const result = await consumer.consume({ ...malformed, payload: { notice_id: 'notice-1' } });
    expect(result.delivered).toBe(false);
  });

  it("echoue explicitement (pas de repli silencieux) quand MAGRIT_PUBLIC_APP_URL est absente -- qa-review round 1 B2", async () => {
    const send = vi.fn();
    const getTenantSlug = vi.fn();
    const resolveRecipients = vi.fn();
    const consumer = new PurgeNoticeNotificationConsumer({
      recipients: buildRecipients({ getTenantSlug, resolveRecipients }),
      deliveries: buildDeliveries(),
      emailSender: { send },
      publicAppUrl: null,
    });

    const result = await consumer.consume(baseEvent());
    expect(result.delivered).toBe(false);
    expect((result as { reason: string }).reason).toContain('MAGRIT_PUBLIC_APP_URL');
    expect(send).not.toHaveBeenCalled();
    // Echoue AVANT meme de tenter de resoudre le tenant/les destinataires.
    expect(getTenantSlug).not.toHaveBeenCalled();
    expect(resolveRecipients).not.toHaveBeenCalled();
  });

  it('livre sans envoyer de courriel quand le tenant est introuvable (defensif, pas un echec)', async () => {
    const send = vi.fn();
    const consumer = new PurgeNoticeNotificationConsumer({
      recipients: buildRecipients({ async getTenantSlug() { return null; } }),
      deliveries: buildDeliveries(),
      emailSender: { send },
      publicAppUrl: BASE_URL,
    });

    await expect(consumer.consume(baseEvent())).resolves.toEqual({ delivered: true });
    expect(send).not.toHaveBeenCalled();
  });

  it('livre sans envoyer de courriel quand aucun destinataire ne correspond (cas nominal, pas un echec)', async () => {
    const send = vi.fn();
    const recordDeliveryAttempt = vi.fn();
    const consumer = new PurgeNoticeNotificationConsumer({
      recipients: buildRecipients({ async resolveRecipients() { return []; } }),
      deliveries: buildDeliveries({ recordDeliveryAttempt }),
      emailSender: { send },
      publicAppUrl: BASE_URL,
    });

    await expect(consumer.consume(baseEvent())).resolves.toEqual({ delivered: true });
    expect(send).not.toHaveBeenCalled();
    expect(recordDeliveryAttempt).not.toHaveBeenCalled();
  });

  it('envoie un courriel par destinataire, avec les donnees du palier ET les liens de commande, et consigne chaque tentative', async () => {
    const send = vi.fn(async () => ({ sent: true as const, providerMessageId: 'resend-msg-1' }));
    const recordDeliveryAttempt = vi.fn(async () => ({ id: 'delivery-1', accepted: true }));
    const consumer = new PurgeNoticeNotificationConsumer({
      recipients: buildRecipients({ async resolveRecipients() { return [recipientA, recipientB]; } }),
      deliveries: buildDeliveries({ recordDeliveryAttempt }),
      emailSender: { send },
      publicAppUrl: BASE_URL,
    });

    await expect(consumer.consume(baseEvent())).resolves.toEqual({ delivered: true });

    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenCalledWith({
      to: recipientA.email,
      stage: 'first',
      fileCount: 2,
      orderCount: 1,
      purgeAtLabel: '12 octobre 2026',
      daysBeforePurge: 20,
      orderLinks: ['https://magritapp.com/t/atelier-test/dashboard/commercial-orders/order-1'],
    });

    expect(recordDeliveryAttempt).toHaveBeenCalledTimes(2);
    expect(recordDeliveryAttempt).toHaveBeenCalledWith('notice-1', recipientA, { providerMessageId: 'resend-msg-1' });
    expect(recordDeliveryAttempt).toHaveBeenCalledWith('notice-1', recipientB, { providerMessageId: 'resend-msg-1' });
  });

  it('un rappel sur PLUSIEURS commandes compose UN lien par order_id (jusqu à 50, §4 du contrat)', async () => {
    const send = vi.fn(async () => ({ sent: true as const, providerMessageId: 'resend-msg-1' }));
    const consumer = new PurgeNoticeNotificationConsumer({
      recipients: buildRecipients(),
      deliveries: buildDeliveries(),
      emailSender: { send },
      publicAppUrl: BASE_URL,
    });

    await consumer.consume(baseEvent({ order_ids: ['order-1', 'order-2', 'order-3'] }));

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        orderLinks: [
          'https://magritapp.com/t/atelier-test/dashboard/commercial-orders/order-1',
          'https://magritapp.com/t/atelier-test/dashboard/commercial-orders/order-2',
          'https://magritapp.com/t/atelier-test/dashboard/commercial-orders/order-3',
        ],
      }),
    );
  });

  it("UN SEUL destinataire accepte suffit a livrer l evenement (unite de livraison differente de quote.sent)", async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({ sent: false, reason: 'Resend 500' })
      .mockResolvedValueOnce({ sent: true, providerMessageId: 'resend-msg-ok' });
    const consumer = new PurgeNoticeNotificationConsumer({
      recipients: buildRecipients({ async resolveRecipients() { return [recipientA, recipientB]; } }),
      deliveries: buildDeliveries(),
      emailSender: { send },
      publicAppUrl: BASE_URL,
    });

    await expect(consumer.consume(baseEvent())).resolves.toEqual({ delivered: true });
  });

  it('aucun destinataire ACCEPTE par Resend -> evenement en echec (rejoue par le drain, MEME notice_id)', async () => {
    const send = vi.fn(async () => ({ sent: false as const, reason: 'Resend indisponible' }));
    const recordDeliveryAttempt = vi.fn(async () => ({ id: 'delivery-1', accepted: false }));
    const consumer = new PurgeNoticeNotificationConsumer({
      recipients: buildRecipients(),
      deliveries: buildDeliveries({ recordDeliveryAttempt }),
      emailSender: { send },
      publicAppUrl: BASE_URL,
    });

    const result = await consumer.consume(baseEvent());
    expect(result.delivered).toBe(false);
    expect((result as { reason: string }).reason).toContain('Resend indisponible');
    // Consigne QUAND MEME l echec (providerMessageId null -- "tentative faite", jamais une preuve).
    expect(recordDeliveryAttempt).toHaveBeenCalledWith('notice-1', recipientA, { providerMessageId: null });
  });

  it('palier second : donnees transmises telles que portees par l evenement (aucune inference cote consommateur)', async () => {
    const send = vi.fn(async () => ({ sent: true as const, providerMessageId: 'resend-msg-2' }));
    const consumer = new PurgeNoticeNotificationConsumer({
      recipients: buildRecipients(),
      deliveries: buildDeliveries(),
      emailSender: { send },
      publicAppUrl: BASE_URL,
    });

    await consumer.consume(baseEvent({ stage: 'second', days_before_purge: 15 }));

    expect(send).toHaveBeenCalledWith(expect.objectContaining({ stage: 'second', daysBeforePurge: 15 }));
  });
});
