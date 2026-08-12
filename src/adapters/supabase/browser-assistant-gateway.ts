import type { AssistantGateway } from '../../modules/diagnostics/application/assistant-gateway.ts';
import { projectId, publicAnonKey } from '../../../utils/supabase/info.tsx';
export class SupabaseLegacyAssistantGateway implements AssistantGateway {
  private readonly baseUrl = `https://${projectId}.supabase.co/functions/v1/make-server-e3db71a4`;
  connection(streaming: boolean) { return { endpoint: `${this.baseUrl}/${streaming ? 'claude-proxy-stream' : 'claude-proxy'}`, authorizationToken: publicAnonKey }; }
}
export const browserAssistantGateway: AssistantGateway = new SupabaseLegacyAssistantGateway();
