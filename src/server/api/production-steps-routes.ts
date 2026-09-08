/**
 * Routes HTTP du module Etapes de production (story E10.13), sur la facade
 * Gestion commerciale (`defineGescomRoute`, E10.0).
 *
 * Lecture ouverte aux jetons utilisateur ET aux cles de service portant
 * `orders:read` (deja publie, aucun scope neuf) : le catalogue est le
 * vocabulaire commun du suivi de commande. Ecriture (POST/PATCH/PUT/DELETE)
 * reservee aux jetons utilisateur, gardee par le droit metier
 * `can_manage_production_steps` (contrat, decision #9) — verifiee AVANT toute
 * lecture de la ressource courante, meme ordre que `price-rules-routes.ts`
 * (E10.6/E10.11) : un acteur sans le droit ne doit pas apprendre par la forme
 * du refus (404/409) que sa commande aurait par ailleurs ete acceptee.
 *
 * Enregistrement obligatoire dans `gescom-routes.ts` (CA1).
 */
import {
  createProductionStepCommandSchema,
  deleteProductionStepResultSchema,
  productionStepSchema,
  productionStepsListSchema,
  productionStepStatusFilterSchema,
  reorderProductionStepsCommandSchema,
  updateProductionStepCommandSchema,
} from '../../modules/production-steps/api/contracts.ts';
import type { ProductionStepStatusFilter } from '../../modules/production-steps/api/contracts.ts';
import type { ProductionStepsService } from '../../modules/production-steps/application/production-steps-service.ts';
import {
  ProductionStepAccessDeniedError,
  ProductionStepInUseError,
  ProductionStepLabelConflictError,
  ProductionStepLimitReachedError,
  ProductionStepNotFoundError,
  ProductionStepPositionsMismatchError,
} from '../../modules/production-steps/application/production-steps-repository.ts';
import {
  assertPrecondition,
  computeEntityTag,
  problem,
  roleRequired,
  SHARED_PROBLEM_CODES,
  validationFailed,
} from '../../modules/_shared/application/index.ts';
import { defineGescomRoute, type GescomRoute, type GescomRequestContext } from './gescom-middleware.ts';

export function createProductionStepsRoutes(service: ProductionStepsService): readonly GescomRoute[] {
  return [
    defineGescomRoute({
      method: 'GET',
      path: '/production-steps',
      operationId: 'listProductionSteps',
      requiredScopes: ['orders:read'],
      inputSchema: null,
      dataSchema: productionStepsListSchema,
      async handle(context) {
        const status = parseStatus(context.url.searchParams.get('status'));
        const { all, filtered } = await service.list(context.tenantId, status);
        // L `ETag` porte TOUJOURS sur le catalogue COMPLET (decision #7 du
        // contrat) : meme quand `status` a filtre la reponse rendue en
        // `data`, la valeur qui se repasse dans l `If-Match` de
        // `reorderProductionSteps` doit valider l ensemble, pas la projection.
        return { status: 200, data: filtered, etag: await computeEntityTag(all) };
      },
    }),

    defineGescomRoute({
      method: 'POST',
      path: '/production-steps',
      operationId: 'createProductionStep',
      authentication: 'user',
      createsResource: true,
      inputSchema: createProductionStepCommandSchema,
      dataSchema: productionStepSchema,
      async handle(context, input) {
        return withDomainErrors(async () => {
          const created = await service.create(context.tenantId, requireUserId(context), input);
          return { status: 201, data: created, etag: await computeEntityTag(created) };
        });
      },
    }),

    defineGescomRoute({
      method: 'GET',
      path: '/production-steps/{stepId}',
      operationId: 'getProductionStep',
      requiredScopes: ['orders:read'],
      inputSchema: null,
      dataSchema: productionStepSchema,
      async handle(context) {
        return withDomainErrors(async () => {
          const step = await service.getById(context.tenantId, context.params['stepId']!);
          return { status: 200, data: step, etag: await computeEntityTag(step) };
        });
      },
    }),

    defineGescomRoute({
      method: 'PATCH',
      path: '/production-steps/{stepId}',
      operationId: 'updateProductionStep',
      authentication: 'user',
      inputSchema: updateProductionStepCommandSchema,
      dataSchema: productionStepSchema,
      async handle(context, input) {
        return withDomainErrors(async () => {
          const stepId = context.params['stepId']!;
          const actor = requireUserId(context);
          // La garde precede la lecture qui alimente l `ETag` (meme ordre que
          // `updatePriceRule`, qa-review E10.6 round 2 R3).
          await service.assertCanManageProductionSteps(context.tenantId, actor);

          const current = await service.getById(context.tenantId, stepId);
          const currentTag = await computeEntityTag(current);
          assertPrecondition(context.ifMatch, currentTag, current);

          const updated = await service.update(context.tenantId, actor, stepId, input);
          return { status: 200, data: updated, etag: await computeEntityTag(updated) };
        });
      },
    }),

    defineGescomRoute({
      method: 'DELETE',
      path: '/production-steps/{stepId}',
      operationId: 'deleteProductionStep',
      authentication: 'user',
      inputSchema: null,
      dataSchema: deleteProductionStepResultSchema,
      async handle(context) {
        return withDomainErrors(async () => {
          await service.remove(context.tenantId, requireUserId(context), context.params['stepId']!);
          return { status: 200, data: { deleted: true as const } };
        });
      },
    }),

    defineGescomRoute({
      method: 'PUT',
      path: '/production-step-positions',
      operationId: 'reorderProductionSteps',
      authentication: 'user',
      inputSchema: reorderProductionStepsCommandSchema,
      dataSchema: productionStepsListSchema,
      async handle(context, input) {
        return withDomainErrors(async () => {
          const actor = requireUserId(context);
          await service.assertCanManageProductionSteps(context.tenantId, actor);

          // `If-Match` porte sur LE CATALOGUE (`listProductionSteps`), jamais
          // celui d une etape isolee (decision #6/#7 du contrat) : la lecture
          // prealable ci-dessous EST le catalogue complet, non filtre.
          const { all: current } = await service.list(context.tenantId, null);
          const currentTag = await computeEntityTag(current);
          // `current_state` du contrat partage (`Problem.current_state`) est
          // un OBJET, jamais un tableau au premier niveau : le catalogue est
          // donc porte sous une cle `steps`.
          assertPrecondition(context.ifMatch, currentTag, { steps: current });

          const reordered = await service.reorder(context.tenantId, actor, input.step_ids);
          return { status: 200, data: reordered, etag: await computeEntityTag(reordered) };
        });
      },
    }),
  ];
}

function parseStatus(raw: string | null): ProductionStepStatusFilter | null {
  if (raw === null) return null;
  const parsed = productionStepStatusFilterSchema.safeParse(raw);
  if (!parsed.success) {
    throw validationFailed([{ field: 'status', message: 'Valeur attendue : active ou disabled.' }]);
  }
  return parsed.data;
}

/** L identifiant utilisateur qui ecrit la ressource (audit `created_by` implicite via `auth.uid()` cote base). */
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

/** Traduit les erreurs de domaine du module Etapes de production en Problem RFC 7807. */
async function withDomainErrors<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof ProductionStepAccessDeniedError) {
      throw roleRequired(['can_manage_production_steps']);
    }
    if (error instanceof ProductionStepNotFoundError) {
      throw problem({
        status: 404,
        title: 'Étape de production introuvable',
        code: 'production_step.not_found',
      });
    }
    if (error instanceof ProductionStepLabelConflictError) {
      throw problem({
        status: 409,
        title: 'Libellé déjà utilisé',
        code: 'production_step.label_conflict',
        detail: error.message,
      });
    }
    if (error instanceof ProductionStepInUseError) {
      throw problem({
        status: 409,
        title: 'Étape encore utilisée',
        code: 'production_step.in_use',
        detail: error.message,
      });
    }
    if (error instanceof ProductionStepLimitReachedError) {
      throw problem({
        status: 422,
        title: 'Plafond atteint',
        code: 'production_step.limit_reached',
        detail: error.message,
      });
    }
    if (error instanceof ProductionStepPositionsMismatchError) {
      throw problem({
        status: 422,
        title: 'Ensemble incomplet',
        code: 'production_step.positions_mismatch',
        detail: error.message,
      });
    }
    throw error;
  }
}
