import type { UserId } from '../../../kernel/ids/index.ts';
import type {
  SessionTenant,
  SessionUserPreferences,
  UpdatePreferences,
  UpdateTenantSettings,
  CreateSubTenant,
  CreateRootTenant,
  SubTenantsDashboard,
} from '../api/contracts.ts';

export type DirectMembership = Readonly<{
  tenant: Omit<
    SessionTenant,
    'myRole' | 'accessScope' | 'allowedShopIds' | 'permissions' | 'inheritedFromParent'
  >;
  role: SessionTenant['myRole'];
  accessScope: SessionTenant['accessScope'];
  allowedShopIds: readonly string[];
  permissions: Partial<SessionTenant['permissions']>;
}>;

export type ChildTenant = DirectMembership['tenant'];

export class SessionTenantMutationError extends Error {
  constructor(public readonly code: 'permission_denied' | 'conflict' | 'not_found', message: string) { super(message); this.name = 'SessionTenantMutationError'; }
}

export class SessionInvitationAcceptanceError extends Error {
  constructor(public readonly code: 'email_mismatch' | 'invalid', message: string) { super(message); this.name = 'SessionInvitationAcceptanceError'; }
}

export interface SessionRepository {
  resolveTenantSlug(userId: UserId, slug: string): Promise<string | null>;
  autoAcceptPendingInvitations(): Promise<void>;
  listDirectMemberships(userId: UserId): Promise<readonly DirectMembership[]>;
  listChildren(parentTenantIds: readonly string[]): Promise<readonly ChildTenant[]>;
  getPreferences(userId: UserId): Promise<Partial<SessionUserPreferences> | null>;
  updatePreferences(
    userId: UserId,
    patch: UpdatePreferences,
  ): Promise<Partial<SessionUserPreferences>>;
  updateLastTenant(userId: UserId, tenantId: string): Promise<Partial<SessionUserPreferences>>;
  updateTenantSettings(userId: UserId, tenantId: string, patch: UpdateTenantSettings): Promise<void>;
  subTenantsDashboard(userId: UserId, parentTenantId: string): Promise<SubTenantsDashboard>;
  createSubTenant(userId: UserId, parentTenantId: string, command: CreateSubTenant): Promise<string>;
  removeSubTenant(userId: UserId, parentTenantId: string, subTenantId: string): Promise<void>;
  createRootTenant(userId: UserId, command: CreateRootTenant): Promise<string>;
  acceptInvitation(userId: UserId, token: string): Promise<string>;
}
