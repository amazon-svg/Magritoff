import type { UserId } from '../../../kernel/ids/index.ts';
import {
  createShopCustomerCommandSchema,
  normalizeShopCustomerEmail,
  type CreateShopCustomerCommand,
  type EnsureSelfShopCustomerResult,
  type LegacyShopCustomerMigrationReportRow,
  type ShopCustomerAccount,
} from '../api/contracts.ts';
import {
  ShopCustomerRejectedError,
  type ShopCustomersRepository,
} from './shop-customers-repository.ts';

export class ShopCustomersService {
  constructor(private readonly repository: ShopCustomersRepository) {}

  migrationReport(actor: UserId, tenantId: string): Promise<LegacyShopCustomerMigrationReportRow[]> {
    return this.repository.migrationReport(actor, tenantId);
  }

  list(actor: UserId, tenantId: string, shopId: string): Promise<ShopCustomerAccount[]> {
    return this.repository.list(actor, tenantId, shopId);
  }

  async create(
    actor: UserId,
    tenantId: string,
    shopId: string,
    input: CreateShopCustomerCommand,
  ): Promise<ShopCustomerAccount> {
    const command = createShopCustomerCommandSchema.parse(input);
    const normalizedEmail = normalizeShopCustomerEmail(command.email);
    const existing = await this.repository.findByNormalizedEmail(
      actor,
      tenantId,
      shopId,
      normalizedEmail,
    );
    if (existing) {
      throw new ShopCustomerRejectedError(
        'duplicate_email',
        'Un compte existe déjà pour cet email dans cette boutique.',
      );
    }

    return this.repository.create(actor, tenantId, shopId, {
      email: command.email.trim(),
      normalizedEmail,
      fullName: command.fullName,
      status: command.initialStatus,
      createdByMagritUserId: actor,
    });
  }

  ensureSelf(actor: UserId, tenantId: string, shopId: string): Promise<EnsureSelfShopCustomerResult> {
    return this.repository.ensureSelf(actor, tenantId, shopId);
  }
}
