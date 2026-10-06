import type { ProductionStepDto } from '@/modules/production-steps';
import { getStatusInfo } from '../helpers/orderStatus';

export type VisibleOrderStatus = Readonly<{
  label: string;
  kind: 'administrative' | 'production';
  tone: 'neutral' | 'info' | 'error';
}>;

const ACTIVE_ADMINISTRATIVE_STATUSES = new Set([
  'validated',
  'in_production',
  'shipped',
  'delivered',
  'invoiced',
]);

/**
 * Résout l'unique statut présenté à l'utilisateur. Les anciennes valeurs
 * opérationnelles de `status` restent compatibles mais ne créent plus un
 * second vocabulaire visible : l'étape de production prévaut.
 */
export function resolveVisibleOrderStatus(
  administrativeStatus: string,
  productionStepId: string | null | undefined,
  steps: readonly Pick<ProductionStepDto, 'id' | 'label'>[],
): VisibleOrderStatus {
  if (administrativeStatus === 'draft') {
    return { label: getStatusInfo('draft').label, kind: 'administrative', tone: 'neutral' };
  }
  if (administrativeStatus === 'cancelled') {
    return { label: getStatusInfo('cancelled').label, kind: 'administrative', tone: 'error' };
  }
  if (administrativeStatus === 'closed') {
    return { label: 'Clôturée', kind: 'administrative', tone: 'neutral' };
  }

  const step = productionStepId
    ? steps.find((candidate) => candidate.id === productionStepId)
    : undefined;
  if (step) return { label: step.label, kind: 'production', tone: 'info' };

  if (ACTIVE_ADMINISTRATIVE_STATUSES.has(administrativeStatus)) {
    return { label: getStatusInfo('validated').label, kind: 'administrative', tone: 'info' };
  }
  return { label: 'Statut inconnu', kind: 'administrative', tone: 'neutral' };
}

export function productionStepReadOnlyReason(administrativeStatus: string): string | undefined {
  if (administrativeStatus === 'draft') return 'Validez la commande avant de choisir une étape de production.';
  if (administrativeStatus === 'cancelled') return 'Une commande annulée ne peut plus changer d’étape de production.';
  if (administrativeStatus === 'closed') return 'Une commande clôturée ne peut plus changer d’étape de production.';
  return undefined;
}
