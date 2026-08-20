import { API_V1_BASE_PATH, FetchApiClient } from '../../../platform/api/index.ts';
import {
  createStorefrontRegistrationCommandSchema,
  createStorefrontRegistrationResultSchema,
  activateStorefrontCredentialCommandSchema,
  activateStorefrontCredentialResultSchema,
  createStorefrontSessionCommandSchema,
  createStorefrontSessionResultSchema,
  endStorefrontSessionResultSchema,
  requestStorefrontPasswordRecoveryCommandSchema,
  requestStorefrontPasswordRecoveryResultSchema,
  resetStorefrontPasswordCommandSchema,
  resetStorefrontPasswordResultSchema,
  type ActivateStorefrontCredentialCommand,
  type CreateStorefrontRegistrationCommand,
  type CreateStorefrontSessionCommand,
  type StorefrontSession,
  type RequestStorefrontPasswordRecoveryCommand,
  type ResetStorefrontPasswordCommand,
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

  async register(shopSlug: string, command: CreateStorefrontRegistrationCommand): Promise<StorefrontSession> {
    const result = await this.client.request({
      method: 'POST',
      path: `${API_V1_BASE_PATH}/storefront/${encodeURIComponent(shopSlug)}/registration`,
      body: createStorefrontRegistrationCommandSchema.parse(command),
      responseSchema: createStorefrontRegistrationResultSchema,
    });
    return result.session;
  }

  async activate(command: ActivateStorefrontCredentialCommand): Promise<StorefrontSession> {
    const result = await this.client.request({
      method: 'POST',
      path: `${API_V1_BASE_PATH}/storefront/activation`,
      body: activateStorefrontCredentialCommandSchema.parse(command),
      responseSchema: activateStorefrontCredentialResultSchema,
    });
    return result.session;
  }

  async requestPasswordRecovery(shopSlug: string, command: RequestStorefrontPasswordRecoveryCommand): Promise<void> {
    await this.client.request({ method: 'POST', path: `${API_V1_BASE_PATH}/storefront/${encodeURIComponent(shopSlug)}/password-recovery`, body: requestStorefrontPasswordRecoveryCommandSchema.parse(command), responseSchema: requestStorefrontPasswordRecoveryResultSchema });
  }

  async resetPassword(command: ResetStorefrontPasswordCommand): Promise<void> {
    await this.client.request({ method: 'POST', path: `${API_V1_BASE_PATH}/storefront/password-reset`, body: resetStorefrontPasswordCommandSchema.parse(command), responseSchema: resetStorefrontPasswordResultSchema });
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
