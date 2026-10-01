import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('runtime portable du worker de notifications', () => {
  it('utilise PostgreSQL et ne charge aucun client Supabase', () => {
    const main = read('src/server/node/notification-worker-main.ts');
    const repository = read('src/adapters/postgres/notification-send-repository.ts');
    const dispatch = read('src/adapters/postgres/notification-dispatch-gateway.ts');

    expect(main).toContain("new PostgresTransactionRunner(pool, 'magrit_worker')");
    expect(main).toContain('createPostgresNotificationSendApplication');
    expect(main).toContain("process.once('SIGTERM', stop)");
    expect(main).not.toContain('@supabase/supabase-js');
    expect(repository).toContain('magrit.claim_notification_messages');
    expect(repository).not.toContain('@supabase/supabase-js');
    expect(dispatch).toContain('magrit.enqueue_notification_message');
    expect(dispatch).not.toContain('@supabase/supabase-js');
  });

  it('expose les commandes de lancement continu et ponctuel', () => {
    const packageJson = JSON.parse(read('package.json')) as { scripts: Record<string, string> };
    expect(packageJson.scripts['worker:notifications']).toContain('notification-worker-main.ts');
    expect(packageJson.scripts['worker:notifications:once']).toContain('MAGRIT_WORKER_ONCE=true');
  });
});
