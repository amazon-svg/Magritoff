import { ClariprintHttpAdapter } from '../../adapters/http/browser-clariprint-adapter.ts';
import { browserStorefrontAssistantGateway } from '../../adapters/http/browser-assistant-gateway.ts';
import { ClariprintApiClient, type ClariprintPricingGateway } from '../../modules/clariprint/index.ts';
import { DiagnosticsApiClient, type AssistantGateway } from '../../modules/diagnostics/index.ts';
import type { FetchApiClient } from '../api/index.ts';

export type StorefrontBrowserRuntime = Readonly<{
  assistant: AssistantGateway;
  createClariprint(client: FetchApiClient): ClariprintPricingGateway;
}>;

/** Runtime public de la boutique : aucun adaptateur d'identité Magrit. */
export const storefrontBrowserRuntime: StorefrontBrowserRuntime = Object.freeze({
  assistant: browserStorefrontAssistantGateway,
  createClariprint: (client) => new ClariprintHttpAdapter(
    new ClariprintApiClient(client),
    new DiagnosticsApiClient(client),
  ),
});
