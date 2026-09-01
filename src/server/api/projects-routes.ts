/**
 * Routes HTTP du module Projets (story E10.1), sur la facade Gestion
 * commerciale (`defineGescomRoute`, E10.0).
 *
 * Ecriture reservee aux jetons utilisateur (`authentication: 'user'`) :
 * cette story n ouvre aucun scope d ecriture aux cles de service. Lecture
 * ouverte a Studio via `projects:read` (WM du 01/09 — Studio attend ce
 * contrat pour brancher son integration).
 *
 * Enregistrement obligatoire dans `gescom-routes.ts` (CA1) — sans quoi
 * `tests/architecture/gescom-api-socle-boundaries.test.ts` echoue.
 */
import {
  createProjectCommandSchema,
  createProjectItemCommandSchema,
  projectDetailSchema,
  projectItemSchema,
  projectSchema,
  projectsListSchema,
  projectStatusSchema,
  removeProjectItemResultSchema,
  updateProjectCommandSchema,
  type ProjectDetailDto,
  type ProjectDto,
} from '../../modules/projects/api/contracts.ts';
import type { ProjectsService } from '../../modules/projects/application/projects-service.ts';
import {
  ProjectCommandRejectedError,
  ProjectNotFoundError,
} from '../../modules/projects/application/projects-repository.ts';
import { uuidSchema } from '../../modules/_shared/api/index.ts';
import {
  assertPrecondition,
  buildPage,
  computeEntityTag,
  decodeCursor,
  problem,
  SHARED_PROBLEM_CODES,
} from '../../modules/_shared/application/index.ts';
import { defineGescomRoute, type GescomRoute, type GescomRequestContext } from './gescom-middleware.ts';

export function createProjectsRoutes(service: ProjectsService): readonly GescomRoute[] {
  return [
    defineGescomRoute({
      method: 'GET',
      path: '/projects',
      operationId: 'listProjects',
      requiredScopes: ['projects:read'],
      inputSchema: null,
      dataSchema: projectsListSchema,
      async handle(context) {
        const q = context.url.searchParams.get('q');
        // B4 (qa-review) : `customer_id` est type `Uuid` au contrat (400
        // attendu sur une valeur malformee). Sans cette validation, une
        // chaine arbitraire etait transmise telle quelle a Postgres, qui
        // levait une erreur non typee remontee en 500 `api.internal_error`.
        const customerIdParam = context.url.searchParams.get('customer_id');
        if (customerIdParam !== null && !uuidSchema.safeParse(customerIdParam).success) {
          throw problem({
            status: 400,
            title: 'Parametre invalide',
            code: SHARED_PROBLEM_CODES.validationFailed,
            detail: 'customer_id doit etre un UUID valide.',
            errors: [{ field: 'customer_id', message: 'UUID invalide.' }],
          });
        }
        const customerId = customerIdParam;
        // `tag_id` reserve E10.2 : accepte au contrat, jamais exploite ici.
        const statusParam = context.url.searchParams.get('status');
        const status = projectStatusSchema.safeParse(statusParam ?? undefined);
        const cursor = context.page.cursor ? decodeCursor(context.page.cursor) : null;

        const result = await service.list(context.tenantId, {
          q,
          customerId,
          status: status.success ? status.data : null,
          size: context.page.size,
          cursor,
        });
        const page = buildPage(result.rows, context.page, (row) => ({
          sort: row.updated_at,
          id: row.id,
        }));

        return {
          status: 200,
          data: page.items,
          meta: { next_cursor: page.nextCursor, page_size: context.page.size },
        };
      },
    }),

    defineGescomRoute({
      method: 'POST',
      path: '/projects',
      operationId: 'createProject',
      authentication: 'user',
      createsResource: true,
      inputSchema: createProjectCommandSchema,
      dataSchema: projectSchema,
      async handle(context, input) {
        return withDomainErrors(async () => ({
          status: 201,
          data: await service.create(context.tenantId, requireUserId(context), input),
        }));
      },
    }),

    defineGescomRoute({
      method: 'GET',
      path: '/projects/{projectId}',
      operationId: 'getProject',
      requiredScopes: ['projects:read'],
      inputSchema: null,
      dataSchema: projectDetailSchema,
      async handle(context) {
        return withDomainErrors(async () => {
          const detail = await service.getDetail(context.tenantId, context.params['projectId']!);
          // L ETag porte sur les champs PROPRES au projet (CA9), pas sur ses
          // elements : sans cette distinction, un If-Match lu ici ne
          // matcherait jamais celui verifie par `updateProject`.
          return { status: 200, data: detail, etag: await computeEntityTag(projectSummaryOf(detail)) };
        });
      },
    }),

    defineGescomRoute({
      method: 'PATCH',
      path: '/projects/{projectId}',
      operationId: 'updateProject',
      authentication: 'user',
      inputSchema: updateProjectCommandSchema,
      dataSchema: projectSchema,
      async handle(context, input) {
        return withDomainErrors(async () => {
          const projectId = context.params['projectId']!;
          const current = await service.getSummary(context.tenantId, projectId);
          const currentTag = await computeEntityTag(current);
          assertPrecondition(context.ifMatch, currentTag, current);

          const updated = await service.update(context.tenantId, projectId, input);
          return { status: 200, data: updated, etag: await computeEntityTag(updated) };
        });
      },
    }),

    defineGescomRoute({
      method: 'POST',
      path: '/projects/{projectId}/items',
      operationId: 'addProjectItem',
      authentication: 'user',
      createsResource: true,
      inputSchema: createProjectItemCommandSchema,
      dataSchema: projectItemSchema,
      async handle(context, input) {
        return withDomainErrors(async () => ({
          status: 201,
          data: await service.addItem(context.tenantId, context.params['projectId']!, input),
        }));
      },
    }),

    defineGescomRoute({
      method: 'DELETE',
      path: '/projects/{projectId}/items/{itemId}',
      operationId: 'removeProjectItem',
      authentication: 'user',
      inputSchema: null,
      dataSchema: removeProjectItemResultSchema,
      async handle(context) {
        return withDomainErrors(async () => {
          await service.removeItem(
            context.tenantId,
            context.params['projectId']!,
            context.params['itemId']!,
          );
          return { status: 200, data: { removed: true as const } };
        });
      },
    }),
  ];
}

/**
 * Sous-ensemble d un projet detaille correspondant a la ressource `Project`
 * (sans `items`). Utilise UNIQUEMENT pour la base de calcul de l ETag (CA9) :
 * `getProject` et `updateProject` doivent produire le meme hash pour le meme
 * etat, quelle que soit la forme du corps qu ils renvoient par ailleurs.
 */
function projectSummaryOf(detail: ProjectDetailDto): ProjectDto {
  const { items: _items, ...summary } = detail;
  return summary;
}

/** L identifiant utilisateur qui cree la ressource (audit `created_by`). */
function requireUserId(context: GescomRequestContext): import('../../kernel/ids/index.ts').UserId {
  if (context.principal.kind !== 'user') {
    // Ne devrait jamais arriver : la route est `authentication: 'user'`, donc
    // `assertUserPrincipal` a deja ecarte toute cle de service avant `handle`.
    throw problem({
      status: 403,
      title: 'Acteur utilisateur requis',
      code: SHARED_PROBLEM_CODES.actorKindRequired,
    });
  }
  return context.principal.userId;
}

/** Traduit les erreurs de domaine du module Projets en Problem RFC 7807. */
async function withDomainErrors<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof ProjectNotFoundError) {
      throw problem({ status: 404, title: 'Projet introuvable', code: SHARED_PROBLEM_CODES.notFound });
    }
    if (error instanceof ProjectCommandRejectedError) {
      throw problem({
        status: 422,
        title: 'Commande refusee',
        code: error.code,
        detail: error.message,
        ...(error.fieldErrors.length > 0 ? { errors: error.fieldErrors } : {}),
      });
    }
    throw error;
  }
}
