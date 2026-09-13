/**
 * Drain de generation (story E10.18c). Le PLAFOND DE 50 000 LIGNES est le
 * seul filet contre un depassement memoire qu aucun try/catch ne rattrape
 * (contrat §8.24 point 4) : verifie ICI qu il est constate AVANT tout appel
 * au renderer, jamais apres.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  ORDER_EXPORT_ROW_LIMIT,
  OrderExportGenerationService,
  buildOrderExportFileName,
} from '@/modules/order-exports/application/order-export-generation-service';
import type { OrderExportRawRow } from '@/modules/order-exports/application/order-export-columns';
import type { OrderExportRenderer, OrderExportRenderResult } from '@/modules/order-exports/application/order-export-renderer';
import type {
  ClaimedOrderExport,
  MarkOrderExportReadyParams,
  OrderExportRowsPage,
  OrderExportRunRepository,
} from '@/modules/order-exports/application/order-export-run-repository';
import type { OrderExportStorage, UploadOrderExportFileParams } from '@/modules/order-exports/application/order-export-storage';
import type { TenantId } from '@/kernel';

const TENANT = 'tenant-1' as TenantId;

function claimed(overrides: Partial<ClaimedOrderExport> = {}): ClaimedOrderExport {
  return {
    id: 'export-1',
    tenantId: TENANT,
    format: 'csv',
    granularity: 'order',
    filters: {},
    ...overrides,
  };
}

class FakeRunRepository implements OrderExportRunRepository {
  claimedExports: readonly ClaimedOrderExport[] = [];
  /** Pages a rendre, dans l ordre des appels a `readRows` (une par page). */
  pages: OrderExportRowsPage[] = [];
  readCalls = 0;
  ready: Array<{ id: string; params: MarkOrderExportReadyParams }> = [];
  failed: Array<{ id: string; code: string; detail: string }> = [];

  async claim(): Promise<readonly ClaimedOrderExport[]> {
    return this.claimedExports;
  }

  async readRows(): Promise<OrderExportRowsPage> {
    this.readCalls += 1;
    const page = this.pages[this.readCalls - 1];
    if (!page) throw new Error('FakeRunRepository: plus de page a rendre.');
    return page;
  }

  async markReady(id: string, params: MarkOrderExportReadyParams): Promise<void> {
    this.ready.push({ id, params });
  }

  async markFailed(id: string, code: string, detail: string): Promise<void> {
    this.failed.push({ id, code, detail });
  }
}

class FakeStorage implements OrderExportStorage {
  uploaded: UploadOrderExportFileParams[] = [];
  failNext = false;

  async upload(params: UploadOrderExportFileParams): Promise<Readonly<{ storagePath: string }>> {
    if (this.failNext) throw new Error('depot impossible (simule)');
    this.uploaded.push(params);
    return { storagePath: `${params.tenantId}/${params.exportId}.${params.extension}` };
  }
}

function rendererReturning(result: OrderExportRenderResult): OrderExportRenderer {
  return {
    format: 'csv',
    contentType: 'text/csv',
    fileExtension: 'csv',
    render: vi.fn(async () => result),
  };
}

function rowsOfSize(n: number): readonly OrderExportRawRow[] {
  return Array.from({ length: n }, (_, i) => ({ order_number: `CDE-${i}` }));
}

describe('OrderExportGenerationService — plafond de 50 000 lignes', () => {
  it('refuse AVANT tout appel au renderer des que le plafond est depasse', async () => {
    const repository = new FakeRunRepository();
    repository.claimedExports = [claimed()];
    // Deux pages : la premiere sature exactement le plafond, la seconde
    // (encore une ligne) le fait deborder — READ_PAGE_SIZE interne = 1000.
    const fullPages = Math.floor(ORDER_EXPORT_ROW_LIMIT / 1000);
    for (let i = 0; i < fullPages; i += 1) {
      repository.pages.push({ rows: rowsOfSize(1000), nextAfter: { i } });
    }
    repository.pages.push({ rows: rowsOfSize(1), nextAfter: null });

    const renderer = rendererReturning({ ok: true, bytes: new Uint8Array() });
    const storage = new FakeStorage();
    const service = new OrderExportGenerationService({ repository, storage, renderers: { csv: renderer } });

    const report = await service.runOnce();

    expect(report).toEqual({ claimed: 1, ready: 0, failed: 1 });
    expect(renderer.render).not.toHaveBeenCalled();
    expect(repository.failed).toHaveLength(1);
    expect(repository.failed[0]?.code).toBe('order_export.row_limit_exceeded');
    expect(storage.uploaded).toHaveLength(0);
  });

  it('accepte exactement le plafond (50 000 lignes)', async () => {
    const repository = new FakeRunRepository();
    repository.claimedExports = [claimed()];
    const fullPages = ORDER_EXPORT_ROW_LIMIT / 1000;
    for (let i = 0; i < fullPages; i += 1) {
      repository.pages.push({ rows: rowsOfSize(1000), nextAfter: i === fullPages - 1 ? null : { i } });
    }

    const renderer = rendererReturning({ ok: true, bytes: new TextEncoder().encode('csv') });
    const storage = new FakeStorage();
    const service = new OrderExportGenerationService({ repository, storage, renderers: { csv: renderer } });

    const report = await service.runOnce();

    expect(report).toEqual({ claimed: 1, ready: 1, failed: 0 });
    expect(repository.ready).toHaveLength(1);
    expect(repository.ready[0]?.params.rowCount).toBe(ORDER_EXPORT_ROW_LIMIT);
  });
});

describe('OrderExportGenerationService — verdicts', () => {
  it('format sans renderer enregistre -> failed, jamais de tentative de lecture', async () => {
    const repository = new FakeRunRepository();
    repository.claimedExports = [claimed({ format: 'xlsx' })];
    const storage = new FakeStorage();
    const service = new OrderExportGenerationService({ repository, storage, renderers: { csv: rendererReturning({ ok: true, bytes: new Uint8Array() }) } });

    const report = await service.runOnce();

    expect(report).toEqual({ claimed: 1, ready: 0, failed: 1 });
    expect(repository.failed[0]?.code).toBe('order_export.generation_failed');
    expect(repository.readCalls).toBe(0);
  });

  it('un renderer qui rend ok:false -> markFailed avec le code/detail du renderer, JAMAIS un throw', async () => {
    const repository = new FakeRunRepository();
    repository.claimedExports = [claimed()];
    repository.pages = [{ rows: [], nextAfter: null }];
    const renderer = rendererReturning({ ok: false, code: 'order_export.generation_failed', detail: 'donnee inattendue' });
    const storage = new FakeStorage();
    const service = new OrderExportGenerationService({ repository, storage, renderers: { csv: renderer } });

    const report = await service.runOnce();

    expect(report).toEqual({ claimed: 1, ready: 0, failed: 1 });
    expect(repository.failed[0]).toMatchObject({ code: 'order_export.generation_failed', detail: 'donnee inattendue' });
  });

  it('un depot Storage en echec -> markFailed order_export.storage_failed', async () => {
    const repository = new FakeRunRepository();
    repository.claimedExports = [claimed()];
    repository.pages = [{ rows: [], nextAfter: null }];
    const renderer = rendererReturning({ ok: true, bytes: new Uint8Array([1, 2, 3]) });
    const storage = new FakeStorage();
    storage.failNext = true;
    const service = new OrderExportGenerationService({ repository, storage, renderers: { csv: renderer } });

    const report = await service.runOnce();

    expect(report).toEqual({ claimed: 1, ready: 0, failed: 1 });
    expect(repository.failed[0]?.code).toBe('order_export.storage_failed');
  });

  it('succes : markReady porte row_count, sha256, byte_size, et expires_at = completed_at + 7 jours EXACTEMENT', async () => {
    const repository = new FakeRunRepository();
    repository.claimedExports = [claimed()];
    repository.pages = [{ rows: rowsOfSize(2), nextAfter: null }];
    const bytes = new TextEncoder().encode('contenu-csv');
    const renderer = rendererReturning({ ok: true, bytes });
    const storage = new FakeStorage();
    const fixedNow = new Date('2026-09-13T10:00:00.000Z');
    const service = new OrderExportGenerationService({
      repository,
      storage,
      renderers: { csv: renderer },
      now: () => fixedNow,
    });

    const report = await service.runOnce();

    expect(report).toEqual({ claimed: 1, ready: 1, failed: 0 });
    const markReadyCall = repository.ready[0]!;
    expect(markReadyCall.params.rowCount).toBe(2);
    expect(markReadyCall.params.byteSize).toBe(bytes.byteLength);
    expect(markReadyCall.params.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(markReadyCall.params.completedAt).toBe('2026-09-13T10:00:00.000Z');
    expect(markReadyCall.params.expiresAt).toBe('2026-09-20T10:00:00.000Z');
    expect(storage.uploaded).toHaveLength(1);
  });

  it('une erreur non prevue (throw) est capturee : failed, jamais un tour casse', async () => {
    const repository = new FakeRunRepository();
    repository.claimedExports = [claimed(), claimed({ id: 'export-2' })];
    // La premiere readRows leve, la seconde reussit normalement.
    let call = 0;
    repository.readRows = async () => {
      call += 1;
      if (call === 1) throw new Error('base de donnees indisponible (simule)');
      return { rows: [], nextAfter: null };
    };
    const renderer = rendererReturning({ ok: true, bytes: new Uint8Array() });
    const storage = new FakeStorage();
    const onUnhandledError = vi.fn();
    const service = new OrderExportGenerationService({ repository, storage, renderers: { csv: renderer }, onUnhandledError });

    const report = await service.runOnce();

    expect(report).toEqual({ claimed: 2, ready: 1, failed: 1 });
    expect(onUnhandledError).toHaveBeenCalledTimes(1);
  });
});

describe('buildOrderExportFileName', () => {
  it('rend les bornes absentes par "tout"', () => {
    const name = buildOrderExportFileName(
      { granularity: 'order', filters: {} },
      'csv',
      new Date('2026-09-13T10:00:00.000Z'),
    );
    expect(name).toBe('commandes-order-tout_tout-2026-09-13T10-00-00-000Z.csv');
  });

  it('reprend created_from/created_to quand ils sont poses', () => {
    const name = buildOrderExportFileName(
      { granularity: 'line', filters: { created_from: '2026-03-01', created_to: '2026-03-31' } },
      'xlsx',
      new Date('2026-09-13T10:00:00.000Z'),
    );
    expect(name).toBe('commandes-line-2026-03-01_2026-03-31-2026-09-13T10-00-00-000Z.xlsx');
  });
});
