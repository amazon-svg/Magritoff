/**
 * ProductVisualPlaceholder — repli quand AUCUN visuel n'est curé.
 *
 * REFACTO-VISUELS (2026-08-09, arbitrage Arnaud). Le visuel d'un produit est
 * une propriete de sa gamme dans le PIM. Tant qu'une gamme n'a pas de visuel,
 * on ne fabrique plus de ressemblance en piochant dans une autre famille —
 * c'est ce qui faisait afficher un flyer pour un calendrier et un depliant
 * pour une brochure. On affiche le REPERE DE FAMILLE : pictogramme + tonalite
 * constante inter-tenant, meme langage que les tuiles de gamme (S7.6) et que
 * le lisere des cartes produit (S2.11).
 *
 * a11y : la couleur ne porte jamais l'information seule — le libelle de
 * famille est rendu sous le pictogramme, et le conteneur porte un aria-label.
 */

import type { LucideIcon } from 'lucide-react';

export interface ProductVisualPlaceholderProps {
  /** Pictogramme de la famille (cf. shopFamilyIdentity / productFamilyIdentity). */
  icon: LucideIcon;
  /** Tonalite hex de la famille — constante, non thémée par la boutique. */
  tone: string;
  /** Libelle humain de la famille (ex. « Calendriers »). */
  label: string;
  /** Masque le libelle quand le contexte le porte deja (carte a bandeau). */
  hideLabel?: boolean;
  className?: string;
}

export function ProductVisualPlaceholder({
  icon: Icon,
  tone,
  label,
  hideLabel = false,
  className,
}: ProductVisualPlaceholderProps) {
  return (
    <div
      data-testid="product-visual-placeholder"
      data-family-label={label}
      role="img"
      aria-label={`Visuel non defini — famille ${label}`}
      className={`w-full h-full grid place-items-center gap-1.5 ${className ?? ''}`}
      style={{ background: `${tone}14` }}
    >
      <Icon className="w-9 h-9" style={{ color: tone }} strokeWidth={1.4} />
      {!hideLabel && (
        <span
          className="font-mono uppercase"
          style={{ fontSize: '9.5px', letterSpacing: '0.08em', color: tone }}
        >
          {label}
        </span>
      )}
    </div>
  );
}
