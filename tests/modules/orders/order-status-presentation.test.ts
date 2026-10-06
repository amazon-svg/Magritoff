import { describe, expect, it } from 'vitest';
import {
  productionStepReadOnlyReason,
  resolveVisibleOrderStatus,
} from '@/modules/orders/ui/workspace/order-status-presentation';

const steps = [
  { id: '11111111-1111-4111-8111-111111111111', label: 'PAO' },
  { id: '22222222-2222-4222-8222-222222222222', label: 'Impression' },
];

describe('présentation unifiée du statut de commande', () => {
  it('donne la priorité aux états administratifs bloquants', () => {
    expect(resolveVisibleOrderStatus('draft', steps[0]!.id, steps)).toMatchObject({
      label: 'En attente de validation', kind: 'administrative',
    });
    expect(resolveVisibleOrderStatus('cancelled', steps[0]!.id, steps)).toMatchObject({
      label: 'Annulée', kind: 'administrative', tone: 'error',
    });
    expect(resolveVisibleOrderStatus('closed', steps[0]!.id, steps).label).toBe('Clôturée');
  });

  it('présente l’étape opérationnelle comme unique statut d’une commande active', () => {
    expect(resolveVisibleOrderStatus('validated', steps[1]!.id, steps)).toEqual({
      label: 'Impression', kind: 'production', tone: 'info',
    });
    expect(resolveVisibleOrderStatus('shipped', null, steps).label).toBe('Validée');
  });

  it('rend le changement d’étape en lecture seule pour les états bloquants', () => {
    expect(productionStepReadOnlyReason('draft')).toContain('Validez');
    expect(productionStepReadOnlyReason('cancelled')).toContain('annulée');
    expect(productionStepReadOnlyReason('closed')).toContain('clôturée');
    expect(productionStepReadOnlyReason('validated')).toBeUndefined();
  });
});
