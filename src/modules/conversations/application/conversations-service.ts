import type { UserId } from '../../../kernel/ids/index.ts';
import type { SaveConversation } from '../api/contracts.ts';
import type { ConversationsRepository } from './conversations-repository.ts';

export class ConversationsService {
  constructor(private readonly repository: ConversationsRepository) {}
  list(actor: UserId, tenantId: string) { return this.repository.list(actor, tenantId); }
  async save(actor: UserId, tenantId: string, conversationId: string, conversation: SaveConversation) { await this.repository.save(actor, tenantId, conversationId, conversation); return { saved: true as const }; }
  async remove(actor: UserId, tenantId: string, conversationId: string) { await this.repository.remove(actor, tenantId, conversationId); return { removed: true as const }; }
}
