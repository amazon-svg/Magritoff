import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const storefront = readFileSync(resolve(process.cwd(), 'src/modules/shops/ui/storefront/PublicShop.tsx'), 'utf8');
const orderLifecycle = readFileSync(resolve(process.cwd(), 'src/modules/orders/ui/hooks/useStorefrontOrderLifecycle.ts'), 'utf8');
const layout = readFileSync(resolve(process.cwd(), 'src/modules/shops/ui/storefront/ShopLayout.tsx'), 'utf8');
const layoutHelpers = readFileSync(resolve(process.cwd(), 'src/modules/shops/ui/storefront/ShopLayout.helpers.ts'), 'utf8');
const account = readFileSync(resolve(process.cwd(), 'src/modules/account/ui/customer-portal/AccountHub.tsx'), 'utf8');

describe('identité du compte storefront', () => {
  it('affiche le client boutique sans réutiliser le menu Magrit', () => {
    expect(layoutHelpers).toContain('session.customer?.fullName');
    expect(layout).not.toContain('AuthMenu');
    expect(account).toContain('session.customer.fullName');
    expect(account).toContain('session.customer.email');
    expect(account).not.toContain('useAuth');
    expect(account).not.toContain('useTenant');
  });

  // BCP-9 (2026-09-15, qa-review round 1) — le cadrage (CONVENTIONS §8.25
  // 5.5) ne vise QU'UNE ligne : l'aria-label du bouton compte
  // (`ShopLayout.tsx:346`). Le texte VISIBLE (le <span> a cote de l icone)
  // n est pas dans le perimetre et garde sa forme d origine (efc52207).
  it('B11 — l aria-label EXACTEMENT du bouton compte passe par resolveAccountLabel', () => {
    expect(layout).toMatch(/aria-label=\{resolveAccountLabel\(storefrontSession\)\}/);
  });

  it('B12 — le texte visible garde sa forme d origine, hors perimetre BCP-9', () => {
    // Forme exacte a efc52207 (git show efc52207:.../ShopLayout.tsx:355).
    expect(layout).toMatch(/\{storefrontSession\?\.customer\.fullName \?\? "Compte"\}/);
    // resolveAccountLabel n apparait qu une seule fois dans le fichier —
    // uniquement pour l aria-label. Une mutation qui le reutiliserait aussi
    // pour le texte visible (debordement de cadrage) ferait echouer cette
    // assertion (count === 2).
    expect(layout.match(/resolveAccountLabel\(storefrontSession\)/g)).toHaveLength(1);
  });

  it('transmet la session au chrome, au profil et à la confirmation', () => {
    expect(storefront).toContain('storefrontSession={storefrontSession}');
    expect(storefront).toContain('onAuthenticated={setStorefrontSession}');
    expect(storefront).toContain('onSignOut={endStorefrontSession}');
    expect(storefront).toContain("storefrontSession?.customer.email ?? ''");
  });

  it('demande une session boutique avant d afficher les données du compte', () => {
    expect(account).toContain('if (!hasCurrentShopSession)');
    expect(account).toContain('<StorefrontLoginForm');
    expect(account).toContain("allowRegistration={shop.access_mode === 'self_signup'}");
    expect(account).toContain('onAuthenticated={onAuthenticated}');
  });

  it('autorise une commande avec la session boutique sans exiger Supabase Auth', () => {
    expect(storefront).toContain('sessionShopId: storefrontSession?.identity.shopId ?? null');
    expect(orderLifecycle).toContain('if (sessionShopId !== shop.id)');
    expect(storefront).not.toContain('useAuth');
    expect(orderLifecycle).not.toContain('useAuth');
  });
});
