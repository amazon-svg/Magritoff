import { supabase } from '/utils/supabase/client';
import type { Client } from '../contexts/ClientsContext';

export function makeQuoteReference(): string {
  const year = new Date().getFullYear();
  const seq = String(Date.now()).slice(-6);
  return `DEV-${year}-${seq}`;
}

export function computeProductTotals(product: any): { totalHT: number; totalTTC: number } {
  const cp = product.clariprintQuote;
  const totalHT = cp?.costs?.total ?? cp?.priceHT ?? product.price ?? 0;
  return { totalHT, totalTTC: totalHT * 1.2 };
}

export interface QuoteRowInput {
  reference: string;
  client_id: string | null;
  product_name: string;
  product_config: any;
  total_ht: number;
  total_ttc: number;
}

export async function persistQuote(userId: string, input: QuoteRowInput) {
  const { error } = await supabase.from('quotes').insert({
    user_id: userId,
    client_id: input.client_id,
    reference: input.reference,
    product_name: input.product_name,
    product_config: input.product_config,
    total_ht: input.total_ht,
    total_ttc: input.total_ttc,
    status: 'draft',
  });
  if (error) console.error('❌ Erreur persist devis:', error.message);
}

export function renderClientBlockHtml(client: Client | null | undefined): string {
  if (!client) {
    return `
      <div class="partie-field">Société / Nom : </div>
      <div class="partie-field">Adresse : </div>
      <div class="partie-field">CP / Ville : </div>
      <div class="partie-field">Tél. / Email : </div>
    `;
  }
  return `
    <div class="partie-field">Société : ${escapeHtml(client.company)}</div>
    <div class="partie-field">Contact : ${escapeHtml(client.contact_name || '')}</div>
    <div class="partie-field">Adresse : ${escapeHtml(client.address || '')}</div>
    <div class="partie-field">Email : ${escapeHtml(client.email || '')}</div>
    <div class="partie-field">Tél. : ${escapeHtml(client.phone || '')}</div>
  `;
}

function escapeHtml(v: string): string {
  return v
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
