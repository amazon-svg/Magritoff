/**
 * Tests unitaires des helpers PURS de la grille des commandes (E10.18a) —
 * aucune dependance React, aucun appel reseau, aucun calcul de prix/seuil.
 */
import { describe, expect, it } from 'vitest';
import { buildPeriodQuery, formatOrderCreatedAt } from '@/modules/commercial-orders/ui/workspace/orders-list.helpers';

describe('buildPeriodQuery', () => {
  it('omet les deux cles quand les deux champs sont vides', () => {
    expect(buildPeriodQuery('', '')).toEqual({});
  });

  it('ne porte que la cle renseignee', () => {
    expect(buildPeriodQuery('2026-09-01', '')).toEqual({ createdFrom: '2026-09-01' });
    expect(buildPeriodQuery('', '2026-09-30')).toEqual({ createdFrom: undefined, createdTo: '2026-09-30' });
  });

  it('porte les deux cles quand les deux champs sont renseignes', () => {
    expect(buildPeriodQuery('2026-09-01', '2026-09-30')).toEqual({
      createdFrom: '2026-09-01',
      createdTo: '2026-09-30',
    });
  });

  it('ne transmet jamais une chaine vide ou uniquement des espaces', () => {
    expect(buildPeriodQuery('   ', '2026-09-30')).toEqual({ createdTo: '2026-09-30' });
  });
});

describe('formatOrderCreatedAt', () => {
  it('affiche la date/heure dans le fuseau de reference Europe/Paris, jamais UTC', () => {
    // 2026-08-31T22:30:00Z vaut le 1er septembre 00h30 a Paris (CEST) — le
    // meme exemple que le contrat (docs/api/CONVENTIONS.md §8.24). Afficher
    // le jour UTC ici contredirait le filtre de periode qui vient de faire
    // entrer cette commande dans "septembre".
    const formatted = formatOrderCreatedAt('2026-08-31T22:30:00.000Z');
    expect(formatted).toContain('01/09/2026');
  });
});
