import type { UserId } from '../../../kernel/ids/index.ts';
import type { AiDiagnosticsGateway } from './ai-diagnostics-gateway.ts';
import type { ClariprintDiagnosticsGateway } from './clariprint-diagnostics-gateway.ts';
import type { PlatformAdminGateway } from './platform-admin-gateway.ts';

/**
 * BCP-0c (docs/api/CONVENTIONS.md §8.25, point 2.3ter) — l acteur n est pas
 * administrateur de la plateforme (`is_super_admin()` faux). La route
 * retraduit ceci en 403 `identity.role_required`, SANS AUCUN appel sortant :
 * cette erreur est levee AVANT tout appel a `aiGateway`/`clariprintGateway`.
 */
export class DiagnosticsAccessDeniedError extends Error {
  constructor() {
    super('Ce diagnostic est reserve a l administrateur de la plateforme.');
    this.name = 'DiagnosticsAccessDeniedError';
  }
}

export class DiagnosticsService {
  constructor(
    private readonly aiGateway: AiDiagnosticsGateway,
    private readonly clariprintGateway: ClariprintDiagnosticsGateway,
    private readonly platformAdmin: PlatformAdminGateway,
  ) {}

  async aiProvider(actor: UserId) {
    await this.assertPlatformAdmin(actor);
    return this.aiGateway.testConnection();
  }

  async clariprint(actor: UserId) {
    await this.assertPlatformAdmin(actor);
    return this.clariprintGateway.testConnection();
  }

  /**
   * Garde d acces PUBLIQUE (methode nommee, pas un detail prive) : la route
   * peut l invoquer explicitement si elle a besoin de refuser avant toute
   * autre lecture, meme discipline que `PriceRulesService.assertCanManagePricing`
   * (`price-rules-service.ts`). Elle reste aussi appelee DANS `aiProvider()`/
   * `clariprint()` en defense en profondeur pour tout appelant direct du
   * service (tests unitaires notamment).
   */
  async assertPlatformAdmin(actor: UserId): Promise<void> {
    const authorized = await this.platformAdmin.isPlatformAdmin(actor);
    if (!authorized) throw new DiagnosticsAccessDeniedError();
  }
}
