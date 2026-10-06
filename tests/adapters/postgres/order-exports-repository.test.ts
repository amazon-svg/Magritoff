import { describe, expect, it, vi } from 'vitest';
import { PostgresOrderExportsRepository } from '../../../src/adapters/postgres/order-exports-repository.ts';
import type { TenantId, UserId } from '../../../src/kernel/ids/index.ts';

const tenantId = '00000000-0000-4000-9000-000000000001' as TenantId;
const actorId = '00000000-0000-4000-9000-000000000002' as UserId;
const exportId = '00000000-0000-4000-9000-000000000003';

describe('PostgresOrderExportsRepository.remove', () => {
  it('confirme la suppression d un export echoue sans fichier de stockage', async () => {
    const queries: string[] = [];
    const transactions = {
      run: async (_context: unknown, operation: (client: unknown) => Promise<unknown>) => operation({
        query: async (sql: string) => {
          queries.push(sql);
          if (sql.includes('select status,storage_path')) {
            return { rows: [{ status: 'failed', storage_path: null }] };
          }
          if (sql.includes('delete from public.commercial_order_exports')) {
            return { rowCount: 1, rows: [] };
          }
          throw new Error(`requete inattendue: ${sql}`);
        },
      }),
    };
    const storage = { send: vi.fn() };
    const repository = new PostgresOrderExportsRepository(transactions as never, storage as never);

    await expect(repository.remove(tenantId, actorId, exportId)).resolves.toBe(true);

    expect(queries).toHaveLength(2);
    expect(storage.send).not.toHaveBeenCalled();
  });
});
