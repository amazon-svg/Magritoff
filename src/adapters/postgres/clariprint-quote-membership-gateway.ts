import type { UserId } from '../../kernel/ids/index.ts';
import { ClariprintQuoteBudgetUnavailableError } from '../../modules/clariprint/application/clariprint-quote-budget.ts';
import type { PostgresTransactionRunner } from './transaction-runner.ts';

export class PostgresClariprintQuoteMembershipGateway {
  constructor(private readonly transactions: PostgresTransactionRunner) {}

  async isMember(userId: string): Promise<boolean> {
    try {
      return await this.transactions.run({ userId: userId as UserId }, async (client) => {
        const result = await client.query(
          'select 1 from public.tenant_members where user_id = $1 limit 1',
          [userId],
        );
        return result.rowCount === 1;
      });
    } catch (error) {
      throw new ClariprintQuoteBudgetUnavailableError(
        `clariprint_quote_membership_check_failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
