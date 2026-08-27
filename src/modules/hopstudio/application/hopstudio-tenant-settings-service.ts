import type { UserId } from '../../../kernel/ids/index.ts';
import type {
  HopeStudioTenantSettings,
  UpdateHopeStudioTenantSettings,
} from '../api/tenant-settings.ts';

export class HopeStudioSettingsRejectedError extends Error {
  constructor(
    public readonly code: 'permission_denied' | 'storage_failed' | 'encryption_unavailable',
    message: string,
  ) {
    super(message);
    this.name = 'HopeStudioSettingsRejectedError';
  }
}

export interface HopeStudioTenantSettingsAccessGateway {
  canManage(actor: UserId, tenantId: string): Promise<boolean>;
}

export interface HopeStudioTenantSettingsRepository {
  get(tenantId: string): Promise<HopeStudioTenantSettings>;
  update(tenantId: string, command: UpdateHopeStudioTenantSettings): Promise<void>;
}

export class HopeStudioTenantSettingsService {
  constructor(
    private readonly access: HopeStudioTenantSettingsAccessGateway,
    private readonly repository: HopeStudioTenantSettingsRepository,
  ) {}

  async get(actor: UserId, tenantId: string): Promise<HopeStudioTenantSettings> {
    await this.assertCanManage(actor, tenantId);
    return this.repository.get(tenantId);
  }

  async update(
    actor: UserId,
    tenantId: string,
    command: UpdateHopeStudioTenantSettings,
  ): Promise<void> {
    await this.assertCanManage(actor, tenantId);
    await this.repository.update(tenantId, command);
  }

  private async assertCanManage(actor: UserId, tenantId: string): Promise<void> {
    if (!await this.access.canManage(actor, tenantId)) {
      throw new HopeStudioSettingsRejectedError(
        'permission_denied',
        'Seul un administrateur du tenant peut gérer Clariprint Studio.',
      );
    }
  }
}
