/**
 * REFACTO-VISUELS (2026-08-09, arbitrage Arnaud) — le visuel est une PROPRIETE
 * DE LA GAMME dans le PIM.
 *
 * Remplace `productMockupSignatureFallback.test.ts` (S2.14), qui verrouillait
 * la garantie inverse : « retourne TOUJOURS une URL non vide ». C'est cette
 * garantie qui produisait le defaut remonte par Arnaud le 2026-08-09 — un
 * calendrier affichait un flyer, une brochure un depliant — parce qu'une
 * famille sans visuel dedie empruntait celui d'une autre famille via une
 * inference sur le NOM du produit. Le contrat s'inverse ici : mieux vaut PAS
 * de visuel (repere de famille au rendu) qu'un visuel FAUX.
 */

import { describe, expect, it } from 'vitest';
import {
  resolveGammeImage,
  resolveProductImage,
} from '../../src/app/utils/productImages';
import type { Gamme } from '../../src/app/utils/productEnrichment';

const FLYER_URL = '/visuels-produits/magrit-flyer.jpg';

function gamme(
  slug: string,
  name: string,
  parent_slug: string | null,
  image_url: string | null = null,
): Gamme {
  return {
    id: `id-${slug}`,
    slug,
    name,
    parent_slug,
    matching_rules: {},
    display_order: 0,
    image_url,
  };
}

/**
 * Arbre representatif du PIM reel : une famille couverte (flyer), une famille
 * NON couverte (calendrier — c'est le cas signale par Arnaud), et des
 * sous-gammes dans les deux.
 */
const GAMMES: Gamme[] = [
  gamme('flyer', 'Flyers', null, FLYER_URL),
  gamme('flyer_a7', 'Flyer A7', 'flyer'),
  gamme('calendrier', 'Calendriers', null),
  gamme('calendrier_bancaire', 'Calendrier bancaire', 'calendrier'),
];

describe('resolveGammeImage — heritage le long de l arbre PIM', () => {
  it('retourne le visuel propre de la gamme quand elle en a un', () => {
    expect(resolveGammeImage('flyer', GAMMES)).toBe(FLYER_URL);
  });

  it('fait heriter une sous-gamme du visuel de sa famille', () => {
    expect(resolveGammeImage('flyer_a7', GAMMES)).toBe(FLYER_URL);
  });

  it('laisse le visuel propre primer sur celui du parent', () => {
    const own = '/visuels-produits/flyer-a7-special.jpg';
    const withOwn = GAMMES.map((g) =>
      g.slug === 'flyer_a7' ? { ...g, image_url: own } : g,
    );
    expect(resolveGammeImage('flyer_a7', withOwn)).toBe(own);
  });

  it('retourne null pour une famille sans visuel — PAS celui d une autre famille', () => {
    expect(resolveGammeImage('calendrier', GAMMES)).toBeNull();
    expect(resolveGammeImage('calendrier_bancaire', GAMMES)).toBeNull();
  });

  it('retourne null sur une gamme inconnue ou un PIM vide', () => {
    expect(resolveGammeImage('gamme_fantome', GAMMES)).toBeNull();
    expect(resolveGammeImage('flyer', [])).toBeNull();
    expect(resolveGammeImage(null, GAMMES)).toBeNull();
  });

  it('ne boucle pas sur un cycle parent_slug (donnee corrompue)', () => {
    const cyclic = [
      gamme('a', 'A', 'b'),
      gamme('b', 'B', 'a'),
    ];
    expect(resolveGammeImage('a', cyclic)).toBeNull();
  });

  it('ignore une image_url vide ou blanche (colonne default \'\')', () => {
    const blank = [gamme('flyer', 'Flyers', null, '   ')];
    expect(resolveGammeImage('flyer', blank)).toBeNull();
  });
});

describe('resolveProductImage — ordre de priorite', () => {
  it('1. l image posee sur le produit prime sur tout', () => {
    expect(
      resolveProductImage({
        name: 'Flyer A7',
        image_url: '/custom/produit.jpg',
        gamme_slug: 'flyer',
        gammes: GAMMES,
      }),
    ).toBe('/custom/produit.jpg');
  });

  it('2. a defaut, le visuel de la gamme resolue', () => {
    expect(
      resolveProductImage({
        name: 'Flyer A7',
        gamme_slug: 'flyer_a7',
        gammes: GAMMES,
      }),
    ).toBe(FLYER_URL);
  });

  it('3. null quand ni le produit ni sa gamme n ont de visuel', () => {
    expect(
      resolveProductImage({
        name: 'Calendrier bancaire 2027',
        gamme_slug: 'calendrier_bancaire',
        gammes: GAMMES,
      }),
    ).toBeNull();
  });

  it('NON-REGRESSION : un calendrier ne recupere JAMAIS le visuel flyer', () => {
    // Le defaut d origine : `inferTemplateFromText` ne connaissait pas
    // « calendrier » et retombait sur la famille flyer, donc sur son visuel.
    // Le nom du produit ne doit plus avoir aucune influence sur le visuel.
    for (const name of [
      'Calendrier mural 2027',
      'Calendrier bancaire',
      'Panneau Dibond 60x40',
      'Drapeau mat 4 m',
      'Set de table restaurant',
    ]) {
      expect(
        resolveProductImage({ name, gammes: GAMMES }),
      ).not.toBe(FLYER_URL);
    }
  });

  it('null quand le PIM n est pas charge (pas de repli devine)', () => {
    expect(resolveProductImage({ name: 'Flyer A5' })).toBeNull();
  });
});
