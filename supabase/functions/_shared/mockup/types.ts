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
}

/** Identifiant des templates supportes. 5 templates MVP livres en S4.2. */
export type MockupTemplate =
  | "flyer"
  | "carteVisite"
  | "brochure"
  | "etiquette"
  | "kakemono";

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
