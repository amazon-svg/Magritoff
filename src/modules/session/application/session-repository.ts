import type { UserId } from '../../../kernel/ids/index.ts';
import type {
  SessionTenant,
  SessionUserPreferences,
  UpdatePreferences,
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

export interface SessionRepository {
  autoAcceptPendingInvitations(): Promise<void>;
  listDirectMemberships(userId: UserId): Promise<readonly DirectMembership[]>;
  listChildren(parentTenantIds: readonly string[]): Promise<readonly ChildTenant[]>;
  getPreferences(userId: UserId): Promise<Partial<SessionUserPreferences> | null>;
  updatePreferences(
    userId: UserId,
    patch: UpdatePreferences,
  ): Promise<Partial<SessionUserPreferences>>;
  updateLastTenant(userId: UserId, tenantId: string): Promise<Partial<SessionUserPreferences>>;
}
