import { API_V1_BASE_PATH, FetchApiClient } from '../../../platform/api/index.ts';
import {
  activateStorefrontCredentialCommandSchema,
  activateStorefrontCredentialResultSchema,
  createStorefrontSessionCommandSchema,
  createStorefrontSessionResultSchema,
  endStorefrontSessionResultSchema,
  type ActivateStorefrontCredentialCommand,
  type CreateStorefrontSessionCommand,
  type StorefrontSession,
} from './contracts.ts';

/** Façade publique storefront, volontairement séparée du client workspace. */
export class StorefrontIdentityApiClient {
  constructor(private readonly client: FetchApiClient) {}

  async authenticate(shopSlug: string, command: CreateStorefrontSessionCommand): Promise<StorefrontSession> {
    const result = await this.client.request({
      method: 'POST',
      path: `${API_V1_BASE_PATH}/storefront/${encodeURIComponent(shopSlug)}/session`,
      body: createStorefrontSessionCommandSchema.parse(command),
      responseSchema: createStorefrontSessionResultSchema,
    });
    return result.session;
  }

  async activate(command: ActivateStorefrontCredentialCommand): Promise<void> {
    await this.client.request({
      method: 'POST',
      path: `${API_V1_BASE_PATH}/storefront/activation`,
      body: activateStorefrontCredentialCommandSchema.parse(command),
      responseSchema: activateStorefrontCredentialResultSchema,
    });
  }

  async current(): Promise<StorefrontSession> {
    const result = await this.client.request({
      path: `${API_V1_BASE_PATH}/storefront/session/current`,
      responseSchema: createStorefrontSessionResultSchema,
    });
    return result.session;
  }

  async end(): Promise<void> {
    await this.client.request({
      method: 'DELETE',
      path: `${API_V1_BASE_PATH}/storefront/session/current`,
      responseSchema: endStorefrontSessionResultSchema,
    });
  }
}
