import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('architecture — runtime Orders portable', () => {
  it('monte les routes Node avec PostgreSQL et les notifications portables', () => {
    const main = read('src/server/node/main.ts');
    expect(main).toContain("import { PostgresOrdersRepository } from '../../adapters/postgres/orders-repository.ts'");
    expect(main).toContain("import { PostgresOrdersNotificationGateway } from '../../adapters/postgres/orders-notification-gateway.ts'");
    expect(main).toContain('const ordersRoutes = createOrdersRoutes(');
    expect(main).toContain('...ordersRoutes');
    expect(main).toContain('isOrdersPath(url.pathname)');
    expect(main).not.toContain('SupabaseOrdersRepository');
  });

  it('ne rappelle ni SDK Supabase ni Edge Function depuis les adaptateurs locaux', () => {
    const repository = read('src/adapters/postgres/orders-repository.ts');
    const notifications = read('src/adapters/postgres/orders-notification-gateway.ts');
    for (const source of [repository, notifications]) {
      expect(source).not.toContain('@supabase/supabase-js');
      expect(source).not.toContain('.functions.invoke');
      expect(source).not.toContain('send-order-notification');
      expect(source).not.toContain('order-workflow-step');
    }
  });
});
