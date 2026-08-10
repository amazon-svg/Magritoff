/**
 * Edge function `shop-sitemap` — S7.13 (Epic 7 gabarit boutique v2).
 *
 * ADR §4.19-4 : sitemap XML par boutique, réservé aux boutiques OUVERTES
 * (`access_mode='self_signup'`). Les boutiques privées (invite_only) sont
 * exclues (404) — elles portent par ailleurs un meta robots noindex côté SPA.
 *
 * GET ?slug=<shop_slug>&base=<origin>
 *   → 200 application/xml : urlset { home boutique, /g/:gamme souscrite }
 *   → 404 si boutique inconnue, inactive ou privée.
 *
 * Lecture service role (gammes souscrites du tenant) ; aucune donnée sensible
 * exposée : uniquement des slugs déjà publics.
 */

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const XML_HEADERS = {
  ...corsHeaders,
  'Content-Type': 'application/xml; charset=utf-8',
  'Cache-Control': 'public, max-age=3600',
};

function xmlEscape(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'GET') {
    return new Response('method_not_allowed', { status: 405, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const slug = url.searchParams.get('slug')?.trim();
  const base = (url.searchParams.get('base') ?? '').replace(/\/+$/, '');
  if (!slug) {
    return new Response('missing_slug', { status: 400, headers: corsHeaders });
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: shop } = await admin
    .from('shops')
    .select('id, slug, tenant_id, active, access_mode')
    .eq('slug', slug)
    .maybeSingle();

  // Boutique inconnue, inactive ou PRIVÉE : pas de sitemap (ADR §4.19-4).
  if (!shop || !shop.active || shop.access_mode !== 'self_signup') {
    return new Response('not_found', { status: 404, headers: corsHeaders });
  }

  // Gammes exposées = gammes racines du PIM (catalogue partagé).
  //
  // REFACTO-VISUELS (2026-08-09) : la lecture de `tenant_gamme_subscriptions`
  // est retirée — l'écran « Gammes actives » qui alimentait cette table a été
  // supprimé (la sélection de ce qui est vendu passe par les bibliothèques
  // puis la boutique). Le repli sur les gammes racines, qui était déjà le
  // chemin réel pour tout tenant n'ayant jamais coché de gamme, devient le
  // seul chemin.
  const { data: roots } = await admin
    .from('product_gammes')
    .select('slug')
    .is('parent_slug', null)
    .order('display_order');
  const gammeSlugs: string[] = (roots ?? []).map((g) => g.slug);

  const origin = base || url.origin;
  const shopBase = `${origin}/shop/${shop.slug}`;
  const urls = [shopBase, ...gammeSlugs.map((g) => `${shopBase}/g/${g}`)];

  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `  <url><loc>${xmlEscape(u)}</loc></url>`).join('\n') +
    `\n</urlset>\n`;

  return new Response(body, { status: 200, headers: XML_HEADERS });
});
