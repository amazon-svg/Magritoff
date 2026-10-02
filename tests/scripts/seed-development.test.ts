import { describe, expect, it } from 'vitest';
import {
  developmentSeedConfiguration,
  seedDevelopmentIdentity,
} from '../../scripts/db/seed-development.mjs';

describe('seed de developpement PostgreSQL', () => {
  it('produit une identite et un tenant deterministes', () => {
    expect(developmentSeedConfiguration({})).toMatchObject({
      email: 'developer@magrit.local',
      issuer: 'http://127.0.0.1:5556/dex',
      tenantSlug: 'magrit-development',
      role: 'owner',
      password: 'magrit-development-only',
    });
  });

  it('normalise les valeurs configurables et refuse les identifiants dangereux', () => {
    expect(developmentSeedConfiguration({
      MAGRIT_DEV_USER_EMAIL: 'Dev@Example.test',
      MAGRIT_DEV_OIDC_ISSUER: 'https://identity.example/',
    })).toMatchObject({
      email: 'dev@example.test',
      issuer: 'https://identity.example',
    });
    expect(() => developmentSeedConfiguration({
      MAGRIT_DEV_TENANT_SLUG: '../production',
    })).toThrow(/Slug/);
    expect(() => developmentSeedConfiguration({
      MAGRIT_DEV_OIDC_ISSUER: 'http://identity.example',
    })).toThrow(/non securise/);
    expect(() => developmentSeedConfiguration({
      MAGRIT_DEV_USER_PASSWORD: 'court',
    })).toThrow(/12 et 128/);
  });

  it('verifie le rattachement existant avant de valider la transaction', async () => {
    const queries: string[] = [];
    const client = {
      async query(sql: string) {
        queries.push(sql.trim());
        if (sql.includes('select app_user_id::text')) {
          return { rows: [{ app_user_id: '30000000-0000-4000-8000-000000000001' }] };
        }
        return { rows: [] };
      },
    };

    await expect(seedDevelopmentIdentity(client, developmentSeedConfiguration({})))
      .rejects.toThrow(/autre utilisateur/);
    expect(queries.at(-1)).toBe('rollback');
    expect(queries).not.toContain('commit');
  });
});
