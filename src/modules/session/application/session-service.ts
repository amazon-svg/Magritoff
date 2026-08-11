import type { UserId } from '../../../kernel';
import type {
  SessionBootstrap,
  SessionTenant,
  SessionUserPreferences,
  UpdatePreferences,
} from '../api/contracts';
import type { DirectMembership, SessionRepository } from './session-repository';

export const DEFAULT_SESSION_PREFERENCES: SessionUserPreferences = Object.freeze({
  theme: 'light',
  language: 'fr',
  default_delivery_zone: 'FR-75',
  notifications_email: true,
  plan: 'freemium',
  is_admin: false,
  last_tenant_id: null,
});

const DEFAULT_PERMISSIONS: SessionTenant['permissions'] = Object.freeze({
  can_quote: true,
  can_order: true,
  can_invite: false,
});

export class SessionService {
  constructor(private readonly repository: SessionRepository) {}

  async load(userId: UserId): Promise<SessionBootstrap> {
    await this.repository.autoAcceptPendingInvitations();
    const directMemberships = await this.repository.listDirectMemberships(userId);
    const inheritable = directMemberships.filter(
      ({ role, accessScope }) =>
        (role === 'owner' || role === 'admin') && accessScope === 'magrit_full',
    );
    const children =
      inheritable.length === 0
        ? []
        : await this.repository.listChildren(inheritable.map(({ tenant }) => tenant.id));
    const directIds = new Set(directMemberships.map(({ tenant }) => tenant.id));
    const direct = directMemberships.map(toDirectTenant);
    const inherited = children
      .filter((tenant) => !directIds.has(tenant.id))
      .map((tenant): SessionTenant => {
        const parent = inheritable.find(({ tenant: candidate }) => candidate.id === tenant.parent_tenant_id);
        return {
          ...tenant,
          myRole: parent?.role ?? 'member',
          accessScope: 'magrit_full',
          allowedShopIds: [],
          permissions: { ...DEFAULT_PERMISSIONS, can_invite: true },
          inheritedFromParent: true,
        };
      });
    const preferences = normalizePreferences(await this.repository.getPreferences(userId));

    return {
      user: { id: userId },
      tenants: [...direct, ...inherited],
      isSuperAdmin: direct.some(
        (tenant) =>
          tenant.is_system_tenant && (tenant.myRole === 'owner' || tenant.myRole === 'admin'),
      ),
      preferences,
    };
  }

  async updatePreferences(userId: UserId, patch: UpdatePreferences) {
    return normalizePreferences(await this.repository.updatePreferences(userId, patch));
  }

  async updateLastTenant(userId: UserId, tenantId: string) {
    const session = await this.load(userId);
    if (!session.tenants.some((tenant) => tenant.id === tenantId)) {
      throw new SessionTenantAccessDeniedError(tenantId);
    }
    return normalizePreferences(await this.repository.updateLastTenant(userId, tenantId));
  }
}

export class SessionTenantAccessDeniedError extends Error {
  constructor(public readonly tenantId: string) {
    super('Le tenant demandé ne fait pas partie de la session utilisateur.');
    this.name = 'SessionTenantAccessDeniedError';
  }
}

function toDirectTenant(membership: DirectMembership): SessionTenant {
  return {
    ...membership.tenant,
    myRole: membership.role,
    accessScope: membership.accessScope,
    allowedShopIds: [...membership.allowedShopIds],
    permissions: { ...DEFAULT_PERMISSIONS, ...membership.permissions },
    inheritedFromParent: false,
  };
}

function normalizePreferences(
  preferences: Partial<SessionUserPreferences> | null,
): SessionUserPreferences {
  return { ...DEFAULT_SESSION_PREFERENCES, ...(preferences ?? {}) };
}
