import { createPostgresPool } from '../../adapters/postgres/pool.ts';
import { PostgresTransactionRunner } from '../../adapters/postgres/transaction-runner.ts';
import { createS3Client } from '../../adapters/s3/client.ts';
import { createPostgresOutboxDispatchApplication } from '../api/outbox-dispatch-composition.ts';
import { runWorkerLoop } from './worker-loop.ts';

const pool = createPostgresPool();
const storage = createS3Client();
const abort = new AbortController();
const intervalMs = positiveInteger(process.env['MAGRIT_OUTBOX_WORKER_INTERVAL_MS'] ?? '60000');
const runOnceOnly = process.env['MAGRIT_WORKER_ONCE'] === 'true';
const application = createPostgresOutboxDispatchApplication({
  transactions: new PostgresTransactionRunner(pool, 'magrit_worker'),
  storage,
  resendApiKey: process.env['RESEND_API_KEY'] ?? null,
  fromEmail: process.env['MAGRIT_FROM_EMAIL'] ?? 'Magrit <noreply@magrit.local>',
  publicAppUrl: process.env['MAGRIT_PUBLIC_APP_URL'] ?? process.env['APP_BASE_URL'] ?? null,
  onUnhandledError(error, event) {
    console.error(JSON.stringify({
      level: 'error',event: 'outbox_worker.consumer_error',outboxEventId: event.id,
      eventName: event.name,error: error instanceof Error ? error.message : String(error),
    }));
  },
});

pool.on('error', (error) => {
  console.error(JSON.stringify({ level: 'error',event: 'outbox_worker.pool_error',error: error.message }));
});
process.once('SIGINT', stop);
process.once('SIGTERM', stop);

try {
  await runWorkerLoop(application.runOnce, {
    intervalMs,signal: abort.signal,once: runOnceOnly,
    onReport(report) {
      if (report.claimed > 0) console.info(JSON.stringify({ level: 'info',event: 'outbox_worker.turn',...report }));
    },
    onError(error) {
      if (runOnceOnly) process.exitCode = 1;
      console.error(JSON.stringify({
        level: 'error',event: 'outbox_worker.turn_error',error: error instanceof Error ? error.message : String(error),
      }));
    },
  });
} finally {
  storage.destroy();
  await pool.end();
}

function stop(): void { abort.abort(); }
function positiveInteger(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed<1) throw new Error('MAGRIT_OUTBOX_WORKER_INTERVAL_MS doit etre un entier positif.');
  return parsed;
}
