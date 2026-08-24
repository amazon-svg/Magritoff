/**
 * P4-VISUELS (2026-06-15) — Résolution des mockups custom per-shop.
 *
 * Les overrides sont chargés une seule fois avec le catalogue autorisé par
 * l'API. Ce helper ne fait qu'une résolution synchrone en mémoire.
 *
 * Pattern composition : helpers purs séparés pour testabilité vitest sans
 * @testing-library/react (cf. shopBackground.helpers.ts).
 */

import type { MockupTemplateType, MockupView, ShopCustomMockup } from '@/modules/shops';
export type { MockupTemplateType, MockupView, ShopCustomMockup as CustomMockupRecord } from '@/modules/shops';

/**
 * Résout l'URL du mockup custom pour un template + view.
 * Retourne null si le catalogue ne contient aucun override.
 */
export function resolveCustomMockup(
  records: readonly ShopCustomMockup[],
  templateType: MockupTemplateType,
  view: MockupView = 'front',
): string | null {
  return records.find((record) => record.templateType === templateType && record.view === view)?.mockupImageUrl ?? null;
}
