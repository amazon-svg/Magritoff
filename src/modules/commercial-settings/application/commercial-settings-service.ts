import type { TenantId, UserId } from '../../../kernel/ids/index.ts';
import {
  NOTIFICATION_SETTINGS_FIELDS,
  type CommercialSettingsDto,
  type UpdateCommercialSettingsCommand,
} from '../api/contracts.ts';
import {
  CommercialSettingsAccessDeniedError,
  CommercialSettingsFieldCapabilityDeniedError,
  type CommercialSettingsRepository,
} from './commercial-settings-repository.ts';

/** Droit supplementaire exige, AU CHAMP pres, pour ecrire les trois reglages de notification (E10.15a, contrat §8.23 §2). */
const CAN_MANAGE_NOTIFICATIONS = 'can_manage_notifications';

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

  /**
   * Garde `can_manage_pricing`, extraite en methode PUBLIQUE (qa-review
   * E10.10a round 1, R1 — meme correctif que `PriceRulesService.
   * assertCanManagePricing()`, `price-rules-service.ts`). Cette promesse ne
   * tenait qu au niveau du SERVICE : `updateCommercialSettings`
   * (`commercial-settings-routes.ts`) lisait la ressource courante (`get()`)
   * AVANT d appeler `update()`, pour calculer l `ETag` et verifier
   * `If-Match` — un acteur sans le droit recevait donc un 409
   * (`assertPrecondition`) au lieu du 403 attendu, `GET` restant par ailleurs
   * ouvert a tout membre. Exposer cette garde permet a la route de l appeler
   * EXPLICITEMENT avant cette lecture ; elle reste egalement appelee ICI, en
   * defense en profondeur pour tout appelant direct du service.
   */
  async assertCanManagePricing(tenantId: TenantId, actor: UserId): Promise<void> {
    const authorized = await this.repository.actorHasCapability(tenantId, actor, 'can_manage_pricing');
    if (!authorized) throw new CommercialSettingsAccessDeniedError();
  }

  async update(
    tenantId: TenantId,
    actor: UserId,
    command: UpdateCommercialSettingsCommand,
  ): Promise<CommercialSettingsDto> {
    await this.assertCanManagePricing(tenantId, actor);
    await this.assertCanManageNotificationFields(tenantId, actor, command);
    return this.repository.update(tenantId, command);
  }

  /**
   * E10.15a — garde AU CHAMP (contrat §8.23 §2), distincte et EN PLUS de
   * `assertCanManagePricing` : n examine que les trois champs de notification
   * de `command`, jamais l operation entiere. Un acteur qui ne touche a AUCUN
   * de ces trois champs ne declenche AUCUN appel supplementaire — meme
   * discipline de garde PUBLIQUE, appelee explicitement par la route AVANT
   * toute lecture de la ressource courante (`assertCanManagePricing`).
   */
  async assertCanManageNotificationFields(
    tenantId: TenantId,
    actor: UserId,
    command: UpdateCommercialSettingsCommand,
  ): Promise<void> {
    const touchedFields = NOTIFICATION_SETTINGS_FIELDS.filter((field) => field in command);
    if (touchedFields.length === 0) return;

    const authorized = await this.repository.actorHasCapability(tenantId, actor, CAN_MANAGE_NOTIFICATIONS);
    if (!authorized) {
      throw new CommercialSettingsFieldCapabilityDeniedError(CAN_MANAGE_NOTIFICATIONS, touchedFields);
    }
  }
}
