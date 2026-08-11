import type { RequestId, TenantId, UserId } from '../ids';

export type UserActorContext = Readonly<{
  kind: 'user';
  userId: UserId;
  tenantId?: TenantId;
  requestId: RequestId;
}>;

export type SystemActorContext = Readonly<{
  kind: 'system';
  systemId: string;
  tenantId?: TenantId;
  requestId: RequestId;
}>;

export type ActorContext = UserActorContext | SystemActorContext;
