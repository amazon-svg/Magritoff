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
import { ShopCustomersApiClient } from '../../modules/shop-customers';
import { ShopsApiClient } from '../../modules/shops';
import { useApiRuntime } from './ApiRuntimeContext';

type WorkspaceModuleClients = Readonly<{
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
  shopCustomers: ShopCustomersApiClient;
  shops: ShopsApiClient;
  shopsForAccessToken(accessToken: string): ShopsApiClient;
  workspaceInvitations: InvitationsApiClient;
  workspaceInvitationsForAccessToken(accessToken: string): InvitationsApiClient;
  workspaceMembers: MembersApiClient;
  workspaceRoles: RolesApiClient;
}>;

const WorkspaceModuleClientsContext = createContext<WorkspaceModuleClients | null>(null);

/** Composition root des façades `/api/v1` consommées par l'application. */
export function ModuleClientsProvider({ children }: { children: ReactNode }) {
  const apiRuntime = useApiRuntime();
  const workspaceClients = useMemo<WorkspaceModuleClients>(
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
      shopCustomers: new ShopCustomersApiClient(apiRuntime.client),
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
    <WorkspaceModuleClientsContext.Provider value={workspaceClients}>
      {children}
    </WorkspaceModuleClientsContext.Provider>
  );
}

function useWorkspaceModuleClients(): WorkspaceModuleClients {
  const clients = useContext(WorkspaceModuleClientsContext);
  if (!clients) throw new Error('Workspace clients require ModuleClientsProvider');
  return clients;
}

export function useOrdersApi(): OrdersApiClient {
  return useWorkspaceModuleClients().orders;
}

export function useCatalogApi(): CatalogApiClient {
  return useWorkspaceModuleClients().catalog;
}

export function useCommercialApi(): CommercialApiClient {
  return useWorkspaceModuleClients().commercial;
}

export function useConversationsApi(): ConversationsApiClient {
  return useWorkspaceModuleClients().conversations;
}

export function useDiagnosticsApi(): DiagnosticsApiClient {
  return useWorkspaceModuleClients().diagnostics;
}


export function useLibrariesApi(): LibrariesApiClient {
  return useWorkspaceModuleClients().libraries;
}

export function useLibraryProductsApi(): LibraryProductsApiClient {
  return useWorkspaceModuleClients().libraryProducts;
}

export function useQuoteTemplatesApi(): QuoteTemplatesApiClient {
  return useWorkspaceModuleClients().quoteTemplates;
}

export function useQuotesApi(): QuotesApiClient {
  return useWorkspaceModuleClients().quotes;
}

export function useSessionApi(): SessionApiClient {
  return useWorkspaceModuleClients().session;
}

export function useShopCustomersApi(): ShopCustomersApiClient {
  return useWorkspaceModuleClients().shopCustomers;
}

export function useShopsApi(): ShopsApiClient {
  return useWorkspaceModuleClients().shops;
}

export function useShopsApiFactory(): WorkspaceModuleClients['shopsForAccessToken'] {
  return useWorkspaceModuleClients().shopsForAccessToken;
}

export function useWorkspaceInvitationsApi(): InvitationsApiClient {
  return useWorkspaceModuleClients().workspaceInvitations;
}

export function useWorkspaceInvitationsApiFactory(): WorkspaceModuleClients['workspaceInvitationsForAccessToken'] {
  return useWorkspaceModuleClients().workspaceInvitationsForAccessToken;
}

export function useWorkspaceMembersApi(): MembersApiClient {
  return useWorkspaceModuleClients().workspaceMembers;
}

export function useWorkspaceRolesApi(): RolesApiClient {
  return useWorkspaceModuleClients().workspaceRoles;
}
