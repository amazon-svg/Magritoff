/**
 * ProductMockup — picto SVG monoline, fallback esthétique quand aucune
 * image produit n'est dispo (ni sur le produit, ni dans le PIM).
 *
 * Direction graphique : monoline sobre, palette ink/line/bg cohérente avec
 * le reste du design system v2 (pas d'emoji, pas de dégradé criard, pas de
 * perspective isométrique cartoon). Un papier posé, contours fins.
 * Respecte la directive handoff : "SVG isométrique ou pattern, jamais emoji".
 */

interface ProductMockupProps {
  /** Nom produit — influence couleur d'accent discrète */
  name: string;
  /** Kind Clariprint (leaflet | folded | book | cover | section) */
  kind?: string;
  /** Catégorie / gamme (influence le pattern si kind absent) */
  category?: string;
  /** Classe CSS du wrapper */
  className?: string;
  /** Badge texte optionnel (ex : type de gamme) posé en corner */
  corner?: string;
}

function hashHue(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h << 5) - h + str.charCodeAt(i);
  return Math.abs(h) % 360;
}

function inferKind(kind?: string, category?: string, name?: string): 'leaflet' | 'folded' | 'book' {
  const k = (kind || '').toLowerCase();
  if (k === 'folded' || k === 'book') return k as 'folded' | 'book';
  if (k === 'leaflet') return 'leaflet';
  const hay = `${category ?? ''} ${name ?? ''}`.toLowerCase();
  if (/brochure|catalogue|livret|book|magazine/.test(hay)) return 'book';
  if (/d[eé]pliant|folded|pli[eé]?/.test(hay)) return 'folded';
  return 'leaflet';
}

export function ProductMockup({
  name,
  kind,
  category,
  className = '',
  corner,
}: ProductMockupProps) {
  const resolvedKind = inferKind(kind, category, name);
  const hue = hashHue(name || category || 'p');
  // Teinte pastel très discrète, alignée sur la charte bg (#FAFAFA).
  const accent = `hsl(${hue}, 30%, 58%)`;
  const softBg1 = `hsl(${hue}, 18%, 97%)`;
  const softBg2 = `hsl(${(hue + 30) % 360}, 14%, 94%)`;

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ background: `linear-gradient(180deg, ${softBg1} 0%, ${softBg2} 100%)` }}
    >
      <svg
        viewBox="0 0 400 225"
        preserveAspectRatio="xMidYMid meet"
        className="absolute inset-0 w-full h-full block"
        aria-hidden="true"
      >
        {/* Grille subtile façon guide — évoque le calage d'impression */}
        <g opacity="0.12" stroke="#0A0A0A" strokeWidth="0.5">
          <line x1="0" y1="56" x2="400" y2="56" strokeDasharray="3 5" />
          <line x1="0" y1="168" x2="400" y2="168" strokeDasharray="3 5" />
          <line x1="100" y1="0" x2="100" y2="225" strokeDasharray="3 5" />
          <line x1="300" y1="0" x2="300" y2="225" strokeDasharray="3 5" />
        </g>

        {resolvedKind === 'leaflet' && <LeafletMark accent={accent} />}
        {resolvedKind === 'folded' && <FoldedMark accent={accent} />}
        {resolvedKind === 'book' && <BookMark accent={accent} />}

        {/* Marque CMYK discrète en coin (clin d'œil imprimeur) */}
        <g transform="translate(372 24)">
          <circle cx="0" cy="0" r="2" fill="#00A7E1" opacity="0.55" />
          <circle cx="5" cy="0" r="2" fill="#EC008C" opacity="0.55" />
          <circle cx="2.5" cy="4" r="2" fill="#FFC600" opacity="0.55" />
          <circle cx="2.5" cy="8" r="2" fill="#0A0A0A" opacity="0.65" />
        </g>
      </svg>

      {/* Badge corner optionnel */}
      {corner && (
        <div className="absolute top-2 left-2 pointer-events-none">
          <span
            className="inline-block font-mono uppercase tracking-wider px-2 py-0.5 rounded"
            style={{
              fontSize: '11px',
              letterSpacing: '0.08em',
              fontWeight: 500,
              background: 'rgba(10,10,10,0.85)',
              color: '#FFFFFF',
            }}
          >
            {corner}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Marks monoline par kind ────────────────────────────────────────────────

function LeafletMark({ accent }: { accent: string }) {
  // Une pile de 3 feuilles (carte / flyer) posées avec legere perspective
  return (
    <g transform="translate(200 112)">
      {/* Feuille 3 (arrière) */}
      <g transform="translate(16 10) rotate(-5)">
        <rect
          x="-78"
          y="-48"
          width="156"
          height="96"
          rx="3"
          fill="#FFFFFF"
          stroke="#D4D4D8"
          strokeWidth="1"
        />
      </g>
      {/* Feuille 2 (milieu) */}
      <g transform="translate(8 5) rotate(2)">
        <rect
          x="-78"
          y="-48"
          width="156"
          height="96"
          rx="3"
          fill="#FFFFFF"
          stroke="#D4D4D8"
          strokeWidth="1"
        />
      </g>
      {/* Feuille 1 (avant, avec contenu schématique monoline) */}
      <g>
        <rect
          x="-78"
          y="-48"
          width="156"
          height="96"
          rx="3"
          fill="#FFFFFF"
          stroke="#0A0A0A"
          strokeWidth="1"
          strokeOpacity="0.35"
        />
        {/* Titre */}
        <rect x="-62" y="-32" width="60" height="3" fill="#0A0A0A" opacity="0.85" />
        {/* Sous-titre */}
        <rect x="-62" y="-22" width="42" height="1.5" fill="#0A0A0A" opacity="0.35" />
        {/* Bloc accent (petit carré couleur) */}
        <rect x="-62" y="8" width="28" height="28" fill={accent} opacity="0.85" rx="1.5" />
        {/* Lignes texte */}
        <rect x="-24" y="10" width="64" height="2" fill="#0A0A0A" opacity="0.6" />
        <rect x="-24" y="18" width="48" height="1.5" fill="#0A0A0A" opacity="0.3" />
        <rect x="-24" y="26" width="52" height="1.5" fill="#0A0A0A" opacity="0.3" />
        <rect x="-24" y="34" width="38" height="1.5" fill="#0A0A0A" opacity="0.3" />
      </g>
    </g>
  );
}

function FoldedMark({ accent }: { accent: string }) {
  // Depliant plie en V
  return (
    <g transform="translate(200 112)">
      {/* Volet gauche */}
      <path
        d="M -76 -48 L -4 -42 L -4 48 L -76 42 Z"
        fill="#FFFFFF"
        stroke="#0A0A0A"
        strokeWidth="1"
        strokeOpacity="0.35"
      />
      <rect x="-66" y="-32" width="48" height="3" fill="#0A0A0A" opacity="0.85" />
      <rect x="-66" y="-22" width="54" height="1.5" fill="#0A0A0A" opacity="0.3" />
      <rect x="-66" y="-16" width="40" height="1.5" fill="#0A0A0A" opacity="0.3" />

      {/* Volet droit (legerement plus clair, perspective) */}
      <path
        d="M -4 -42 L 76 -50 L 76 40 L -4 48 Z"
        fill="#FCFCFC"
        stroke="#0A0A0A"
        strokeWidth="1"
        strokeOpacity="0.35"
      />
      <rect x="8" y="-32" width="48" height="4" fill={accent} opacity="0.9" rx="0.5" />
      <rect x="8" y="-22" width="54" height="1.5" fill="#0A0A0A" opacity="0.3" />
      <rect x="8" y="-16" width="40" height="1.5" fill="#0A0A0A" opacity="0.3" />
      <rect x="8" y="6" width="58" height="28" fill={accent} opacity="0.15" rx="1.5" />

      {/* Ligne de pli verticale */}
      <line
        x1="-4"
        y1="-42"
        x2="-4"
        y2="48"
        stroke="#0A0A0A"
        strokeWidth="0.7"
        strokeOpacity="0.28"
        strokeDasharray="2 2"
      />
    </g>
  );
}

function BookMark({ accent }: { accent: string }) {
  // Brochure/livre relié avec dos
  return (
    <g transform="translate(200 112)">
      {/* Dos / épaisseur (tranche des pages) */}
      <rect x="-82" y="-52" width="6" height="104" fill="#E4E4E7" />
      <rect x="-82" y="-52" width="2" height="104" fill="#D4D4D8" />
      {[-36, -20, -4, 12, 28, 44].map((y) => (
        <line key={y} x1="-82" y1={y} x2="-76" y2={y} stroke="#D4D4D8" strokeWidth="0.4" />
      ))}
      {/* Couverture */}
      <rect
        x="-76"
        y="-52"
        width="152"
        height="104"
        rx="2"
        fill="#FFFFFF"
        stroke="#0A0A0A"
        strokeWidth="1"
        strokeOpacity="0.35"
      />
      {/* Titre */}
      <rect x="-62" y="-34" width="72" height="5" fill="#0A0A0A" opacity="0.85" />
      <rect x="-62" y="-22" width="92" height="1.5" fill="#0A0A0A" opacity="0.3" />
      <rect x="-62" y="-16" width="80" height="1.5" fill="#0A0A0A" opacity="0.3" />
      {/* Zone visuelle accent */}
      <rect x="-52" y="-2" width="104" height="44" rx="1.5" fill={accent} opacity="0.16" />
      <circle cx="0" cy="20" r="12" fill={accent} opacity="0.7" />
    </g>
  );
}
