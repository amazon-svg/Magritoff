import type { TenantId } from '../../../kernel/ids/index.ts';
import type {
  CommercialLineFileDetailDto,
  CommercialLineFileDto,
  CommercialLineType,
  UploadCommercialLineFileCommand,
} from '../api/contracts.ts';

export class CommercialLineFileNotFoundError extends Error {
  constructor() {
    super('Fichier ou ligne commerciale introuvable dans cet espace.');
    this.name = 'CommercialLineFileNotFoundError';
  }
}

export interface CommercialLineFilesRepository {
  list(tenantId: TenantId, lineType: CommercialLineType, lineId: string): Promise<readonly CommercialLineFileDto[]>;
  getForRead(tenantId: TenantId, lineType: CommercialLineType, lineId: string, fileId: string): Promise<CommercialLineFileDetailDto>;
  upload(tenantId: TenantId, lineType: CommercialLineType, lineId: string, command: UploadCommercialLineFileCommand): Promise<CommercialLineFileDto>;
}
