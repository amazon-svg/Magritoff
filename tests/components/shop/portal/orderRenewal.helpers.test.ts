/**
 * Tests vitest pour orderRenewal.helpers.ts (Story S3.3 Sprint 5 AC5).
 */

import { describe, it, expect } from 'vitest';
import {
  rebuildCartFromOrderItems,
  renewalBannerSections,
  type OrderItemRow,
} from '@/modules/orders/ui/storefront/orderRenewal.helpers';
import { resolveCartLinePricing } from '@/modules/orders/ui/storefront/cartPricing';
import type { ShopProduct } from '@/modules/shops/ui/runtime/ShopsContext';

function makeProduct(overrides: Partial<ShopProduct>): ShopProduct {
  return {
    id: 'prod-default',
    shop_id: 'shop-1',
    product_id: null,
    name: 'Produit test',
    category: 'cards',
    description: '',
    price_ht: 100,
    image_url: '',
    config: {},
    display_order: 0,
    ...overrides,
  };
}

function makeItem(overrides: Partial<OrderItemRow>): OrderItemRow {
  return {
    product_id: 'prod-1',
    product_label: 'Cartes de visite 85x55',
    clariprint_options: { material: 'Couché 350g', finish: 'mat' },
    quantity: 500,
    unit_price_ht: 100,
    ...overrides,
  };
}

describe('rebuildCartFromOrderItems', () => {
  it('items vides → cart vide + 0 warning', () => {
    const r = rebuildCartFromOrderItems([], []);
    expect(r.lines).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(r.stats).toEqual({ matched: 0, skipped: 0, total: 0 });
  });

  it('1 item product_id matchant catalogue → 1 ligne cart, qty correcte', () => {
    const items = [makeItem({ product_id: 'prod-1', quantity: 250 })];
    const products = [makeProduct({ id: 'prod-1', name: 'Cartes pro' })];
    const r = rebuildCartFromOrderItems(items, products);
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0].product.id).toBe('prod-1');
    expect(r.lines[0].qty).toBe(250);
    expect(r.warnings).toEqual([]);
    expect(r.stats).toEqual({ matched: 1, skipped: 0, total: 1 });
  });

  it('1 item product_id absent du catalogue → 0 ligne + 1 warning avec label', () => {
    const items = [
      makeItem({ product_id: 'prod-retire', product_label: 'Flyer A5 brillant' }),
    ];
    const products = [makeProduct({ id: 'autre' })];
    const r = rebuildCartFromOrderItems(items, products);
    expect(r.lines).toEqual([]);
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toContain('Flyer A5 brillant');
    expect(r.warnings[0]).toContain('retiré du catalogue');
    expect(r.stats).toEqual({ matched: 0, skipped: 1, total: 1 });
  });

  it('1 item product_id null (legacy library sans UUID) → 0 ligne + 1 warning explicite', () => {
    const items = [makeItem({ product_id: null, product_label: 'Kakemono 80x200' })];
    const products = [makeProduct({ id: 'prod-1' })];
    const r = rebuildCartFromOrderItems(items, products);
    expect(r.lines).toEqual([]);
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toContain('Kakemono 80x200');
    expect(r.warnings[0]).toContain('référence catalogue manquante');
  });

  it('2 items mix matchant/absent → 1 ligne + 1 warning', () => {
    const items = [
      makeItem({ product_id: 'prod-ok', product_label: 'OK', quantity: 100 }),
      makeItem({ product_id: 'prod-absent', product_label: 'Indispo' }),
    ];
    const products = [makeProduct({ id: 'prod-ok', name: 'Produit valide' })];
    const r = rebuildCartFromOrderItems(items, products);
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0].qty).toBe(100);
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toContain('Indispo');
    expect(r.stats).toEqual({ matched: 1, skipped: 1, total: 2 });
  });

  it('préserve les options Clariprint snapshot (merge avec config catalogue)', () => {
    const items = [
      makeItem({
        product_id: 'prod-1',
        clariprint_options: { material: 'Recyclé 250g', finish: 'soft-touch' },
      }),
    ];
    const products = [
      makeProduct({
        id: 'prod-1',
        config: { material: 'Couché 350g', dimensions: { w: 85, h: 55 } },
      }),
    ];
    const r = rebuildCartFromOrderItems(items, products);
    // snapshot écrase la valeur catalogue
    expect((r.lines[0].product.config as any).material).toBe('Recyclé 250g');
    // snapshot ajoute une clé absente du catalogue
    expect((r.lines[0].product.config as any).finish).toBe('soft-touch');
    // clés catalogue non snapshotées sont préservées
    expect((r.lines[0].product.config as any).dimensions).toEqual({ w: 85, h: 55 });
  });

  it('quantity invalide (0, NaN, négatif) → fallback qty=1', () => {
    const items = [
      makeItem({ product_id: 'prod-1', quantity: 0 }),
      makeItem({ product_id: 'prod-1', quantity: -50 }),
    ];
    const products = [makeProduct({ id: 'prod-1' })];
    const r = rebuildCartFromOrderItems(items, products);
    expect(r.lines).toHaveLength(2);
    expect(r.lines[0].qty).toBe(1);
    expect(r.lines[1].qty).toBe(1);
  });

  it('product_label vide ou null → fallback label générique dans warning', () => {
    const items = [makeItem({ product_id: null, product_label: null })];
    const r = rebuildCartFromOrderItems(items, []);
    expect(r.warnings[0]).toContain('Produit sans libellé');
  });

  // BCP-11 (docs/api/CONVENTIONS.md §8.25 point 3.6 (e)) — quatrième porte.

  it('T6 — clariprint_options.quantity present : reconstruit LE nombre de paquets commande (pas fige a 1), exemplaires dans config.quantity', () => {
    // BCP-11 round 2 (qa-review, defaut 1) : quantity=2 ICI, pas 1. Round 1
    // figeait qty a ONE_PACK sans condition dans toPackLine, un test avec
    // quantity=1 ne pouvait pas voir la difference (1 ou fige a 1, meme
    // resultat). Un acheteur ayant commande 2 paquets a 70 EUR retrouvait
    // 1 paquet a 35 EUR apres un renouvellement, sans avertissement.
    const items = [
      makeItem({
        product_id: 'prod-1',
        quantity: 2,
        clariprint_options: { quantity: 500 },
        unit_price_ht: 35,
      }),
    ];
    const products = [makeProduct({ id: 'prod-1', price_ht: 35 })];
    const r = rebuildCartFromOrderItems(items, products);
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0].qty).toBe(2);
    expect((r.lines[0].product.config as any).quantity).toBe(500);
    expect(resolveCartLinePricing(r.lines[0]).lineTotalHt).toBe(70);
  });

  it('T6b — clariprint_options.quantity present avec quantity=1 (cas normal, un seul paquet)', () => {
    const items = [
      makeItem({
        product_id: 'prod-1',
        quantity: 1,
        clariprint_options: { quantity: 500 },
        unit_price_ht: 35,
      }),
    ];
    const products = [makeProduct({ id: 'prod-1', price_ht: 35 })];
    const r = rebuildCartFromOrderItems(items, products);
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0].qty).toBe(1);
    expect((r.lines[0].product.config as any).quantity).toBe(500);
    expect(resolveCartLinePricing(r.lines[0]).lineTotalHt).toBe(35);
  });

  // Q20 (docs/api/CONVENTIONS.md §8.25 point 9) — chemin supplémentaire
  // vérifié en instruisant ce lot : `submitCart` envoie `line.product.config`
  // ENTIER comme `clariprintOptions`, persisté tel quel par
  // `api_create_storefront_order` dans `tenant_order_items.clariprint_options`
  // (aucun filtrage SQL). Un `clariprintQuote` légitime au moment de l'ajout
  // resurgirait donc, potentiellement périmé, au renouvellement.

  it('Q20 — un clariprintQuote snapshotte (produit configuré, quantity present) n est PAS reinjecte dans le panier renouvele', () => {
    const items = [
      makeItem({
        product_id: 'prod-1',
        quantity: 1,
        clariprint_options: { quantity: 500, material: 'Couché 350g', clariprintQuote: { success: true, priceHT: 35 } },
        unit_price_ht: 35,
      }),
    ];
    const products = [makeProduct({ id: 'prod-1', price_ht: 40 })];
    const r = rebuildCartFromOrderItems(items, products);
    expect(r.lines).toHaveLength(1);
    expect((r.lines[0].product.config as any).clariprintQuote).toBeUndefined();
    // Le prix vient du catalogue courant (40), pas du vieux devis (35),
    // et la source n est plus 'clariprint'.
    const pricing = resolveCartLinePricing(r.lines[0]);
    expect(pricing.resolution.source).not.toBe('clariprint');
    expect(pricing.unitPriceHt).toBe(40);
    // qa-review round 1, défaut 2 : le prix a changé (35 payé -> 40
    // renouvelé), l acheteur doit en être informé.
    expect(r.priceChanged).toEqual(['Produit test']);
  });

  it('Q20 — un clariprintQuote snapshotte (produit NON configuré) n est PAS reinjecte non plus', () => {
    const items = [
      makeItem({
        product_id: 'prod-1',
        quantity: 3,
        clariprint_options: { material: 'Couché 350g', clariprintQuote: { success: true, priceHT: 12 } },
        unit_price_ht: 12,
      }),
    ];
    const products = [makeProduct({ id: 'prod-1', price_ht: 15 })];
    const r = rebuildCartFromOrderItems(items, products);
    expect(r.lines).toHaveLength(1);
    expect((r.lines[0].product.config as any).clariprintQuote).toBeUndefined();
    const pricing = resolveCartLinePricing(r.lines[0]);
    expect(pricing.resolution.source).not.toBe('clariprint');
    expect(r.priceChanged).toEqual(['Produit test']);
  });

  // qa-review round 1, DÉFAUT 1 — le clariprintQuote peut venir de l AUTRE
  // moitié du merge : la config CATALOGUE courante (`product.config`), pas
  // seulement le snapshot de commande (`item.clariprint_options`). Chemin
  // atteignable par l API publiée (createShopProductCommandSchema /
  // updateShopProductCommandSchema, `config: z.record(z.string(),
  // z.unknown())`, aucune clé interdite). Ce test isole EXACTEMENT ce
  // second chemin : le snapshot de commande NE porte AUCUN clariprintQuote,
  // seule la config catalogue en porte un.
  it('Q20 qa-review défaut 1 — un clariprintQuote pose sur la config CATALOGUE (pas le snapshot de commande) n est pas reinjecte non plus', () => {
    const items = [
      makeItem({
        product_id: 'prod-1',
        quantity: 1,
        // Snapshot de commande SANS clariprintQuote — seule la faute serait
        // de le laisser filtrer depuis product.config ci-dessous.
        clariprint_options: { material: 'Couché 350g' },
        unit_price_ht: 35,
      }),
    ];
    const products = [
      makeProduct({
        id: 'prod-1',
        price_ht: 40,
        config: {
          material: 'Couché 350g',
          // Devis pose sur le produit CATALOGUE lui-meme, par ex. via un
          // appel a l API publiee de gestion du catalogue boutique.
          clariprintQuote: { success: true, priceHT: 5 },
        },
      }),
    ];
    const r = rebuildCartFromOrderItems(items, products);
    expect(r.lines).toHaveLength(1);
    expect((r.lines[0].product.config as any).clariprintQuote).toBeUndefined();
    const pricing = resolveCartLinePricing(r.lines[0]);
    expect(pricing.resolution.source).not.toBe('clariprint');
    // Le prix catalogue (40), pas le devis catalogue périmé (5).
    expect(pricing.unitPriceHt).toBe(40);
  });

  // qa-review round 1, DÉFAUT 2 — un renouvellement à prix STRICTEMENT
  // IDENTIQUE ne doit produire AUCUN avertissement de changement de prix.
  it('Q20 qa-review défaut 2 — renouvellement a prix identique : AUCUN avertissement de changement', () => {
    const items = [
      makeItem({
        product_id: 'prod-1',
        quantity: 1,
        clariprint_options: { material: 'Couché 350g' },
        unit_price_ht: 40,
      }),
    ];
    const products = [makeProduct({ id: 'prod-1', price_ht: 40 })];
    const r = rebuildCartFromOrderItems(items, products);
    expect(r.lines).toHaveLength(1);
    expect(r.priceChanged).toEqual([]);
  });

  // qa-review round 1, DÉFAUT 2 — un renouvellement à prix DIFFÉRENT doit
  // être signalé, même quand la nouvelle source est ferme (library_cached).
  it('Q20 qa-review défaut 2 — renouvellement a prix different (35 paye -> 40 catalogue) : avertissement emis, meme si le nouveau prix est ferme', () => {
    const items = [
      makeItem({
        product_id: 'prod-1',
        quantity: 1,
        clariprint_options: { material: 'Couché 350g' },
        unit_price_ht: 35,
      }),
    ];
    const products = [makeProduct({ id: 'prod-1', name: 'Cartes pro', price_ht: 40 })];
    const r = rebuildCartFromOrderItems(items, products);
    expect(r.lines).toHaveLength(1);
    const pricing = resolveCartLinePricing(r.lines[0]);
    expect(pricing.resolution.source).toBe('library_cached'); // ferme
    expect(r.priceChanged).toEqual(['Cartes pro']);

    // Le bandeau restitue bien une troisieme section distincte.
    const sections = renewalBannerSections([], [], r.priceChanged);
    expect(sections).toHaveLength(1);
    expect(sections[0]).toMatchObject({
      kind: 'price-changed',
      title: '1 produit renouvelé à un prix différent de celui payé',
      items: ['Cartes pro'],
    });
  });

  it('Q20 qa-review défaut 2 — unit_price_ht absent (null) : pas de comparaison possible, aucun avertissement', () => {
    const items = [
      makeItem({
        product_id: 'prod-1',
        quantity: 1,
        clariprint_options: { material: 'Couché 350g' },
        unit_price_ht: null,
      }),
    ];
    const products = [makeProduct({ id: 'prod-1', price_ht: 999 })];
    const r = rebuildCartFromOrderItems(items, products);
    expect(r.lines).toHaveLength(1);
    expect(r.priceChanged).toEqual([]);
  });

  it('T7 — quantity suspecte SANS clariprint_options.quantity : pas de reinterpretation silencieuse en exemplaires', () => {
    // Forme qu'une fuite d'exemplaires dans tenant_order_items.quantity aurait
    // gravee AVANT ce lot (aucun signal clariprint_options.quantity separe).
    // Le residu doit rester VISIBLE (paquets = 500, total visiblement faux),
    // jamais "reparé" en silence en le relisant comme un CopyCount.
    const items = [
      makeItem({
        product_id: 'prod-1',
        quantity: 500,
        clariprint_options: null,
        unit_price_ht: 35,
      }),
    ];
    const products = [makeProduct({ id: 'prod-1', price_ht: 35 })];
    const r = rebuildCartFromOrderItems(items, products);
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0].qty).toBe(500);
    expect(resolveCartLinePricing(r.lines[0]).lineTotalHt).toBe(35 * 500);
  });
});

/**
 * Q14-a round 2, défaut D1 (docs/api/CONVENTIONS.md §8.25 point 3.7 (c-bis)) —
 * deux sections jamais confondues sous un seul titre.
 */
describe('renewalBannerSections — point 3.7 (c-bis)', () => {
  it('aucune liste non vide -> aucune section', () => {
    expect(renewalBannerSections([], [])).toEqual([]);
  });

  it('scenario exact de la qa-review : 1 retire + 2 prix non fermes -> deux sections, dans cet ordre, titres accordes', () => {
    const sections = renewalBannerSections(
      ['Produit indisponible : Flyer A5 (retiré du catalogue)'],
      ['Cartes de visite', 'Kakemono'],
    );
    expect(sections).toHaveLength(2);
    expect(sections[0]).toEqual({
      kind: 'not-added',
      title: '1 produit indisponible (non ajouté au panier)',
      items: ['Produit indisponible : Flyer A5 (retiré du catalogue)'],
    });
    expect(sections[1]).toEqual({
      kind: 'price-not-firm',
      title: '2 produits ajoutés au panier avec un prix non définitif',
      detail: "Le prix définitif est confirmé par l'imprimeur à la validation de la commande.",
      items: ['Cartes de visite', 'Kakemono'],
    });
  });

  it('un seul produit non ajoute, singulier correct, aucune section prix', () => {
    const sections = renewalBannerSections(['Produit indisponible : X'], []);
    expect(sections).toHaveLength(1);
    expect(sections[0]?.title).toBe('1 produit indisponible (non ajouté au panier)');
  });

  it('un seul produit a prix non ferme, singulier correct, aucune section non-ajoute', () => {
    const sections = renewalBannerSections([], ['Flyer A5']);
    expect(sections).toHaveLength(1);
    expect(sections[0]?.kind).toBe('price-not-firm');
    expect(sections[0]?.title).toBe('1 produit ajouté au panier avec un prix non définitif');
  });

  it('items de la section non-ajoutes sont les avertissements complets (sens d origine, inchange)', () => {
    const sections = renewalBannerSections(['Produit indisponible : Y (retiré du catalogue)'], []);
    expect(sections[0]?.items).toEqual(['Produit indisponible : Y (retiré du catalogue)']);
  });

  it('items de la section prix-non-ferme sont les NOMS seuls, jamais une phrase complete', () => {
    const sections = renewalBannerSections([], ['Brochure catalogue']);
    // Mutation implicite testee : si la fonction composait une phrase par
    // ligne (comme le round 1 le faisait), cet item ne serait pas EGAL au nom
    // seul.
    expect(sections[0]?.items).toEqual(['Brochure catalogue']);
  });

  // Mutation exigee par le cadrage : "reverser les prix dans renewalWarnings
  // doit faire echouer un test" — verifie ici que la fonction ne fusionne
  // JAMAIS les deux listes dans une seule section.
  it('ne fusionne jamais les deux categories dans une seule section', () => {
    const sections = renewalBannerSections(['Produit indisponible : A'], ['B']);
    const notAddedSection = sections.find((s) => s.kind === 'not-added');
    const priceNotFirmSection = sections.find((s) => s.kind === 'price-not-firm');
    expect(notAddedSection?.items).not.toContain('B');
    expect(priceNotFirmSection?.items).not.toContain('Produit indisponible : A');
  });
});
