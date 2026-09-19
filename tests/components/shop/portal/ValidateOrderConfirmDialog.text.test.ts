/**
 * BCP-5 (docs/api/CONVENTIONS.md §8.25 point 5.1, Q1 2026-09-15) : l'atelier
 * voit le même libellé que l'acheteur pour le statut draft.
 *
 * qa-review de BCP-5 (2026-09-15), point 5.1(c) : « les messages d'erreur
 * qui nomment un statut le tirent eux aussi de la table ». Le texte ne
 * recopie donc plus les libellés à la main — il appelle `getStatusInfo(...)`.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { acknowledgementFor, unverifiedLineNamesOf } from '@/modules/orders/ui/storefront/ValidateOrderConfirmDialog';
import type { OrderUI } from '@/modules/orders/ui/storefront/PortalOrders.helpers';

/**
 * Q17-c (qa-review round 1, BLOQUANT 2) — un test textuel qui n asserte pas
 * sur du code REELLEMENT EXECUTE ne prouve rien : la qa a mute
 * `onConfirm(orderId, hasUnverifiedPrices)` en `onConfirm(orderId, true)` tout
 * en laissant l ancienne forme dans un commentaire juste a cote, et
 * `expect(source).toContain(...)` restait vert. Meme pattern que
 * `ShopProductCard.addAsIsWiring.test.ts` (defaut D5 de son historique) :
 * retirer les commentaires AVANT toute assertion de presence.
 */
const stripComments = (src: string): string =>
  src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/^\s*\/\*[\s\S]*?\*\//gm, '')
    .replace(/^\s*\/\/.*$/gm, '');

const rawSource = readFileSync(
  resolve(process.cwd(), 'src/modules/orders/ui/storefront/ValidateOrderConfirmDialog.tsx'),
  'utf8',
);
const source = stripComments(rawSource);

describe('ValidateOrderConfirmDialog — libellé atelier (BCP-5)', () => {
  it('ne nomme plus le statut Brouillon côté atelier', () => {
    expect(source).not.toContain('Brouillon');
  });

  it('tire les deux libellés de la table unique, jamais recopiés en dur', () => {
    expect(source).toContain("La commande passera de <strong>{getStatusInfo('draft').label}</strong>");
    expect(source).toContain("<strong>{getStatusInfo('validated').label}</strong>");
    expect(source).not.toContain('<strong>En attente de validation</strong>');
    expect(source).not.toContain('<strong>Validée</strong>');
  });
});

// Q17-c (docs/api/CONVENTIONS.md §8.25 point 12 (c)) — « un second bouton,
// jamais une case discrète », qui NOMME les lignes concernées. Avant ce lot,
// ce composant n avait ni ce libellé ni cet acquittement explicite : ces
// tests échouent sur le code d avant.
describe('ValidateOrderConfirmDialog — geste distinct prix non vérifié (Q17-c)', () => {
  it('le confirm relaie acknowledgementFor(order), jamais une valeur figée (BLOQUANT 2)', () => {
    expect(source).toContain('onConfirm(orderId, acknowledgementFor(order))');
    // Ceinture et bretelles : aucune forme figée ne doit survivre, même
    // partiellement, une fois les commentaires retirés.
    expect(source).not.toContain('onConfirm(orderId, true)');
    expect(source).not.toContain('onConfirm(orderId, hasUnverifiedPrices)');
  });

  it('un bouton de confirmation DISTINCT porte le libellé exact du point 12 (c)', () => {
    expect(source).toContain('Valider malgré les prix non vérifiés');
    expect(source).toContain('validateOrderDialogConfirmUnverified');
  });

  it('la notice ne montre jamais le nom technique client_unverified', () => {
    expect(source).not.toContain("'client_unverified'</");
    expect(source).not.toMatch(/client_unverified<\/(strong|span)>/);
  });
});

// Q17-c (qa-review round 1, BLOQUANT 2) — comportement, pas texte : cette
// fonction decide SEULE si la commande exige l acquittement distinct.
describe('acknowledgementFor (Q17-c, BLOQUANT 2)', () => {
  it('null -> false (pas de commande ouverte)', () => {
    expect(acknowledgementFor(null)).toBe(false);
  });

  it('hasUnverifiedPrices=true -> true', () => {
    expect(acknowledgementFor({ hasUnverifiedPrices: true })).toBe(true);
  });

  it('hasUnverifiedPrices=false -> false', () => {
    expect(acknowledgementFor({ hasUnverifiedPrices: false })).toBe(false);
  });

  it('hasUnverifiedPrices absent (cohorte legacy) -> false, jamais true par defaut', () => {
    expect(acknowledgementFor({ hasUnverifiedPrices: undefined })).toBe(false);
  });
});

describe('unverifiedLineNamesOf (Q17-c)', () => {
  function order(items: OrderUI['items']): Pick<OrderUI, 'items'> {
    return { items };
  }

  it('null -> tableau vide', () => {
    expect(unverifiedLineNamesOf(null)).toEqual([]);
  });

  it('ne retient que les lignes client_unverified, nomme jamais les autres', () => {
    const names = unverifiedLineNamesOf(order([
      { name: 'Flyers', qty: 10, price_ht: 5, priceOrigin: 'client_unverified' },
      { name: 'Cartes de visite', qty: 500, price_ht: 2, priceOrigin: 'catalog' },
      { name: 'Kakémono', qty: 1, price_ht: 100, priceOrigin: 'legacy' },
    ]));
    expect(names).toEqual(['Flyers']);
  });

  it('aucune ligne client_unverified -> tableau vide', () => {
    const names = unverifiedLineNamesOf(order([
      { name: 'Cartes de visite', qty: 500, price_ht: 2, priceOrigin: 'catalog' },
    ]));
    expect(names).toEqual([]);
  });
});
