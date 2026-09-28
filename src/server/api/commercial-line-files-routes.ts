import {
  commercialLineFileDetailSchema,
  commercialLineFileSchema,
  commercialLineFilesListSchema,
  commercialLineTypeSchema,
  uploadCommercialLineFileCommandSchema,
} from '../../modules/commercial-line-files/api/contracts.ts';
import type { CommercialLineFilesService } from '../../modules/commercial-line-files/application/commercial-line-files-service.ts';
import { CommercialLineFileNotFoundError } from '../../modules/commercial-line-files/application/commercial-line-files-repository.ts';
import { uuidSchema } from '../../modules/_shared/api/index.ts';
import { problem, SHARED_PROBLEM_CODES } from '../../modules/_shared/application/index.ts';
import { defineGescomRoute, type GescomRoute, type GescomRequestContext } from './gescom-middleware.ts';

export function createCommercialLineFilesRoutes(service: CommercialLineFilesService): readonly GescomRoute[] {
  return [
    defineGescomRoute({
      method: 'GET',
      path: '/commercial-line-files/{lineType}/{lineId}',
      operationId: 'listCommercialLineFiles',
      authentication: 'user',
      inputSchema: null,
      dataSchema: commercialLineFilesListSchema,
      async handle(context) {
        const { lineType, lineId } = parseLine(context);
        return withFileErrors(async () => ({
          status: 200,
          data: await service.list(context.tenantId, lineType, lineId),
        }));
      },
    }),
    defineGescomRoute({
      method: 'POST',
      path: '/commercial-line-files/{lineType}/{lineId}',
      operationId: 'uploadCommercialLineFile',
      authentication: 'user',
      createsResource: true,
      inputSchema: uploadCommercialLineFileCommandSchema,
      dataSchema: commercialLineFileSchema,
      async handle(context, input) {
        const { lineType, lineId } = parseLine(context);
        return withFileErrors(async () => ({
          status: 201,
          data: await service.upload(context.tenantId, lineType, lineId, input),
        }));
      },
    }),
    defineGescomRoute({
      method: 'GET',
      path: '/commercial-line-files/{lineType}/{lineId}/{fileId}',
      operationId: 'getCommercialLineFile',
      authentication: 'user',
      inputSchema: null,
      dataSchema: commercialLineFileDetailSchema,
      async handle(context) {
        const { lineType, lineId } = parseLine(context);
        const fileId = uuidSchema.safeParse(context.params['fileId']);
        if (!fileId.success) throw invalidPath('fileId');
        return withFileErrors(async () => ({
          status: 200,
          data: await service.getForRead(context.tenantId, lineType, lineId, fileId.data),
        }));
      },
    }),
  ];
}

function parseLine(context: GescomRequestContext) {
  const lineType = commercialLineTypeSchema.safeParse(context.params['lineType']);
  const lineId = uuidSchema.safeParse(context.params['lineId']);
  if (!lineType.success) throw invalidPath('lineType');
  if (!lineId.success) throw invalidPath('lineId');
  return { lineType: lineType.data, lineId: lineId.data };
}

function invalidPath(field: string) {
  return problem({
    status: 400,
    title: 'Paramètre invalide',
    code: SHARED_PROBLEM_CODES.validationFailed,
    errors: [{ field, message: 'Valeur invalide.' }],
  });
}

async function withFileErrors<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof CommercialLineFileNotFoundError) {
      throw problem({ status: 404, title: 'Fichier introuvable', code: SHARED_PROBLEM_CODES.notFound });
    }
    throw error;
  }
}
