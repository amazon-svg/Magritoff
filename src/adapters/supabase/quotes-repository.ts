import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserId } from '../../kernel/ids/index.ts';
import type { CreateQuoteDraft, QuoteDraftCreated } from '../../modules/quotes/api/contracts.ts';
import { QuoteRejectedError, type QuotesRepository } from '../../modules/quotes/application/quotes-repository.ts';
import type { Database, Json } from '../../types/database.types.ts';

export class SupabaseQuotesRepository implements QuotesRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async createDraft(actor: UserId, tenantId: string, command: CreateQuoteDraft): Promise<QuoteDraftCreated> {
    const { data, error } = await this.client.from('quotes').insert({
      user_id: actor, tenant_id: tenantId, reference: command.reference,
      product_name: command.productName,
      product_config: jsonObject(command.productConfig),
      total_ht: command.totalHt, total_ttc: command.totalTtc, status: 'draft',
    }).select('id').single();
    if (error || !data) {
      const invalid = error?.code === '23502' || error?.code === '23514' || error?.code === '22P02';
      throw new QuoteRejectedError(invalid ? 'invalid_quote' : 'permission_denied', error?.message ?? 'Création du brouillon impossible.');
    }
    return { id: data.id };
  }
}

function jsonObject(value: unknown): Json {
  return JSON.parse(JSON.stringify(value ?? {})) as Json;
}
