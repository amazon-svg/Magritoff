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
import { describe, expect, it, vi } from 'vitest';
import {
  acknowledgementFor,
  runValidateConfirm,
  unverifiedLineNamesOf,
} from '@/modules/orders/ui/storefront/ValidateOrderConfirmDialog';
import type { OrderUI } from '@/modules/orders/ui/storefront/PortalOrders.helpers';
// Le nettoyage des commentaires vit DESORMAIS dans un seul fichier :
// `tests/_helpers/stripComments.ts`. Il etait recopie a la main ici, et la
// copie etait plus faible que l original — d abord le `//` ancre en debut de
// ligne, puis (apres correction round 3) le `/* */` reste ancre. Le detail
// et les limites sont documentes la-bas.
import { stripComments } from '../../../_helpers/stripComments';

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

/**
 * Q17-c (qa-review round 2, BLOQUANT 1 — troisième round) — la revue a
 * démontré qu un test TEXTUEL sur `onConfirm(orderId, acknowledgementFor(order))`
 * reste vert quand le code réel est muté en `onConfirm(orderId, true)` avec
 * l ancienne forme laissée en commentaire adjacent (à l époque, un
 * commentaire de fin de ligne survivait au nettoyage du texte source).
 * Décision du coordinateur : on ne répare pas ce test, on le remplace.
 * `runValidateConfirm` exécute RÉELLEMENT le chemin complet avec des
 * dépendances injectées : ce test lit l argument que le faux `onConfirm` a
 * VRAIMENT reçu, sans lire un seul caractère du fichier source — et reste
 * donc valable quelle que soit la forme du commentaire, ligne ou bloc.
 */
function buildOrder(overrides: Partial<OrderUI> = {}): OrderUI {
  return {
    id: 'order-1', source: 'v1_1', date: '2026-09-19T10:00:00Z',
    customer_name: 'Client', customer_email: 'client@test.fr',
    items: [], total_ht: 100, total_ttc: 120, status: 'draft',
    ...overrides,
  };
}

describe('runValidateConfirm (Q17-c, BLOQUANT 1 round 3)', () => {
  it('commande marquee (hasUnverifiedPrices=true) -> onConfirm recoit true, jamais figee', async () => {
    const onConfirm = vi.fn().mockResolvedValue(null);
    const onSubmittingChange = vi.fn();
    const onError = vi.fn();
    const onClose = vi.fn();

    await runValidateConfirm(buildOrder({ hasUnverifiedPrices: true }), {
      onConfirm, onSubmittingChange, onError, onClose,
    });

    expect(onConfirm).toHaveBeenCalledWith('order-1', true);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('commande non marquee (hasUnverifiedPrices=false) -> onConfirm recoit false, jamais true par defaut', async () => {
    const onConfirm = vi.fn().mockResolvedValue(null);
    const deps = { onConfirm, onSubmittingChange: vi.fn(), onError: vi.fn(), onClose: vi.fn() };

    await runValidateConfirm(buildOrder({ hasUnverifiedPrices: false }), deps);

    expect(onConfirm).toHaveBeenCalledWith('order-1', false);
  });

  it('hasUnverifiedPrices absent (cohorte legacy) -> onConfirm recoit false', async () => {
    const onConfirm = vi.fn().mockResolvedValue(null);
    const deps = { onConfirm, onSubmittingChange: vi.fn(), onError: vi.fn(), onClose: vi.fn() };

    await runValidateConfirm(buildOrder({ hasUnverifiedPrices: undefined }), deps);

    expect(onConfirm).toHaveBeenCalledWith('order-1', false);
  });

  it('order=null -> AUCUN appel a onConfirm (pas de commande ouverte)', async () => {
    const onConfirm = vi.fn();
    const deps = { onConfirm, onSubmittingChange: vi.fn(), onError: vi.fn(), onClose: vi.fn() };

    await runValidateConfirm(null, deps);

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('onConfirm renvoie un message d erreur -> onError le recoit, onClose NON appele', async () => {
    const onConfirm = vi.fn().mockResolvedValue('Erreur serveur');
    const onError = vi.fn();
    const onClose = vi.fn();

    await runValidateConfirm(buildOrder({ hasUnverifiedPrices: true }), {
      onConfirm, onSubmittingChange: vi.fn(), onError, onClose,
    });

    expect(onError).toHaveBeenCalledWith('Erreur serveur');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('ordre des effets : submitting(true), puis appel, puis submitting(false)', async () => {
    const calls: string[] = [];
    const onConfirm = vi.fn().mockImplementation(async () => { calls.push('confirm'); return null; });
    const onSubmittingChange = vi.fn().mockImplementation((v: boolean) => calls.push(`submitting:${v}`));

    await runValidateConfirm(buildOrder(), {
      onConfirm, onSubmittingChange, onError: vi.fn(), onClose: vi.fn(),
    });

    expect(calls).toEqual(['submitting:true', 'confirm', 'submitting:false']);
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
