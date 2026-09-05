/**
 * Routes HTTP du module Tags de projet (story E10.2), sur la facade Gestion
 * commerciale (`defineGescomRoute`, E10.0).
 *
 * Ecriture (creation, suppression) reservee aux jetons utilisateur
 * (`authentication: 'user'`), meme choix que Clients (E10.4) et Projets
 * (E10.1) : cette story n ouvre aucun scope d ecriture aux cles de service.
 * Lecture ouverte a Studio via `project-tags:read`.
 *
 * Enregistrement obligatoire dans `gescom-routes.ts` (CA1) — sans quoi
 * `tests/architecture/gescom-api-socle-boundaries.test.ts` echoue.
 */
import {
  createProjectTagCommandSchema,
  deleteProjectTagResultSchema,
  projectTagSchema,
  projectTagsListSchema,
} from '../../modules/project-tags/api/contracts.ts';
import type { ProjectTagsService } from '../../modules/project-tags/application/project-tags-service.ts';
import {
  ProjectTagCommandRejectedError,
  ProjectTagNotFoundError,
} from '../../modules/project-tags/application/project-tags-repository.ts';
import { problem, SHARED_PROBLEM_CODES } from '../../modules/_shared/application/index.ts';
import { defineGescomRoute, type GescomRoute } from './gescom-middleware.ts';

export function createProjectTagsRoutes(service: ProjectTagsService): readonly GescomRoute[] {
  return [
    defineGescomRoute({
      method: 'GET',
      path: '/project-tags',
      operationId: 'listProjectTags',
      requiredScopes: ['project-tags:read'],
      inputSchema: null,
      dataSchema: projectTagsListSchema,
      async handle(context) {
        const q = context.url.searchParams.get('q');
        const tags = await service.list(context.tenantId, { q });
        return { status: 200, data: tags };
      },
    }),

    defineGescomRoute({
      method: 'POST',
      path: '/project-tags',
      operationId: 'createProjectTag',
      authentication: 'user',
      createsResource: true,
      inputSchema: createProjectTagCommandSchema,
      dataSchema: projectTagSchema,
      async handle(context, input) {
        return withDomainErrors(async () => {
          const { tag, created } = await service.create(context.tenantId, input);
          // CA2 : 201 sur une creation reelle, 200 quand le libelle
          // normalise existait deja — PAS un 409, ce n est pas un conflit.
          return { status: created ? 201 : 200, data: tag };
        });
      },
    }),

    defineGescomRoute({
      method: 'DELETE',
      path: '/project-tags/{tagId}',
      operationId: 'deleteProjectTag',
      authentication: 'user',
      inputSchema: null,
      dataSchema: deleteProjectTagResultSchema,
      async handle(context) {
        return withDomainErrors(async () => {
          await service.delete(context.tenantId, context.params['tagId']!);
          return { status: 200, data: { deleted: true as const } };
        });
      },
    }),
  ];
}

/** Traduit les erreurs de domaine du module Tags de projet en Problem RFC 7807. */
async function withDomainErrors<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof ProjectTagNotFoundError) {
      throw problem({ status: 404, title: 'Tag introuvable', code: SHARED_PROBLEM_CODES.notFound });
    }
    if (error instanceof ProjectTagCommandRejectedError) {
      const CONFLICT_CODES = new Set(['project_tag.in_use', 'project_tag.label_already_used']);
      throw problem({
        status: CONFLICT_CODES.has(error.code) ? 409 : 422,
        title: 'Commande refusée',
        code: error.code,
        detail: error.message,
        ...(error.fieldErrors.length > 0 ? { errors: error.fieldErrors } : {}),
      });
    }
    throw error;
  }
}
