import { describe, expect, it, vi } from 'vitest';
import { PurgeSweepService, DEFAULT_PURGE_SWEEP_SETTINGS } from '@/modules/order-files/application/purge-sweep-service';
import type {
  ClaimedPurgeNoticeSummary,
  DeliveryPendingCheck,
  ExpiredPurgeNoticeSummary,
  PurgeSweepRepository,
} from '@/modules/order-files/application/purge-sweep-repository';
import type { EmailDeliveryStatusGateway } from '@/modules/order-files/application/purge-notice-delivery-status-gateway';
import type {
  BlockedPurgeCount,
  PurgeExecutionRepository,
  PurgeExecutionSummary,
} from '@/modules/order-files/application/purge-execution-repository';
import type { OrphanObjectRepository } from '@/modules/order-files/application/orphan-object-repository';

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
    async resetStaleNotices() {
      return 0;
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

function buildExecutionRepository(overrides: Partial<PurgeExecutionRepository> = {}): PurgeExecutionRepository {
  return {
    async purgeEligibleFiles() {
      return [];
    },
    async countBlockedFiles() {
      return [];
    },
    ...overrides,
  };
}

function buildOrphanRepository(overrides: Partial<OrphanObjectRepository> = {}): OrphanObjectRepository {
  return {
    async removeOrphanObjects() {
      return 0;
    },
    ...overrides,
  };
}

const EMPTY_REPORT_TAIL = { filesPurged: 0, purgeEventsEmitted: 0, orphanObjectsRemoved: 0, blockedFiles: [] };
const EMPTY_REPORT_HEAD = { staleNoticesReset: 0 };

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
      execution: buildExecutionRepository(),
      orphans: buildOrphanRepository(),
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
      execution: buildExecutionRepository(),
      orphans: buildOrphanRepository(),
    });

    const report = await service.runOnce();

    expect(report).toEqual({
      ...EMPTY_REPORT_HEAD,
      noticesCreated: 2,
      noticesExpired: 1,
      deliveriesChecked: 2,
      deliveriesConfirmed: 1,
      ...EMPTY_REPORT_TAIL,
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
      execution: buildExecutionRepository(),
      orphans: buildOrphanRepository(),
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
      execution: buildExecutionRepository(),
      orphans: buildOrphanRepository(),
    });

    await expect(service.runOnce()).resolves.toEqual({
      ...EMPTY_REPORT_HEAD,
      noticesCreated: 2,
      noticesExpired: 0,
      deliveriesChecked: 0,
      deliveriesConfirmed: 0,
      ...EMPTY_REPORT_TAIL,
    });
  });

  it('(E10.22b) appelle purgeEligibleFiles APRES la relecture des livraisons (etape 2), et compte fichiers/evenements', async () => {
    const callOrder: string[] = [];
    const claimDeliveriesForRecheck = vi.fn(async (): Promise<readonly DeliveryPendingCheck[]> => {
      callOrder.push('claimDeliveriesForRecheck');
      return [];
    });
    const purgeEligibleFiles = vi.fn(async (limit: number): Promise<readonly PurgeExecutionSummary[]> => {
      callOrder.push('purgeEligibleFiles');
      expect(limit).toBe(DEFAULT_PURGE_SWEEP_SETTINGS.purgeExecutionLimit);
      return [
        { tenantId: 't1', fileCount: 2, orderCount: 1, byteSizeFreed: 300, orderIds: ['o1'] },
        { tenantId: 't2', fileCount: 1, orderCount: 1, byteSizeFreed: 100, orderIds: ['o2'] },
      ];
    });

    const service = new PurgeSweepService({
      repository: buildRepository({ claimDeliveriesForRecheck }),
      deliveryStatus: buildStatusGateway(),
      execution: buildExecutionRepository({ purgeEligibleFiles }),
      orphans: buildOrphanRepository(),
    });

    const report = await service.runOnce();

    expect(report.filesPurged).toBe(3);
    expect(report.purgeEventsEmitted).toBe(2);
    expect(callOrder).toEqual(['claimDeliveriesForRecheck', 'purgeEligibleFiles']);
  });

  it('(E10.22c) appelle removeOrphanObjects APRES purgeEligibleFiles, avec les reglages par defaut (24h, 200)', async () => {
    const callOrder: string[] = [];
    const purgeEligibleFiles = vi.fn(async (): Promise<readonly PurgeExecutionSummary[]> => {
      callOrder.push('purgeEligibleFiles');
      return [];
    });
    const removeOrphanObjects = vi.fn(async (olderThanHours: number, limit: number): Promise<number> => {
      callOrder.push('removeOrphanObjects');
      expect(olderThanHours).toBe(DEFAULT_PURGE_SWEEP_SETTINGS.orphanObjectOlderThanHours);
      expect(limit).toBe(DEFAULT_PURGE_SWEEP_SETTINGS.orphanObjectLimit);
      return 5;
    });

    const service = new PurgeSweepService({
      repository: buildRepository(),
      deliveryStatus: buildStatusGateway(),
      execution: buildExecutionRepository({ purgeEligibleFiles }),
      orphans: buildOrphanRepository({ removeOrphanObjects }),
    });

    const report = await service.runOnce();

    expect(report.orphanObjectsRemoved).toBe(5);
    expect(callOrder).toEqual(['purgeEligibleFiles', 'removeOrphanObjects']);
  });

  it('(B1, qa-review round 1) appelle countBlockedFiles APRES purgeEligibleFiles (etape 4), rend le compte par tenant/motif', async () => {
    const callOrder: string[] = [];
    const purgeEligibleFiles = vi.fn(async (): Promise<readonly PurgeExecutionSummary[]> => {
      callOrder.push('purgeEligibleFiles');
      return [];
    });
    const blocked: readonly BlockedPurgeCount[] = [
      { tenantId: 't1', reason: 'rappel_non_confirme', count: 4000 },
      { tenantId: 't1', reason: 'rappel_en_echec', count: 2 },
    ];
    const countBlockedFiles = vi.fn(async (): Promise<readonly BlockedPurgeCount[]> => {
      callOrder.push('countBlockedFiles');
      return blocked;
    });

    const service = new PurgeSweepService({
      repository: buildRepository(),
      deliveryStatus: buildStatusGateway(),
      execution: buildExecutionRepository({ purgeEligibleFiles, countBlockedFiles }),
      orphans: buildOrphanRepository(),
    });

    const report = await service.runOnce();

    expect(report.blockedFiles).toEqual(blocked);
    // APRES purgeEligibleFiles (etape 4) -- voir en-tete de fichier. L ordre
    // exact vis-a-vis de removeOrphanObjects (etape 5) n est PAS garanti par
    // ce test (independant), seul l ordre par rapport a la purge compte.
    expect(callOrder[0]).toBe('purgeEligibleFiles');
    expect(callOrder).toContain('countBlockedFiles');
  });

  it('rien de du (execution et orphelins vides) : rapport a zero sur les trois nouveaux champs', async () => {
    const service = new PurgeSweepService({
      repository: buildRepository(),
      deliveryStatus: buildStatusGateway(),
      execution: buildExecutionRepository(),
      orphans: buildOrphanRepository(),
    });

    await expect(service.runOnce()).resolves.toEqual({
      ...EMPTY_REPORT_HEAD,
      noticesCreated: 0,
      noticesExpired: 0,
      deliveriesChecked: 0,
      deliveriesConfirmed: 0,
      ...EMPTY_REPORT_TAIL,
    });
  });

  it('(E10.22d) appelle resetStaleNotices EN TETE de tour (etape 0), avant toute reclamation, et rend son compte', async () => {
    const callOrder: string[] = [];
    const resetStaleNotices = vi.fn(async (): Promise<number> => {
      callOrder.push('resetStaleNotices');
      return 3;
    });
    const claimNotices = vi.fn(async (): Promise<readonly ClaimedPurgeNoticeSummary[]> => {
      callOrder.push('claimNotices');
      return [];
    });

    const service = new PurgeSweepService({
      repository: buildRepository({ resetStaleNotices, claimNotices }),
      deliveryStatus: buildStatusGateway(),
      execution: buildExecutionRepository(),
      orphans: buildOrphanRepository(),
    });

    const report = await service.runOnce();

    expect(report.staleNoticesReset).toBe(3);
    expect(callOrder[0]).toBe('resetStaleNotices');
    expect(callOrder).toContain('claimNotices');
  });
});
