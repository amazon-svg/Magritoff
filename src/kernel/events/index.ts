import type { TenantId } from '../ids';

export type DomainEvent<Name extends string, Payload> = Readonly<{
  id: string;
  name: Name;
  occurredAt: string;
  tenantId: TenantId;
  aggregateId: string;
  payload: Readonly<Payload>;
}>;
