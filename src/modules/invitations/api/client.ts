import { API_V1_BASE_PATH, FetchApiClient } from '../../../platform/api/index.ts';
import {
  createInvitationCommandSchema,
  createInvitationResultSchema,
  type CreateInvitationCommand,
  type CreateInvitationResult,
} from './contracts.ts';

export class InvitationsApiClient {
  constructor(private readonly client: FetchApiClient) {}

  create(command: CreateInvitationCommand): Promise<CreateInvitationResult> {
    return this.client.request({
      method: 'POST',
      path: `${API_V1_BASE_PATH}/invitations`,
      body: createInvitationCommandSchema.parse(command),
      responseSchema: createInvitationResultSchema,
    });
  }
}
