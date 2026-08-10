import type { ActorContext, AppError, Page, PageRequest, Result } from '../../kernel';
import type { ResourceRef } from '../access';

export type AuditRecordInput = Readonly<{
  actor: ActorContext;
  action: string;
  resource: ResourceRef;
  occurredAt: string;
  before?: Readonly<Record<string, unknown>>;
  after?: Readonly<Record<string, unknown>>;
  metadata?: Readonly<Record<string, unknown>>;
}>;

export type AuditRecord = AuditRecordInput & Readonly<{
  id: string;
}>;

export type AuditQuery = PageRequest & Readonly<{
  actor: ActorContext;
  action?: string;
  resource?: ResourceRef;
}>;

export type AuditErrorCode =
  | 'audit.invalid_record'
  | 'audit.forbidden'
  | 'audit.provider_unavailable';

export type AuditError = AppError & Readonly<{
  code: AuditErrorCode;
}>;

export interface AuditService {
  append(record: AuditRecordInput): Promise<Result<void, AuditError>>;
  list(query: AuditQuery): Promise<Result<Page<AuditRecord>, AuditError>>;
}
