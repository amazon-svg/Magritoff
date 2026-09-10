import { describe, expect, it, vi } from 'vitest';
import { PurgeSweepService, DEFAULT_PURGE_SWEEP_SETTINGS } from '@/modules/order-files/application/purge-sweep-service';
import type {
  ClaimedPurgeNoticeSummary,
  DeliveryPendingCheck,
  ExpiredPurgeNoticeSummary,
  PurgeSweepRepository,
} from '@/modules/order-files/application/purge-sweep-repository';
import type { EmailDeliveryStatusGateway } from '@/modules/order-files/application/purge-notice-delivery-status-gateway';

function buildRepository(overrides: Partial<PurgeSweepRepository> = {}): PurgeSweepRepository {
  return {
    async claimNotices() {
      return [];
    },
    async expireStaleNotices() {
      return [];
    },
    async claimDeliveriesForRecheck() {
      return [];
    },
    async recordDeliveryCheck() {
      return;
    },
    ...overrides,
  };
}

function buildStatusGateway(overrides: Partial<EmailDeliveryStatusGateway> = {}): EmailDeliveryStatusGateway {
  return {
    async fetchStatus() {
      return null;
    },
    ...overrides,
  };
}

describe('DEFAULT_PURGE_SWEEP_SETTINGS', () => {
  it('reglages confirmes au contrat §4/§10 (E10.22a) : 20/15 jours de recul, fenetre de 3 jours', () => {
    expect(DEFAULT_PURGE_SWEEP_SETTINGS.leadDaysByStage).toEqual({ first: 20, second: 15 });
    expect(DEFAULT_PURGE_SWEEP_SETTINGS.expiryWindowDays).toBe(3);
  });
});

describe('PurgeSweepService', () => {
  it('reclame les DEUX paliers a chaque tour, avec leurs reglages respectifs', async () => {
    const claimNotices = vi.fn(async (): Promise<readonly ClaimedPurgeNoticeSummary[]> => []);
    const service = new PurgeSweepService({
      repository: buildRepository({ claimNotices }),
      deliveryStatus: buildStatusGateway(),
    });

    await service.runOnce();

    expect(claimNotices).toHaveBeenCalledTimes(2);
    expect(claimNotices).toHaveBeenCalledWith('first', 20);
    expect(claimNotices).toHaveBeenCalledWith('second', 15);
  });

  it('compte les rappels crees, expires, et les livraisons relues/confirmees', async () => {
    const claimNotices = vi.fn(async (stage: 'first' | 'second'): Promise<readonly ClaimedPurgeNoticeSummary[]> =>
      stage === 'first'
        ? [{ noticeId: 'n1', tenantId: 't1', fileCount: 2, orderCount: 1 }]
        : [{ noticeId: 'n2', tenantId: 't1', fileCount: 1, orderCount: 1 }],
    );
    const expireStaleNotices = vi.fn(
      async (): Promise<readonly ExpiredPurgeNoticeSummary[]> => [{ noticeId: 'n0', tenantId: 't1', stage: 'first' }],
    );
    const pending: readonly DeliveryPendingCheck[] = [
      { deliveryId: 'd1', noticeId: 'n1', providerMessageId: 'msg-1' },
      { deliveryId: 'd2', noticeId: 'n1', providerMessageId: 'msg-2' },
    ];
    const claimDeliveriesForRecheck = vi.fn(async () => pending);
    const recordDeliveryCheck = vi.fn(async () => undefined);

    const fetchStatus = vi
      .fn()
      .mockResolvedValueOnce({ lastEvent: 'delivered' })
      .mockResolvedValueOnce({ lastEvent: 'queued' });

    const service = new PurgeSweepService({
      repository: buildRepository({ claimNotices, expireStaleNotices, claimDeliveriesForRecheck, recordDeliveryCheck }),
      deliveryStatus: buildStatusGateway({ fetchStatus }),
    });

    const report = await service.runOnce();

    expect(report).toEqual({
      noticesCreated: 2,
      noticesExpired: 1,
      deliveriesChecked: 2,
      deliveriesConfirmed: 1,
    });
    expect(recordDeliveryCheck).toHaveBeenCalledWith('d1', 'delivered');
    expect(recordDeliveryCheck).toHaveBeenCalledWith('d2', 'queued');
  });

  it("une relecture EN ECHEC (reseau, cle absente -- lastEvent null) ne consigne RIEN, reste PENDANTE", async () => {
    const claimDeliveriesForRecheck = vi.fn(async (): Promise<readonly DeliveryPendingCheck[]> => [
      { deliveryId: 'd1', noticeId: 'n1', providerMessageId: 'msg-1' },
    ]);
    const recordDeliveryCheck = vi.fn(async () => undefined);

    const service = new PurgeSweepService({
      repository: buildRepository({ claimDeliveriesForRecheck, recordDeliveryCheck }),
      deliveryStatus: buildStatusGateway({ async fetchStatus() { return null; } }),
    });

    const report = await service.runOnce();

    expect(report.deliveriesChecked).toBe(1);
    expect(report.deliveriesConfirmed).toBe(0);
    expect(recordDeliveryCheck).not.toHaveBeenCalled();
  });

  it("n envoie JAMAIS de courriel -- seul le drain outbox existant s en charge", async () => {
    // Test de DOCUMENTATION : PurgeSweepRepository n expose aucune methode
    // d envoi de courriel (voir le port), et PurgeSweepService n importe
    // aucun sender. La preuve la plus fiable est l absence de dependance,
    // verifiee a la compilation -- ce test verifie simplement qu un tour
    // complet, meme avec des rappels crees, ne fait RIEN d autre que ce que
    // le repository/le statusGateway rendent.
    const claimNotices = vi.fn(async (): Promise<readonly ClaimedPurgeNoticeSummary[]> => [
      { noticeId: 'n1', tenantId: 't1', fileCount: 1, orderCount: 1 },
    ]);
    const service = new PurgeSweepService({
      repository: buildRepository({ claimNotices }),
      deliveryStatus: buildStatusGateway(),
    });

    await expect(service.runOnce()).resolves.toEqual({
      noticesCreated: 2,
      noticesExpired: 0,
      deliveriesChecked: 0,
      deliveriesConfirmed: 0,
    });
  });
});
