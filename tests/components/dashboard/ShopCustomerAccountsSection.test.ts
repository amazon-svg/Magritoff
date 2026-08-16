import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('ShopCustomerAccountsSection', () => {
  const source = readFileSync(
    resolve(process.cwd(), 'src/app/components/dashboard/ShopCustomerAccountsSection.tsx'),
    'utf8',
  );

  it('utilise la façade ShopCustomers composée et aucun accès Supabase', () => {
    expect(source).toContain('useShopCustomersApi');
    expect(source).not.toContain('utils/supabase');
    expect(source).not.toMatch(/\bsupabase\s*\./);
  });

  it('explique la séparation des comptes sans promettre une invitation', () => {
    expect(source).toContain('ne sont pas des utilisateurs Magrit');
    expect(source).toContain('Aucun email, mot de passe ou');
    expect(source).toContain("initialStatus: 'delegated_only'");
  });
});
