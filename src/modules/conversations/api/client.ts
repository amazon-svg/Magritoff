import { API_V1_BASE_PATH, FetchApiClient } from '../../../platform/api/index.ts';
import { conversationMutationResultSchema, conversationRemovalResultSchema, conversationsSchema, saveConversationSchema, type ConversationDto, type SaveConversation } from './contracts.ts';

export class ConversationsApiClient {
  constructor(private readonly client: FetchApiClient) {}
  list(tenantId: string): Promise<ConversationDto[]> {
    return this.client.request({ path: `${API_V1_BASE_PATH}/tenants/${tenantId}/conversations`, responseSchema: conversationsSchema });
  }
  save(tenantId: string, conversationId: string, conversation: SaveConversation): Promise<void> {
    return this.client.request({ method: 'PUT', path: `${API_V1_BASE_PATH}/tenants/${tenantId}/conversations/${encodeURIComponent(conversationId)}`, body: saveConversationSchema.parse(conversation), responseSchema: conversationMutationResultSchema }).then(() => undefined);
  }
  remove(tenantId: string, conversationId: string): Promise<void> {
    return this.client.request({ method: 'DELETE', path: `${API_V1_BASE_PATH}/tenants/${tenantId}/conversations/${encodeURIComponent(conversationId)}`, responseSchema: conversationRemovalResultSchema }).then(() => undefined);
  }
}
