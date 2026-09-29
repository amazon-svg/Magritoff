import type { UserId } from '../../kernel/ids/index.ts';
import type { ConversationDto, SaveConversation } from '../../modules/conversations/api/contracts.ts';
import {
  ConversationRejectedError,
  type ConversationsRepository,
} from '../../modules/conversations/application/conversations-repository.ts';
import type { PostgresTransactionRunner } from './transaction-runner.ts';

type ConversationRow = Readonly<{
  id: string;
  timestamp: Date;
  title: string;
  messages: unknown;
  products: unknown;
}>;

export class PostgresConversationsRepository implements ConversationsRepository {
  constructor(private readonly transactions: PostgresTransactionRunner) {}

  list(actor: UserId, tenantId: string): Promise<ConversationDto[]> {
    return this.transactions.run({ userId: actor, tenantId: asTenantId(tenantId) }, async (client) => {
      const result = await client.query<ConversationRow>(`
        select id, timestamp, title, messages, products
        from public.conversations
        where tenant_id = $1
        order by timestamp desc
      `, [tenantId]);
      return result.rows.map(mapConversation);
    });
  }

  save(
    actor: UserId,
    tenantId: string,
    conversationId: string,
    conversation: SaveConversation,
  ): Promise<void> {
    return this.transactions.run({ userId: actor, tenantId: asTenantId(tenantId) }, async (client) => {
      const result = await client.query<{ id: string }>(`
        insert into public.conversations (
          id, user_id, tenant_id, title, messages, products, timestamp
        ) values ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7)
        on conflict (id) do update set
          title = excluded.title,
          messages = excluded.messages,
          products = excluded.products,
          timestamp = excluded.timestamp
        where conversations.user_id = excluded.user_id
          and conversations.tenant_id = excluded.tenant_id
        returning id
      `, [
        conversationId,
        actor,
        tenantId,
        conversation.title,
        JSON.stringify(conversation.messages),
        JSON.stringify(conversation.products),
        new Date(conversation.timestamp),
      ]);
      if (result.rowCount !== 1) throw permissionDenied('Conversation détenue par un autre contexte.');
    }).catch(classifyPostgresError);
  }

  remove(actor: UserId, tenantId: string, conversationId: string): Promise<void> {
    return this.transactions.run({ userId: actor, tenantId: asTenantId(tenantId) }, async (client) => {
      const result = await client.query<{ id: string }>(`
        delete from public.conversations
        where id = $1 and tenant_id = $2 and user_id = $3
        returning id
      `, [conversationId, tenantId, actor]);
      if (result.rowCount !== 1) {
        throw new ConversationRejectedError('not_found', 'Conversation introuvable.');
      }
    }).catch(classifyPostgresError);
  }
}

function mapConversation(row: ConversationRow): ConversationDto {
  return {
    id: row.id,
    timestamp: row.timestamp.getTime(),
    title: row.title,
    messages: asMessages(row.messages),
    products: Array.isArray(row.products) ? row.products : [],
  };
}

function asMessages(value: unknown): ConversationDto['messages'] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => (
    entry !== null
    && typeof entry === 'object'
    && !Array.isArray(entry)
    && typeof Reflect.get(entry, 'role') === 'string'
    && typeof Reflect.get(entry, 'content') === 'string'
      ? [{ role: Reflect.get(entry, 'role'), content: Reflect.get(entry, 'content') }]
      : []
  ));
}

function classifyPostgresError(error: unknown): never {
  if (error instanceof ConversationRejectedError) throw error;
  const code = postgresCode(error);
  if (code === '42501' || code === '23514' || code === '23503') {
    throw permissionDenied(error instanceof Error ? error.message : 'Accès conversation refusé.');
  }
  throw error;
}

function postgresCode(error: unknown): string | undefined {
  if (error === null || typeof error !== 'object') return undefined;
  const code = Reflect.get(error, 'code');
  return typeof code === 'string' ? code : undefined;
}

function permissionDenied(message: string): ConversationRejectedError {
  return new ConversationRejectedError('permission_denied', message);
}

function asTenantId(value: string) {
  return value as import('../../kernel/ids/index.ts').TenantId;
}
