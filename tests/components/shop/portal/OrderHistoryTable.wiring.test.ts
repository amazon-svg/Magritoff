/**
 * Q17-c (qa-review round 1, BLOQUANT 3) — la frontière acheteur/atelier
 * n'est réelle que si le SITE D'APPEL, dans le JSX, appelle bien la
 * fonction pure testée par ailleurs (`OrderHistoryTable.helpers.test.ts`).
 * `showsUnverifiedPriceBadge`/`showsOrderDetail`/`isAtelierAppearance` sont
 * elles-mêmes correctement testées ; ce que la qa a démontré, c'est que
 * RIEN ne garantissait que le composant les appelle réellement plutôt
 * qu'une condition réécrite à la main (`o.hasUnverifiedPrices === true`,
 * `isDashboardAppearance` recopié). Trois mutations, chacune laissant les
 * 3379 tests d'alors intégralement verts :
 *  - remplacer `showsUnverifiedPriceBadge(o, appearance)` par
 *    `o.hasUnverifiedPrices === true` (la pastille apparaît côté acheteur) ;
 *  - remplacer `isAtelierAppearance(appearance)` par une condition qui
 *    laisse le bouton de détail visible côté acheteur ;
 *  - remplacer `showsOrderDetail(o, appearance, expandedOrderIds)` par
 *    `expandedOrderIds.has(o.id)` seul (l'acheteur peut déplier ses lignes
 *    et lire la provenance du prix).
 *
 * Pattern déjà en place dans ce dossier
 * (`ShopProductCard.addAsIsWiring.test.ts`) : assertions texte bornées à la
 * zone du site d'appel (pas tout le fichier), commentaires retirés d'abord.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const stripComments = (src: string): string =>
  src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/^\s*\/\*[\s\S]*?\*\//gm, '')
    .replace(/^\s*\/\/.*$/gm, '');

const source = stripComments(readFileSync(
  resolve(process.cwd(), 'src/modules/orders/ui/storefront/OrderHistoryTable.tsx'),
  'utf8',
));

/** Fenêtre de texte précédant immédiatement un testid — la garde JSX vit toujours juste avant. */
function windowBefore(testidExpression: string, span = 260): string {
  const i = source.indexOf(testidExpression);
  expect(i, `testid "${testidExpression}" introuvable dans le source nettoyé`).toBeGreaterThan(-1);
  return source.slice(Math.max(0, i - span), i);
}

describe('OrderHistoryTable — câblage de la frontière acheteur/atelier (Q17-c, BLOQUANT 3)', () => {
  it('la pastille appelle showsUnverifiedPriceBadge(o, appearance), jamais une condition réécrite', () => {
    const zone = windowBefore('TEST_IDS.shop.orderUnverifiedPriceBadge');
    expect(zone).toContain('showsUnverifiedPriceBadge(o, appearance) && (');
    expect(zone).not.toContain('hasUnverifiedPrices === true');
    expect(zone).not.toMatch(/appearance === ['"]dashboard['"]/);
  });

  it('le choix bouton/texte statique du détail appelle isAtelierAppearance(appearance)', () => {
    const zone = windowBefore('TEST_IDS.shop.orderDetailToggle');
    expect(zone).toContain('isAtelierAppearance(appearance) ? (');
    expect(zone).not.toContain('isDashboardAppearance ?');
  });

  it('la ligne de détail appelle showsOrderDetail(o, appearance, expandedOrderIds), jamais expandedOrderIds seul', () => {
    const zone = windowBefore('TEST_IDS.shop.orderDetailRow');
    expect(zone).toContain('showsOrderDetail(o, appearance, expandedOrderIds) && (');
    expect(zone).not.toContain('isDashboardAppearance && expandedOrderIds.has(o.id)');
  });
});
