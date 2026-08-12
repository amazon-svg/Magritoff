import type { AssistantGateway, CategoryEditorialInput } from '../../modules/diagnostics/application/assistant-gateway.ts';
import { projectId, publicAnonKey } from '../../../utils/supabase/info.tsx';
export class SupabaseLegacyAssistantGateway implements AssistantGateway {
  private readonly baseUrl = `https://${projectId}.supabase.co/functions/v1/make-server-e3db71a4`;
  connection(streaming: boolean) { return { endpoint: `${this.baseUrl}/${streaming ? 'claude-proxy-stream' : 'claude-proxy'}`, authorizationToken: publicAnonKey }; }
  async categoryEditorial(input: CategoryEditorialInput): Promise<Record<string, unknown>> {
    const response = await fetch(`${this.baseUrl}/category-editorial`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` }, body: JSON.stringify(input) });
    if (!response.ok) throw new Error(`category_editorial_failed:${response.status}`);
    const payload = await response.json() as { editorial?: Record<string, unknown> };
    return payload.editorial ?? {};
  }
}
export const browserAssistantGateway: AssistantGateway = new SupabaseLegacyAssistantGateway();
