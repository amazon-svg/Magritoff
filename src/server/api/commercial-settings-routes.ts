/**
 * Routes HTTP du module Reglages commerciaux (E10.10a), sur la facade
 * Gestion commerciale (`defineGescomRoute`, E10.0).
 *
 * `GET` ouvert a tout membre de l espace (aucune garde, aucun scope de cle de
 * service — reserve aux jetons utilisateur comme le reste du module) ;
 * `PATCH` exige le droit `can_manage_pricing` (E10.11), verifie par le
 * SERVICE (§8.12, decision « meme mecanisme applicatif que les autres sites »)
 * plutot que par un champ declaratif de la facade.
 *
 * Enregistrement obligatoire dans `gescom-routes.ts` (CA1).
 */
import {
  commercialSettingsSchema,
  updateCommercialSettingsCommandSchema,
} from '../../modules/commercial-settings/api/contracts.ts';
import type { CommercialSettingsService } from '../../modules/commercial-settings/application/commercial-settings-service.ts';
import { CommercialSettingsAccessDeniedError } from '../../modules/commercial-settings/application/commercial-settings-repository.ts';
import {
  assertPrecondition,
  computeEntityTag,
  problem,
  roleRequired,
  SHARED_PROBLEM_CODES,
} from '../../modules/_shared/application/index.ts';
import { defineGescomRoute, type GescomRoute, type GescomRequestContext } from './gescom-middleware.ts';

export function createCommercialSettingsRoutes(
  service: CommercialSettingsService,
): readonly GescomRoute[] {
  return [
    defineGescomRoute({
      method: 'GET',
      path: '/commercial-settings',
      operationId: 'getCommercialSettings',
      authentication: 'user',
      inputSchema: null,
      dataSchema: commercialSettingsSchema,
      async handle(context) {
        const settings = await service.get(context.tenantId);
        return { status: 200, data: settings, etag: await computeEntityTag(settings) };
      },
    }),

    defineGescomRoute({
      method: 'PATCH',
      path: '/commercial-settings',
      operationId: 'updateCommercialSettings',
      authentication: 'user',
      inputSchema: updateCommercialSettingsCommandSchema,
      dataSchema: commercialSettingsSchema,
      async handle(context, input) {
        return withDomainErrors(async () => {
          const actor = requireUserId(context);
          // qa-review E10.10a round 1 (R1), meme correctif que price-rules-
          // routes.ts (round 2, R3) : la garde can_manage_pricing est posee
          // AVANT toute lecture de la ressource, pour que le refus 403 sorte
          // toujours avant un eventuel 409 (`assertPrecondition`) — l ordre
          // promis par `CommercialSettingsService.assertCanManagePricing()`.
          await service.assertCanManagePricing(context.tenantId, actor);

          const current = await service.get(context.tenantId);
          const currentTag = await computeEntityTag(current);
          assertPrecondition(context.ifMatch, currentTag, current);

          const updated = await service.update(context.tenantId, actor, input);
          return { status: 200, data: updated, etag: await computeEntityTag(updated) };
        });
      },
    }),
  ];
}

function requireUserId(context: GescomRequestContext): import('../../kernel/ids/index.ts').UserId {
  if (context.principal.kind !== 'user') {
    throw problem({
      status: 403,
      title: 'Acteur utilisateur requis',
      code: SHARED_PROBLEM_CODES.actorKindRequired,
    });
  }
  return context.principal.userId;
}

async function withDomainErrors<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof CommercialSettingsAccessDeniedError) {
      throw roleRequired(['can_manage_pricing']);
    }
    throw error;
  }
}
