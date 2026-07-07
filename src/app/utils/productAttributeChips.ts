/**
 * S2.13 (Epic 2, FR-ECOM-03) — Puces d'attributs clés sur ProductCard.
 *
 * Jusqu'à 3 puces normalisées par famille, extraites du PIM/config via les
 * MÊMES resolvers que l'enrichissement produit (resolveTemplate de
 * productEnrichment) — AUCUNE duplication de logique d'extraction. Les puces
 * sont comparables entre produits d'une même famille (UX §1).
 *
 * Data-driven : seules les puces renseignées s'affichent (pas de puce vide).
 * NE PAS créer d'onglet — enrichit la card (et l'onglet Fiche existant).
 */

import { resolveTemplate } from "./productEnrichment";
import {
  resolveMockupTemplate,
  type MockupTemplate,
  type MockupTemplateInput,
} from "./productMockupAssets";

export interface AttributeChip {
  /** Libellé de l'attribut (title/a11y). */
  label: string;
  /** Valeur affichée (unité incluse), ex "85×55 mm", "350 g", "Mat". */
  value: string;
}

interface ChipSpec {
  label: string;
  /** Clé resolver FIELD_RESOLVERS (productEnrichment). */
  key: string;
  /** Unité appended si valeur numérique nue (ex grammage → "g"). */
  unit?: string;
}

/**
 * Attributs clés par famille (max 3, ordre = priorité d'affichage).
 * Réutilise les clés resolver existantes : format, grammage, finition, papier,
 * quantite, pages.
 */
const CHIP_SPECS: Record<MockupTemplate, ChipSpec[]> = {
  carteVisite: [
    { label: "Format", key: "format" },
    { label: "Grammage", key: "grammage", unit: "g" },
    { label: "Finition", key: "finition" },
  ],
  flyer: [
    { label: "Format", key: "format" },
    { label: "Grammage", key: "grammage", unit: "g" },
    { label: "Finition", key: "finition" },
  ],
  brochure: [
    { label: "Format", key: "format" },
    { label: "Pages", key: "pages" },
    { label: "Grammage", key: "grammage", unit: "g" },
  ],
  depliant: [
    { label: "Format", key: "format" },
    { label: "Grammage", key: "grammage", unit: "g" },
    { label: "Finition", key: "finition" },
  ],
  etiquette: [
    { label: "Format", key: "format" },
    { label: "Quantité", key: "quantite" },
    { label: "Papier", key: "papier" },
  ],
  kakemono: [
    { label: "Format", key: "format" },
    { label: "Papier", key: "papier" },
    { label: "Finition", key: "finition" },
  ],
  packaging: [
    { label: "Format", key: "format" },
    { label: "Papier", key: "papier" },
    { label: "Quantité", key: "quantite" },
  ],
};

const MAX_CHIPS = 3;

/**
 * Résout jusqu'à 3 puces d'attributs pour un produit, selon sa famille.
 * Filtre les attributs non renseignés (data-driven).
 */
export function resolveProductChips(
  product: MockupTemplateInput,
  maxChips: number = MAX_CHIPS,
): AttributeChip[] {
  const template = resolveMockupTemplate(product);
  // config ?? {} : les resolvers (FIELD_RESOLVERS.format) supposent un objet
  // (déréférencent c.dimensions) → jamais leur passer undefined.
  const config = (product as { config?: unknown }).config ?? {};
  const chips: AttributeChip[] = [];
  for (const spec of CHIP_SPECS[template]) {
    const raw = resolveTemplate(`{{${spec.key}}}`, config).trim();
    if (!raw) continue;
    const value = spec.unit && /^\d+(\.\d+)?$/.test(raw) ? `${raw} ${spec.unit}` : raw;
    chips.push({ label: spec.label, value });
    if (chips.length >= maxChips) break;
  }
  return chips;
}
