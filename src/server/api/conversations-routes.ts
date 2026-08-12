import { parseId, type UserId } from '../../kernel/ids/index.ts';
import { conversationMutationResultSchema, conversationRemovalResultSchema, conversationsSchema, saveConversationSchema } from '../../modules/conversations/api/contracts.ts';
import { ConversationRejectedError } from '../../modules/conversations/application/conversations-repository.ts';
import type { ConversationsService } from '../../modules/conversations/application/conversations-service.ts';
import { API_V1_BASE_PATH } from '../../platform/api/contracts.ts';
import { ApiHttpError } from './errors.ts';
import { defineJsonRoute, type ApiRequestContext, type ApiRoute } from './routes.ts';

export function createConversationsRoutes(service: ConversationsService): readonly ApiRoute[] {
  const base = `${API_V1_BASE_PATH}/tenants/{tenantId}/conversations`;
  return [
    defineJsonRoute({ method: 'GET', path: base, authentication: 'required', inputSchema: null, outputSchema: conversationsSchema, async handle(context) { return execute(async () => ({ status: 200, body: await service.list(actor(context), param(context, 'tenantId')) })); } }),
    defineJsonRoute({ method: 'PUT', path: `${base}/{conversationId}`, authentication: 'required', inputSchema: saveConversationSchema, outputSchema: conversationMutationResultSchema, async handle(context, conversation) { return execute(async () => ({ status: 200, body: await service.save(actor(context), param(context, 'tenantId'), param(context, 'conversationId'), conversation) })); } }),
    defineJsonRoute({ method: 'DELETE', path: `${base}/{conversationId}`, authentication: 'required', inputSchema: null, outputSchema: conversationRemovalResultSchema, async handle(context) { return execute(async () => ({ status: 200, body: await service.remove(actor(context), param(context, 'tenantId'), param(context, 'conversationId')) })); } }),
  ];
}
async function execute<T>(operation: () => Promise<T>): Promise<T> { try { return await operation(); } catch (error) { if (error instanceof ConversationRejectedError) throw new ApiHttpError({ type: 'about:blank', title: error.code === 'not_found' ? 'Conversation introuvable' : 'Accès conversation interdit', status: error.code === 'not_found' ? 404 : 403, code: `conversations.${error.code}`, detail: error.message }); throw error; } }
function actor(context: ApiRequestContext): UserId { if (context.actor?.kind !== 'user') throw new ApiHttpError({ type: 'about:blank', title: 'Acteur utilisateur requis', status: 403, code: 'identity.user_actor_required' }); return context.actor.userId as UserId; }
function param(context: ApiRequestContext, name: string): string { const parsed = parseId(context.params[name] ?? ''); if (!parsed.ok || parsed.value.length > 200) throw new ApiHttpError({ type: 'about:blank', title: 'Identifiant invalide', status: 422, code: 'api.validation_failed' }); return parsed.value; }
