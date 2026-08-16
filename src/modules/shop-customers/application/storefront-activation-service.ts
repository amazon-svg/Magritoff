import { z } from 'zod';
import {
  activateStorefrontCredentialCommandSchema,
  issueStorefrontActivationCommandSchema,
  type ActivateStorefrontCredentialCommand,
  type IssueStorefrontActivationCommand,
  type IssueStorefrontActivationResult,
} from '../api/contracts.ts';

export interface StorefrontActivationGateway {
  issue(actorId: string, tenantId: string, shopId: string, accountId: string, expiresInSeconds: number): Promise<string | null>;
  activate(token: string, password: string): Promise<boolean>;
}

export class StorefrontActivationRejectedError extends Error {
  constructor(public readonly code: 'permission_denied' | 'activation_failed') {
    super(code === 'permission_denied' ? 'Activation interdite pour ce compte boutique.' : 'Lien d’activation invalide ou expiré.');
    this.name = 'StorefrontActivationRejectedError';
  }
}

export class StorefrontActivationService {
  constructor(private readonly gateway: StorefrontActivationGateway) {}

  async issue(actorId: string, tenantId: string, shopId: string, accountId: string, input: IssueStorefrontActivationCommand): Promise<IssueStorefrontActivationResult> {
    const ids = z.object({ actorId: z.string().uuid(), tenantId: z.string().uuid(), shopId: z.string().uuid(), accountId: z.string().uuid() }).parse({ actorId, tenantId, shopId, accountId });
    const command = issueStorefrontActivationCommandSchema.parse(input);
    const token = await this.gateway.issue(ids.actorId, ids.tenantId, ids.shopId, ids.accountId, command.expiresInSeconds);
    if (!token) throw new StorefrontActivationRejectedError('permission_denied');
    return { activationToken: token, expiresInSeconds: command.expiresInSeconds };
  }

  async activate(input: ActivateStorefrontCredentialCommand): Promise<void> {
    const command = activateStorefrontCredentialCommandSchema.parse(input);
    if (!await this.gateway.activate(command.token, command.password)) {
      throw new StorefrontActivationRejectedError('activation_failed');
    }
  }
}
