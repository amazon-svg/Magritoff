import { AsyncLocalStorage } from 'node:async_hooks';
import type { TenantId, UserId } from '../../kernel/ids/index.ts';

/** Server composition only: populated after HTTP authentication and tenant resolution. */
const requestIdentity = new AsyncLocalStorage<Readonly<{ tenantId: TenantId; userId: UserId }>>();
export function withAuthenticatedPostgresRequest<T>(identity: { tenantId: TenantId; userId: UserId }, operation: () => Promise<T>): Promise<T> {
  return requestIdentity.run(Object.freeze({ ...identity }), operation);
}
export function authenticatedPostgresRequest() {
  return requestIdentity.getStore();
}
