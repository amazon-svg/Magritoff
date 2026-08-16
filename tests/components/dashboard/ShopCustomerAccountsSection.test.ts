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

  it('expose toujours le lien manuel après une tentative d invitation', () => {
    expect(source).toContain('api.issueActivation');
    expect(source).toContain('Lien d’activation manuel');
    expect(source).toContain('transmettez ce lien manuellement');
  });

  it('propose l action unifiée de délégation sans manipuler de jeton', () => {
    expect(source).toContain('Se connecter à la boutique');
    expect(source).toContain('api.startSelfDelegation');
    expect(source).toContain("window.open('about:blank', '_blank')");
    expect(source).not.toContain('opaqueToken');
  });

  it('explique la séparation des comptes sans promettre une invitation', () => {
    expect(source).toContain('ne sont pas des utilisateurs Magrit');
    expect(source).toContain('Aucun email, mot de passe ou');
    expect(source).toContain("initialStatus: 'delegated_only'");
  });
});
