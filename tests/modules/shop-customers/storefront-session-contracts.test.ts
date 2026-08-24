import { describe, expect, it } from 'vitest';
import {
  createStorefrontSessionCommandSchema,
  createStorefrontSessionResultSchema,
  storefrontSessionSchema,
} from '@/modules/shop-customers';

const SHOP = '11111111-1111-4111-8111-111111111111';
const CUSTOMER = '22222222-2222-4222-8222-222222222222';

describe('contrats de session storefront', () => {
  it('lie strictement la session au compte et à une boutique', () => {
    expect(() => storefrontSessionSchema.parse(session())).not.toThrow();
    expect(() => storefrontSessionSchema.parse(session({
      customer: { ...session().customer, shopId: '33333333-3333-4333-8333-333333333333' },
    }))).toThrow();
  });

  it('n expose ni sujet Auth technique ni jeton dans le résultat JSON', () => {
    const parsed = createStorefrontSessionResultSchema.parse({ session: session() });
    const json = JSON.stringify(parsed);
    expect(json).not.toContain('authSubject');
    expect(json).not.toContain('token');
    expect(json).not.toContain('password');
  });

  it('valide le secret en entrée sans le normaliser', () => {
    const command = createStorefrontSessionCommandSchema.parse({
      email: ' client@example.com ',
      password: '  secret conservé  ',
    });
    expect(command.email).toBe('client@example.com');
    expect(command.password).toBe('  secret conservé  ');
  });
});

function session(overrides: Record<string, unknown> = {}) {
  return {
    identity: {
      kind: 'shop_customer' as const,
      shopId: SHOP,
      shopCustomerAccountId: CUSTOMER,
    },
    customer: {
      id: CUSTOMER,
      shopId: SHOP,
      email: 'client@example.com',
      fullName: 'Client Exemple',
      status: 'active' as const,
    },
    expiresAt: '2026-08-16T12:00:00+00:00',
    ...overrides,
  };
}
