import type { TenantId } from '../ids/index.ts';

export type DomainEvent<Name extends string, Payload> = Readonly<{
  id: string;
  name: Name;
  occurredAt: string;
  tenantId: TenantId;
  aggregateId: string;
  payload: Readonly<Payload>;
}>;
