import type { AssistantGateway } from '../../modules/diagnostics/application/assistant-gateway.ts';

export class BrowserApiAssistantGateway implements AssistantGateway {
  connection(accessToken: string, _streaming: boolean) {
    return { endpoint: '/api/v1/assistant/chat', authorizationToken: accessToken };
  }
}

export const browserAssistantGateway: AssistantGateway = new BrowserApiAssistantGateway();
