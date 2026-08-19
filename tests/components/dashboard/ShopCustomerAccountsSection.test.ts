import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('ShopCustomerAccountsSection', () => {
  const source = readFileSync(
    resolve(process.cwd(), 'src/app/components/dashboard/ShopCustomerAccountsSection.tsx'),
    'utf8',
  );
  const hook = readFileSync(
    resolve(process.cwd(), 'src/app/hooks/useShopCustomerAccountManagement.ts'),
    'utf8',
  );

  it('délègue la façade ShopCustomers au hook et ne connaît aucun accès Supabase', () => {
    expect(source).toContain('useShopCustomerAccountManagement');
    expect(source).not.toContain('useShopCustomersApi');
    expect(hook).toContain('useShopCustomersApi');
    expect(hook).toContain('targetKeyRef.current');
    for (const candidate of [source, hook]) {
      expect(candidate).not.toContain('utils/supabase');
      expect(candidate).not.toMatch(/\bsupabase\s*\./);
    }
  });

  it('expose toujours le lien manuel après une tentative d invitation', () => {
    expect(hook).toContain('api.issueActivation');
    expect(source).toContain('Lien d’activation manuel');
    expect(source).toContain('transmettez ce lien manuellement');
    expect(source).toContain('Ouvrir l’activation');
    expect(source).toContain('choisit son mot de passe');
  });

  it('propose l action unifiée de délégation sans manipuler de jeton', () => {
    expect(source).toContain('Se connecter à la boutique');
    expect(hook).toContain('api.startSelfDelegation');
    expect(source).toContain("window.open('about:blank', '_blank')");
    expect(source).not.toContain('opaqueToken');
  });

  it('explique la séparation des comptes sans promettre une invitation', () => {
    expect(source).toContain('ne sont pas des utilisateurs Magrit');
    expect(source).toContain('Aucun email, mot de passe ou');
    expect(source).toContain("initialStatus: 'delegated_only'");
  });
});
