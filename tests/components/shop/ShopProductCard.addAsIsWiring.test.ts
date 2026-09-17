/**
 * Q14-a round 2 (docs/api/CONVENTIONS.md §8.25 point 3.7) — DÉFAUT D2 de la
 * qa-review, corrigé.
 *
 * Constat de la qa-review round 1 : les fonctions pures `canAddAsIs` et
 * `addToCartButtonState` sont testées cas par cas, mais RIEN dans le dépôt ne
 * lit `ShopProductCard.tsx` — le câblage entre ces fonctions pures et le JSX
 * pouvait donc être cassé sans qu'aucun test ne rougisse. La qa a démontré
 * six mutations (W1-W6), toutes vertes à `pnpm typecheck` et à la suite
 * complète.
 *
 * Ces tests suivent le pattern déjà en usage dans ce dossier
 * (`PublicShop.submitCart.test.ts`, `PublicShop.productConfigurationAlignment.test.ts`,
 * `portal/PortalCart.text.test.ts`) : assertions texte sur les fichiers
 * sources, pour une classe de défaut (câblage entre composants) qu'un test
 * de rendu isolé ne verrait pas plus sûrement — le dépôt n'a de toute façon
 * aucune bibliothèque de rendu React ni environnement DOM dans `vitest`
 * (vérifié dans `package.json`).
 *
 * Chaque test ci-dessous a été rejoué manuellement contre la mutation
 * correspondante (W1 à W6, adaptées au câblage du round 2 pour W6, qui
 * change de forme avec le défaut D1 — voir story-Q14a.md pour le verdict de
 * chacune) : toutes rougissent.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '../../..');
const read = (relPath: string) => readFileSync(resolve(root, relPath), 'utf-8');

const CARD_PATH = 'src/modules/catalog/ui/storefront/ShopProductCard.tsx';
const LIFECYCLE_PATH = 'src/modules/orders/ui/hooks/useStorefrontOrderLifecycle.ts';
const CART_PATH = 'src/modules/orders/ui/storefront/PortalCart.tsx';
const PUBLIC_SHOP_PATH = 'src/modules/shops/ui/storefront/PublicShop.tsx';

describe('ShopProductCard — le cablage du bouton + Panier lit REELLEMENT les fonctions pures (W1-W5)', () => {
  it('W1 — disabled est pose depuis addToCartState.disabled, jamais un litteral', () => {
    const src = read(CARD_PATH);
    expect(src).toMatch(/disabled=\{addToCartState\.disabled\}/);
    // Un litteral fige (mutation W1) ne doit jamais apparaitre sur ce bouton.
    expect(src).not.toMatch(/disabled=\{false\}/);
  });

  it('W2 — aria-describedby est pose depuis addToCartState.describedBy, sous condition', () => {
    const src = read(CARD_PATH);
    expect(src).toMatch(/"aria-describedby":\s*addToCartState\.describedBy/);
  });

  it('W3 — addToCartButtonState recoit EXACTEMENT addAsIsReasonId, et le libelle porte le MEME identifiant en id', () => {
    const src = read(CARD_PATH);
    expect(src).toMatch(/addToCartButtonState\(addAsIsEligibility,\s*addAsIsReasonId\)/);
    expect(src).toMatch(/id=\{addAsIsReasonId\}/);
  });

  it('W4 — canAddAsIs est appele avec le quote extrait du produit, jamais un null fige', () => {
    const src = read(CARD_PATH);
    expect(src).toMatch(/canAddAsIs\(product,\s*clariprintQuote\)/);
  });

  it('W5 — le libelle est rendu conditionnellement sur addToCartState.label', () => {
    const src = read(CARD_PATH);
    expect(src).toMatch(/\{addToCartState\.label && \(/);
  });

  it('onConfigure est REQUIS (reserve qa-review, repli sur onAddToCart supprime)', () => {
    const src = read(CARD_PATH);
    expect(src).toMatch(/onConfigure:\s*\(product: ShopProduct\) => void;/);
    expect(src).not.toMatch(/onConfigure\?:/);
    // Le repli n a plus de raison d exister dans le gestionnaire de clic.
    expect(src).not.toMatch(/if \(onConfigure\)/);
  });
});

describe('Volet renouvellement — le cablage D1 (deux canaux separes) tient de bout en bout (W6 adaptee)', () => {
  it('le hook appelle REELLEMENT collectPriceNotFirmProductNames et pose son resultat dans renewalPriceNotFirm', () => {
    const src = read(LIFECYCLE_PATH);
    expect(src).toMatch(/setRenewalPriceNotFirm\(collectPriceNotFirmProductNames\(lines\)\)/);
    // renewalWarnings garde le sens d origine (warnings de rebuildCartFromOrderItems
    // SEULS) : jamais refusionne avec le resultat de collectPriceNotFirmProductNames.
    expect(src).not.toMatch(/setRenewalWarnings\(\[\.\.\.warnings/);
  });

  it('dismissRenewalWarnings et submitCart vident les DEUX canaux, jamais un seul', () => {
    const src = read(LIFECYCLE_PATH);
    const setPriceNotFirmCalls = (src.match(/setRenewalPriceNotFirm\(\[\]\)/g) ?? []).length;
    const setWarningsCalls = (src.match(/setRenewalWarnings\(\[\]\)/g) ?? []).length;
    // Trois sites de remise a zero : changement de slug, submitCart reussi,
    // dismissRenewalWarnings — les deux etats doivent etre vides aux TROIS.
    expect(setPriceNotFirmCalls).toBe(3);
    expect(setWarningsCalls).toBe(3);
  });

  it('PublicShop transmet REELLEMENT renewalPriceNotFirm a PortalCart (pas seulement destructure)', () => {
    const src = read(PUBLIC_SHOP_PATH);
    expect(src).toMatch(/renewalPriceNotFirm,/); // destructure du hook
    expect(src).toMatch(/renewalPriceNotFirm=\{renewalPriceNotFirm\}/); // prop transmise au JSX
  });

  it('PortalCart calcule les sections par la fonction pure, ne compose aucun texte lui-meme', () => {
    const src = read(CART_PATH);
    expect(src).toMatch(/renewalBannerSections\(renewalWarnings,\s*renewalPriceNotFirm\)/);
    // Le titre du round 1 ("N produit(s) indisponible(s)...") ne doit plus
    // etre COMPOSE dans PortalCart : seule renewalBannerSections le fait.
    expect(src).not.toMatch(/indisponible\$\{/);
    expect(src).not.toMatch(/\{renewalWarnings\.length\} produit/);
  });

  it('PortalCart rend les DEUX data-testid de section, associes au bon kind, jamais inverses', () => {
    const src = read(CART_PATH);
    expect(src).toMatch(
      /section\.kind === 'not-added'\s*\n?\s*\?\s*TEST_IDS\.shop\.cartRenewalNotAddedSection\s*\n?\s*:\s*TEST_IDS\.shop\.cartRenewalPriceNotFirmSection/,
    );
  });

  it('la section prix-non-ferme rend sa phrase secondaire (section.detail), jamais composee en dur', () => {
    const src = read(CART_PATH);
    expect(src).toMatch(/\{section\.detail && \(/);
  });

  it('le bandeau entier est conditionne sur renewalSections.length, jamais sur un seul des deux canaux', () => {
    const src = read(CART_PATH);
    expect(src).toMatch(/\{renewalSections\.length > 0 && \(/);
    // Round 1 conditionnait sur renewalWarnings.length seul : un retour a
    // cette forme masquerait la section prix-non-ferme quand aucun produit
    // n est indisponible.
    expect(src).not.toMatch(/\{renewalWarnings\.length > 0 && \(/);
  });
});
