import type { UserId } from '../../../kernel/ids/index.ts';
import type { ConversationDto, SaveConversation } from '../api/contracts.ts';

export class ConversationRejectedError extends Error {
  constructor(public readonly code: 'permission_denied' | 'not_found', message: string) { super(message); this.name = 'ConversationRejectedError'; }
}
export interface ConversationsRepository {
  list(actor: UserId, tenantId: string): Promise<ConversationDto[]>;
  save(actor: UserId, tenantId: string, conversationId: string, conversation: SaveConversation): Promise<void>;
  remove(actor: UserId, tenantId: string, conversationId: string): Promise<void>;
}
