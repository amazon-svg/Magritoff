import { createContext, type ReactNode, useContext, useMemo } from 'react';
import { CatalogApiClient } from '../../modules/catalog';
import { CommercialApiClient } from '../../modules/commercial';
import { ConversationsApiClient } from '../../modules/conversations';
import { DiagnosticsApiClient } from '../../modules/diagnostics';
import { InvitationsApiClient } from '../../modules/invitations';
import { LibrariesApiClient, LibraryProductsApiClient } from '../../modules/libraries';
import { MembersApiClient } from '../../modules/members';
import { OrdersApiClient } from '../../modules/orders';
import { QuoteTemplatesApiClient } from '../../modules/quote-templates';
import { QuotesApiClient } from '../../modules/quotes';
import { RolesApiClient } from '../../modules/roles';
import { SessionApiClient } from '../../modules/session';
import { ShopsApiClient } from '../../modules/shops';
import { useApiRuntime } from './ApiRuntimeContext';

type ModuleClients = Readonly<{
  catalog: CatalogApiClient;
  commercial: CommercialApiClient;
  conversations: ConversationsApiClient;
  diagnostics: DiagnosticsApiClient;
  libraries: LibrariesApiClient;
  libraryProducts: LibraryProductsApiClient;
  orders: OrdersApiClient;
  quoteTemplates: QuoteTemplatesApiClient;
  quotes: QuotesApiClient;
  session: SessionApiClient;
  shops: ShopsApiClient;
  shopsForAccessToken(accessToken: string): ShopsApiClient;
  workspaceInvitations: InvitationsApiClient;
  workspaceInvitationsForAccessToken(accessToken: string): InvitationsApiClient;
  workspaceMembers: MembersApiClient;
  workspaceRoles: RolesApiClient;
}>;

const ModuleClientsContext = createContext<ModuleClients | null>(null);

/** Composition root des façades `/api/v1` consommées par l'application. */
export function ModuleClientsProvider({ children }: { children: ReactNode }) {
  const apiRuntime = useApiRuntime();
  const clients = useMemo<ModuleClients>(
    () => ({
      catalog: new CatalogApiClient(apiRuntime.client),
      commercial: new CommercialApiClient(apiRuntime.client),
      conversations: new ConversationsApiClient(apiRuntime.client),
      diagnostics: new DiagnosticsApiClient(apiRuntime.client),
      libraries: new LibrariesApiClient(apiRuntime.client),
      libraryProducts: new LibraryProductsApiClient(apiRuntime.client),
      orders: new OrdersApiClient(apiRuntime.client),
      quoteTemplates: new QuoteTemplatesApiClient(apiRuntime.client),
      quotes: new QuotesApiClient(apiRuntime.client),
      session: new SessionApiClient(apiRuntime.client),
      shops: new ShopsApiClient(apiRuntime.client),
      shopsForAccessToken: (accessToken) => new ShopsApiClient(
        apiRuntime.forAccessToken(accessToken),
      ),
      workspaceInvitations: new InvitationsApiClient(apiRuntime.client),
      workspaceInvitationsForAccessToken: (accessToken) => new InvitationsApiClient(
        apiRuntime.forAccessToken(accessToken),
      ),
      workspaceMembers: new MembersApiClient(apiRuntime.client),
      workspaceRoles: new RolesApiClient(apiRuntime.client),
    }),
    [apiRuntime],
  );

  return (
    <ModuleClientsContext.Provider value={clients}>
      {children}
    </ModuleClientsContext.Provider>
  );
}

export function useOrdersApi(): OrdersApiClient {
  const clients = useContext(ModuleClientsContext);
  if (!clients) throw new Error('useOrdersApi must be used within a ModuleClientsProvider');
  return clients.orders;
}

export function useCatalogApi(): CatalogApiClient {
  const clients = useContext(ModuleClientsContext);
  if (!clients) throw new Error('useCatalogApi must be used within a ModuleClientsProvider');
  return clients.catalog;
}

export function useCommercialApi(): CommercialApiClient {
  const clients = useContext(ModuleClientsContext);
  if (!clients) throw new Error('useCommercialApi must be used within a ModuleClientsProvider');
  return clients.commercial;
}

export function useConversationsApi(): ConversationsApiClient {
  const clients = useContext(ModuleClientsContext);
  if (!clients) throw new Error('useConversationsApi must be used within a ModuleClientsProvider');
  return clients.conversations;
}

export function useDiagnosticsApi(): DiagnosticsApiClient {
  const clients = useContext(ModuleClientsContext);
  if (!clients) throw new Error('useDiagnosticsApi must be used within a ModuleClientsProvider');
  return clients.diagnostics;
}

export function useLibrariesApi(): LibrariesApiClient {
  const clients = useContext(ModuleClientsContext);
  if (!clients) throw new Error('useLibrariesApi must be used within a ModuleClientsProvider');
  return clients.libraries;
}

export function useLibraryProductsApi(): LibraryProductsApiClient {
  const clients = useContext(ModuleClientsContext);
  if (!clients) throw new Error('useLibraryProductsApi must be used within a ModuleClientsProvider');
  return clients.libraryProducts;
}

export function useQuoteTemplatesApi(): QuoteTemplatesApiClient {
  const clients = useContext(ModuleClientsContext);
  if (!clients) throw new Error('useQuoteTemplatesApi must be used within a ModuleClientsProvider');
  return clients.quoteTemplates;
}

export function useQuotesApi(): QuotesApiClient {
  const clients = useContext(ModuleClientsContext);
  if (!clients) throw new Error('useQuotesApi must be used within a ModuleClientsProvider');
  return clients.quotes;
}

export function useSessionApi(): SessionApiClient {
  const clients = useContext(ModuleClientsContext);
  if (!clients) throw new Error('useSessionApi must be used within a ModuleClientsProvider');
  return clients.session;
}

export function useShopsApi(): ShopsApiClient {
  const clients = useContext(ModuleClientsContext);
  if (!clients) throw new Error('useShopsApi must be used within a ModuleClientsProvider');
  return clients.shops;
}

export function useShopsApiFactory(): ModuleClients['shopsForAccessToken'] {
  const clients = useContext(ModuleClientsContext);
  if (!clients) throw new Error('useShopsApiFactory must be used within a ModuleClientsProvider');
  return clients.shopsForAccessToken;
}

export function useWorkspaceInvitationsApi(): InvitationsApiClient {
  const clients = useContext(ModuleClientsContext);
  if (!clients) throw new Error('useWorkspaceInvitationsApi must be used within a ModuleClientsProvider');
  return clients.workspaceInvitations;
}

export function useWorkspaceInvitationsApiFactory(): ModuleClients['workspaceInvitationsForAccessToken'] {
  const clients = useContext(ModuleClientsContext);
  if (!clients) throw new Error('useWorkspaceInvitationsApiFactory must be used within a ModuleClientsProvider');
  return clients.workspaceInvitationsForAccessToken;
}

export function useWorkspaceMembersApi(): MembersApiClient {
  const clients = useContext(ModuleClientsContext);
  if (!clients) throw new Error('useWorkspaceMembersApi must be used within a ModuleClientsProvider');
  return clients.workspaceMembers;
}

export function useWorkspaceRolesApi(): RolesApiClient {
  const clients = useContext(ModuleClientsContext);
  if (!clients) throw new Error('useWorkspaceRolesApi must be used within a ModuleClientsProvider');
  return clients.workspaceRoles;
}
