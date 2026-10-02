import type { TenantId, UserId } from '../../kernel/ids/index.ts';
import { toIsoTimestamp } from '../../modules/_shared/application/index.ts';
import type { CreateProductionStepCommand, ProductionStepColor, ProductionStepDto, UpdateProductionStepCommand } from '../../modules/production-steps/api/contracts.ts';
import {
  ProductionStepInUseError,
  ProductionStepLabelConflictError,
  ProductionStepLimitReachedError,
  ProductionStepNotFoundError,
  ProductionStepPositionsMismatchError,
  type ListProductionStepsResult,
  type ProductionStepsRepository,
} from '../../modules/production-steps/application/production-steps-repository.ts';
import type { PostgresTransactionRunner } from './transaction-runner.ts';

type StepRow = Readonly<{
  id: string; tenant_id: string; label: string; position: number; color: ProductionStepColor;
  is_terminal: boolean; is_active: boolean; created_at: Date; updated_at: Date;
}>;

export class PostgresProductionStepsRepository implements ProductionStepsRepository {
  constructor(private readonly transactions: PostgresTransactionRunner) {}

  list(tenantId: TenantId): Promise<ListProductionStepsResult> {
    return this.transactions.run({ tenantId }, async (client) => {
      const result = await client.query<StepRow>(
        'select * from public.production_steps where tenant_id = $1 order by position',
        [tenantId],
      );
      return { all: result.rows.map(toDto) };
    });
  }

  findById(tenantId: TenantId, stepId: string): Promise<ProductionStepDto | null> {
    return this.transactions.run({ tenantId }, async (client) => {
      const result = await client.query<StepRow>(
        'select * from public.production_steps where tenant_id = $1 and id = $2',
        [tenantId, stepId],
      );
      return result.rows[0] === undefined ? null : toDto(result.rows[0]);
    });
  }

  async create(tenantId: TenantId, actor: UserId, command: CreateProductionStepCommand): Promise<ProductionStepDto> {
    try {
      return await this.transactions.run({ tenantId, userId: actor }, async (client) => {
        const result = await client.query<StepRow>(
          'select * from magrit.create_production_step($1, $2, $3, $4)',
          [tenantId, command.label, command.color, command.is_terminal],
        );
        return toDto(requiredRow(result.rows));
      });
    } catch (error) { throw mapError(error); }
  }

  async update(tenantId: TenantId, actor: UserId, stepId: string, command: UpdateProductionStepCommand): Promise<ProductionStepDto> {
    try {
      return await this.transactions.run({ tenantId, userId: actor }, async (client) => {
        const fields: string[] = [];
        const values: unknown[] = [tenantId, stepId];
        for (const [field, value] of Object.entries(command)) {
          fields.push(`${field} = $${values.length + 1}`);
          values.push(value);
        }
        if (fields.length === 0) {
          const current = await client.query<StepRow>(
            'select * from public.production_steps where tenant_id = $1 and id = $2',
            [tenantId, stepId],
          );
          if (current.rows[0] === undefined) throw new ProductionStepNotFoundError();
          return toDto(current.rows[0]);
        }
        const result = await client.query<StepRow>(`
          update public.production_steps set ${fields.join(', ')}
           where tenant_id = $1 and id = $2 returning *
        `, values);
        if (result.rows[0] === undefined) throw new ProductionStepNotFoundError();
        return toDto(result.rows[0]);
      });
    } catch (error) { throw mapError(error); }
  }

  async remove(tenantId: TenantId, actor: UserId, stepId: string): Promise<void> {
    try {
      await this.transactions.run({ tenantId, userId: actor }, async (client) => {
        await client.query('select magrit.delete_production_step($1, $2)', [tenantId, stepId]);
      });
    } catch (error) { throw mapError(error); }
  }

  async reorder(tenantId: TenantId, actor: UserId, stepIds: readonly string[]): Promise<readonly ProductionStepDto[]> {
    try {
      return await this.transactions.run({ tenantId, userId: actor }, async (client) => {
        await client.query('select magrit.reorder_production_steps($1, $2::uuid[])', [tenantId, [...stepIds]]);
        const result = await client.query<StepRow>(
          'select * from public.production_steps where tenant_id = $1 order by position',
          [tenantId],
        );
        return result.rows.map(toDto);
      });
    } catch (error) { throw mapError(error); }
  }

  actorHasCapability(tenantId: TenantId, actorId: UserId, capability: string): Promise<boolean> {
    return this.transactions.run({ tenantId, userId: actorId }, async (client) => {
      const result = await client.query<{ allowed: boolean }>(
        'select magrit.actor_has_capability($1, $2) as allowed', [tenantId, capability],
      );
      return result.rows[0]?.allowed === true;
    });
  }
}

function toDto(row: StepRow): ProductionStepDto {
  return {
    id: row.id, tenant_id: row.tenant_id, label: row.label, position: row.position,
    color: row.color, is_terminal: row.is_terminal, is_active: row.is_active,
    created_at: toIsoTimestamp(row.created_at), updated_at: toIsoTimestamp(row.updated_at),
  };
}

function requiredRow(rows: readonly StepRow[]): StepRow {
  const row = rows[0];
  if (row === undefined) throw new Error('Etape de production absente apres ecriture.');
  return row;
}

function mapError(error: unknown): Error {
  if (error instanceof ProductionStepNotFoundError) return error;
  const pgError = error as { code?: string; message?: string };
  const message = pgError.message ?? '';
  if (message.includes('production_step.limit_reached')) return new ProductionStepLimitReachedError();
  if (message.includes('production_step.not_found')) return new ProductionStepNotFoundError();
  if (message.includes('production_step.in_use') || pgError.code === '23503') return new ProductionStepInUseError();
  if (message.includes('production_step.positions_mismatch')) return new ProductionStepPositionsMismatchError();
  if (pgError.code === '23505') return new ProductionStepLabelConflictError();
  return error instanceof Error ? error : new Error(String(error));
}
