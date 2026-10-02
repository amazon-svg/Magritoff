import { createPostgresPool } from '../../adapters/postgres/pool.ts';
import { PostgresTransactionRunner } from '../../adapters/postgres/transaction-runner.ts';
import { ResendNotificationEmailSender } from '../../adapters/resend/notification-email-sender.ts';
import { SmtpNotificationEmailSender } from '../../adapters/smtp/notification-email-sender.ts';
import { readSmtpConfiguration, SmtpTransport } from '../../adapters/smtp/transport.ts';
import { createPostgresNotificationSendApplication } from '../api/notification-send-composition.ts';
import { runWorkerLoop } from './worker-loop.ts';

const pool = createPostgresPool();
const abort = new AbortController();
const intervalMs = positiveInteger(process.env['MAGRIT_NOTIFICATION_WORKER_INTERVAL_MS'] ?? '60000');
const runOnceOnly = process.env['MAGRIT_WORKER_ONCE'] === 'true';
const fromEmail = process.env['MAGRIT_FROM_EMAIL'] ?? 'Magrit <noreply@magrit.local>';
const smtpConfiguration = readSmtpConfiguration();
const emailAdapter = smtpConfiguration === null
  ? new ResendNotificationEmailSender(process.env['RESEND_API_KEY'] ?? null, fromEmail)
  : new SmtpNotificationEmailSender(new SmtpTransport(smtpConfiguration), fromEmail);

const application = createPostgresNotificationSendApplication({
  transactions: new PostgresTransactionRunner(pool, 'magrit_worker'),
  resendApiKey: process.env['RESEND_API_KEY'] ?? null,
  fromEmail,
  emailAdapter,
  onUnhandledError(error, message) {
    console.error(JSON.stringify({
      level: 'error',
      event: 'notification_worker.adapter_error',
      notificationId: message.id,
      channel: message.channel,
      error: error instanceof Error ? error.message : String(error),
    }));
  },
});

pool.on('error', (error) => {
  console.error(JSON.stringify({ level: 'error', event: 'notification_worker.pool_error', error: error.message }));
});

process.once('SIGINT', stop);
process.once('SIGTERM', stop);

try {
  await runWorkerLoop(application.runOnce, {
    intervalMs,
    signal: abort.signal,
    once: runOnceOnly,
    onReport(report) {
      if (report.claimed > 0) {
        console.info(JSON.stringify({ level: 'info', event: 'notification_worker.turn', ...report }));
      }
    },
    onError(error) {
      if (runOnceOnly) process.exitCode = 1;
      console.error(JSON.stringify({
        level: 'error',
        event: 'notification_worker.turn_error',
        error: error instanceof Error ? error.message : String(error),
      }));
    },
  });
} finally {
  await pool.end();
}

function stop(): void {
  abort.abort();
}

function positiveInteger(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error('MAGRIT_NOTIFICATION_WORKER_INTERVAL_MS doit etre un entier positif.');
  }
  return parsed;
}
