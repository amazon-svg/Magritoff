/**
 * Tests unitaires du helper PUR d `OrderStatusDialog` (E10.14) —
 * derivation de l etat visuel de chaque etape en colonne droite de la
 * modale. Aucune dependance React, aucun appel reseau.
 */
import { describe, expect, it } from 'vitest';
import {
  currentStepPosition,
  stepVisualState,
} from '@/modules/commercial-orders/ui/components/order-status.helpers';

const STEP_RECU = { id: 'step-recu', position: 0 };
const STEP_PAO = { id: 'step-pao', position: 1 };
const STEP_VALIDE = { id: 'step-valide', position: 2 };
const STEP_LIVRE = { id: 'step-livre', position: 5 };

describe('currentStepPosition', () => {
  it('rend la position de l etape courante', () => {
    expect(currentStepPosition([STEP_RECU, STEP_PAO, STEP_VALIDE], STEP_PAO.id)).toBe(1);
  });

  it('rend null si currentStepId est null (commande sans etape)', () => {
    expect(currentStepPosition([STEP_RECU, STEP_PAO], null)).toBeNull();
  });

  it('rend null si currentStepId ne correspond a aucune etape du catalogue (defense en profondeur)', () => {
    expect(currentStepPosition([STEP_RECU, STEP_PAO], 'etape-inconnue')).toBeNull();
  });
});

describe('stepVisualState', () => {
  it("rend 'current' pour l etape courante, quelle que soit sa position", () => {
    expect(stepVisualState(STEP_PAO, STEP_PAO.id, 1)).toBe('current');
  });

  it("rend 'done' pour une etape de position STRICTEMENT inferieure a l etape courante", () => {
    expect(stepVisualState(STEP_RECU, STEP_VALIDE.id, 2)).toBe('done');
  });

  it("rend 'pending' pour une etape de position superieure ou egale a l etape courante (hors l etape courante elle-meme)", () => {
    expect(stepVisualState(STEP_LIVRE, STEP_VALIDE.id, 2)).toBe('pending');
  });

  it("rend 'pending' pour TOUTES les etapes quand la commande ne porte AUCUNE etape courante (currentPosition null)", () => {
    expect(stepVisualState(STEP_RECU, null, null)).toBe('pending');
    expect(stepVisualState(STEP_LIVRE, null, null)).toBe('pending');
  });

  it(
    "CA4 — un SAUT (etape courante tres avancee) rend les etapes intermediaires 'done' a l affichage " +
      "SANS que cela ne signifie qu elles ont ete reellement traversees : c est un rendu de position, " +
      'jamais une preuve de passage (le journal, lui, ne ment pas — voir OrderStepChange.from_step_id/to_step_id).',
    () => {
      // La commande a saute directement de "Fichier reçu" a "Livré" : PAO et
      // "Fichier validé" sont position < 5 et se rendent "done", bien
      // qu aucune entree de journal ne les cite.
      expect(stepVisualState(STEP_PAO, STEP_LIVRE.id, 5)).toBe('done');
      expect(stepVisualState(STEP_VALIDE, STEP_LIVRE.id, 5)).toBe('done');
    },
  );
});
