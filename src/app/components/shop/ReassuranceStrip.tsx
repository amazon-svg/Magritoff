/**
 * S7.7 — ReassuranceStrip : bandeau de réassurance du ShopChrome.
 *
 * 3 faits maximum, DÉRIVÉS des claims déjà portés par le produit (badges
 * FSC / Fabriqué en France des cards S2.26 + promesse cœur Magrit). Aucun
 * fait inventé (pas d'avis ni de délais tant que la donnée n'existe pas).
 * Variant `header` (barre fine horizontale) ; variant `fiche` harmonisé S7.14.
 */

import { Leaf, MapPin, Zap } from 'lucide-react';
import { TEST_IDS } from '../../lib/testIds';

const FACTS = [
  { icon: Zap, label: 'Prix immédiat par Magrit' },
  { icon: MapPin, label: 'Fabriqué en France' },
  { icon: Leaf, label: 'Papiers FSC / PEFC' },
] as const;

export function ReassuranceStrip({ isDark = false }: { isDark?: boolean }) {
  return (
    <div
      data-testid={TEST_IDS.shop.reassuranceStrip}
      className={`flex items-center justify-center gap-6 px-4 py-1.5 border-b overflow-x-auto whitespace-nowrap ${
        isDark ? 'bg-gray-900 border-gray-800 text-gray-400' : 'bg-bg border-line text-ink-muted'
      }`}
      style={{ fontSize: '11.5px' }}
    >
      {FACTS.map(({ icon: Icon, label }) => (
        <span key={label} className="inline-flex items-center gap-1.5 shrink-0">
          <Icon className="w-3 h-3" strokeWidth={1.5} aria-hidden="true" />
          {label}
        </span>
      ))}
    </div>
  );
}
