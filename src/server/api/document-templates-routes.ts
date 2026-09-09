/**
 * Routes HTTP du module Gabarits PDF de documents (story E10.10b-4a), sur la
 * facade Gestion commerciale (`defineGescomRoute`, E10.0).
 *
 * Les SEPT operations de 4a (hors `fields`, 4b) : lecture (list/get) ouverte a
 * tout membre du tenant (contrat §8.18 §4 : "Ne conditionne PAS la LECTURE"),
 * ecriture (create/update/delete/upload-urls/uploads) gardee par le droit
 * metier `can_manage_document_templates`, verifiee par le SERVICE avant toute
 * lecture de la ressource courante — meme ordre que
 * `production-steps-routes.ts` (E10.13) : un acteur sans le droit ne doit pas
 * apprendre par la forme du refus (404/409) que sa commande aurait par
 * ailleurs ete acceptee.
 *
 * Enregistrement obligatoire dans `gescom-routes.ts` (CA1).
 */
import {
  confirmDocumentPdfTemplateUploadCommandSchema,
  createDocumentPdfTemplateCommandSchema,
  deleteDocumentPdfTemplateResultSchema,
  documentPdfTemplateCreatedSchema,
  documentPdfTemplateDetailSchema,
  documentPdfTemplateFieldMapSchema,
  documentPdfTemplatesListSchema,
  documentPdfTemplateStatusSchema,
  documentPdfTemplateUploadTicketSchema,
  documentTypeSchema,
  replaceDocumentPdfTemplateFieldsCommandSchema,
  updateDocumentPdfTemplateCommandSchema,
  type DocumentPdfTemplateDetailDto,
  type DocumentPdfTemplateFieldMapDto,
  type DocumentPdfTemplateStatus,
  type DocumentType,
} from '../../modules/document-templates/api/contracts.ts';
import type { DocumentTemplatesService } from '../../modules/document-templates/application/document-templates-service.ts';
import {
  DocumentPdfTemplateAccessDeniedError,
  DocumentPdfTemplateDefaultRequiresReadyError,
  DocumentPdfTemplateGeometryChangedError,
  DocumentPdfTemplateInUseError,
  DocumentPdfTemplateInvalidFieldMapError,
  DocumentPdfTemplateInvalidPdfError,
  DocumentPdfTemplateLimitReachedError,
  DocumentPdfTemplateNameConflictError,
  DocumentPdfTemplateNotFoundError,
  DocumentPdfTemplateUploadMissingError,
  DocumentPdfTemplateUploadRequiredError,
} from '../../modules/document-templates/application/document-templates-repository.ts';
import {
  assertPrecondition,
  computeEntityTag,
  problem,
  roleRequired,
  SHARED_PROBLEM_CODES,
  validationFailed,
} from '../../modules/_shared/application/index.ts';
import { defineGescomRoute, type GescomRoute, type GescomRequestContext } from './gescom-middleware.ts';

export function createDocumentTemplatesRoutes(service: DocumentTemplatesService): readonly GescomRoute[] {
  return [
    defineGescomRoute({
      method: 'GET',
      path: '/document-pdf-templates',
      operationId: 'listDocumentPdfTemplates',
      authentication: 'user',
      inputSchema: null,
      dataSchema: documentPdfTemplatesListSchema,
      async handle(context) {
        const documentType = parseDocumentType(context.url.searchParams.get('document_type'));
        const status = parseStatus(context.url.searchParams.get('status'));
        const templates = await service.list(context.tenantId, { documentType, status });
        // PAS DE PAGINATION, PAS D ETAG DE COLLECTION (contrat §8.18 : plafond
        // de 20 par tenant/type, aucune operation ne reecrit la collection en
        // tant que TOUT).
        return { status: 200, data: [...templates] };
      },
    }),

    defineGescomRoute({
      method: 'POST',
      path: '/document-pdf-templates',
      operationId: 'createDocumentPdfTemplate',
      authentication: 'user',
      createsResource: true,
      inputSchema: createDocumentPdfTemplateCommandSchema,
      dataSchema: documentPdfTemplateCreatedSchema,
      async handle(context, input) {
        return withDomainErrors(async () => {
          const actor = requireUserId(context);
          const created = await service.create(context.tenantId, actor, input);
          return { status: 201, data: created, etag: await templateEntityTag(created.template) };
        });
      },
    }),

    defineGescomRoute({
      method: 'GET',
      path: '/document-pdf-templates/{templateId}',
      operationId: 'getDocumentPdfTemplate',
      authentication: 'user',
      inputSchema: null,
      dataSchema: documentPdfTemplateDetailSchema,
      async handle(context) {
        return withDomainErrors(async () => {
          const template = await service.getById(context.tenantId, context.params['templateId']!);
          return { status: 200, data: template, etag: await templateEntityTag(template) };
        });
      },
    }),

    defineGescomRoute({
      method: 'PATCH',
      path: '/document-pdf-templates/{templateId}',
      operationId: 'updateDocumentPdfTemplate',
      authentication: 'user',
      inputSchema: updateDocumentPdfTemplateCommandSchema,
      dataSchema: documentPdfTemplateDetailSchema,
      async handle(context, input) {
        return withDomainErrors(async () => {
          const templateId = context.params['templateId']!;
          const actor = requireUserId(context);
          // La garde precede la lecture qui alimente l ETag (meme ordre que
          // `updateProductionStep`, qa-review E10.6/E10.13).
          await service.assertCanManageDocumentTemplates(context.tenantId, actor);

          const current = await service.getById(context.tenantId, templateId);
          const currentTag = await templateEntityTag(current);
          assertPrecondition(context.ifMatch, currentTag, current);

          const updated = await service.update(context.tenantId, actor, templateId, input);
          return { status: 200, data: updated, etag: await templateEntityTag(updated) };
        });
      },
    }),

    defineGescomRoute({
      method: 'DELETE',
      path: '/document-pdf-templates/{templateId}',
      operationId: 'deleteDocumentPdfTemplate',
      authentication: 'user',
      inputSchema: null,
      dataSchema: deleteDocumentPdfTemplateResultSchema,
      async handle(context) {
        return withDomainErrors(async () => {
          await service.remove(context.tenantId, requireUserId(context), context.params['templateId']!);
          return { status: 200, data: { deleted: true as const } };
        });
      },
    }),

    defineGescomRoute({
      method: 'POST',
      path: '/document-pdf-templates/{templateId}/upload-urls',
      operationId: 'issueDocumentPdfTemplateUploadUrl',
      authentication: 'user',
      // 200, PAS d Idempotency-Key (contrat : un billet d import n est pas
      // une ressource metier, le rejouer DOIT rendre un billet NEUF).
      inputSchema: null,
      dataSchema: documentPdfTemplateUploadTicketSchema,
      async handle(context) {
        return withDomainErrors(async () => {
          const ticket = await service.issueUploadUrl(
            context.tenantId,
            requireUserId(context),
            context.params['templateId']!,
          );
          return { status: 200, data: ticket };
        });
      },
    }),

    defineGescomRoute({
      method: 'POST',
      path: '/document-pdf-templates/{templateId}/uploads',
      operationId: 'confirmDocumentPdfTemplateUpload',
      authentication: 'user',
      createsResource: true,
      inputSchema: confirmDocumentPdfTemplateUploadCommandSchema,
      dataSchema: documentPdfTemplateDetailSchema,
      async handle(context, input) {
        return withDomainErrors(async () => {
          const confirmed = await service.confirmUpload(
            context.tenantId,
            requireUserId(context),
            context.params['templateId']!,
            input,
          );
          return { status: 201, data: confirmed, etag: await templateEntityTag(confirmed) };
        });
      },
    }),

    // ── E10.10b-4b — editeur de coordonnees ──────────────────────────────
    defineGescomRoute({
      method: 'GET',
      path: '/document-pdf-templates/{templateId}/fields',
      operationId: 'getDocumentPdfTemplateFields',
      // Lecture OUVERTE a tout membre du tenant, meme regle que le gabarit
      // lui-meme (contrat §8.18 §4 : "Ne conditionne PAS la LECTURE").
      authentication: 'user',
      inputSchema: null,
      dataSchema: documentPdfTemplateFieldMapSchema,
      async handle(context) {
        return withDomainErrors(async () => {
          const fields = await service.getFields(context.tenantId, context.params['templateId']!);
          return { status: 200, data: fields, etag: await fieldMapEntityTag(fields) };
        });
      },
    }),

    defineGescomRoute({
      method: 'PUT',
      path: '/document-pdf-templates/{templateId}/fields',
      operationId: 'replaceDocumentPdfTemplateFields',
      authentication: 'user',
      // Pas d option declarative de capability sur `defineGescomRoute` (le
      // socle E10 ne l offre que via `requiredScopes`, pour les cles de
      // service) : la garde `can_manage_document_templates` est verifiee
      // dans `handle()`, meme discipline que toutes les autres routes
      // d ecriture de ce module.
      inputSchema: replaceDocumentPdfTemplateFieldsCommandSchema,
      dataSchema: documentPdfTemplateFieldMapSchema,
      async handle(context, input) {
        return withDomainErrors(async () => {
          const templateId = context.params['templateId']!;
          const actor = requireUserId(context);
          // La garde precede la lecture qui alimente l `ETag` (meme ordre que
          // `updateDocumentPdfTemplate`/`reorderProductionSteps`).
          await service.assertCanManageDocumentTemplates(context.tenantId, actor);

          // L `ETag` de la carte est DISTINCT de celui du gabarit (contrat :
          // "meme parti que l ETag de collection de listProductionSteps") —
          // renommer/desactiver le gabarit ne doit jamais faire echouer un
          // `If-Match` pose sur sa carte de champs, et reciproquement.
          const current = await service.getFields(context.tenantId, templateId);
          const currentTag = await fieldMapEntityTag(current);
          assertPrecondition(context.ifMatch, currentTag, current);

          const updated = await service.replaceFields(context.tenantId, actor, templateId, input);
          return { status: 200, data: updated, etag: await fieldMapEntityTag(updated) };
        });
      },
    }),
  ];
}

/**
 * ETag calcule sur une projection STABLE du gabarit : `background_url` et
 * `background_url_expires_at` sont EXCLUS. Ce sont des URL signees rendues a
 * chaque lecture (nouveau jeton, nouvelle expiration a chaque appel,
 * `SupabaseDocumentTemplatesRepository.toDetailDto()`) — les inclure dans le
 * calcul ferait varier l ETag entre deux lectures de la MEME ressource,
 * inchangee, et casserait `If-Match` (le contrat le dit explicitement :
 * "L ETag valide LE GABARIT (nom, defaut, fichier importe)", pas ce que le
 * stockage a signe pour cette requete-ci). Trouve par le test de contrat
 * (bascule `is_default`), pas par relecture du contrat seule.
 */
async function templateEntityTag(template: DocumentPdfTemplateDetailDto): Promise<string> {
  const { background_url: _backgroundUrl, background_url_expires_at: _backgroundUrlExpiresAt, ...stable } = template;
  return computeEntityTag(stable);
}

/**
 * ETag DISTINCT de celui du gabarit (contrat, `getDocumentPdfTemplateFields`) :
 * la carte est REECRITE D UN BLOC (`replaceDocumentPdfTemplateFields`), donc
 * c est l ensemble qui est la ressource ecrite, et c est a l ensemble qu il
 * faut un validateur — meme parti que l ETag de collection de
 * `listProductionSteps`/`reorderProductionSteps`.
 */
async function fieldMapEntityTag(fieldMap: DocumentPdfTemplateFieldMapDto): Promise<string> {
  return computeEntityTag(fieldMap);
}

function parseDocumentType(raw: string | null): DocumentType | null {
  if (raw === null) return null;
  const parsed = documentTypeSchema.safeParse(raw);
  if (!parsed.success) {
    throw validationFailed([{ field: 'document_type', message: 'Valeur attendue : quote.' }]);
  }
  return parsed.data;
}

function parseStatus(raw: string | null): DocumentPdfTemplateStatus | null {
  if (raw === null) return null;
  const parsed = documentPdfTemplateStatusSchema.safeParse(raw);
  if (!parsed.success) {
    throw validationFailed([{ field: 'status', message: 'Valeur attendue : awaiting_upload ou ready.' }]);
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

/** Traduit les erreurs de domaine du module Gabarits PDF en Problem RFC 7807. */
async function withDomainErrors<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof DocumentPdfTemplateAccessDeniedError) {
      throw roleRequired(['can_manage_document_templates']);
    }
    if (error instanceof DocumentPdfTemplateNotFoundError) {
      throw problem({
        status: 404,
        title: 'Gabarit PDF introuvable',
        code: 'document_pdf_template.not_found',
      });
    }
    if (error instanceof DocumentPdfTemplateUploadMissingError) {
      throw problem({
        status: 404,
        title: 'Aucun fichier depose',
        code: 'document_pdf_template.upload_missing',
        detail: error.message,
      });
    }
    if (error instanceof DocumentPdfTemplateNameConflictError) {
      throw problem({
        status: 409,
        title: 'Nom deja utilise',
        code: 'document_pdf_template.name_conflict',
        detail: error.message,
      });
    }
    if (error instanceof DocumentPdfTemplateDefaultRequiresReadyError) {
      throw problem({
        status: 409,
        title: 'Gabarit non pret',
        code: 'document_pdf_template.default_requires_ready',
        detail: error.message,
      });
    }
    if (error instanceof DocumentPdfTemplateInUseError) {
      throw problem({
        status: 409,
        title: 'Gabarit encore utilise',
        code: 'document_pdf_template.in_use',
        detail: error.message,
      });
    }
    if (error instanceof DocumentPdfTemplateGeometryChangedError) {
      throw problem({
        status: 409,
        title: 'Geometrie modifiee',
        code: 'document_pdf_template.geometry_changed',
        detail: error.message,
      });
    }
    if (error instanceof DocumentPdfTemplateLimitReachedError) {
      throw problem({
        status: 422,
        title: 'Plafond atteint',
        code: 'document_pdf_template.limit_reached',
        detail: error.message,
      });
    }
    if (error instanceof DocumentPdfTemplateInvalidPdfError) {
      throw problem({
        status: 422,
        title: 'Fichier PDF invalide',
        code: 'document_pdf_template.invalid_pdf',
        detail: error.message,
      });
    }
    if (error instanceof DocumentPdfTemplateUploadRequiredError) {
      throw problem({
        status: 409,
        title: 'Gabarit non pret',
        code: 'document_pdf_template.upload_required',
        detail: error.message,
      });
    }
    if (error instanceof DocumentPdfTemplateInvalidFieldMapError) {
      throw problem({
        status: 422,
        title: 'Carte de champs invalide',
        code: 'document_pdf_template.invalid_field_map',
        detail: error.message,
        errors: error.errors,
      });
    }
    throw error;
  }
}
