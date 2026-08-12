import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserId } from '../../kernel/ids/index.ts';
import type { ConversationDto, SaveConversation } from '../../modules/conversations/api/contracts.ts';
import { ConversationRejectedError, type ConversationsRepository } from '../../modules/conversations/application/conversations-repository.ts';
import type { Database, Json } from '../../types/database.types.ts';

export class SupabaseConversationsRepository implements ConversationsRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}
  async list(_actor: UserId, tenantId: string): Promise<ConversationDto[]> {
    const { data, error } = await this.client.from('conversations').select('id, timestamp, title, messages, products').eq('tenant_id', tenantId).order('timestamp', { ascending: false });
    if (error) throw rejected(error.message);
    return (data ?? []).map((row) => ({ id: row.id, timestamp: new Date(row.timestamp).getTime(), title: row.title, messages: asMessages(row.messages), products: Array.isArray(row.products) ? row.products : [] }));
  }
  async save(actor: UserId, tenantId: string, conversationId: string, conversation: SaveConversation): Promise<void> {
    const { error } = await this.client.from('conversations').upsert({ id: conversationId, user_id: actor, tenant_id: tenantId, title: conversation.title, messages: conversation.messages as Json, products: conversation.products as Json, timestamp: new Date(conversation.timestamp).toISOString() }, { onConflict: 'id' });
    if (error) throw rejected(error.message);
  }
  async remove(_actor: UserId, tenantId: string, conversationId: string): Promise<void> {
    const { data, error } = await this.client.from('conversations').delete().eq('id', conversationId).eq('tenant_id', tenantId).select('id').maybeSingle();
    if (error) throw rejected(error.message);
    if (!data) throw new ConversationRejectedError('not_found', 'Conversation introuvable.');
  }
}

function asMessages(value: Json) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => entry && typeof entry === 'object' && !Array.isArray(entry) && typeof entry.role === 'string' && typeof entry.content === 'string' ? [{ role: entry.role, content: entry.content }] : []);
}
function rejected(message: string) { return new ConversationRejectedError('permission_denied', message); }
