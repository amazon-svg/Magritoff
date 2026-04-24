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

/**
 * Insere une ligne dans `quotes`. En v3, tenant_id est REQUIS par la RLS —
 * il est donc passe explicitement par l'appelant (qui dispose du tenant
 * courant via useTenant()).
 */
export async function persistQuote(
  userId: string,
  tenantId: string,
  input: QuoteRowInput
) {
  const { error } = await supabase.from('quotes').insert({
    user_id: userId,
    tenant_id: tenantId,
    client_id: input.client_id,
    reference: input.reference,
    product_name: input.product_name,
    product_config: input.product_config,
    total_ht: input.total_ht,
    total_ttc: input.total_ttc,
    status: 'draft',
  });
  if (error) console.error('[quotes] persist error:', error.message);
}

// ─── Gabarits de devis (templating) ───────────────────────────────────────

export interface QuoteTemplate {
  /** id Supabase ou slug si built-in (ex: "builtin-classique") */
  id: string;
  /** true si c'est un des 3 gabarits livres en dur par Magrit */
  builtin?: boolean;
  /** nom visible dans les selecteurs + le dashboard */
  name: string;
  /** style general : `classique`, `atelier`, `corporate`, `custom` */
  style?: 'classique' | 'atelier' | 'corporate' | 'custom';

  // ─── Identite imprimerie / emetteur ─────────────────────────────────────
  company_name?: string | null;
  address?: string | null;
  postal_code?: string | null;
  city?: string | null;
  country?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  siret?: string | null;
  tva_number?: string | null;
  /** data-url ou url publique du logo */
  logo_url?: string | null;

  // ─── Branding visuel ────────────────────────────────────────────────────
  brand_color?: string | null;     // couleur principale (titres, traits)
  accent_color?: string | null;    // couleur d'accent (filet haut / bas)
  font_family?: string | null;     // font CSS du PDF imprimable

  // ─── Metadonnees ────────────────────────────────────────────────────────
  validity_days?: number | null;
  footer_text?: string | null;
}

/** Les 3 gabarits "sortie d'usine", adaptes a l'industrie de l'impression. */
export const BUILTIN_QUOTE_TEMPLATES: QuoteTemplate[] = [
  {
    id: 'builtin-classique',
    builtin: true,
    style: 'classique',
    name: 'Classique Professionnel',
    company_name: 'Votre imprimerie',
    address: '',
    postal_code: '',
    city: '',
    phone: '',
    email: '',
    website: '',
    brand_color: '#1e3a8a',
    accent_color: '#f59e0b',
    font_family: "'Arial', sans-serif",
    validity_days: 30,
    footer_text: 'Devis valable 30 jours a compter de sa date d\'emission. Conditions generales disponibles sur simple demande.',
  },
  {
    id: 'builtin-atelier',
    builtin: true,
    style: 'atelier',
    name: 'Atelier Print',
    company_name: 'Atelier d\'impression',
    brand_color: '#111111',
    accent_color: '#D97706',
    font_family: "'Helvetica Neue', 'Inter Tight', Arial, sans-serif",
    validity_days: 30,
    footer_text: 'Impression soignee, papiers certifies PEFC/FSC. TVA non applicable art. 293 B du CGI (le cas echeant).',
  },
  {
    id: 'builtin-corporate',
    builtin: true,
    style: 'corporate',
    name: 'Corporate B2B',
    company_name: 'Votre societe',
    brand_color: '#0F172A',
    accent_color: '#64748B',
    font_family: "'Inter', 'Helvetica Neue', Arial, sans-serif",
    validity_days: 45,
    footer_text: 'Devis confidentiel. Toute reproduction interdite sans accord ecrit. Paiement a 30 jours fin de mois.',
  },
];

/** Gabarit minimal utilise en absence de selection ni de preferences user. */
export function getDefaultTemplate(): QuoteTemplate {
  return BUILTIN_QUOTE_TEMPLATES[0];
}

// ─── Rendu HTML imprimable ────────────────────────────────────────────────

export function renderClientBlockHtml(client: Client | null | undefined): string {
  if (!client) {
    return `
      <div class="partie-field">Societe / Nom :</div>
      <div class="partie-field">Adresse :</div>
      <div class="partie-field">CP / Ville :</div>
      <div class="partie-field">Tel. / Email :</div>
    `;
  }
  return `
    <div class="partie-field">Societe : ${escapeHtml(client.company)}</div>
    <div class="partie-field">Contact : ${escapeHtml(client.contact_name || '')}</div>
    <div class="partie-field">Adresse : ${escapeHtml(client.address || '')}</div>
    <div class="partie-field">Email : ${escapeHtml(client.email || '')}</div>
    <div class="partie-field">Tel. : ${escapeHtml(client.phone || '')}</div>
  `;
}

export function renderEmitterBlockHtml(template: QuoteTemplate): string {
  const parts: string[] = [];
  if (template.company_name) parts.push(`<div class="partie-field">Societe : ${escapeHtml(template.company_name)}</div>`);
  if (template.address) parts.push(`<div class="partie-field">Adresse : ${escapeHtml(template.address)}</div>`);
  if (template.postal_code || template.city) {
    parts.push(
      `<div class="partie-field">CP / Ville : ${escapeHtml([template.postal_code, template.city].filter(Boolean).join(' '))}</div>`
    );
  }
  if (template.phone) parts.push(`<div class="partie-field">Tel. : ${escapeHtml(template.phone)}</div>`);
  if (template.email) parts.push(`<div class="partie-field">Email : ${escapeHtml(template.email)}</div>`);
  if (template.siret) parts.push(`<div class="partie-field">SIRET : ${escapeHtml(template.siret)}</div>`);
  if (template.tva_number)
    parts.push(`<div class="partie-field">TVA : ${escapeHtml(template.tva_number)}</div>`);
  return parts.join('') || '<div class="partie-field">Societe : </div>';
}

export interface QuoteItem {
  name: string;
  quantity?: number | string;
  format?: string;
  material?: string;
  priceHT: number;
}

export function renderQuoteHtml(input: {
  template: QuoteTemplate;
  reference: string;
  client: Client | null | undefined;
  items: QuoteItem[];
}): string {
  const { template, reference, client, items } = input;
  const brand = template.brand_color || '#111';
  const accent = template.accent_color || '#f59e0b';

  const totalHT = items.reduce((s, it) => s + (it.priceHT || 0), 0);
  const tva = totalHT * 0.2;
  const totalTTC = totalHT * 1.2;

  const logoBlock = template.logo_url
    ? `<div class="tpl-logo"><img src="${escapeHtml(template.logo_url)}" alt="Logo"/></div>`
    : `<div class="tpl-logo" style="background:${brand};color:#fff;padding:12px 16px;border-radius:6px;font-weight:600;">${escapeHtml(
        template.company_name || 'Votre logo'
      )}</div>`;

  const rows = items
    .map(
      (it) => `
        <tr>
          <td>${escapeHtml(it.name)}</td>
          <td>${it.quantity ?? ''}</td>
          <td>${escapeHtml(it.format ?? '')}</td>
          <td>${escapeHtml(it.material ?? '')}</td>
          <td style="text-align:right">${(it.priceHT || 0).toFixed(2)} €</td>
        </tr>
      `
    )
    .join('');

  return `
    <section class="devis">
      <div class="tpl-header">
        ${logoBlock}
        <div style="text-align:right;">
          <h1 style="color:${brand};">DEVIS ${escapeHtml(reference)}</h1>
          <div class="meta">Date : ${new Date().toLocaleDateString('fr-FR')}
            · Validite : ${template.validity_days ?? 30} jours
            · ${items.length} produit${items.length > 1 ? 's' : ''}</div>
        </div>
      </div>

      <div class="parties">
        <div class="partie">
          <div class="partie-title">Emetteur</div>
          ${renderEmitterBlockHtml(template)}
        </div>
        <div class="partie">
          <div class="partie-title">Client</div>
          ${renderClientBlockHtml(client)}
        </div>
      </div>

      <table>
        <thead><tr>
          <th>Produit</th><th>Qte</th><th>Format</th><th>Support</th>
          <th style="text-align:right">HT</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>

      <div class="totals">
        <div>Total HT : <strong>${totalHT.toFixed(2)} €</strong></div>
        <div>TVA (20 %) : <strong>${tva.toFixed(2)} €</strong></div>
        <div class="final">Total TTC : ${totalTTC.toFixed(2)} €</div>
      </div>

      ${
        template.footer_text
          ? `<div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:11px;color:#666;">${escapeHtml(template.footer_text)}</div>`
          : ''
      }
    </section>
  `;
}

function escapeHtml(v: string): string {
  return (v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
