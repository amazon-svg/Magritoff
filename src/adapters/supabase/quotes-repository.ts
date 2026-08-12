import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserId } from '../../kernel/ids/index.ts';
import type { CreateEditableQuote, CreateQuoteDraft, QuoteDraftCreated, QuoteLineDraft, QuoteRecord, QuoteScope, QuoteWithLines, SaveQuote } from '../../modules/quotes/api/contracts.ts';
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

  async list(actor: UserId, tenantId: string, scope: QuoteScope): Promise<QuoteRecord[]> {
    if (scope === 'all') await this.assertCanViewAll(tenantId);
    let query = this.client.from('quotes').select(HEAD_COLUMNS).eq('tenant_id', tenantId).order('created_at', { ascending: false });
    if (scope === 'mine') query = query.eq('user_id', actor);
    const { data, error } = await query;
    if (error) throw rejected(error);
    return (data ?? []) as QuoteRecord[];
  }

  async get(_actor: UserId, tenantId: string, quoteId: string): Promise<QuoteWithLines> {
    const { data: head, error: headError } = await this.client.from('quotes').select(HEAD_COLUMNS).eq('tenant_id', tenantId).eq('id', quoteId).maybeSingle();
    if (headError) throw rejected(headError);
    if (!head) throw new QuoteRejectedError('not_found', 'Devis introuvable.');
    const { data: lines, error: linesError } = await this.client.from('quote_lines').select('*').eq('quote_id', quoteId).order('position');
    if (linesError) throw rejected(linesError);
    return { ...(head as QuoteRecord), lines: lines ?? [] } as QuoteWithLines;
  }

  async create(actor: UserId, tenantId: string, command: CreateEditableQuote): Promise<QuoteDraftCreated> {
    const { data: head, error } = await this.client.from('quotes').insert({
      user_id: actor, tenant_id: tenantId, reference: command.reference, product_name: command.productName,
      client_name: command.clientName, status: 'draft', total_ht: command.totalHt, total_ttc: command.totalTtc,
    }).select('id').single();
    if (error || !head) throw classified(error);
    try { await this.insertLines(head.id, command.lines); }
    catch (lineError) { await this.client.from('quotes').delete().eq('id', head.id); throw lineError; }
    return { id: head.id };
  }

  async save(_actor: UserId, tenantId: string, quoteId: string, command: SaveQuote): Promise<void> {
    await this.assertQuote(tenantId, quoteId);
    const { error: deleteError } = await this.client.from('quote_lines').delete().eq('quote_id', quoteId);
    if (deleteError) throw rejected(deleteError);
    await this.insertLines(quoteId, command.lines);
    const patch = {
      total_ht: command.totalHt, total_ttc: command.totalTtc,
      ...(command.clientName === undefined ? {} : { client_name: command.clientName }),
      ...(command.status === undefined ? {} : { status: command.status }),
      ...(command.productName === undefined ? {} : { product_name: command.productName }),
    };
    const { data, error } = await this.client.from('quotes').update(patch).eq('tenant_id', tenantId).eq('id', quoteId).select('id').maybeSingle();
    if (error) throw classified(error);
    if (!data) throw new QuoteRejectedError('not_found', 'Devis introuvable.');
  }

  async setStatus(_actor: UserId, tenantId: string, quoteId: string, status: string): Promise<void> {
    const { data, error } = await this.client.from('quotes').update({ status }).eq('tenant_id', tenantId).eq('id', quoteId).select('id').maybeSingle();
    if (error) throw classified(error);
    if (!data) throw new QuoteRejectedError('not_found', 'Devis introuvable.');
  }

  async remove(_actor: UserId, tenantId: string, quoteId: string): Promise<void> {
    const { data, error } = await this.client.from('quotes').delete().eq('tenant_id', tenantId).eq('id', quoteId).select('id').maybeSingle();
    if (error) throw classified(error);
    if (!data) throw new QuoteRejectedError('not_found', 'Devis introuvable.');
  }

  async duplicate(actor: UserId, tenantId: string, quoteId: string, reference: string): Promise<QuoteDraftCreated> {
    const source = await this.get(actor, tenantId, quoteId);
    return this.create(actor, tenantId, {
      reference, productName: source.product_name, clientName: source.client_name,
      totalHt: source.total_ht ?? 0, totalTtc: source.total_ttc ?? 0,
      lines: source.lines.map(({ product_name, product_config, quantity, unit_cost_ht, unit_price_ht, margin_pct, line_total_ht, position }) => ({ product_name, product_config, quantity, unit_cost_ht, unit_price_ht, margin_pct, line_total_ht, position })),
    });
  }

  private async insertLines(quoteId: string, lines: QuoteLineDraft[]): Promise<void> {
    if (lines.length === 0) return;
    const { error } = await this.client.from('quote_lines').insert(lines.map((line, index) => ({
      quote_id: quoteId, product_name: line.product_name, product_config: jsonObject(line.product_config),
      quantity: line.quantity, unit_cost_ht: line.unit_cost_ht, unit_price_ht: line.unit_price_ht,
      margin_pct: line.margin_pct, line_total_ht: line.line_total_ht, position: index,
    })));
    if (error) throw classified(error);
  }

  private async assertQuote(tenantId: string, quoteId: string): Promise<void> {
    const { data, error } = await this.client.from('quotes').select('id').eq('tenant_id', tenantId).eq('id', quoteId).maybeSingle();
    if (error) throw rejected(error);
    if (!data) throw new QuoteRejectedError('not_found', 'Devis introuvable.');
  }

  private async assertCanViewAll(tenantId: string): Promise<void> {
    const [role, superAdmin] = await Promise.all([
      this.client.rpc('user_role_in_tenant', { p_tenant_id: tenantId }), this.client.rpc('is_super_admin'),
    ]);
    if (role.error || superAdmin.error) throw rejected(role.error ?? superAdmin.error!);
    if (!superAdmin.data && role.data !== 'owner' && role.data !== 'admin') throw new QuoteRejectedError('permission_denied', 'Lecture de tous les devis interdite.');
  }
}

const HEAD_COLUMNS = 'id, user_id, tenant_id, reference, product_name, client_name, status, total_ht, total_ttc, created_at, updated_at' as const;
function rejected(error: { message?: string }): QuoteRejectedError { return new QuoteRejectedError('permission_denied', error.message ?? 'Accès devis refusé.'); }
function classified(error: { code?: string; message?: string } | null): QuoteRejectedError {
  if (error?.code === '23502' || error?.code === '23514' || error?.code === '22P02') return new QuoteRejectedError('invalid_quote', error.message ?? 'Devis invalide.');
  return rejected(error ?? {});
}

function jsonObject(value: unknown): Json {
  return JSON.parse(JSON.stringify(value ?? {})) as Json;
}
