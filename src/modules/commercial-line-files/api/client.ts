import { successEnvelopeSchema } from '../../_shared/api/index.ts';
import { API_V1_BASE_PATH, FetchApiClient } from '../../../platform/api/index.ts';
import {
  commercialLineFileDetailSchema,
  commercialLineFileSchema,
  commercialLineFilesListSchema,
  uploadCommercialLineFileCommandSchema,
  type CommercialLineFileDetailDto,
  type CommercialLineFileDto,
  type CommercialLineType,
  type UploadCommercialLineFileCommand,
} from './contracts.ts';

const BASE_PATH = `${API_V1_BASE_PATH}/commercial-line-files`;

export class CommercialLineFilesApiClient {
  constructor(private readonly client: FetchApiClient) {}

  async list(lineType: CommercialLineType, lineId: string): Promise<readonly CommercialLineFileDto[]> {
    const envelope = await this.client.request({
      path: `${BASE_PATH}/${lineType}/${lineId}`,
      responseSchema: successEnvelopeSchema(commercialLineFilesListSchema),
    });
    return envelope.data;
  }

  async upload(
    lineType: CommercialLineType,
    lineId: string,
    command: UploadCommercialLineFileCommand,
  ): Promise<CommercialLineFileDto> {
    const envelope = await this.client.request({
      method: 'POST',
      path: `${BASE_PATH}/${lineType}/${lineId}`,
      headers: { 'Idempotency-Key': crypto.randomUUID() },
      body: uploadCommercialLineFileCommandSchema.parse(command),
      responseSchema: successEnvelopeSchema(commercialLineFileSchema),
    });
    return envelope.data;
  }

  async getForRead(
    lineType: CommercialLineType,
    lineId: string,
    fileId: string,
  ): Promise<CommercialLineFileDetailDto> {
    const envelope = await this.client.request({
      path: `${BASE_PATH}/${lineType}/${lineId}/${fileId}`,
      responseSchema: successEnvelopeSchema(commercialLineFileDetailSchema),
    });
    return envelope.data;
  }
}
