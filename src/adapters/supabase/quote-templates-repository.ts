import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserId } from '../../kernel/ids/index.ts';
import type { CreateQuoteTemplate, QuoteTemplateDto, QuoteTemplatesOverview, UpdateQuoteTemplate } from '../../modules/quote-templates/api/contracts.ts';
import { QuoteTemplateRejectedError, type QuoteTemplatesRepository } from '../../modules/quote-templates/application/quote-templates-repository.ts';
import type { Database } from '../../types/database.types.ts';

export class SupabaseQuoteTemplatesRepository implements QuoteTemplatesRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}
  async overview(actor: UserId, tenantId: string): Promise<QuoteTemplatesOverview> {
    const [templates, preference] = await Promise.all([
      this.client.from('quote_templates').select('*').eq('tenant_id', tenantId).order('created_at'),
      this.client.from('user_preferences').select('default_quote_template_id').eq('user_id', actor).maybeSingle(),
    ]);
    if (templates.error || preference.error) throw rejected(templates.error ?? preference.error!);
    return { templates: (templates.data ?? []).map(mapTemplate), defaultTemplateId: preference.data?.default_quote_template_id ?? null };
  }
  async create(actor: UserId, tenantId: string, input: CreateQuoteTemplate): Promise<QuoteTemplateDto> {
    const values = { user_id: actor, tenant_id: tenantId, ...payload(input), name: input.name } as Database['public']['Tables']['quote_templates']['Insert'];
    const { data, error } = await this.client.from('quote_templates').insert(values).select().single();
    if (error || !data) throw classified(error);
    return mapTemplate(data);
  }
  async update(_actor: UserId, tenantId: string, id: string, input: UpdateQuoteTemplate): Promise<void> {
    const { data, error } = await this.client.from('quote_templates').update(payload(input)).eq('tenant_id', tenantId).eq('id', id).select('id').maybeSingle();
    if (error) throw classified(error); if (!data) throw notFound();
  }
  async remove(actor: UserId, tenantId: string, id: string): Promise<void> {
    const { data, error } = await this.client.from('quote_templates').delete().eq('tenant_id', tenantId).eq('id', id).select('id').maybeSingle();
    if (error) throw classified(error); if (!data) throw notFound();
    const { data: preference } = await this.client.from('user_preferences').select('default_quote_template_id').eq('user_id', actor).maybeSingle();
    if (preference?.default_quote_template_id === id) await this.setDefault(actor, tenantId, null);
  }
  async setDefault(actor: UserId, tenantId: string, id: string | null): Promise<void> {
    if (id && !id.startsWith('builtin-')) {
      const { data, error } = await this.client.from('quote_templates').select('id').eq('tenant_id', tenantId).eq('id', id).maybeSingle();
      if (error) throw rejected(error); if (!data) throw notFound();
    }
    const { error } = await this.client.from('user_preferences').upsert({ user_id: actor, default_quote_template_id: id }, { onConflict: 'user_id' });
    if (error) throw classified(error);
  }
}
function payload(input: UpdateQuoteTemplate | CreateQuoteTemplate): Database['public']['Tables']['quote_templates']['Update'] { return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as Database['public']['Tables']['quote_templates']['Update']; }
function mapTemplate(row: Database['public']['Tables']['quote_templates']['Row']): QuoteTemplateDto { return { id: row.id, builtin: false, name: row.name, style: row.style === 'classique' || row.style === 'atelier' || row.style === 'corporate' ? row.style : 'custom', company_name: row.company_name, address: row.address, postal_code: row.postal_code, city: row.city, country: row.country, phone: row.phone, email: row.email, website: row.website, siret: row.siret, tva_number: row.tva_number, logo_url: row.logo_url, brand_color: row.brand_color, accent_color: row.accent_color, font_family: row.font_family, validity_days: row.validity_days, footer_text: row.footer_text }; }
function rejected(error: { message?: string }): QuoteTemplateRejectedError { return new QuoteTemplateRejectedError('permission_denied', error.message ?? 'Accès gabarit refusé.'); }
function classified(error: { code?: string; message?: string } | null) { return error?.code === '23502' || error?.code === '23514' ? new QuoteTemplateRejectedError('invalid_template', error.message ?? 'Gabarit invalide.') : rejected(error ?? {}); }
function notFound() { return new QuoteTemplateRejectedError('not_found', 'Gabarit introuvable.'); }
