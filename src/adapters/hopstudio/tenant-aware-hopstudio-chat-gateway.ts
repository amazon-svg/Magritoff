import type {
  HopeStudioChatGateway,
  HopeStudioChatGatewayRequest,
} from '../../modules/hopstudio/application/hopstudio-chat-gateway.ts';
import { HopeStudioChatUnavailableError } from '../../modules/hopstudio/application/hopstudio-chat-gateway.ts';
import type { HopeStudioTraceSink } from '../../modules/hopstudio/application/hopstudio-chat-gateway.ts';
import {
  noopExternalServiceRequestRegistry,
  type ExternalServiceRequestRegistry,
} from '../../modules/external-services/application/external-service-request-registry.ts';
import type { HopeStudioTenantConnectionResolver } from '../../modules/hopstudio/application/hopstudio-tenant-connection.ts';
import { HttpHopeStudioChatGateway } from './http-hopstudio-chat-gateway.ts';

/**
 * Sélectionne la connexion après résolution de l identité serveur. Une instance
 * HTTP courte est volontaire : aucun secret tenant n est conservé dans un cache
 * partagé par plusieurs requêtes.
 */
export class TenantAwareHopeStudioChatGateway implements HopeStudioChatGateway {
  constructor(
    private readonly connections: HopeStudioTenantConnectionResolver,
    private readonly fetchImplementation: typeof fetch = globalThis.fetch,
    private readonly trace: HopeStudioTraceSink = () => {},
    private readonly registry: ExternalServiceRequestRegistry = noopExternalServiceRequestRegistry,
  ) {}

  async chat(request: HopeStudioChatGatewayRequest) {
    const connection = await this.connections.resolve(request.tenantId);
    if (!connection) {
      throw new HopeStudioChatUnavailableError(
        'HopeStudio n est pas configuré pour ce tenant.',
      );
    }
    if (connection.tenantId !== request.tenantId) {
      throw new HopeStudioChatUnavailableError(
        'La configuration HopeStudio résolue ne correspond pas au tenant authentifié.',
      );
    }

    this.trace({
      traceId: request.traceId ?? crypto.randomUUID(),
      stage: 'connection.resolved',
      endpoint: safeEndpoint(connection.hopeStudioUrl),
      tenantId: request.tenantId,
      hasClariprintCredentials: Boolean(connection.clariprint),
      hasClariprintUrl: Boolean(connection.clariprint?.url),
      hasApiToken: Boolean(connection.apiToken),
    });

    return new HttpHopeStudioChatGateway(
      connection,
      null,
      undefined,
      this.fetchImplementation,
      this.trace,
      this.registry,
    ).chat(request);
  }
}

function safeEndpoint(value: string): string {
  const url = new URL(value.includes('://') ? value : `https://${value}`);
  return `${url.origin}${url.pathname}`;
}
