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
import type { StorefrontSession } from '@/modules/shop-customers';
import type { Shop } from '@/modules/shops';
import { StorefrontLoginForm } from '@/modules/shop-customers/ui/storefront';
import type { AccountSection } from '@/modules/orders/ui/storefront';
import { PortalOrders } from '@/modules/orders/ui/storefront';
import { TEST_IDS } from '@/shared/presentation/testIds';

const SECTIONS: Array<{ key: AccountSection; label: string; icon: typeof Package }> = [
  { key: 'orders', label: 'Mes commandes', icon: Package },
  { key: 'quotes', label: 'Mes devis', icon: FileText },
  { key: 'profile', label: 'Mon profil', icon: User },
];

export interface AccountHubProps {
  shop: Shop;
  hasStorefrontSession?: boolean;
  section: AccountSection;
  onSection: (section: AccountSection) => void;
  onRenewOrder: (order: { id: string; source: string }) => void;
  onGoHome: () => void;
  storefrontSession: StorefrontSession | null;
  onAuthenticated: (session: StorefrontSession) => void;
  onSignOut: () => Promise<void>;
}

export function AccountHub({
  shop,
  hasStorefrontSession = false,
  section,
  onSection,
  onRenewOrder,
  onGoHome,
  storefrontSession,
  onAuthenticated,
  onSignOut,
}: AccountHubProps) {
  const hasCurrentShopSession = storefrontSession?.identity.shopId === shop.id;

  if (!hasCurrentShopSession) {
    return (
      <div className="mx-auto max-w-xl px-5 py-10 lg:px-9">
        <div className="rounded-xl border border-line bg-paper p-5">
          <h2 className="m-0 text-xl font-medium text-ink">Accédez à votre compte boutique</h2>
          <p className="mb-5 mt-1 text-sm text-ink-muted">
            Connectez-vous pour consulter vos commandes, vos devis et votre profil dans cette boutique.
          </p>
          <StorefrontLoginForm
            shopSlug={shop.slug}
            contactEmail={shop.contact_email}
            allowRegistration={shop.access_mode === 'self_signup'}
            onAuthenticated={onAuthenticated}
          />
        </div>
      </div>
    );
  }

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
          <PortalOrders shopId={shop.id} hasStorefrontSession={hasStorefrontSession} onRenewOrder={onRenewOrder} />
        )}
        {section === 'quotes' && <AccountQuotes />}
        {section === 'profile' && (
          <AccountProfile
            session={storefrontSession}
            shopName={shop.name}
            onGoHome={onGoHome}
            onSignOut={onSignOut}
          />
        )}
      </div>
    </div>
  );
}

function AccountQuotes() {
  // Les anciens devis du workspace sont volontairement exclus : ils sont
  // rattachés aux utilisateurs Magrit, pas au compte client de la boutique.
  return <EmptyCard text="Aucun devis boutique pour l’instant. Créez-en un depuis votre panier." />;
}

function AccountProfile({
  session,
  shopName,
  onGoHome,
  onSignOut,
}: {
  session: StorefrontSession | null;
  shopName: string;
  onGoHome: () => void;
  onSignOut: () => Promise<void>;
}) {
  if (!session) {
    return <EmptyCard text="Connectez-vous pour accéder à votre profil." />;
  }
  const rows: Array<[string, string]> = [
    ['Nom', session.customer.fullName],
    ['Email', session.customer.email],
    ['Boutique', shopName],
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
          await onSignOut();
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
