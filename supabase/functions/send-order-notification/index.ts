/**
 * Edge function `send-order-notification` (Sprint 5, S3.2-residual AC1).
 *
 * Envoie un email Resend a l'admin tenant pour le notifier qu'une nouvelle
 * commande vient d'etre creee par un acheteur B2B.
 *
 * Strategie best-effort : si Resend echoue (API key manquante, rate limit,
 * domaine non verifie), l'echec est logge dans `llm_usage_events` mais ne
 * remonte PAS d'erreur bloquante au caller. Une notification email perdue
 * n'est pas un blocker fonctionnel (la commande est creee, visible dans
 * PortalOrders + DashboardOrders).
 *
 * Heuristique "admin tenant" : tenant_members avec
 *   access_scope='magrit_full' AND permissions->>'can_invite'='true'
 * Si plusieurs candidats (cas frequent : owner + admin), tous sont notifies.
 * Si zero candidat (cas degrade : tenant sans admin actif), warning logge.
 *
 * Body attendu (valide Zod) :
 *   { order_id: uuid, tenant_id: uuid, shop_id: uuid, total_ht: number,
 *     currency: string, base_url: string }
 *
 * Retour :
 *   { ok: true, recipients_count, sent_count, fallback?: boolean }
 *   { ok: false, error, stage? }
 */

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { z } from 'npm:zod@4.4.3';
import { corsHeaders } from '../_shared/cors.ts';
import { formatOrderNotificationEmail, formatShortOrderId, formatEuro } from './_email.ts';

const bodySchema = z.object({
  order_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  shop_id: z.string().uuid(),
  total_ht: z.number().nonnegative(),
  currency: z.string().min(3).max(3).default('EUR'),
  base_url: z.string().url(),
});

async function sendResendEmail(opts: {
  to: string[];
  subject: string;
  html: string;
  text: string;
}): Promise<{ ok: boolean; reason?: string }> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) {
    return { ok: false, reason: 'RESEND_API_KEY non configuree' };
  }
  const fromAddr =
    Deno.env.get('MAGRIT_FROM_EMAIL') || 'Magrit <onboarding@resend.dev>';

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromAddr,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    }),
  });

  if (!resp.ok) {
    const detail = await resp.text();
    return {
      ok: false,
      reason: `Resend ${resp.status}: ${detail.slice(0, 200)}`,
    };
  }
  return { ok: true };
}

/**
 * Log un fallback dans llm_usage_events (endpoint=send-order-notification-fallback)
 * pour traceabilite operationnelle. Best-effort : si l'insert echoue, no-op
 * silencieux (on ne va pas alerter sur un alerting qui echoue).
 */
async function logFallback(
  supa: ReturnType<typeof createClient>,
  context: { order_id: string; tenant_id: string; reason: string },
): Promise<void> {
  try {
    await supa.from('llm_usage_events').insert({
      endpoint: 'send-order-notification-fallback',
      model: 'n/a',
      input_tokens: 0,
      output_tokens: 0,
      tenant_id: context.tenant_id,
      metadata: { order_id: context.order_id, reason: context.reason.slice(0, 500) },
    });
  } catch (e) {
    console.error('[send-order-notification] logFallback failed:', e);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'POST requis' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const rawBody = await req.json();
    const parse = bodySchema.safeParse(rawBody);
    if (!parse.success) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Body invalide', details: parse.error.issues }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    const body = parse.data;

    const supaUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supaUrl || !serviceKey) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Credentials Supabase manquants' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    const supa = createClient(supaUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 1. Recupere infos boutique + buyer email
    const { data: orderRow, error: orderErr } = await supa
      .from('tenant_orders')
      .select('id, created_by, shop_id, shop:shops!inner(name, slug, tenant_id)')
      .eq('id', body.order_id)
      .maybeSingle();

    if (orderErr || !orderRow) {
      await logFallback(supa, {
        order_id: body.order_id,
        tenant_id: body.tenant_id,
        reason: `Order introuvable: ${orderErr?.message ?? 'not found'}`,
      });
      return new Response(
        JSON.stringify({ ok: false, error: 'Order introuvable', stage: 'lookup_order' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const shop = (orderRow as { shop?: { name?: string; slug?: string } }).shop ?? {};
    const shopName = shop.name ?? shop.slug ?? 'votre boutique';

    // Buyer email via auth.admin (service_role required)
    let buyerEmail: string | null = null;
    try {
      const { data: userData } = await supa.auth.admin.getUserById(
        (orderRow as { created_by: string }).created_by,
      );
      buyerEmail = userData?.user?.email ?? null;
    } catch (e) {
      console.warn('[send-order-notification] lookup buyer email failed:', e);
    }

    // 2. Recupere les destinataires (admins tenant = magrit_full + can_invite=true)
    const { data: admins, error: adminsErr } = await supa
      .from('tenant_members')
      .select('user_id')
      .eq('tenant_id', body.tenant_id)
      .eq('access_scope', 'magrit_full')
      .filter('permissions->>can_invite', 'eq', 'true');

    if (adminsErr) {
      await logFallback(supa, {
        order_id: body.order_id,
        tenant_id: body.tenant_id,
        reason: `Admins query failed: ${adminsErr.message}`,
      });
      return new Response(
        JSON.stringify({ ok: false, error: 'Query admins failed', stage: 'lookup_admins' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const adminUserIds = (admins ?? []).map((a) => (a as { user_id: string }).user_id);
    if (adminUserIds.length === 0) {
      await logFallback(supa, {
        order_id: body.order_id,
        tenant_id: body.tenant_id,
        reason: 'Aucun admin tenant (magrit_full + can_invite=true)',
      });
      return new Response(
        JSON.stringify({ ok: true, recipients_count: 0, sent_count: 0, fallback: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Resolve emails admin via auth.admin
    const adminEmails: string[] = [];
    for (const uid of adminUserIds) {
      try {
        const { data: u } = await supa.auth.admin.getUserById(uid);
        if (u?.user?.email) adminEmails.push(u.user.email);
      } catch (e) {
        console.warn('[send-order-notification] lookup admin email failed for', uid, e);
      }
    }

    if (adminEmails.length === 0) {
      await logFallback(supa, {
        order_id: body.order_id,
        tenant_id: body.tenant_id,
        reason: 'Admins trouves mais aucune adresse email resolvable',
      });
      return new Response(
        JSON.stringify({ ok: true, recipients_count: 0, sent_count: 0, fallback: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 3. Build email content
    const orderShortId = formatShortOrderId(body.order_id);
    const dashboardLink = `${body.base_url.replace(/\/$/, '')}/dashboard?tab=orders`;
    const email = formatOrderNotificationEmail({
      orderShortId,
      shopName,
      buyerEmail,
      totalLabel: formatEuro(body.total_ht, body.currency),
      dashboardLink,
    });

    // 4. Send Resend (best-effort, log si echec)
    const result = await sendResendEmail({
      to: adminEmails,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });

    if (!result.ok) {
      await logFallback(supa, {
        order_id: body.order_id,
        tenant_id: body.tenant_id,
        reason: `Resend send failed: ${result.reason ?? 'unknown'}`,
      });
      return new Response(
        JSON.stringify({
          ok: true,
          recipients_count: adminEmails.length,
          sent_count: 0,
          fallback: true,
          reason: result.reason,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        recipients_count: adminEmails.length,
        sent_count: adminEmails.length,
        order_short_id: orderShortId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[send-order-notification] unhandled error:', err);
    return new Response(
      JSON.stringify({ ok: false, error: 'Exception interne', stage: 'unhandled' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
