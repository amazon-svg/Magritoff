import { API_V1_BASE_PATH, FetchApiClient } from '../../../platform/api/index.ts';
import {
  activateStorefrontCredentialCommandSchema,
  activateStorefrontCredentialResultSchema,
  type ActivateStorefrontCredentialCommand,
} from './contracts.ts';

/** Façade publique storefront, volontairement séparée du client workspace. */
export class StorefrontIdentityApiClient {
  constructor(private readonly client: FetchApiClient) {}

  async activate(command: ActivateStorefrontCredentialCommand): Promise<void> {
    await this.client.request({
      method: 'POST',
      path: `${API_V1_BASE_PATH}/storefront/activation`,
      body: activateStorefrontCredentialCommandSchema.parse(command),
      responseSchema: activateStorefrontCredentialResultSchema,
    });
  }
}
