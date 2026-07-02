import { supabase } from '/utils/supabase/client';
import { applyTax, DEFAULT_TAX_RATE, extractTaxAmount, formatTaxLabel } from './tax';

/**
 * Sprint 10 Phase B users : decouplage du type Client legacy. Le bloc Client
 * du devis PDF accepte desormais une saisie libre (utilisateur tape les
 * infos du destinataire au moment du devis). Type local QuoteClientInfo
 * conserve les champs historiques pour back-compat des composants existants.
 */
export interface QuoteClientInfo {
  company?: string | null;
  contact_name?: string | null;
  address?: string | null;
  email?: string | null;
  phone?: string | null;
}

export function makeQuoteReference(): string {
  const year = new Date().getFullYear();
  const seq = String(Date.now()).slice(-6);
  return `DEV-${year}-${seq}`;
}

export function computeProductTotals(
  product: any,
  taxRate: number = DEFAULT_TAX_RATE
): { totalHT: number; totalTTC: number } {
  const cp = product.clariprintQuote;
  const totalHT = cp?.costs?.total ?? cp?.priceHT ?? product.price ?? 0;
  return { totalHT, totalTTC: applyTax(totalHT, taxRate) };
}

export interface QuoteRowInput {
  reference: string;
  product_name: string;
  product_config: any;
  total_ht: number;
  total_ttc: number;
}

/**
 * Insere une ligne dans `quotes`. En v3, tenant_id est REQUIS par la RLS —
 * il est donc passe explicitement par l'appelant (qui dispose du tenant
 * courant via useTenant()).
 *
 * Sprint 10 Phase B users : colonne quotes.client_id supprimee (DROP TABLE
 * clients CASCADE). Le devis est lie au tenant + user emetteur uniquement.
 */
export async function persistQuote(
  userId: string,
  tenantId: string,
  input: QuoteRowInput
) {
  const { error } = await supabase.from('quotes').insert({
    user_id: userId,
    tenant_id: tenantId,
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

export function renderClientBlockHtml(client: QuoteClientInfo | null | undefined): string {
  if (!client) {
    return `
      <div class="partie-field">Societe / Nom :</div>
      <div class="partie-field">Adresse :</div>
      <div class="partie-field">CP / Ville :</div>
      <div class="partie-field">Tel. / Email :</div>
    `;
  }
  return `
    <div class="partie-field">Societe : ${escapeHtml(client.company || '')}</div>
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
  client: QuoteClientInfo | null | undefined;
  items: QuoteItem[];
  /** Taux TVA. R0 : passe par le caller via getTaxRate(currentTenant). */
  taxRate?: number;
}): string {
  const { template, reference, client, items, taxRate = DEFAULT_TAX_RATE } = input;
  const brand = template.brand_color || '#111';
  const accent = template.accent_color || '#f59e0b';

  const totalHT = items.reduce((s, it) => s + (it.priceHT || 0), 0);
  const tva = extractTaxAmount(totalHT, taxRate);
  const totalTTC = applyTax(totalHT, taxRate);

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
        <div>TVA (${formatTaxLabel(taxRate)}) : <strong>${tva.toFixed(2)} €</strong></div>
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

// ─── Document imprimable complet (wrapper HTML + styles) ───────────────────
// Factorise le wrapper <!DOCTYPE html> + <style> partage par CartButton et
// l'editeur de devis (S-QUOTES-3). Le corps `bodyHtml` est typiquement produit
// par renderQuoteHtml().

/** Construit le document HTML imprimable complet a partir d'un gabarit + corps. */
export function buildQuoteDocumentHtml(
  template: QuoteTemplate,
  bodyHtml: string,
  title = 'Devis'
): string {
  const brand = template.brand_color || '#111';
  const accent = template.accent_color || '#f59e0b';
  return `
    <!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
    <style>
      body{font-family:${template.font_family || 'Arial, sans-serif'};padding:40px;color:#111;background:#fff}
      h1{color:${brand};margin:0 0 8px 0;font-size:28px}
      .meta{color:#666;font-size:13px;margin-bottom:24px}
      .parties{display:flex;gap:24px;margin-bottom:24px}
      .partie{flex:1;padding:16px;border:2px solid #e5e7eb;border-radius:8px}
      .partie-title{font-weight:bold;color:${brand};font-size:13px;text-transform:uppercase;margin-bottom:10px}
      .partie-field{font-size:13px;color:#444;margin-bottom:6px}
      table{width:100%;border-collapse:collapse;margin:16px 0}
      th,td{border-bottom:1px solid #e5e7eb;padding:8px;font-size:13px;text-align:left}
      th{background:#f3f4f6;color:${brand}}
      .totals{margin-top:16px;display:flex;flex-direction:column;align-items:flex-end;gap:4px;font-size:14px}
      .totals .final{font-size:18px;font-weight:bold;color:${brand};border-top:2px solid ${brand};padding-top:8px;margin-top:8px}
      .devis{margin-bottom:40px;border-top:4px solid ${accent};padding-top:24px}
      .devis + .devis{page-break-before:always}
      .tpl-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;gap:24px}
      .tpl-emitter{font-size:12px;color:#444;line-height:1.5}
      .tpl-logo img{max-width:160px;max-height:72px;object-fit:contain}
    </style></head><body>
      ${bodyHtml}
    </body></html>
  `;
}

/**
 * Ouvre une fenetre d'impression avec le document devis complet.
 * Retourne false si le navigateur a bloque la popup.
 */
export function openQuotePrint(
  template: QuoteTemplate,
  bodyHtml: string,
  title = 'Devis'
): boolean {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert("Le navigateur a bloque la fenetre d'impression. Autorisez les popups pour ce site.");
    return false;
  }
  printWindow.document.write(buildQuoteDocumentHtml(template, bodyHtml, title));
  printWindow.document.close();
  setTimeout(() => printWindow.print(), 250);
  return true;
}
