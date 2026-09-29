import type { TenantId } from '../../../kernel/ids/index.ts';
import type {
  CommercialLineType,
  UploadCommercialLineFileCommand,
} from '../api/contracts.ts';
import type { CommercialLineFilesRepository } from './commercial-line-files-repository.ts';

export class CommercialLineFilesService {
  constructor(private readonly repository: CommercialLineFilesRepository) {}

  list(tenantId: TenantId, lineType: CommercialLineType, lineId: string) {
    return this.repository.list(tenantId, lineType, lineId);
  }

  getForRead(tenantId: TenantId, lineType: CommercialLineType, lineId: string, fileId: string) {
    return this.repository.getForRead(tenantId, lineType, lineId, fileId);
  }

  upload(tenantId: TenantId, lineType: CommercialLineType, lineId: string, command: UploadCommercialLineFileCommand) {
    return this.repository.upload(tenantId, lineType, lineId, command);
  }
}
