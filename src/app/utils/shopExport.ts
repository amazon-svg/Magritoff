import type { Shop, ShopProduct } from '../contexts/ShopsContext';
import type { Gamme, ProductDefinition } from './productEnrichment';
import { enrichProduct } from './productEnrichment';
import { applyTax, DEFAULT_TAX_RATE } from './tax';

// ─── CSV utils ───────────────────────────────────────────────────────────────

function csvEscape(value: unknown): string {
  if (value == null) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(headers: string[], rows: Array<Record<string, unknown>>): string {
  const head = headers.join(',');
  const body = rows.map((r) => headers.map((h) => csvEscape(r[h])).join(',')).join('\n');
  return `${head}\n${body}\n`;
}

function downloadBlob(filename: string, content: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob(['\uFEFF' + content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 200);
}

// ─── Format Shopify CSV (import produit) ─────────────────────────────────────
// Réf : https://help.shopify.com/en/manual/products/import-export/using-csv

const SHOPIFY_HEADERS = [
  'Handle',
  'Title',
  'Body (HTML)',
  'Vendor',
  'Type',
  'Tags',
  'Published',
  'Option1 Name',
  'Option1 Value',
  'Variant SKU',
  'Variant Price',
  'Variant Inventory Policy',
  'Variant Fulfillment Service',
  'Image Src',
  'SEO Title',
  'SEO Description',
  'Status',
];

export function exportShopToShopifyCsv(
  shop: Shop,
  products: ShopProduct[],
  gammes: Gamme[],
  definitions: ProductDefinition[],
  taxRate: number = DEFAULT_TAX_RATE
) {
  const rows = products.map((p) => {
    const enriched = enrichProduct(p.config || {}, gammes, definitions, 'fr');
    const handle = (enriched.resolved.title || p.name)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60);
    const body =
      enriched.resolved.description ||
      enriched.resolved.short_description ||
      p.description ||
      '';
    return {
      Handle: handle,
      Title: enriched.resolved.title || p.name,
      'Body (HTML)': markdownToHtml(body),
      Vendor: shop.name,
      Type: p.category || 'Impression',
      Tags: (enriched.resolved.keywords || []).join(', '),
      Published: 'TRUE',
      'Option1 Name': 'Quantité',
      'Option1 Value': String(p.config?.quantity ?? '1'),
      'Variant SKU': p.id,
      'Variant Price': applyTax(p.price_ht, taxRate).toFixed(2),
      'Variant Inventory Policy': 'continue',
      'Variant Fulfillment Service': 'manual',
      'Image Src': p.image_url || '',
      'SEO Title': (enriched.resolved.seo_title || enriched.resolved.title || p.name).slice(0, 60),
      'SEO Description': (enriched.resolved.seo_description || body).slice(0, 160),
      Status: 'active',
    };
  });
  const csv = toCsv(SHOPIFY_HEADERS, rows);
  downloadBlob(`shopify_${shop.slug}.csv`, csv);
}

// ─── Format JSON générique (API-ready) ───────────────────────────────────────

export function exportShopToJson(
  shop: Shop,
  products: ShopProduct[],
  gammes: Gamme[],
  definitions: ProductDefinition[],
  taxRate: number = DEFAULT_TAX_RATE
) {
  const out = {
    shop: {
      name: shop.name,
      slug: shop.slug,
      description: shop.description,
      address: shop.address,
      contact_email: shop.contact_email,
      theme: shop.theme,
    },
    products: products.map((p) => {
      const enriched = enrichProduct(p.config || {}, gammes, definitions, 'fr');
      return {
        sku: p.id,
        name: enriched.resolved.title || p.name,
        category: p.category,
        gamme: enriched.gamme?.slug ?? null,
        image_url: p.image_url || null,
        description: enriched.resolved.description || p.description || '',
        short_description: enriched.resolved.short_description || '',
        seo: {
          title: enriched.resolved.seo_title || '',
          description: enriched.resolved.seo_description || '',
          h1: enriched.resolved.h1 || '',
          keywords: enriched.resolved.keywords || [],
        },
        faq: enriched.resolved.faq,
        usage_examples: enriched.resolved.usage_examples,
        price_ht: p.price_ht,
        price_ttc: Math.round(applyTax(p.price_ht, taxRate) * 100) / 100,
        currency: 'EUR',
        tech: p.config?.clariprintData ?? null,
      };
    }),
    exported_at: new Date().toISOString(),
  };
  downloadBlob(
    `magrit_${shop.slug}.json`,
    JSON.stringify(out, null, 2),
    'application/json;charset=utf-8'
  );
}

// ─── Markdown minimal → HTML (pour Shopify Body) ─────────────────────────────

function markdownToHtml(md: string): string {
  if (!md) return '';
  // Escape HTML pour ne pas injecter de balises inattendues
  const esc = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  // Headings
  let html = esc
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>');
  // Bold & italic
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  // Line breaks (double newline → paragraphes, simple → <br>)
  html = html
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('');
  return html;
}
