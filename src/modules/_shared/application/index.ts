/** Entree publique du socle applicatif transverse (story E10.0). */
export {
  assertPrecondition,
  computeEntityTag,
  readIfMatch,
} from './concurrency.ts';

export {
  deriveShopCustomerIdempotencyStorageKey,
  fingerprintRequest,
  idempotencyInProgress,
  idempotencyKeyReused,
  InMemoryIdempotencyStore,
  readIdempotencyKey,
} from './idempotency.ts';
export type {
  IdempotencyLookup,
  IdempotencyRecord,
  IdempotencyRequest,
  IdempotencyStore,
} from './idempotency.ts';

export {
  buildPage,
  decodeCursor,
  encodeCursor,
  parsePageParams,
  toPageParamsDto,
} from './pagination.ts';
export type { CursorPosition, PageParams } from './pagination.ts';

export {
  authenticationRequired,
  internalError,
  problem,
  ProblemError,
  resourceConflict,
  roleRequired,
  scopeRequired,
  SHARED_PROBLEM_CODES,
  validationFailed,
} from './problem.ts';
export type { ProblemInit, SharedProblemCode } from './problem.ts';

export {
  assertScopes,
  assertShopCustomerPrincipal,
  assertTenantNotAddressed,
  assertUserPrincipal,
  readCredential,
  resolvePrincipal,
} from './tenant-resolution.ts';
export type {
  ApiCredential,
  ApiPrincipal,
  CookieCredential,
  PrincipalVerifier,
  ServicePrincipal,
  ServiceScope,
  ShopCustomerPrincipal,
  ShopCustomerSessionKind,
  UserPrincipal,
} from './tenant-resolution.ts';

export {
  buildDeliveryHeaders,
  OUTBOX_EVENT_VERSIONS,
  OutboxPublisher,
  serializeEventEnvelope,
  signEventBody,
  toEventEnvelope,
  verifyEventSignature,
} from './outbox.ts';

export { toIsoTimestamp, toIsoTimestampOrNull } from './timestamps.ts';
export type {
  EventPayload,
  OutboxEvent,
  OutboxEventDraft,
  OutboxPublisherDependencies,
  OutboxRepository,
} from './outbox.ts';
