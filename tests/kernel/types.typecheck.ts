import type { TenantId, UserId } from '../../src/kernel';

declare const tenantId: TenantId;
declare const userId: UserId;

function requireTenantId(id: TenantId): TenantId {
  return id;
}

requireTenantId(tenantId);

// @ts-expect-error Les identifiants opaques de domaines differents ne sont pas interchangeables.
requireTenantId(userId);
