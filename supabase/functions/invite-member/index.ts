/**
 * Edge function `invite-member` - R5-bis (refacto 2026-05-11).
 *
 * Resout la race condition B4 (audit refacto §1.1) : avant cette function,
 * DashboardUsers.sendInvite() faisait 2 appels separes (insert
 * tenant_invitations + fetch send-invitation-email). Si l'email Resend
 * echouait, l'invitation existait en DB sans email envoye.
 *
 * Cette function consolide les 2 etapes en une transaction edge avec
 * rollback : si Resend echoue, la ligne tenant_invitations inseree est
 * supprimee, et le caller recoit une erreur explicite.
 *
 * Body attendu (valide via Zod) :
 *   {
 *     email: string,
 *     role: 'owner' | 'admin' | 'member' | 'partner',
 *     tenant_id: string (uuid),
 *     invited_by: string (uuid),
 *     access_scope: 'magrit_full' | 'shop_only',
 *     allowed_shop_ids: string[],
 *     permissions: { can_quote: bool, can_order: bool, can_invite: bool },
 *     baseUrl: string (origin pour construire le lien /invitations/{token})
 *   }
 *
 * Retour :
 *   succes : { ok: true, invitationId, sent: bool, link, reason?: string }
 *   erreur : { ok: false, error: string, stage?: 'insert' | 'email' | 'rollback' }
 */

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { z } from 'npm:zod@4.4.3';
import { corsHeaders } from '../_shared/cors.ts';

const ROLE_LABELS_FR: Record<string, string> = {
  owner: 'Proprietaire',
  admin: 'Administrateur',
  member: 'Membre',
  partner: 'Partenaire',
};

// S-USERS-REFONTE Phase A (2026-05-25) : ajout role_definition_ids pour
// propager les rôles à l'acceptation (cf. migration 20260525000200 +
// accept_tenant_invitation étendue). Les anciens champs role/access_scope/
// permissions restent OPTIONNELS pour back-compat (legacy invite flows).
const inviteBodySchema = z.object({
  email: z.string().email(),
  // Legacy : reste optionnel et utilisé pour back-compat. Le modal refait
  // envoie 'member' par défaut + access_scope='magrit_full' + permissions
  // legacy minimales, mais c'est role_definition_ids qui détermine vraiment
  // les capabilités à l'acceptation.
  role: z.enum(['owner', 'admin', 'member', 'partner']).default('member'),
  tenant_id: z.string().uuid(),
  invited_by: z.string().uuid(),
  access_scope: z.enum(['magrit_full', 'shop_only']).default('magrit_full'),
  allowed_shop_ids: z.array(z.string().uuid()).default([]),
  permissions: z
    .object({
      can_quote: z.boolean().default(true),
      can_order: z.boolean().default(true),
      can_invite: z.boolean().default(false),
    })
    .default({ can_quote: true, can_order: true, can_invite: false }),
  /**
   * S-USERS-REFONTE Phase A : ids des tenant_role_definitions à assigner
   * à l'acceptation. Vide = pas de rôles propagés (back-compat legacy).
   * Le RPC accept_tenant_invitation crée les tenant_role_assignments
   * automatiquement après création du tenant_member.
   */
  role_definition_ids: z.array(z.string().uuid()).default([]),
  baseUrl: z.string().url(),
});

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
      to: [opts.to],
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
    const parseResult = inviteBodySchema.safeParse(rawBody);
    if (!parseResult.success) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: 'Body invalide',
          details: parseResult.error.issues,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    const body = parseResult.data;

    const supaUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!supaUrl || !serviceKey || !anonKey) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Credentials Supabase manquants' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    const supa = createClient(supaUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // ─── S9 audit sécurité (Sprint 9, 2026-06-01) : durcissements R5-bis P1 ───
    // Avant : edge faisait confiance au caller pour invited_by + tenant_id.
    // Un user authentifié forgeant invited_by/tenant_id pouvait inviter sur
    // n'importe quel tenant. Durcissements en place :
    //   1. Auth check : extraire JWT caller, vérifier que body.invited_by ==
    //      caller.id. Empêche forgery du champ invited_by.
    //   2. Capability check : vérifier que caller a 'can_invite' sur le tenant
    //      cible (via user_has_capability Phase A).
    //   3. Validation role_definition_ids ⊂ tenant : éviter pollution avec
    //      des rôles d'un autre tenant.
    //   4. Idempotence : refuser si invitation pending non-acceptée non-
    //      expirée existe déjà pour (email, tenant_id).
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Authorization Bearer required', stage: 'auth' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    const supaUser = createClient(supaUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: callerData, error: callerErr } = await supaUser.auth.getUser();
    if (callerErr || !callerData?.user) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Invalid or expired JWT', stage: 'auth' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    const callerId = callerData.user.id;

    if (callerId !== body.invited_by) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: 'invited_by_mismatch: caller JWT id does not match body.invited_by',
          stage: 'auth',
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Check capability can_invite sur le tenant cible (via Phase A)
    const { data: hasInvite, error: capErr } = await supaUser.rpc('user_has_capability', {
      p_tenant_id: body.tenant_id,
      p_capability: 'can_invite',
    });
    if (capErr) {
      return new Response(
        JSON.stringify({ ok: false, error: `Capability check failed: ${capErr.message}`, stage: 'auth' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    if (hasInvite !== true) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: 'permission_denied: caller lacks can_invite capability on tenant',
          stage: 'auth',
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Validation role_definition_ids ⊂ tenant cible (anti-pollution)
    if (body.role_definition_ids.length > 0) {
      const { data: validRoles, error: rolesErr } = await supa
        .from('tenant_role_definitions')
        .select('id')
        .eq('tenant_id', body.tenant_id)
        .in('id', body.role_definition_ids);
      if (rolesErr) {
        return new Response(
          JSON.stringify({ ok: false, error: `Roles check failed: ${rolesErr.message}`, stage: 'auth' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      if ((validRoles?.length ?? 0) !== body.role_definition_ids.length) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: 'role_mismatch_tenant: some role_definition_ids do not belong to target tenant',
            stage: 'auth',
          }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    // Idempotence : pas de doublon pending non-expiré pour (email, tenant_id)
    const emailLower = body.email.toLowerCase().trim();
    const { data: existingPending } = await supa
      .from('tenant_invitations')
      .select('id, token, expires_at')
      .eq('tenant_id', body.tenant_id)
      .eq('email', emailLower)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();
    if (existingPending) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: 'duplicate_pending: une invitation pending existe deja pour ce email/tenant',
          existing_invitation_id: existingPending.id,
          stage: 'idempotency',
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Etape 1 : insert tenant_invitations (avec token genere)
    const token =
      crypto.randomUUID().replace(/-/g, '') + Date.now().toString(36);
    const expires = new Date(Date.now() + 14 * 86_400_000).toISOString();

    const { data: inserted, error: insertErr } = await supa
      .from('tenant_invitations')
      .insert({
        tenant_id: body.tenant_id,
        email: body.email.toLowerCase().trim(),
        role: body.role,
        token,
        expires_at: expires,
        invited_by: body.invited_by,
        access_scope: body.access_scope,
        allowed_shop_ids:
          body.access_scope === 'shop_only' ? body.allowed_shop_ids : [],
        permissions: body.permissions,
        // S-USERS-REFONTE Phase A : ids des rôles à propager à l'acceptation
        // (cf. accept_tenant_invitation RPC qui les insère en
        // tenant_role_assignments automatiquement).
        pending_role_ids: body.role_definition_ids,
      })
      .select('id, token')
      .single();

    if (insertErr || !inserted) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: insertErr?.message || 'Insert tenant_invitations echec',
          stage: 'insert',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Etape 2 : recuperer le contexte tenant + inviteur pour le mail
    const { data: tenant } = await supa
      .from('tenants')
      .select('name, slug')
      .eq('id', body.tenant_id)
      .maybeSingle();

    let inviterEmail: string | null = null;
    const { data: inviter } = await supa.auth.admin.getUserById(body.invited_by);
    inviterEmail = inviter?.user?.email ?? null;

    const cleanBase = body.baseUrl.replace(/\/+$/, '');
    const link = `${cleanBase}/invitations/${inserted.token}`;

    const tenantName = tenant?.name || 'votre espace Magrit';
    const roleLabel = ROLE_LABELS_FR[body.role] || body.role;
    const expiresFr = new Date(expires).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });

    const subject = inviterEmail
      ? `${inviterEmail} vous invite a rejoindre ${tenantName} sur Magrit`
      : `Invitation a rejoindre ${tenantName} sur Magrit`;

    const intro = inviterEmail
      ? `${escapeHtml(inviterEmail)} vous a invite(e) a rejoindre l'espace <strong>${escapeHtml(tenantName)}</strong> sur Magrit.`
      : `Vous avez ete invite(e) a rejoindre l'espace <strong>${escapeHtml(tenantName)}</strong> sur Magrit.`;

    const html = `<!DOCTYPE html>
<html lang="fr">
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a; max-width: 560px; margin: 0 auto; padding: 24px;">
  <p style="font-size: 15px; line-height: 1.5;">Bonjour,</p>
  <p style="font-size: 15px; line-height: 1.5;">${intro}</p>
  <p style="font-size: 14px; line-height: 1.5; color: #555;">
    Role : <strong>${escapeHtml(roleLabel)}</strong><br/>
    Cette invitation expire le ${escapeHtml(expiresFr)}.
  </p>
  <p style="margin: 28px 0;">
    <a href="${escapeHtml(link)}" style="display: inline-block; background: #1a1a1a; color: #fff; text-decoration: none; padding: 12px 20px; border-radius: 6px; font-size: 14px; font-weight: 500;">
      Accepter l'invitation
    </a>
  </p>
  <p style="font-size: 12px; color: #888; line-height: 1.5;">
    Ou copiez ce lien : <br/>
    <a href="${escapeHtml(link)}" style="color: #555; word-break: break-all;">${escapeHtml(link)}</a>
  </p>
  <p style="font-size: 12px; color: #888; line-height: 1.5; margin-top: 32px;">
    Si vous n'attendiez pas cette invitation, ignorez simplement ce message.
  </p>
  <p style="font-size: 11px; color: #aaa; margin-top: 32px;">Magrit — copilote IA web-to-print</p>
</body>
</html>`;

    const text = [
      'Bonjour,',
      '',
      inviterEmail
        ? `${inviterEmail} vous a invite(e) a rejoindre l'espace "${tenantName}" sur Magrit.`
        : `Vous avez ete invite(e) a rejoindre l'espace "${tenantName}" sur Magrit.`,
      '',
      `Role : ${roleLabel}`,
      `Cette invitation expire le ${expiresFr}.`,
      '',
      "Pour l'accepter, ouvrez ce lien :",
      link,
      '',
      "Si vous n'attendiez pas cette invitation, ignorez simplement ce message.",
      '',
      '— Magrit, copilote IA web-to-print',
    ].join('\n');

    // Etape 3 : envoyer l'email Resend
    const emailResult = await sendResendEmail({
      to: body.email.toLowerCase().trim(),
      subject,
      html,
      text,
    });

    // Etape 4 : si email fail → rollback ou degrade selon nature
    if (!emailResult.ok) {
      // S-USERS-REFONTE Phase A complement (2026-05-25) : distinguer
      // erreurs de CONFIG Resend (API key absente, domaine non verifie,
      // sender invalide → 4xx Resend) vs vraies PANNES (5xx, timeout
      // reseau). Pour les erreurs config, on garde l'invitation et on
      // retourne le lien manuel — l'admin peut transmettre puis fixer
      // la config Resend en parallele. Evite que l'utilisateur soit
      // bloque par un probleme infra sans impact sur le flow metier.
      const reason = emailResult.reason ?? '';
      const isConfigMissing = reason.includes('RESEND_API_KEY non configuree');
      const isResend4xx = /Resend 4\d\d:/.test(reason);
      const isConfigError = isConfigMissing || isResend4xx;

      if (isConfigError) {
        // Garde l'invitation, retourne le lien pour transmission manuelle.
        // Le caller (front) decide d'afficher un prompt avec le lien ou un
        // toast informatif "email non envoye, lien copie".
        return new Response(
          JSON.stringify({
            ok: true,
            invitationId: inserted.id,
            sent: false,
            link,
            reason,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      // Erreur Resend reelle (5xx ou reseau) → rollback transactionnel
      const { error: rollbackErr } = await supa
        .from('tenant_invitations')
        .delete()
        .eq('id', inserted.id);

      if (rollbackErr) {
        console.error(
          '[invite-member] rollback failed (invitation orpheline) :',
          rollbackErr.message,
        );
        return new Response(
          JSON.stringify({
            ok: false,
            error: `Email Resend echec (${emailResult.reason}) ET rollback echec (${rollbackErr.message})`,
            stage: 'rollback',
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      return new Response(
        JSON.stringify({
          ok: false,
          error: `Email Resend echec : ${emailResult.reason}. Invitation supprimee (rollback OK).`,
          stage: 'email',
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Succes complet : invitation + email envoye
    return new Response(
      JSON.stringify({
        ok: true,
        invitationId: inserted.id,
        sent: true,
        link,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('[invite-member] erreur inattendue :', error);
    return new Response(
      JSON.stringify({
        ok: false,
        error: 'Erreur serveur',
        message: String(error),
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
