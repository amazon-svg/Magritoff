/**
 * AppShell
 * ────────
 * Racine du router : monte les providers qui ont besoin du router
 * (TenantProvider utilise useParams/useNavigate) puis render un <Outlet />
 * pour que les routes enfants prennent le relais.
 *
 * Providers router-agnostiques (Auth, Preferences, PIM) sont dans App.tsx.
 * Providers tenant-scoped (Conversation, Clients, Library, Shops, Cart,
 * QuoteTemplates) sont ici, APRES le TenantProvider, pour pouvoir reagir
 * au tenant courant.
 */

import { Outlet } from 'react-router';
import { TenantProvider } from './contexts/TenantContext';
import { ConversationProvider } from './contexts/ConversationContext';
import { ClientsProvider } from './contexts/ClientsContext';
import { LibraryProvider } from './contexts/LibraryContext';
import { ShopsProvider } from './contexts/ShopsContext';
import { QuoteTemplatesProvider } from './contexts/QuoteTemplatesContext';
import { CartProvider } from './contexts/CartContext';

export function AppShell() {
  return (
    <TenantProvider>
      <ConversationProvider>
        <ClientsProvider>
          <LibraryProvider>
            <ShopsProvider>
              <QuoteTemplatesProvider>
                <CartProvider>
                  <Outlet />
                </CartProvider>
              </QuoteTemplatesProvider>
            </ShopsProvider>
          </LibraryProvider>
        </ClientsProvider>
      </ConversationProvider>
    </TenantProvider>
  );
}
