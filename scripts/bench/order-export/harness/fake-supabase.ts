// Faux PostgREST + Storage, cote HOTE (jamais dans l isolat mesure).
// Sert au runner reel exactement ce que la vraie base renverrait :
//  - rpc/api_claim_order_exports      -> un export reclame, puis []
//  - rpc/api_read_order_export_rows   -> pages [{cursor, payload}], forme
//    copiee de la migration 20260913000000 (numeric caste en ::text,
//    timestamptz en ISO a decalage explicite, entiers natifs)
//  - PATCH commercial_order_exports    -> 204, verdict enregistre
//  - POST storage/v1/object/...        -> 200, taille enregistree
// GET /reset?rows=&gran=&format= reinitialise ; GET /last rend le verdict.
const PORT = 54410;
const EXPORT_ID = '11111111-1111-4111-8111-111111111111';
const TENANT_ID = '22222222-2222-4222-8222-222222222222';

type Row = { cursor: Record<string, unknown>; payload: Record<string, unknown> };

let rows: Row[] = [];
let format = 'csv';
let gran = 'line';
let claimed = false;
let claims = 1;
let verdict: Record<string, unknown> = {};
let uploadBytes = 0;
let pagesServed = 0;
let bytesServed = 0;

function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pad = (n: number, w: number) => String(n).padStart(w, '0');
const money = (x: number) => x.toFixed(2);
const rate = (x: number) => x.toFixed(4);

const KINDS = ['Imprimerie', 'Agence', 'Studio', 'Mairie de', 'Association', 'Cabinet', 'Boulangerie', 'Garage', 'Clinique', 'Librairie'];
const NAMES = ['du Centre', 'Martin', 'des Lilas', 'Saint-Exupéry', 'Horizon', 'Belle Rive', 'Duval & Fils', 'Nord-Est', 'Océane', 'Le Moulin'];
const FIRST = ['Jean', 'Marie', 'Sophie', 'Pierre', 'Lucie', 'Hélène', 'Karim', 'Nadia', 'Thomas', 'Élodie'];
const LAST = ['Dupont', 'Lefèvre', 'Moreau', 'Garnier', 'Rousseau', 'Benali', 'Faure', 'Chevalier', 'Perrin', 'Roux'];
const STEPS = ['Prépresse', 'Impression offset', 'Façonnage', 'Contrôle qualité', 'Expédition', null];
const PRODUCTS = [
  'Flyers A5 quadri recto-verso 135 g couché mat',
  'Cartes de visite 85x55 350 g pelliculage soft touch',
  'Affiches A2 quadri recto 170 g couché brillant',
  'Brochure A4 16 pages agrafée 115 g intérieur 250 g couverture',
  'Dépliant 3 volets A4 roulé 170 g couché satiné',
  'Enveloppes DL 110x220 fenêtre 80 g offset',
  'Kakemono 85x200 bâche 440 g enrouleur',
  'Étiquettes adhésives 50x30 vinyle blanc découpe à la forme',
];

function customer(k: number) {
  const company = k % 5 !== 0;
  if (company) {
    return {
      customer_type: 'company',
      customer_name: `${KINDS[k % 10]} ${NAMES[Math.floor(k / 10) % 10]} ${k}`,
      customer_siret: `${pad(732829320 + k, 9)}${pad(k % 99999, 5)}`,
      customer_vat_number: `FR${pad((k * 7919) % 100000000000, 11)}`,
    };
  }
  return {
    customer_type: 'individual',
    customer_name: `${FIRST[k % 10]} ${LAST[Math.floor(k / 10) % 10]}`,
    customer_siret: null,
    customer_vat_number: null,
  };
}

function build(n: number, g: string): Row[] {
  const rnd = mulberry32(42);
  const out: Row[] = [];
  const base = Date.UTC(2026, 0, 1, 7, 0, 0);
  let orderIdx = 0;
  while (out.length < n) {
    orderIdx += 1;
    const k = Math.floor(rnd() * 1500);
    const c = customer(k);
    const hasContact = rnd() > 0.3;
    const contactName = hasContact ? `${FIRST[(k + 3) % 10]} ${LAST[(k + 7) % 10]}` : null;
    const contactEmail = hasContact ? `${FIRST[(k + 3) % 10].toLowerCase()}.${LAST[(k + 7) % 10].toLowerCase()}${k}@exemple-client.fr` : null;
    const createdIso = new Date(base + orderIdx * 173_000).toISOString().replace('Z', '421+00:00');
    const orderNumber = `CMD-2026-${pad(orderIdx, 6)}`;
    const shared = {
      order_number: orderNumber,
      quote_number: `DEV-2026-${pad(orderIdx, 6)}`,
      order_created_at: createdIso,
      ...c,
      customer_contact_name: contactName,
      customer_contact_email: contactEmail,
      order_status: 'validated',
      production_step_label: STEPS[Math.floor(rnd() * STEPS.length)],
    };
    const lineCount = 1 + Math.floor(rnd() * 5);
    let subtotal = 0;
    const lines: Array<Record<string, unknown>> = [];
    for (let p = 1; p <= lineCount; p++) {
      const qty = [100, 250, 500, 1000, 2500, 5000, 1][Math.floor(rnd() * 7)];
      const bracket = Math.round((20 + rnd() * 4000) * 100) / 100;
      const disc = rnd() > 0.7 ? [0.05, 0.1, 0.15][Math.floor(rnd() * 3)] : 0;
      const sale = Math.round(bracket * (1 - disc) * 100) / 100;
      subtotal += sale;
      lines.push({
        line_position: p,
        line_label: `${PRODUCTS[Math.floor(rnd() * PRODUCTS.length)]} — réf. ${orderNumber}-${p}`,
        quantity: qty,
        bracket_amount_excl_tax: money(bracket),
        discount_rate: disc === 0 ? '0.0000' : rate(disc),
        unit_price_indicative: (sale / qty).toFixed(4),
        sale_price: money(sale),
      });
    }
    if (g === 'order') {
      const gd = rnd() > 0.8 ? Math.round(subtotal * 0.03 * 100) / 100 : 0;
      const net = subtotal - gd;
      const vat = Math.round(net * 0.2 * 100) / 100;
      out.push({
        cursor: { order_created_at: createdIso, order_number: orderNumber },
        payload: {
          ...shared,
          lines_subtotal: money(subtotal),
          global_discount: money(gd),
          effective_discount_rate: subtotal > 0 ? rate(gd / subtotal) : null,
          net_total: money(net),
          vat_rate: '0.2000',
          vat_regime: rnd() > 0.95 ? 'export_eu' : 'metropole_fr',
          vat_amount: money(vat),
          total_incl_tax: money(net + vat),
        },
      });
    } else {
      for (const l of lines) {
        if (out.length >= n) break;
        out.push({
          cursor: { order_created_at: createdIso, order_number: orderNumber, line_position: l.line_position },
          payload: { ...shared, ...l },
        });
      }
    }
  }
  return out;
}

const keyOf = (c: Record<string, unknown>) => `${c.order_number}|${c.line_position ?? ''}`;
let index = new Map<string, number>();

Deno.serve({ port: PORT, hostname: '0.0.0.0' }, async (req) => {
  const url = new URL(req.url);
  const path = url.pathname;
  if (path === '/reset') {
    const n = Number(url.searchParams.get('rows') ?? '1000');
    gran = url.searchParams.get('gran') ?? 'line';
    format = url.searchParams.get('format') ?? 'csv';
    claims = Number(url.searchParams.get('claims') ?? '1');
    rows = build(n, gran);
    index = new Map(rows.map((r, i) => [keyOf(r.cursor), i]));
    claimed = false; verdict = {}; uploadBytes = 0; pagesServed = 0; bytesServed = 0;
    return Response.json({ ok: true, rows: rows.length, gran, format });
  }
  if (path === '/last') {
    return Response.json({ verdict, uploadBytes, pagesServed, bytesServed, rows: rows.length });
  }
  if (path === '/rest/v1/rpc/api_claim_order_exports') {
    await req.text();
    if (claimed) return Response.json([]);
    claimed = true;
    return Response.json(Array.from({ length: claims }, (_u, k) => ({ id: EXPORT_ID.slice(0, -2) + String(k).padStart(2, '0'), tenant_id: TENANT_ID, format, granularity: gran, filters: { created_from: '2026-01-01', created_to: '2026-12-31' } })));
  }
  if (path === '/rest/v1/rpc/api_read_order_export_rows') {
    const body = await req.json();
    const limit = Number(body.p_limit);
    const start = body.p_after == null ? 0 : (index.get(keyOf(body.p_after)) ?? rows.length - 1) + 1;
    const text = JSON.stringify(rows.slice(start, start + limit));
    pagesServed += 1; bytesServed += text.length;
    return new Response(text, { headers: { 'content-type': 'application/json; charset=utf-8' } });
  }
  if (path.startsWith('/rest/v1/commercial_order_exports') && req.method === 'PATCH') {
    const v = await req.json();
    verdict = { ...v, patches: ((verdict as any).patches ?? 0) + 1, statuses: [ ...(((verdict as any).statuses) ?? []), v.status ] };
    return new Response(null, { status: 204 });
  }
  if (path.startsWith('/storage/v1/object/')) {
    const buf = new Uint8Array(await req.arrayBuffer());
    uploadBytes = buf.byteLength;
    return Response.json({ Key: path.replace('/storage/v1/object/', ''), Id: crypto.randomUUID() });
  }
  return new Response(`unhandled ${req.method} ${path}`, { status: 404 });
});
