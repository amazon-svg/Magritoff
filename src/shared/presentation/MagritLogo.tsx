import { SVGProps } from 'react';

// Logo Magrit — direction 01 "La vraie marguerite"
// 18 pétales blancs de 20° d'écart, cœur jaune pollen texturé,
// sur tile bleu pastel dégradé (135°).
// Source : .design-handoff/designs/Logo.html

interface MagritLogoProps extends Omit<SVGProps<SVGSVGElement>, 'children'> {
  /** Taille en px (width = height) */
  size?: number | string;
  /**
   * Variante d'affichage.
   *  - "tile" (défaut) : tile bleu + marguerite + cœur, avec tous les dégradés
   *  - "plain" : transparent, marguerite blanche + cœur jaune (pour fonds custom)
   *  - "mono-dark" : silhouette monochrome sombre (ink) — pour sidebars claires
   *  - "mono-light" : silhouette monochrome claire — pour fonds sombres
   */
  variant?: 'tile' | 'plain' | 'mono-dark' | 'mono-light';
  /** Radius de la tile (défaut : 23 = correspond à la maquette). Utilisé seulement en "tile". */
  radius?: number;
}

const PETAL_ANGLES = Array.from({ length: 18 }, (_, i) => i * 20);

export function MagritLogo({
  size = 40,
  variant = 'tile',
  radius = 23,
  ...props
}: MagritLogoProps) {
  const isMono = variant === 'mono-dark' || variant === 'mono-light';
  const petalFill = variant === 'mono-dark' ? 'currentColor'
    : variant === 'mono-light' ? 'currentColor'
    : '#FFFFFF';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      aria-label="Magrit"
      role="img"
      {...props}
    >
      {variant === 'tile' && (
        <defs>
          <linearGradient id="mgrt-tile" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#E5F0FC" />
            <stop offset="100%" stopColor="#B7D3F2" />
          </linearGradient>
          <radialGradient id="mgrt-core" cx="45%" cy="40%" r="55%">
            <stop offset="0%" stopColor="#FFE066" />
            <stop offset="70%" stopColor="#F5B529" />
            <stop offset="100%" stopColor="#C68708" />
          </radialGradient>
          <pattern id="mgrt-pollen" x="0" y="0" width="2.5" height="2.5" patternUnits="userSpaceOnUse">
            <circle cx="1.25" cy="1.25" r="0.5" fill="#C68708" fillOpacity="0.5" />
          </pattern>
        </defs>
      )}

      {variant === 'tile' && (
        <rect width="100" height="100" rx={radius} fill="url(#mgrt-tile)" />
      )}

      <g transform="translate(50 50)">
        {/* 18 pétales */}
        <g fill={petalFill}>
          {PETAL_ANGLES.map((angle) => (
            <ellipse
              key={angle}
              cx="0"
              cy="-26"
              rx="3.5"
              ry="16"
              transform={`rotate(${angle})`}
            />
          ))}
        </g>

        {/* Cœur */}
        {isMono ? (
          <circle r="11" fill={petalFill} opacity="0.55" />
        ) : (
          <>
            <circle r="11" fill="url(#mgrt-core)" />
            <circle r="11" fill="url(#mgrt-pollen)" />
          </>
        )}
      </g>
    </svg>
  );
}

/**
 * Version lockup : logo + mot "Magrit" en Helvetica Neue 400.
 * Utilisable dans les headers.
 */
interface MagritLockupProps extends Omit<MagritLogoProps, 'size'> {
  /** Taille de l'icône en px */
  iconSize?: number | string;
  /** Taille du texte en px (défaut 16) */
  textSize?: number | string;
  /** Classe CSS du wrapper */
  className?: string;
  /** Couleur du texte (défaut var(--ink)) */
  textColor?: string;
}

export function MagritLockup({
  iconSize = 28,
  textSize = 16,
  className = '',
  textColor,
  ...logoProps
}: MagritLockupProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <MagritLogo size={iconSize} {...logoProps} />
      <span
        style={{
          fontSize: typeof textSize === 'number' ? `${textSize}px` : textSize,
          fontWeight: 500,
          letterSpacing: '-0.01em',
          color: textColor,
        }}
      >
        Magrit
      </span>
    </span>
  );
}
