import pg from 'pg';

const { Pool } = pg;

export type PostgresPoolEnvironment = Readonly<Record<string, string | undefined>>;

export function createPostgresPool(environment: PostgresPoolEnvironment = process.env): pg.Pool {
  const connectionString = environment['DATABASE_URL'];
  const max = positiveInteger(environment['MAGRIT_POSTGRES_POOL_MAX'] ?? '10', 'MAGRIT_POSTGRES_POOL_MAX');
  const connectionTimeoutMillis = positiveInteger(
    environment['MAGRIT_POSTGRES_CONNECT_TIMEOUT_MS'] ?? '5000',
    'MAGRIT_POSTGRES_CONNECT_TIMEOUT_MS',
  );

  return new Pool({
    ...(connectionString === undefined
      ? {
          host: environment['MAGRIT_DEV_POSTGRES_HOST'] ?? '127.0.0.1',
          port: positiveInteger(environment['MAGRIT_DEV_POSTGRES_PORT'] ?? '55432', 'MAGRIT_DEV_POSTGRES_PORT'),
          database: environment['MAGRIT_DEV_POSTGRES_DB'] ?? 'magrit',
          user: environment['MAGRIT_DEV_POSTGRES_USER'] ?? 'magrit',
          password: environment['MAGRIT_DEV_POSTGRES_PASSWORD'] ?? 'magrit-local-only',
        }
      : { connectionString }),
    max,
    connectionTimeoutMillis,
    idleTimeoutMillis: 30_000,
    application_name: 'magrit-api',
  });
}

function positiveInteger(value: string, name: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${name} doit etre un entier positif.`);
  return parsed;
}
