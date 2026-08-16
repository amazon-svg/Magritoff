import { z } from 'zod';
import {
  activateStorefrontCredentialCommandSchema,
  issueStorefrontActivationCommandSchema,
  type ActivateStorefrontCredentialCommand,
  type IssueStorefrontActivationCommand,
  type IssueStorefrontActivationResult,
} from '../api/contracts.ts';
import type { StorefrontActivationEmailSender } from './storefront-activation-email-sender.ts';

export type StorefrontActivationIssue = Readonly<{
  token: string;
  customerEmail: string;
  customerName: string;
  shopName: string;
  shopSlug: string;
}>;

export interface StorefrontActivationGateway {
  issue(actorId: string, tenantId: string, shopId: string, accountId: string, expiresInSeconds: number): Promise<StorefrontActivationIssue | null>;
  activate(token: string, password: string): Promise<boolean>;
}

export class StorefrontActivationRejectedError extends Error {
  constructor(public readonly code: 'permission_denied' | 'activation_failed') {
    super(code === 'permission_denied' ? 'Activation interdite pour ce compte boutique.' : 'Lien d’activation invalide ou expiré.');
    this.name = 'StorefrontActivationRejectedError';
  }
}

export class StorefrontActivationService {
  constructor(
    private readonly gateway: StorefrontActivationGateway,
    private readonly emailSender: StorefrontActivationEmailSender,
  ) {}

  async issue(actorId: string, tenantId: string, shopId: string, accountId: string, input: IssueStorefrontActivationCommand, baseUrl: string): Promise<IssueStorefrontActivationResult> {
    const ids = z.object({ actorId: z.string().uuid(), tenantId: z.string().uuid(), shopId: z.string().uuid(), accountId: z.string().uuid() }).parse({ actorId, tenantId, shopId, accountId });
    const command = issueStorefrontActivationCommandSchema.parse(input);
    const issued = await this.gateway.issue(ids.actorId, ids.tenantId, ids.shopId, ids.accountId, command.expiresInSeconds);
    if (!issued) throw new StorefrontActivationRejectedError('permission_denied');
    const link = `${baseUrl.replace(/\/+$/, '')}/shop/${encodeURIComponent(issued.shopSlug)}/activate?token=${encodeURIComponent(issued.token)}`;
    const delivery = await this.emailSender.send({
      to: issued.customerEmail,
      customerName: issued.customerName,
      shopName: issued.shopName,
      link,
      expiresInSeconds: command.expiresInSeconds,
    });
    return {
      sent: delivery.sent,
      link,
      expiresInSeconds: command.expiresInSeconds,
      ...(delivery.reason ? { reason: delivery.reason.slice(0, 500) } : {}),
    };
  }

  async activate(input: ActivateStorefrontCredentialCommand): Promise<void> {
    const command = activateStorefrontCredentialCommandSchema.parse(input);
    if (!await this.gateway.activate(command.token, command.password)) {
      throw new StorefrontActivationRejectedError('activation_failed');
    }
  }
}
