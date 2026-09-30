import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import type { TenantId, UserId } from '../../src/kernel/ids/index.ts';
import { PostgresCatalogRepository } from '../../src/adapters/postgres/catalog-repository.ts';
import { createPostgresPool } from '../../src/adapters/postgres/pool.ts';
import { PostgresTransactionRunner } from '../../src/adapters/postgres/transaction-runner.ts';

const integrationEnabled = process.env['MAGRIT_POSTGRES_INTEGRATION'] === '1';
const describeIntegration = integrationEnabled ? describe : describe.skip;

describeIntegration('PostgresCatalogRepository — PostgreSQL reel', () => {
  let pool: Pool;
  let repository: PostgresCatalogRepository;
  const tenantId = randomUUID() as TenantId;
  const foreignTenantId = randomUUID() as TenantId;
  const platformAdminId = randomUUID() as UserId;
  const tenantAdminId = randomUUID() as UserId;
  const memberId = randomUUID() as UserId;
  const slug = `catalogue_${randomUUID().replaceAll('-', '')}`;

  beforeAll(async () => {
    pool = createPostgresPool();
    repository = new PostgresCatalogRepository(
      new PostgresTransactionRunner(pool, 'magrit_api'),
    );
    await pool.query(`
      insert into public.app_users (id, email_normalized, display_name)
      values
        ($1, $2, 'Catalog Platform Admin'),
        ($3, $4, 'Catalog Tenant Admin'),
        ($5, $6, 'Catalog Member')
    `, [
      platformAdminId, `catalog-platform-${platformAdminId}@example.invalid`,
      tenantAdminId, `catalog-admin-${tenantAdminId}@example.invalid`,
      memberId, `catalog-member-${memberId}@example.invalid`,
    ]);
    await pool.query(`
      insert into public.user_preferences (user_id, is_admin)
      values ($1, true), ($2, false), ($3, false)
    `, [platformAdminId, tenantAdminId, memberId]);
    await pool.query(`
      insert into public.tenants (id, slug, name)
      values ($1, $2, 'Catalog Integration'), ($3, $4, 'Foreign Catalog')
    `, [tenantId, `catalog-${tenantId}`, foreignTenantId, `catalog-${foreignTenantId}`]);
    await pool.query(`
      insert into public.tenant_members (tenant_id, user_id, role)
      values ($1, $2, 'admin'), ($1, $3, 'member')
    `, [tenantId, tenantAdminId, memberId]);
  });

  afterAll(async () => {
    if (!pool) return;
    await pool.query('delete from public.product_gammes where slug = $1', [slug]);
    await pool.query('delete from public.tenants where id = any($1::uuid[])', [[tenantId, foreignTenantId]]);
    await pool.query(
      'delete from public.app_users where id = any($1::uuid[])',
      [[platformAdminId, tenantAdminId, memberId]],
    );
    await pool.end();
  });

  it('reserve les mutations du PIM a un administrateur de plateforme', async () => {
    await expect(repository.upsertPimGamme(tenantAdminId, {
      slug,
      name: 'Interdit',
    })).rejects.toMatchObject({ code: 'permission_denied' });

    await expect(repository.upsertPimGamme(platformAdminId, {
      slug,
      name: 'Gamme intégration',
      matchingRules: { kind: 'leaflet' },
      displayOrder: 42,
      imageUrl: null,
    })).resolves.toMatchObject({
      slug,
      name: 'Gamme intégration',
      matchingRules: { kind: 'leaflet' },
      displayOrder: 42,
    });
  });

  it('sert le catalogue global a un utilisateur authentifie et conserve les champs omis', async () => {
    const first = await repository.upsertPimDefinition(platformAdminId, {
      gammeSlug: slug,
      variationFilter: { format: 'A4' },
      locale: 'fr',
      name: 'Définition A4',
      keywords: ['a4', 'test'],
      usageExamples: [{ title: 'Affiche', description: 'Usage de test' }],
      faq: [{ question: 'Pourquoi ?', answer: 'Pour tester.' }],
      commercialPitch: 'Premier argumentaire',
    });
    const updated = await repository.upsertPimDefinition(platformAdminId, {
      gammeSlug: slug,
      variationFilter: { format: 'A4' },
      locale: 'fr',
      commercialPitch: 'Argumentaire actualisé',
    });
    expect(updated.id).toBe(first.id);
    expect(updated.name).toBe('Définition A4');
    expect(updated.keywords).toEqual(['a4', 'test']);
    expect(updated.commercialPitch).toBe('Argumentaire actualisé');

    await expect(repository.pimCatalog(memberId)).resolves.toMatchObject({
      gammes: expect.arrayContaining([expect.objectContaining({ slug })]),
      definitions: expect.arrayContaining([expect.objectContaining({ id: first.id })]),
    });
  });

  it('autorise les souscriptions au tenant admin et les isole par tenant', async () => {
    await expect(repository.setGammeSubscriptions(tenantAdminId, tenantId, {
      subscriptions: [{ gammeSlug: slug, active: true }],
    })).resolves.toContainEqual({ gammeSlug: slug, active: true, displayOrder: 0 });

    await expect(repository.gammeSubscriptions(memberId, tenantId))
      .resolves.toContainEqual({ gammeSlug: slug, active: true, displayOrder: 0 });
    await expect(repository.gammeSubscriptions(memberId, foreignTenantId)).resolves.toEqual([]);
    await expect(repository.setGammeSubscriptions(memberId, tenantId, {
      subscriptions: [{ gammeSlug: slug, active: false }],
    })).rejects.toMatchObject({ code: 'permission_denied' });
  });

  it('supprime une gamme et ses donnees rattachees', async () => {
    await repository.deletePimGamme(platformAdminId, slug);
    const catalog = await repository.pimCatalog(memberId);
    expect(catalog.gammes.some((gamme) => gamme.slug === slug)).toBe(false);
    expect(catalog.definitions.some((definition) => definition.gammeSlug === slug)).toBe(false);
    await expect(repository.gammeSubscriptions(memberId, tenantId)).resolves.not.toEqual(
      expect.arrayContaining([expect.objectContaining({ gammeSlug: slug })]),
    );
    await expect(repository.deletePimGamme(platformAdminId, slug))
      .rejects.toMatchObject({ code: 'not_found' });
  });
});
