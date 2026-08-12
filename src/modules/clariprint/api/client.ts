import { API_V1_BASE_PATH, FetchApiClient } from '../../../platform/api/index.ts';
import { clariprintQuoteCommandSchema, clariprintQuoteResultSchema, type ClariprintQuoteCommand, type ClariprintQuoteResult } from './contracts.ts';

export class ClariprintApiClient {
  constructor(private readonly client: FetchApiClient) {}
  quote(command: ClariprintQuoteCommand, signal?: AbortSignal): Promise<ClariprintQuoteResult> {
    return this.client.request({
      method: 'POST',
      path: `${API_V1_BASE_PATH}/clariprint/quote`,
      body: clariprintQuoteCommandSchema.parse(command),
      responseSchema: clariprintQuoteResultSchema,
      ...(signal === undefined ? {} : { signal }),
    });
  }
}
