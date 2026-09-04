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
import { TenantProvider } from '@/modules/tenants/ui/runtime';
import { ConversationProvider } from '@/modules/conversations/ui/runtime';
import { LibraryProvider } from '@/modules/libraries/ui/runtime';
import { ShopsProvider } from '@/modules/shops/ui/runtime';
import { QuoteTemplatesProvider } from '@/modules/quote-templates/ui/runtime';
import { CartProvider } from '@/modules/orders/ui/runtime';
import { AccessProfileProvider } from '@/modules/roles/ui/runtime';
import { WorkspaceModuleUiBridge } from '@/app/surfaces/WorkspaceModuleUiBridge';
import { browserRuntime } from '@/platform/runtime';
import { PIMProvider } from '@/modules/catalog/ui/runtime';
import { PreferencesProvider } from '@/modules/account/ui/preferences';
import { SessionBootstrapProvider } from '@/modules/session/ui/bootstrap';
import { PendingMagritInvitationRedirect } from '@/modules/invitations/ui/runtime/PendingMagritInvitationRedirect';
import { useApiRuntime } from '@/app/contexts/ApiRuntimeContext';

export function AppShell() {
  const { client } = useApiRuntime();

  return (
    <>
      <PendingMagritInvitationRedirect />
      <SessionBootstrapProvider apiClient={client}>
        <TenantProvider>
          <WorkspaceModuleUiBridge runtime={browserRuntime}>
            <PreferencesProvider>
              <PIMProvider>
                <AccessProfileProvider>
                  <ConversationProvider>
                    <LibraryProvider>
                      <ShopsProvider>
                        <QuoteTemplatesProvider>
                          <CartProvider>
                            <Outlet />
                          </CartProvider>
                        </QuoteTemplatesProvider>
                      </ShopsProvider>
                    </LibraryProvider>
                  </ConversationProvider>
                </AccessProfileProvider>
              </PIMProvider>
            </PreferencesProvider>
          </WorkspaceModuleUiBridge>
        </TenantProvider>
      </SessionBootstrapProvider>
    </>
  );
}
