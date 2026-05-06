import { ShoppingCart } from 'lucide-react';
import type { Shop } from '../../../contexts/ShopsContext';
import type { PortalView } from './types';
import { TEST_IDS } from '../../../lib/testIds';

interface Props {
  shop: Shop;
  view: PortalView;
  onView: (v: PortalView) => void;
  cartCount: number;
  // Budget corporate affiché dans la strip (mock ou futur backend B2B).
  // On n'affiche PAS de mention "validation / N+1" tant que ce n'est pas
  // implémenté côté backend.
  budget?: { label: string; used: number; total: number };
}

// Top chrome corporate partagé entre F1 / F2 / F3 / F4.
// Design source : .design-handoff/designs/05 - Portail B2B.html (section .top + .budget)
// v2.1 : retrait des menus non-implémentés (Templates, Équipe) et du bouton
// de recherche redondant avec "Catalogue".
export function PortalChrome({ shop, view, onView, cartCount, budget }: Props) {
  const navItems: Array<{ key: PortalView; label: string }> = [
    { key: 'home', label: 'Accueil' },
    { key: 'catalog', label: 'Catalogue' },
    { key: 'orders', label: 'Mes commandes' },
  ];

  const pct = budget ? Math.min(100, Math.round((budget.used / budget.total) * 100)) : 0;

  return (
    <>
      {/* Top bar co-brandée */}
      <div
        data-testid={TEST_IDS.shop.header}
        className="flex items-center gap-7 px-9 py-3.5 border-b border-line bg-paper"
        style={{ fontFamily: 'var(--font-ui)' }}
      >
        <div data-testid={TEST_IDS.shop.headerLogo} className="flex items-center gap-2.5">
          {shop.logo_url ? (
            <img src={shop.logo_url} alt={shop.name} className="h-6 w-6 object-contain rounded" />
          ) : (
            <div
              className="h-6 w-6 rounded"
              style={{
                background: `linear-gradient(135deg, ${shop.theme.primaryColor} 0%, ${shop.theme.accentColor} 100%)`,
              }}
            />
          )}
          <span className="text-ink" style={{ fontSize: '15px', fontWeight: 500 }}>
            {shop.name}
          </span>
          <span className="w-px h-[18px] bg-line mx-1" />
          <span className="text-ink-muted" style={{ fontSize: '13.5px', fontWeight: 400 }}>
            × Magrit
          </span>
        </div>

        <nav className="flex gap-0.5 ml-2">
          {navItems.map((item) => {
            const active = view === item.key;
            return (
              <button
                key={item.key}
                onClick={() => onView(item.key)}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  active ? 'bg-bg text-ink' : 'text-ink-2 hover:bg-bg/60'
                }`}
                style={{ fontSize: '13px', fontWeight: active ? 500 : 400 }}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        <button
          data-testid={TEST_IDS.shop.cartIcon}
          onClick={() => onView('cart')}
          className="ml-auto relative flex items-center gap-2 px-3 py-1.5 rounded-lg border border-line bg-paper text-ink-2 hover:text-ink"
          style={{ fontSize: '13px', fontWeight: 400 }}
        >
          <ShoppingCart className="w-3.5 h-3.5" strokeWidth={1.5} />
          Panier
          {cartCount > 0 && (
            <span
              className="font-mono px-1.5 py-0.5 rounded-full bg-ink text-paper"
              style={{ fontSize: '10.5px', fontWeight: 500, minWidth: '18px', textAlign: 'center' }}
            >
              {cartCount}
            </span>
          )}
        </button>

        <div
          data-testid={TEST_IDS.shop.headerUserMenu}
          className="w-7 h-7 rounded-full bg-line-2 grid place-items-center text-ink-muted"
          style={{ fontSize: '11px', fontWeight: 500 }}
          title="Compte utilisateur"
        >
          U
        </div>
      </div>

      {/* Budget strip corporate (mock pour l'instant — sera branché au backend B2B) */}
      {budget && (
        <div
          className="flex items-center gap-8 px-9 py-3.5 bg-bg border-b border-line"
          style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 400 }}
        >
          <span className="text-ink-muted">
            Centre de coût ·{' '}
            <span className="text-ink" style={{ fontWeight: 500 }}>
              {budget.label}
            </span>
          </span>
          <span className="text-ink-muted">
            Budget T4 ·{' '}
            <span
              className="text-ink font-mono"
              style={{ fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}
            >
              {budget.used.toLocaleString('fr-FR')}€ / {budget.total.toLocaleString('fr-FR')}€
            </span>
          </span>
          <div className="flex-1 max-w-[240px] h-1.5 bg-line rounded overflow-hidden relative">
            <div
              className="h-full rounded"
              style={{ width: `${pct}%`, background: 'var(--brand)' }}
            />
          </div>
        </div>
      )}
    </>
  );
}
