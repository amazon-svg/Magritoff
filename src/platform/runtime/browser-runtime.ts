import { browserAuthenticationGateway } from '../../adapters/supabase/browser-authentication-gateway.ts';
import type { AuthenticationGateway } from '../../modules/account/index.ts';
import { ClariprintApiClient, type ClariprintPricingGateway } from '../../modules/clariprint/index.ts';
import { DiagnosticsApiClient } from '../../modules/diagnostics/index.ts';
import { ClariprintHttpAdapter } from '../../adapters/http/browser-clariprint-adapter.ts';
import type { FetchApiClient } from '../api/index.ts';

export type BrowserRuntime = Readonly<{
  authentication: AuthenticationGateway;
  createClariprint(client: FetchApiClient): ClariprintPricingGateway;
}>;

export const browserRuntime: BrowserRuntime = Object.freeze({
  authentication: browserAuthenticationGateway,
  createClariprint: (client) => new ClariprintHttpAdapter(
    new ClariprintApiClient(client),
    new DiagnosticsApiClient(client),
  ),
});
