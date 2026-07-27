/**
 * S7.10 — AccountHub : « Mon compte » du portail acheteur (/account/*).
 *
 * Fonctions portail relocalisées (spec UX Custom Component n°8) :
 *  - Mes commandes : PortalOrders 4 tabs role-driven (les validations
 *    workflow S-ORDER-ROLES sont ces tabs) ;
 *  - Mes devis : lecture seule via QuotesContext (scope mine) ;
 *  - Mon profil : infos réelles + déconnexion.
 * Sidebar desktop / tabs scrollables mobile. Budget mock NON repris (pas de
 * section sans donnée réelle).
 */

import { FileText, LogOut, Package, User } from 'lucide-react';
import { supabase } from '/utils/supabase/client';
import type { Shop } from '../../../contexts/ShopsContext';
import type { AccountSection } from './types';
import { PortalOrders } from './PortalOrders';
import { useAuth } from '../../../contexts/AuthContext';
import { useTenant } from '../../../contexts/TenantContext';
import { useQuotes } from '../../../contexts/QuotesContext';
import { TEST_IDS } from '../../../lib/testIds';

const SECTIONS: Array<{ key: AccountSection; label: string; icon: typeof Package }> = [
  { key: 'orders', label: 'Mes commandes', icon: Package },
  { key: 'quotes', label: 'Mes devis', icon: FileText },
  { key: 'profile', label: 'Mon profil', icon: User },
];

/** Statuts devis → libellés FR (mapping 3 groupes S-QUOTES). */
const QUOTE_STATUS_LABELS: Record<string, string> = {
  draft: 'brouillon',
  sent: 'envoyé',
  pending: 'en attente',
  validated: 'validé',
  won: 'gagné',
  rejected: 'rejeté',
  lost: 'perdu',
};

export interface AccountHubProps {
  shop: Shop;
  section: AccountSection;
  onSection: (section: AccountSection) => void;
  onRenewOrder: (order: { id: string; source: string }) => void;
  onGoHome: () => void;
}

export function AccountHub({
  shop,
  section,
  onSection,
  onRenewOrder,
  onGoHome,
}: AccountHubProps) {
  const { user } = useAuth();
  const { currentTenant } = useTenant();

  return (
    <div
      data-testid={TEST_IDS.shop.accountHub}
      className="px-5 lg:px-9 py-6 grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-6 items-start"
    >
      {/* Sidebar desktop / tabs mobile */}
      <nav
        aria-label="Mon compte"
        className="flex lg:flex-col gap-1 overflow-x-auto whitespace-nowrap lg:whitespace-normal"
      >
        {SECTIONS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            data-testid={TEST_IDS.shop.accountTab}
            data-section={key}
            aria-current={section === key ? 'page' : undefined}
            onClick={() => onSection(key)}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-md text-left shrink-0 transition-colors ${
              section === key
                ? 'bg-ink text-paper'
                : 'text-ink-2 hover:bg-bg hover:text-ink'
            }`}
            style={{ fontSize: '13px', fontWeight: 500 }}
          >
            <Icon className="w-3.5 h-3.5" strokeWidth={1.5} />
            {label}
          </button>
        ))}
      </nav>

      <div className="min-w-0">
        {section === 'orders' && (
          <PortalOrders shopId={shop.id} onRenewOrder={onRenewOrder} />
        )}
        {section === 'quotes' && <AccountQuotes />}
        {section === 'profile' && (
          <AccountProfile
            email={user?.email ?? null}
            shopName={shop.name}
            tenantName={currentTenant?.name ?? null}
            onGoHome={onGoHome}
          />
        )}
      </div>
    </div>
  );
}

function AccountQuotes() {
  const { user } = useAuth();
  const { quotes, loading } = useQuotes();

  if (!user) {
    return (
      <EmptyCard text="Connectez-vous pour retrouver vos devis." />
    );
  }
  if (loading) {
    return <EmptyCard text="Chargement de vos devis…" />;
  }
  const mine = quotes.filter((q) => q.user_id === user.id);
  if (mine.length === 0) {
    return (
      <EmptyCard text="Aucun devis pour l'instant. Créez-en un depuis votre panier." />
    );
  }
  return (
    <div
      data-testid={TEST_IDS.shop.accountQuotesList}
      className="bg-paper border border-line rounded-xl overflow-hidden"
    >
      <table className="w-full border-collapse" style={{ fontSize: '13px' }}>
        <thead>
          <tr className="border-b border-line text-left">
            <th className="px-4 py-3 font-mono uppercase text-ink-mute-2" style={{ fontSize: '10px', letterSpacing: '0.06em' }}>Référence</th>
            <th className="px-4 py-3 font-mono uppercase text-ink-mute-2" style={{ fontSize: '10px', letterSpacing: '0.06em' }}>Produit</th>
            <th className="px-4 py-3 font-mono uppercase text-ink-mute-2" style={{ fontSize: '10px', letterSpacing: '0.06em' }}>Statut</th>
            <th className="px-4 py-3 font-mono uppercase text-ink-mute-2 text-right" style={{ fontSize: '10px', letterSpacing: '0.06em' }}>Total HT</th>
          </tr>
        </thead>
        <tbody>
          {mine.map((q) => (
            <tr key={q.id} className="border-b border-line last:border-0">
              <td className="px-4 py-3 font-mono text-ink-muted">{q.reference ?? q.id.slice(0, 8)}</td>
              <td className="px-4 py-3 text-ink">{q.product_name}</td>
              <td className="px-4 py-3 text-ink-muted">
                {QUOTE_STATUS_LABELS[q.status] ?? q.status}
              </td>
              <td
                className="px-4 py-3 font-mono text-ink text-right"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {q.total_ht != null ? `${q.total_ht.toFixed(2)} €` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AccountProfile({
  email,
  shopName,
  tenantName,
  onGoHome,
}: {
  email: string | null;
  shopName: string;
  tenantName: string | null;
  onGoHome: () => void;
}) {
  if (!email) {
    return <EmptyCard text="Connectez-vous pour accéder à votre profil." />;
  }
  const rows: Array<[string, string]> = [
    ['Email', email],
    ['Boutique', shopName],
    ...(tenantName ? ([['Espace', tenantName]] as Array<[string, string]>) : []),
  ];
  return (
    <div
      data-testid={TEST_IDS.shop.accountProfile}
      className="bg-paper border border-line rounded-xl px-5 py-4 max-w-xl flex flex-col gap-3"
    >
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-baseline gap-4">
          <span
            className="font-mono uppercase text-ink-mute-2 w-24 shrink-0"
            style={{ fontSize: '10px', letterSpacing: '0.06em' }}
          >
            {label}
          </span>
          <span className="text-ink" style={{ fontSize: '13.5px' }}>
            {value}
          </span>
        </div>
      ))}
      <button
        type="button"
        data-testid={TEST_IDS.shop.accountLogoutBtn}
        onClick={async () => {
          await supabase.auth.signOut();
          onGoHome();
        }}
        className="mt-2 self-start inline-flex items-center gap-2 px-3.5 py-2 rounded-md border border-line-2 bg-paper text-ink hover:bg-bg transition-colors"
        style={{ fontSize: '13px', fontWeight: 500 }}
      >
        <LogOut className="w-3.5 h-3.5" strokeWidth={1.5} />
        Se déconnecter
      </button>
    </div>
  );
}

function EmptyCard({ text }: { text: string }) {
  return (
    <div className="bg-paper border border-line rounded-xl px-6 py-10 text-center">
      <p className="text-ink-muted m-0" style={{ fontSize: '13.5px' }}>
        {text}
      </p>
    </div>
  );
}
