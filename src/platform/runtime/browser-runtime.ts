import { browserAuthenticationGateway } from '../../adapters/supabase/browser-authentication-gateway.ts';
import type { AuthenticationGateway } from '../../modules/account/index.ts';
import { ClariprintApiClient, type ClariprintPricingGateway } from '../../modules/clariprint/index.ts';
import { DiagnosticsApiClient } from '../../modules/diagnostics/index.ts';
import { ClariprintHttpAdapter } from '../../adapters/http/browser-clariprint-adapter.ts';
import type { FetchApiClient } from '../api/index.ts';
import { browserAssistantGateway } from '../../adapters/http/browser-assistant-gateway.ts';
import type { AssistantGateway } from '../../modules/diagnostics/index.ts';

export type BrowserRuntime = Readonly<{
  authentication: AuthenticationGateway;
  assistant: AssistantGateway;
  createClariprint(client: FetchApiClient): ClariprintPricingGateway;
}>;

export const browserRuntime: BrowserRuntime = Object.freeze({
  authentication: browserAuthenticationGateway,
  assistant: browserAssistantGateway,
  createClariprint: (client) => new ClariprintHttpAdapter(
    new ClariprintApiClient(client),
    new DiagnosticsApiClient(client),
  ),
});
