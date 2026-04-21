/**
 * ProductMockup — mockups SVG schématiques par type de produit Clariprint.
 *
 * Respecte le handoff v2 (directive "SVG isométrique ou pattern, jamais emoji").
 * Dessine une stack de papier vue légèrement en perspective, variable selon :
 *  - kind Clariprint (leaflet | folded | book | cover | section)
 *  - gamme Magrit (inferred depuis name/category)
 *
 * Palette : dégradés pastel tirés du hash du nom produit, pour varier
 * tout en restant dans une direction graphique cohérente.
 */

interface ProductMockupProps {
  /** Nom produit (source du hash couleur) */
  name: string;
  /** Kind Clariprint : leaflet / folded / book / etc. */
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
  const bg1 = `hsl(${hue}, 40%, 96%)`;
  const bg2 = `hsl(${(hue + 30) % 360}, 35%, 88%)`;
  const accent = `hsl(${hue}, 45%, 55%)`;
  const ink = '#0A0A0A';

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{
        // Fond de secours si le SVG est rendu en "meet" (bordures visibles)
        background: `linear-gradient(135deg, ${bg1} 0%, ${bg2} 100%)`,
      }}
    >
      <svg
        viewBox="0 0 400 225"
        preserveAspectRatio="xMidYMid meet"
        className="absolute inset-0 w-full h-full block"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={`mkbg-${hue}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={bg1} />
            <stop offset="100%" stopColor={bg2} />
          </linearGradient>
          <linearGradient id={`mkpaper-${hue}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#F5F5F5" />
          </linearGradient>
          <filter id={`mkshadow-${hue}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="2" dy="4" stdDeviation="3" floodOpacity="0.12" />
          </filter>
        </defs>

        {/* Fond dégradé pastel */}
        <rect width="400" height="225" fill={`url(#mkbg-${hue})`} />

        {/* Motif pointillé subtil pour la texture */}
        <g opacity="0.22">
          {Array.from({ length: 12 }, (_, i) =>
            Array.from({ length: 20 }, (_, j) => (
              <circle
                key={`${i}-${j}`}
                cx={20 + j * 20}
                cy={20 + i * 17}
                r="0.8"
                fill="#FFFFFF"
              />
            ))
          )}
        </g>

        {/* Mockup selon le kind */}
        {resolvedKind === 'leaflet' && <LeafletMockup accent={accent} hue={hue} ink={ink} />}
        {resolvedKind === 'folded' && <FoldedMockup accent={accent} hue={hue} ink={ink} />}
        {resolvedKind === 'book' && <BookMockup accent={accent} hue={hue} ink={ink} />}
      </svg>

      {/* Badge corner optionnel */}
      {corner && (
        <div className="absolute top-2 left-2 pointer-events-none">
          <span
            className="inline-block font-mono uppercase tracking-wider px-2 py-0.5 rounded text-white"
            style={{
              fontSize: '11px',
              letterSpacing: '0.08em',
              fontWeight: 500,
              background: 'rgba(10,10,10,0.75)',
            }}
          >
            {corner}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Leaflet : 3 feuilles empilées legerement offset ────────────────────────
function LeafletMockup({ accent, hue, ink }: { accent: string; hue: number; ink: string }) {
  return (
    <g transform="translate(200 112)" filter={`url(#mkshadow-${hue})`}>
      {/* Feuille 3 (arrière) */}
      <g transform="translate(14 10) rotate(-4)">
        <rect x="-80" y="-55" width="160" height="110" rx="3" fill="#FFFFFF" opacity="0.85" />
      </g>
      {/* Feuille 2 (milieu) */}
      <g transform="translate(7 5) rotate(2)">
        <rect x="-80" y="-55" width="160" height="110" rx="3" fill={`url(#mkpaper-${hue})`} />
      </g>
      {/* Feuille 1 (avant, avec contenu schematique) */}
      <g>
        <rect x="-80" y="-55" width="160" height="110" rx="3" fill="#FFFFFF" />
        {/* Lignes de texte simulées */}
        <rect x="-65" y="-38" width="80" height="4" rx="1" fill={ink} opacity="0.85" />
        <rect x="-65" y="-26" width="130" height="2" rx="1" fill={ink} opacity="0.25" />
        <rect x="-65" y="-20" width="120" height="2" rx="1" fill={ink} opacity="0.25" />
        <rect x="-65" y="-14" width="80" height="2" rx="1" fill={ink} opacity="0.25" />
        {/* Accent color block */}
        <rect x="-65" y="10" width="40" height="30" rx="2" fill={accent} opacity="0.85" />
        <rect x="-18" y="10" width="80" height="3" rx="1" fill={ink} opacity="0.6" />
        <rect x="-18" y="19" width="60" height="2" rx="1" fill={ink} opacity="0.25" />
        <rect x="-18" y="27" width="70" height="2" rx="1" fill={ink} opacity="0.25" />
        <rect x="-18" y="35" width="50" height="2" rx="1" fill={ink} opacity="0.25" />
      </g>
    </g>
  );
}

// ─── Folded : feuille pliée en V (dépliant) ─────────────────────────────────
function FoldedMockup({ accent, hue, ink }: { accent: string; hue: number; ink: string }) {
  return (
    <g transform="translate(200 112)" filter={`url(#mkshadow-${hue})`}>
      {/* Volet gauche */}
      <g>
        <path
          d="M -80 -60 L -5 -50 L -5 55 L -80 45 Z"
          fill={`url(#mkpaper-${hue})`}
        />
        <rect x="-70" y="-42" width="55" height="3" fill={ink} opacity="0.7" />
        <rect x="-70" y="-34" width="60" height="1.5" fill={ink} opacity="0.22" />
        <rect x="-70" y="-28" width="45" height="1.5" fill={ink} opacity="0.22" />
      </g>
      {/* Volet droit (plus clair, comme en perspective) */}
      <g>
        <path
          d="M -5 -50 L 80 -58 L 80 47 L -5 55 Z"
          fill="#FFFFFF"
        />
        <rect x="8" y="-40" width="55" height="4" fill={accent} opacity="0.85" />
        <rect x="8" y="-30" width="60" height="1.5" fill={ink} opacity="0.25" />
        <rect x="8" y="-24" width="48" height="1.5" fill={ink} opacity="0.25" />
        <rect x="8" y="0" width="60" height="35" rx="2" fill={accent} opacity="0.15" />
        <rect x="8" y="40" width="50" height="1.5" fill={ink} opacity="0.22" />
      </g>
      {/* Ligne de pliure */}
      <line x1="-5" y1="-50" x2="-5" y2="55" stroke={ink} strokeWidth="0.4" opacity="0.2" strokeDasharray="1.5 1.5" />
    </g>
  );
}

// ─── Book : pile de pages reliées (brochure) ────────────────────────────────
function BookMockup({ accent, hue, ink }: { accent: string; hue: number; ink: string }) {
  return (
    <g transform="translate(200 112)" filter={`url(#mkshadow-${hue})`}>
      {/* Dos / épaisseur (tranche des pages visible) */}
      <rect x="-84" y="-60" width="6" height="120" fill="#E4E4E7" />
      <rect x="-84" y="-60" width="2" height="120" fill="#D4D4D8" />
      {/* Pages internes suggérées par lignes horizontales */}
      {[-45, -30, -15, 0, 15, 30, 45].map((y) => (
        <line
          key={y}
          x1="-84"
          y1={y}
          x2="-78"
          y2={y}
          stroke="#D4D4D8"
          strokeWidth="0.4"
        />
      ))}
      {/* Couverture */}
      <rect x="-78" y="-60" width="155" height="120" rx="1" fill={`url(#mkpaper-${hue})`} />
      {/* Titre en haut */}
      <rect x="-65" y="-45" width="75" height="5" fill={ink} opacity="0.85" />
      <rect x="-65" y="-35" width="100" height="2" fill={ink} opacity="0.25" />
      <rect x="-65" y="-29" width="90" height="2" fill={ink} opacity="0.25" />
      {/* Illustration accent */}
      <rect x="-55" y="-5" width="110" height="50" rx="2" fill={accent} opacity="0.18" />
      <circle cx="0" cy="20" r="14" fill={accent} opacity="0.6" />
    </g>
  );
}
