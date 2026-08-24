import { API_V1_BASE_PATH, FetchApiClient } from '../../../platform/api/index.ts';
import {
  createInvitationCommandSchema,
  createInvitationResultSchema,
  invitationOptionsSchema,
  invitationActivationSchema,
  pendingInvitationsSchema,
  resendInvitationCommandSchema,
  resendInvitationResultSchema,
  revokeInvitationResultSchema,
  type CreateInvitationCommand,
  type CreateInvitationResult,
  type InvitationOptions,
  type InvitationActivation,
  type PendingInvitation,
  type ResendInvitationResult,
} from './contracts.ts';

export class InvitationsApiClient {
  constructor(private readonly client: FetchApiClient) {}

  activation(token: string): Promise<InvitationActivation> {
    return this.client.request({
      path: `${API_V1_BASE_PATH}/invitations/${encodeURIComponent(token)}/activation`,
      responseSchema: invitationActivationSchema,
    });
  }

  create(command: CreateInvitationCommand): Promise<CreateInvitationResult> {
    return this.client.request({
      method: 'POST',
      path: `${API_V1_BASE_PATH}/invitations`,
      body: createInvitationCommandSchema.parse(command),
      responseSchema: createInvitationResultSchema,
    });
  }

  options(tenantId: string): Promise<InvitationOptions> {
    return this.client.request({ path: `${API_V1_BASE_PATH}/tenants/${tenantId}/invitation-options`, responseSchema: invitationOptionsSchema });
  }

  pending(tenantId: string): Promise<PendingInvitation[]> {
    return this.client.request({ path: `${API_V1_BASE_PATH}/tenants/${tenantId}/invitations`, responseSchema: pendingInvitationsSchema });
  }

  resend(invitationId: string, baseUrl: string): Promise<ResendInvitationResult> {
    return this.client.request({
      method: 'POST', path: `${API_V1_BASE_PATH}/invitations/${invitationId}/resend`,
      body: resendInvitationCommandSchema.parse({ baseUrl }), responseSchema: resendInvitationResultSchema,
    });
  }

  revoke(invitationId: string): Promise<void> {
    return this.client.request({
      method: 'DELETE', path: `${API_V1_BASE_PATH}/invitations/${invitationId}`,
      responseSchema: revokeInvitationResultSchema,
    }).then(() => undefined);
  }
}
