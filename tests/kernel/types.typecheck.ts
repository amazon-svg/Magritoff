import type { Id, TenantId, UserId } from '../../src/kernel';

declare const tenantId: TenantId;
declare const userId: UserId;

const acceptsTenant = (_value: TenantId): void => undefined;
const acceptsGenericId = (_value: Id<string>): void => undefined;

acceptsTenant(tenantId);
acceptsGenericId(userId);

// @ts-expect-error Les identifiants utilisateur et tenant ne sont pas interchangeables.
acceptsTenant(userId);
