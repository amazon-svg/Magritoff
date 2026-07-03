/**
 * AppShell
 * ────────
 * Racine du router : monte les providers qui ont besoin du router
 * (TenantProvider utilise useParams/useNavigate) puis render un <Outlet />
 * pour que les routes enfants prennent le relais.
 *
 * Providers router-agnostiques (Auth, Preferences, PIM) sont dans App.tsx.
 * Providers tenant-scoped (Conversation, Library, Shops, Cart, QuoteTemplates)
 * sont ici, APRES le TenantProvider, pour pouvoir reagir au tenant courant.
 *
 * Sprint 10 Phase B users : ClientsProvider supprime (decision Arnaud
 * 2026-06-02 - consolidation utilisateurs via tenant_members uniquement).
 */

import { Outlet } from 'react-router';
import { TenantProvider } from './contexts/TenantContext';
import { ConversationProvider } from './contexts/ConversationContext';
import { LibraryProvider } from './contexts/LibraryContext';
import { ShopsProvider } from './contexts/ShopsContext';
import { QuoteTemplatesProvider } from './contexts/QuoteTemplatesContext';
import { CartProvider } from './contexts/CartContext';
import { QuotesProvider } from './contexts/QuotesContext';

export function AppShell() {
  return (
    <TenantProvider>
      <ConversationProvider>
        <LibraryProvider>
          <ShopsProvider>
            <QuoteTemplatesProvider>
              <CartProvider>
                <QuotesProvider>
                  <Outlet />
                </QuotesProvider>
              </CartProvider>
            </QuoteTemplatesProvider>
          </ShopsProvider>
        </LibraryProvider>
      </ConversationProvider>
    </TenantProvider>
  );
}
