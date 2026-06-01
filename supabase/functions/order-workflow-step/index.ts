/**
 * Edge function `order-workflow-step` — S-N1-APPROVAL (Sprint 6, 2026-06-01).
 *
 * Déclenche les notifications email Resend après une transition de statut
 * de commande, selon la `notify_policy` du rôle actif sur la transition.
 *
 * Appelée en fire-and-forget par le front après succès de la RPC
 * `transition_tenant_order_status` (ou `update_tenant_order_status` legacy).
 *
 * Body Zod attendu :
 *   {
 *     order_id: uuid,
 *     from_status: string,
 *     to_status: string,
 *     actor_user_id: uuid,
 *     base_url: string (origin pour construire le lien commande)
 *   }
 *
 * Détermine destinataires :
 *   - chain_next : users avec rôles assignés non-révoqués sur la commande
 *     ayant ordering_index strictement supérieur au rôle utilisé pour la
 *     transition (= next step validators dans la chaîne)
 *   - all_roles : tous les users avec rôles assignés non-révoqués sur la
 *     commande (sauf l'acteur lui-même)
 *   - none : aucune notification
 *
 * Réponse :
 *   { ok: true, notified_count: N, policy: 'chain_next'|'all_roles'|'none',
 *     destinations: [{ user_id, email, sent: bool, reason? }] }
 */

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { z } from 'npm:zod@4.4.3';
import { corsHeaders } from '../_shared/cors.ts';

const bodySchema = z.object({
  order_id: z.string().uuid(),
  from_status: z.string(),
  to_status: z.string(),
  actor_user_id: z.string().uuid(),
  base_url: z.string().url(),
});

const STATUS_LABELS_FR: Record<string, string> = {
  draft: 'Brouillon',
  validated: 'Validée',
  in_production: 'En production',
  shipped: 'Expédiée',
  delivered: 'Livrée',
  invoiced: 'Facturée',
  cancelled: 'Annulée',
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function sendResendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ ok: boolean; reason?: string }> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) {
    return { ok: false, reason: 'RESEND_API_KEY non configuree' };
  }
  const fromAddr = Deno.env.get('MAGRIT_FROM_EMAIL') || 'Magrit <onboarding@resend.dev>';

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromAddr,
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    }),
  });

  if (!resp.ok) {
    const detail = await resp.text();
    return { ok: false, reason: `Resend ${resp.status}: ${detail.slice(0, 200)}` };
  }
  return { ok: true };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ ok: false, error: 'POST requis' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  try {
    const rawBody = await req.json();
    const parseResult = bodySchema.safeParse(rawBody);
    if (!parseResult.success) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Body invalide', details: parseResult.error.issues }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    const body = parseResult.data;

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

    // Charge la commande + tenant
    const { data: order, error: orderErr } = await supa
      .from('tenant_orders')
      .select('id, tenant_id, shop_id, created_by, total_ht, currency, notes')
      .eq('id', body.order_id)
      .single();
    if (orderErr || !order) {
      return new Response(
        JSON.stringify({ ok: false, error: 'order_not_found', details: orderErr?.message }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: tenant } = await supa
      .from('tenants').select('name, slug').eq('id', order.tenant_id).maybeSingle();

    // Charge le rôle actif utilisé pour la transition (le rôle avec
    // capability requise par la matrice tenant_order_status_transitions).
    // Si l'actor a plusieurs rôles, on prend celui avec ordering_index
    // le plus bas (le plus "amont" dans la chaîne).
    const { data: transition } = await supa
      .from('tenant_order_status_transitions')
      .select('required_capability, self_service_creator')
      .eq('tenant_id', order.tenant_id)
      .eq('from_status_code', body.from_status)
      .eq('to_status_code', body.to_status)
      .maybeSingle();

    let activeRole: {
      id: string;
      name: string;
      notify_policy: 'chain_next' | 'all_roles' | 'none';
      ordering_index: number;
    } | null = null;

    if (transition?.required_capability) {
      const { data: actorRoles } = await supa
        .from('tenant_order_roles')
        .select(
          'role_definition_id, tenant_role_definitions(id, name, notify_policy, ordering_index, capabilities, archived_at)',
        )
        .eq('order_id', body.order_id)
        .eq('user_id', body.actor_user_id)
        .is('revoked_at', null);

      type Row = {
        role_definition_id: string;
        tenant_role_definitions: {
          id: string;
          name: string;
          notify_policy: 'chain_next' | 'all_roles' | 'none';
          ordering_index: number;
          capabilities: Record<string, boolean>;
          archived_at: string | null;
        } | null;
      };

      const matching = ((actorRoles ?? []) as Row[])
        .filter(
          (r) =>
            r.tenant_role_definitions &&
            r.tenant_role_definitions.archived_at === null &&
            r.tenant_role_definitions.capabilities[transition.required_capability!] === true,
        )
        .map((r) => r.tenant_role_definitions!)
        .sort((a, b) => a.ordering_index - b.ordering_index);

      activeRole = matching[0] ?? null;
    }

    // Fallback : si pas de capability matchée (admin tenant qui passe
    // outre, ou self-service creator), prendre le rôle de l'acteur sur
    // la commande avec ordering_index le plus bas (= le plus "amont"
    // dans la chaîne). Garantit qu'on lit la notify_policy effective de
    // l'acteur même quand la transition n'exige pas sa capability.
    if (!activeRole) {
      const { data: anyActorRoles } = await supa
        .from('tenant_order_roles')
        .select(
          'tenant_role_definitions(id, name, notify_policy, ordering_index, capabilities, archived_at)',
        )
        .eq('order_id', body.order_id)
        .eq('user_id', body.actor_user_id)
        .is('revoked_at', null);

      type AnyActorRow = {
        tenant_role_definitions: {
          id: string;
          name: string;
          notify_policy: 'chain_next' | 'all_roles' | 'none';
          ordering_index: number;
          capabilities: Record<string, boolean>;
          archived_at: string | null;
        } | null;
      };

      const sorted = ((anyActorRoles ?? []) as AnyActorRow[])
        .filter((r) => r.tenant_role_definitions && r.tenant_role_definitions.archived_at === null)
        .map((r) => r.tenant_role_definitions!)
        .sort((a, b) => a.ordering_index - b.ordering_index);

      activeRole = sorted[0] ?? null;
    }

    // Si toujours pas de rôle (acteur sans aucun assignment sur la commande,
    // ex admin tenant pur), défaut 'chain_next' = notifier toute la chaîne.
    const policy: 'chain_next' | 'all_roles' | 'none' = activeRole?.notify_policy ?? 'chain_next';

    if (policy === 'none') {
      return new Response(
        JSON.stringify({ ok: true, notified_count: 0, policy: 'none', destinations: [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Charge tous les assignments non-révoqués sur la commande
    const { data: assignments } = await supa
      .from('tenant_order_roles')
      .select(
        'user_id, tenant_role_definitions(name, notify_policy, ordering_index, archived_at)',
      )
      .eq('order_id', body.order_id)
      .is('revoked_at', null);

    type AssignmentRow = {
      user_id: string;
      tenant_role_definitions: {
        name: string;
        notify_policy: string;
        ordering_index: number;
        archived_at: string | null;
      } | null;
    };

    let recipients = ((assignments ?? []) as AssignmentRow[])
      .filter((r) => r.tenant_role_definitions && r.tenant_role_definitions.archived_at === null)
      .filter((r) => r.user_id !== body.actor_user_id); // jamais l'acteur

    if (policy === 'chain_next' && activeRole) {
      // Next-step validators : ordering_index strictement supérieur
      recipients = recipients.filter(
        (r) => r.tenant_role_definitions!.ordering_index > activeRole!.ordering_index,
      );
    }
    // policy === 'all_roles' : on garde tous les assignments (sauf acteur, déjà filtré)

    // Dédoublonne par user_id (un user avec 2 rôles est notifié 1 seule fois)
    const uniqueUserIds = Array.from(new Set(recipients.map((r) => r.user_id)));

    // Charge les emails des destinataires
    const destinations: Array<{ user_id: string; email: string | null; sent: boolean; reason?: string }> = [];

    const cleanBase = body.base_url.replace(/\/+$/, '');
    const orderShortId = body.order_id.replace(/-/g, '').slice(0, 8).toUpperCase();
    const tenantName = tenant?.name || 'votre espace Magrit';
    const fromLabel = STATUS_LABELS_FR[body.from_status] || body.from_status;
    const toLabel = STATUS_LABELS_FR[body.to_status] || body.to_status;

    for (const userId of uniqueUserIds) {
      const { data: u } = await supa.auth.admin.getUserById(userId);
      const email = u?.user?.email ?? null;
      if (!email) {
        destinations.push({ user_id: userId, email: null, sent: false, reason: 'email_missing' });
        continue;
      }

      const orderLink = tenant?.slug
        ? `${cleanBase}/t/${tenant.slug}/orders?id=${body.order_id}`
        : `${cleanBase}/orders`;

      const subject =
        body.to_status === 'validated'
          ? `Commande #${orderShortId} validée — action possible (${tenantName})`
          : `Commande #${orderShortId} ${toLabel.toLowerCase()} — ${tenantName}`;

      const html = `<!DOCTYPE html>
<html lang="fr"><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a; max-width: 560px; margin: 0 auto; padding: 24px;">
  <p style="font-size: 15px; line-height: 1.5;">Bonjour,</p>
  <p style="font-size: 15px; line-height: 1.5;">
    La commande <strong>#${escapeHtml(orderShortId)}</strong> de l'espace <strong>${escapeHtml(tenantName)}</strong> vient de passer de <strong>${escapeHtml(fromLabel)}</strong> à <strong>${escapeHtml(toLabel)}</strong>.
  </p>
  <p style="font-size: 14px; line-height: 1.5; color: #555;">
    Vous recevez ce message parce qu'un rôle vous a été assigné sur cette commande.
  </p>
  <p style="margin: 28px 0;">
    <a href="${escapeHtml(orderLink)}" style="display: inline-block; background: #1a1a1a; color: #fff; text-decoration: none; padding: 12px 20px; border-radius: 6px; font-size: 14px; font-weight: 500;">
      Voir la commande
    </a>
  </p>
  <p style="font-size: 11px; color: #aaa; margin-top: 32px;">Magrit — copilote IA web-to-print</p>
</body></html>`;

      const text = [
        'Bonjour,',
        '',
        `La commande #${orderShortId} de l'espace "${tenantName}" vient de passer de "${fromLabel}" à "${toLabel}".`,
        '',
        'Vous recevez ce message parce qu\'un rôle vous a été assigné sur cette commande.',
        '',
        `Voir la commande : ${orderLink}`,
        '',
        '— Magrit, copilote IA web-to-print',
      ].join('\n');

      const sendResult = await sendResendEmail({ to: email, subject, html, text });
      destinations.push({
        user_id: userId,
        email,
        sent: sendResult.ok,
        ...(sendResult.reason ? { reason: sendResult.reason } : {}),
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        notified_count: destinations.filter((d) => d.sent).length,
        policy,
        active_role: activeRole ? { name: activeRole.name, ordering_index: activeRole.ordering_index } : null,
        destinations,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('[order-workflow-step] erreur inattendue:', error);
    return new Response(
      JSON.stringify({ ok: false, error: 'Erreur serveur', message: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
