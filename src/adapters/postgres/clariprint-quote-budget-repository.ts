import type { PoolClient } from 'pg';
import {
  ClariprintQuoteBudgetUnavailableError,
  type ClariprintQuoteBudget,
  type ClariprintQuoteBudgetDecision,
  type ClariprintQuoteBudgetRefusal,
  type ClariprintQuoteCaller,
} from '../../modules/clariprint/application/clariprint-quote-budget.ts';
import type { PostgresTransactionRunner } from './transaction-runner.ts';

type DatabaseScope =
  | 'clariprint_quote_visitor'
  | 'clariprint_quote_member'
  | 'clariprint_quote_public_daily';

type Counter = Readonly<{
  scope: DatabaseScope;
  key: string;
  windowStart: Date;
  hits: number;
  maxHits: number;
}>;

const REFUSAL_BY_SCOPE: Readonly<Record<DatabaseScope, ClariprintQuoteBudgetRefusal>> = {
  clariprint_quote_visitor: 'visitor',
  clariprint_quote_member: 'member',
  clariprint_quote_public_daily: 'public',
};

/** Consomme tous les etages applicables dans une transaction, ou aucun. */
export class PostgresClariprintQuoteBudgetRepository implements ClariprintQuoteBudget {
  constructor(private readonly transactions: PostgresTransactionRunner) {}

  async consume(caller: ClariprintQuoteCaller): Promise<ClariprintQuoteBudgetDecision> {
    try {
      return await this.transactions.run({}, async (client) => {
        const scopes: DatabaseScope[] = caller.kind === 'member'
          ? ['clariprint_quote_member']
          : ['clariprint_quote_public_daily', 'clariprint_quote_visitor'];
        const counters: Counter[] = [];
        for (const scope of scopes) {
          counters.push(await lockCounter(client, scope, scope === 'clariprint_quote_public_daily'
            ? 'global'
            : caller.key));
        }

        const ownScope = caller.kind === 'member'
          ? 'clariprint_quote_member'
          : 'clariprint_quote_visitor';
        const refused = counters.find((counter) => counter.scope === ownScope && counter.hits >= counter.maxHits)
          ?? counters.find((counter) => counter.hits >= counter.maxHits);
        if (refused !== undefined) {
          return { allowed: false, refusedScope: REFUSAL_BY_SCOPE[refused.scope] };
        }

        for (const counter of counters) {
          await client.query(`
            update public.api_rate_limit_counters
               set hits = hits + 1
             where scope = $1 and key_hash = $2 and window_start = $3
          `, [counter.scope, counter.key, counter.windowStart]);
        }
        return { allowed: true };
      });
    } catch (error) {
      if (error instanceof ClariprintQuoteBudgetUnavailableError) throw error;
      throw new ClariprintQuoteBudgetUnavailableError(
        `clariprint_quote_budget_call_failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

async function lockCounter(
  client: PoolClient,
  scope: DatabaseScope,
  key: string,
): Promise<Counter> {
  const configuration = await client.query<{
    max_hits: number;
    window_start: Date;
  }>(`
    select max_hits,
           case window_kind
             when 'civil_day' then
               date_trunc('day', clock_timestamp() at time zone civil_day_timezone)
                 at time zone civil_day_timezone
             else to_timestamp(
               floor(extract(epoch from clock_timestamp()) / window_seconds) * window_seconds
             )
           end as window_start
      from public.api_rate_limits
     where scope = $1
  `, [scope]);
  const config = configuration.rows[0];
  if (config === undefined) {
    throw new ClariprintQuoteBudgetUnavailableError(`clariprint_quote_budget_missing_scope:${scope}`);
  }

  await client.query(`
    insert into public.api_rate_limit_counters(scope, key_hash, window_start, hits)
    values($1, $2, $3, 0)
    on conflict (scope, key_hash, window_start) do nothing
  `, [scope, key, config.window_start]);
  const locked = await client.query<{ hits: number }>(`
    select hits
      from public.api_rate_limit_counters
     where scope = $1 and key_hash = $2 and window_start = $3
     for update
  `, [scope, key, config.window_start]);
  const row = locked.rows[0];
  if (row === undefined) {
    throw new ClariprintQuoteBudgetUnavailableError('clariprint_quote_budget_counter_missing');
  }
  return {
    scope,
    key,
    windowStart: config.window_start,
    hits: row.hits,
    maxHits: config.max_hits,
  };
}
