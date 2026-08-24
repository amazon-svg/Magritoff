import { FileText, Layers, Image as ImageIcon, Mail, Calendar, Tag, BookOpen, Megaphone, Package } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface Props {
  src?: string;
  alt?: string;
  name: string;
  category?: string;
  accentColor?: string;
  secondaryColor?: string;
  className?: string;
  showLabel?: boolean;
}

// Mapping catégorie → icône lucide. Fallback : Package.
const CATEGORY_ICONS: Array<{ match: RegExp; icon: LucideIcon; emoji: string }> = [
  { match: /carte.*visite|business.?card|visite/i, icon: Tag, emoji: '💳' },
  { match: /flyer|tract|leaflet/i, icon: FileText, emoji: '📄' },
  { match: /brochure|catalogue|magazine|livret/i, icon: BookOpen, emoji: '📚' },
  { match: /affiche|poster|panneau/i, icon: ImageIcon, emoji: '🖼️' },
  { match: /d[eé]pliant|folder/i, icon: Layers, emoji: '📰' },
  { match: /enveloppe|envelope/i, icon: Mail, emoji: '✉️' },
  { match: /sticker|autocollant|étiquette|etiquette/i, icon: Tag, emoji: '🏷️' },
  { match: /calendrier|calendar/i, icon: Calendar, emoji: '📅' },
  { match: /banni[eè]re|banner|kak[eé]mono|roll.?up/i, icon: Megaphone, emoji: '🎌' },
  { match: /bloc|cahier|carnet|notebook/i, icon: BookOpen, emoji: '📓' },
];

function resolveIcon(name: string, category?: string) {
  const target = `${category || ''} ${name}`;
  for (const entry of CATEGORY_ICONS) {
    if (entry.match.test(target)) return entry;
  }
  return { icon: Package, emoji: '📦' };
}

function hashHue(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h << 5) - h + str.charCodeAt(i);
  return Math.abs(h) % 360;
}

export function ProductImage({
  src,
  alt,
  name,
  category,
  accentColor,
  secondaryColor,
  className = '',
  showLabel = true,
}: Props) {
  if (src) {
    return <img src={src} alt={alt ?? name} className={className} />;
  }

  const { icon: Icon, emoji } = resolveIcon(name, category);
  const baseHue = hashHue(name || category || 'p');
  const color1 = accentColor || `hsl(${baseHue}, 55%, 50%)`;
  const color2 = secondaryColor || `hsl(${(baseHue + 40) % 360}, 60%, 60%)`;

  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden ${className}`}
      style={{
        background: `linear-gradient(135deg, ${color1} 0%, ${color2} 100%)`,
      }}
    >
      {/* Motif décoratif subtil */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `radial-gradient(circle at 20% 30%, white 1px, transparent 1px),
                            radial-gradient(circle at 70% 80%, white 1px, transparent 1px)`,
          backgroundSize: '28px 28px, 36px 36px',
        }}
      />

      {/* Gros emoji au centre */}
      <div className="relative flex flex-col items-center justify-center gap-1 px-3 text-center">
        <span className="text-6xl drop-shadow-lg" role="img" aria-hidden="true">
          {emoji}
        </span>
        {showLabel && category && (
          <div className="mt-1 px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full">
            <div className="text-[11px] uppercase tracking-widest text-white font-semibold">
              {category}
            </div>
          </div>
        )}
      </div>

      {/* Fallback icon (SR-only) */}
      <Icon className="sr-only" />
    </div>
  );
}
