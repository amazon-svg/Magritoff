import type { TenantId, UserId } from '../../../kernel/ids/index.ts';
import type { CommercialSettingsDto, UpdateCommercialSettingsCommand } from '../api/contracts.ts';
import {
  CommercialSettingsAccessDeniedError,
  type CommercialSettingsRepository,
} from './commercial-settings-repository.ts';

export type CommercialSettingsServiceDependencies = Readonly<{
  repository: CommercialSettingsRepository;
}>;

/**
 * Service applicatif du module Reglages commerciaux (E10.10a). Orchestration
 * fine : `GET` est ouvert a tout membre (aucune garde), `PATCH` exige
 * `can_manage_pricing` (E10.11), verifie ICI avant toute ecriture — meme
 * discipline que `CommercialQuotesService.listAuditEntries()`.
 */
export class CommercialSettingsService {
  private readonly repository: CommercialSettingsRepository;

  constructor(dependencies: CommercialSettingsServiceDependencies) {
    this.repository = dependencies.repository;
  }

  get(tenantId: TenantId): Promise<CommercialSettingsDto> {
    return this.repository.get(tenantId);
  }

  async update(
    tenantId: TenantId,
    actor: UserId,
    command: UpdateCommercialSettingsCommand,
  ): Promise<CommercialSettingsDto> {
    const authorized = await this.repository.actorHasCapability(tenantId, actor, 'can_manage_pricing');
    if (!authorized) throw new CommercialSettingsAccessDeniedError();
    return this.repository.update(tenantId, command);
  }
}
