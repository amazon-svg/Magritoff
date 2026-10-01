import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(resolve(process.cwd(), 'infra/postgres/migrations/0052_orders_storefront_context.sql'), 'utf8');
const routes = readFileSync(resolve(process.cwd(), 'src/server/api/orders-routes.ts'), 'utf8');
const repository = readFileSync(resolve(process.cwd(), 'src/adapters/postgres/orders-repository.ts'), 'utf8');

describe('brouillons Orders par identité boutique', () => {
  it('exige simultanément le compte et la boutique de la session', () => {
    expect(repository).toContain('identity.account_id !== order.shop_customer_account_id');
    expect(repository).toContain('identity.shop_id !== order.shop_id');
  });

  it('conserve un repli Magrit contrôlé pour les deux sessions parallèles', () => {
    expect(repository).toContain('canFallbackToMagrit');
    expect(repository).toContain('authorization.magritUserId !== null');
  });

  it('transporte le cookie seulement dans le contexte serveur Orders', () => {
    expect(routes).toContain('orderResourceAuthorization');
    expect(repository).toContain('withOrderAccess');
    expect(migration).toContain('magrit.current_storefront_account_id()');
  });
});
