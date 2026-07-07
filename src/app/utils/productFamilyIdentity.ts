/**
 * S2.11 (Epic 2, FR-ECOM-01) — Identité visuelle de famille produit.
 *
 * Repère "catégorie" scannable en 1 seconde : couleur + pictogramme + libellé,
 * cohérent partout (card / fiche / panier / historique).
 *
 * Principes (décisions Arnaud 2026-07-07) :
 *  - Réutilise la taxonomie MockupTemplate (7 familles, source unique
 *    productMockupAssets) — AUCUNE nouvelle taxonomie.
 *  - Repères SÉMANTIQUES NEUTRES : la tonalité de famille est CONSTANTE
 *    inter-tenant (elle n'est PAS thémée par --shop-primary). Un flyer est
 *    ambre chez Manitou comme chez ERAM → cohérence de scan garantie.
 *  - a11y : la couleur ne porte JAMAIS l'info seule → toujours picto + libellé
 *    (le consommateur ajoute `aria-label`).
 *
 * Le helper est pur (label + tone + template testables). Les pictogrammes
 * (composants React lucide) vivent dans FAMILY_ICON, mappés à part.
 */

import {
  Boxes,
  CreditCard,
  FileText,
  Flag,
  BookOpen,
  Layers,
  Tag,
  type LucideIcon,
} from "lucide-react";
import {
  resolveMockupTemplate,
  type MockupTemplate,
  type MockupTemplateInput,
} from "./productMockupAssets";

export interface FamilyIdentity {
  /** Famille résolue (MockupTemplate). */
  template: MockupTemplate;
  /** Libellé FR humain (uppercase géré côté rendu). */
  label: string;
  /** Tonalité hex CONSTANTE (curatée, muted, distinguable, light/dark-safe). */
  tone: string;
}

/**
 * Palette de familles — 7 teintes curatées, muted, distinguables entre elles,
 * lisibles en liseré + icône sur fond clair comme sombre. Constantes : ne
 * dépendent PAS du thème tenant (décision B, 2026-07-07).
 */
export const FAMILY_IDENTITY: Record<MockupTemplate, Omit<FamilyIdentity, "template">> = {
  carteVisite: { label: "Cartes", tone: "#4F6BED" }, // indigo
  flyer: { label: "Flyers", tone: "#D08421" }, // ambre
  brochure: { label: "Brochures", tone: "#0E8F7E" }, // teal
  depliant: { label: "Dépliants", tone: "#8B5CF6" }, // violet
  etiquette: { label: "Étiquettes", tone: "#DB2777" }, // rose
  kakemono: { label: "Grand format", tone: "#0891B2" }, // cyan
  packaging: { label: "Packaging", tone: "#B4622A" }, // terracotta
};

/** Pictogramme lucide par famille. Séparé du helper pur pour la testabilité. */
export const FAMILY_ICON: Record<MockupTemplate, LucideIcon> = {
  carteVisite: CreditCard,
  flyer: FileText,
  brochure: BookOpen,
  depliant: Layers,
  etiquette: Tag,
  kakemono: Flag,
  packaging: Boxes,
};

/**
 * Résout l'identité de famille d'un produit (template + libellé + tonalité).
 * S'appuie sur resolveMockupTemplate (kind Clariprint > inférence nom/catégorie,
 * fallback flyer garanti → jamais de repère vide).
 */
export function resolveFamilyIdentity(product: MockupTemplateInput): FamilyIdentity {
  const template = resolveMockupTemplate(product);
  const { label, tone } = FAMILY_IDENTITY[template];
  return { template, label, tone };
}
