import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
// Le runner reste un script Node directement executable ; Vitest charge son API ESM.
import {
  applyMigrations,
  databaseConfiguration,
  discoverMigrations,
} from '../../scripts/db/migrate.mjs';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => (
    rm(directory, { recursive: true, force: true })
  )));
});

describe('runner de migrations PostgreSQL', () => {
  it('decouvre uniquement les migrations valides dans l ordre', async () => {
    const directory = await temporaryDirectory();
    await writeFile(join(directory, '0002_second.sql'), 'select 2;\n');
    await writeFile(join(directory, '0001_first.sql'), 'select 1;\n');
    await writeFile(join(directory, 'README.md'), 'ignore');

    const migrations = await discoverMigrations(directory);

    expect(migrations.map((migration: { version: string }) => migration.version)).toEqual([
      '0001_first',
      '0002_second',
    ]);
    expect(migrations.every((migration: { checksum: string }) => /^[a-f0-9]{64}$/.test(migration.checksum))).toBe(true);
  });

  it('applique chaque fichier une seule fois dans une transaction', async () => {
    const directory = await temporaryDirectory();
    await writeFile(join(directory, '0001_first.sql'), 'select 1;\n');
    const client = new FakeMigrationClient();

    await expect(applyMigrations(client, directory)).resolves.toMatchObject({
      applied: ['0001_first'],
      total: 1,
    });
    await expect(applyMigrations(client, directory)).resolves.toMatchObject({
      applied: [],
      total: 1,
    });

    expect(client.statements.filter((statement) => statement === 'select 1;')).toHaveLength(1);
    expect(client.statements.filter((statement) => statement === 'begin')).toHaveLength(1);
    expect(client.statements.filter((statement) => statement === 'commit')).toHaveLength(1);
  });

  it('refuse la modification d une migration deja appliquee et libere le verrou', async () => {
    const directory = await temporaryDirectory();
    const path = join(directory, '0001_first.sql');
    await writeFile(path, 'select 1;\n');
    const client = new FakeMigrationClient();
    await applyMigrations(client, directory);
    await writeFile(path, 'select 2;\n');

    await expect(applyMigrations(client, directory)).rejects.toThrow(/deja appliquee puis modifiee/);
    expect(client.statements.at(-1)).toContain('pg_advisory_unlock');
  });

  it('privilegie l URL de migration et valide le port local', () => {
    expect(databaseConfiguration({
      DATABASE_URL: 'postgresql://runtime',
      MAGRIT_DATABASE_MIGRATION_URL: 'postgresql://migrator',
    })).toEqual({ connectionString: 'postgresql://migrator' });

    expect(() => databaseConfiguration({ MAGRIT_DEV_POSTGRES_PORT: 'invalid' })).toThrow(/PORT invalide/);
  });
});

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'magrit-migrations-'));
  temporaryDirectories.push(directory);
  return directory;
}

class FakeMigrationClient {
  readonly statements: string[] = [];
  private readonly applied = new Map<string, string>();

  async query(sql: string, parameters: unknown[] = []): Promise<{ rows: Record<string, string>[] }> {
    const normalized = sql.trim().replace(/\s+/g, ' ');
    this.statements.push(normalized);

    if (normalized.startsWith('select version, checksum')) {
      return { rows: [...this.applied].map(([version, checksum]) => ({ version, checksum })) };
    }
    if (normalized.startsWith('insert into public.magrit_schema_migrations')) {
      this.applied.set(String(parameters[0]), String(parameters[1]));
    }
    return { rows: [] };
  }
}
