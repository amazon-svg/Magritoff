/**
 * Types partages du module mockup engine (Story S4.1b, Epic 4).
 *
 * Le module renderer (renderer.ts) consomme ces types pour generer un PNG
 * paramntrique a partir d'un template SVG, des specs produit et du theming
 * boutique.
 *
 * Cohorte avec _shared/clariprint/ et _shared/llm/ : interface fine, types
 * exportes depuis un fichier dedie pour faciliter la reutilisation par les
 * consommateurs aval (S4.1c edge function mockup-generator).
 */

/** Specs produit minimales requises pour generer un mockup. */
export interface ProductSpecs {
  /** Largeur du produit en mm (ex: 148 pour A5 portrait). */
  width: number;
  /** Hauteur du produit en mm (ex: 210 pour A5 portrait). */
  height: number;
  /** Nom commercial du produit, affiche sur le mockup. */
  productName: string;
}

/** Theming de la boutique consommatrice (couleur primaire pour pattern). */
export interface ShopTheming {
  /** Couleur primaire au format hex `#RRGGBB`. */
  primaryColor: string;
  /**
   * S-PRODUCT-VIEWS-MULTI (Sprint 7, 2026-06-01) : vue du produit à rendre.
   * 'front' (défaut, layout actuel des templates) ou 'back' (verso, layout
   * différencié : zone d'impression vide ou pattern minimal — l'acheteur
   * comprend "voici la 2ème face du produit").
   *
   * Templates qui supportent les 2 vues (flyer, carteVisite). Les autres
   * (brochure, etiquette, kakemono) ignorent et rendent 'front'.
   */
  view?: 'front' | 'back';
}

/** Identifiant des templates supportes.
 *  5 templates MVP livres en S4.2.
 *  P15 (2026-06-16) : ajout packaging (boite kraft 3D) + depliant (3 volets perspective). */
export type MockupTemplate =
  | "flyer"
  | "carteVisite"
  | "brochure"
  | "etiquette"
  | "kakemono"
  | "packaging"
  | "depliant";

/** Erreur typee du module renderer, discriminee par `kind`. */
export class MockupRendererError extends Error {
  constructor(
    public readonly kind:
      | "unsupported_template"
      | "invalid_specs"
      | "render_failed",
    message: string,
    public override readonly cause?: unknown,
  ) {
    super(message);
    this.name = "MockupRendererError";
  }
}
