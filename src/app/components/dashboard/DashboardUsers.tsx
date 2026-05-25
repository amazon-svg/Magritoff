/**
 * DashboardUsers — Onglet "Utilisateurs" du dashboard tenant
 * ===========================================================
 * Cet ecran fusionne, dans un seul onglet, les deux populations
 * presentes dans un espace Magrit :
 *
 *   1. UTILISATEURS MAGRIT   — membres du tenant (owner/admin/member/partner)
 *      qui se connectent a l'app + invitations en attente. Couvert E9.2 et E9.3.
 *
 *   2. CONTACTS CRM          — contacts client (entreprise + email + tel) qu'un
 *      imprimeur garde dans son repertoire pour les associer a des devis.
 *
 * E9.2 : CRUD complet (invite, change role, remove) + audit trail.
 * E9.3 : droits granulaires par membership :
 *          - access_scope : 'magrit_full' (tout le dashboard) | 'shop_only'
 *            (acces uniquement a une ou plusieurs boutiques)
 *          - allowed_shop_ids : liste de boutiques accessibles (si shop_only)
 *          - permissions : {can_quote, can_order, can_invite}
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Mail, UserMinus, Shield, Plus, Pencil, Trash2, Users as UsersIcon,
  X, Loader2, Settings, Send,
} from 'lucide-react';
import { supabase } from '/utils/supabase/client';
import {
  useTenant,
  AccessScope,
  MemberPermissions,
  DEFAULT_PERMISSIONS,
} from '../../contexts/TenantContext';
import { useAuth } from '../../contexts/AuthContext';
import { useClients, Client } from '../../contexts/ClientsContext';
import { useShops } from '../../contexts/ShopsContext';
import { TEST_IDS } from '../../lib/testIds';
import { DashboardRolesSection } from './DashboardRolesSection';
import { InviteUserModalV2 } from './InviteUserModalV2';
import { EditUserRolesModal } from './EditUserRolesModal';

// E9.5 — appelle l'edge function send-invitation-email. Best-effort :
// renvoie toujours un objet { sent, link, reason? } pour que le caller
// puisse soit confirmer "email envoye", soit afficher le lien manuel.
//
// R5 (refacto 2026-05-11) : migre vers `supabase.functions.invoke()`
// (ADR-R3 pattern Supabase unique). L auth header est gere automatiquement
// par le SDK.
//
// Conserve UNIQUEMENT pour le bouton "Renvoyer" (resendInvite) — pour les
// nouvelles invitations, R5-bis utilise `invite-member` (transactionnel).
async function callSendInvitationEmail(invitationId: string): Promise<{
  sent: boolean;
  link: string;
  reason?: string;
}> {
  try {
    const { data, error } = await supabase.functions.invoke<{
      ok: boolean;
      sent?: boolean;
      link?: string;
      reason?: string;
      error?: string;
    }>('make-server-e3db71a4/send-invitation-email', {
      body: {
        invitationId,
        baseUrl: window.location.origin,
      },
    });
    if (error || !data?.ok) {
      return {
        sent: false,
        link: '',
        reason: data?.error || error?.message || 'invocation echouee',
      };
    }
    return { sent: !!data.sent, link: data.link || '', reason: data.reason };
  } catch (e) {
    return { sent: false, link: '', reason: String(e) };
  }
}

/**
 * R5-bis (refacto 2026-05-11) — Appelle l'edge `invite-member` transactionnelle
 * qui consolide l'insert tenant_invitations + envoi email Resend dans la
 * meme operation avec rollback si l'email echoue. Resout la race condition
 * B4 (review adversariale §1.1) ou une invitation pouvait exister en DB
 * sans email envoye.
 *
 * Retour :
 *   succes (email envoye) : { sent: true, invitationId, link }
 *   succes degrade (RESEND_API_KEY absente → lien manuel) : { sent: false, invitationId, link, reason }
 *   echec : { sent: false, invitationId: null, link: null, error }
 */
async function callInviteMember(input: {
  email: string;
  role?: 'owner' | 'admin' | 'member' | 'partner';
  tenant_id: string;
  invited_by: string;
  access_scope?: 'magrit_full' | 'shop_only';
  allowed_shop_ids?: string[];
  permissions?: { can_quote: boolean; can_order: boolean; can_invite: boolean };
  // S-USERS-REFONTE Phase A : ids des rôles à propager à l'acceptation.
  role_definition_ids?: string[];
}): Promise<{
  sent: boolean;
  invitationId: string | null;
  link: string | null;
  reason?: string;
  error?: string;
}> {
  try {
    const { data, error } = await supabase.functions.invoke<{
      ok: boolean;
      invitationId?: string;
      sent?: boolean;
      link?: string;
      reason?: string;
      error?: string;
    }>('invite-member', {
      body: {
        ...input,
        baseUrl: window.location.origin,
      },
    });
    if (error || !data?.ok) {
      return {
        sent: false,
        invitationId: null,
        link: null,
        error: data?.error || error?.message || 'invocation echouee',
      };
    }
    return {
      sent: !!data.sent,
      invitationId: data.invitationId ?? null,
      link: data.link ?? null,
      reason: data.reason,
    };
  } catch (e) {
    return {
      sent: false,
      invitationId: null,
      link: null,
      error: String(e),
    };
  }
}

// ────────────────────────────────────────────────────────────────────────────
// SECTION 1 — Utilisateurs Magrit (membres tenant + invitations)
// ────────────────────────────────────────────────────────────────────────────

type Role = 'owner' | 'admin' | 'member' | 'partner';
type InviteRole = Exclude<Role, 'owner'>;

interface MemberRow {
  user_id: string;
  email: string | null;
  role: Role;
  joined_at: string;
  access_scope: AccessScope;
  allowed_shop_ids: string[];
  permissions: MemberPermissions;
}

interface InvitationRow {
  id: string;
  email: string;
  role: InviteRole;
  expires_at: string;
  created_at: string;
  access_scope: AccessScope;
  allowed_shop_ids: string[];
  permissions: MemberPermissions;
}

function MagritUsersSection() {
  const { user } = useAuth();
  const { currentTenant, currentRole, isSuperAdmin } = useTenant();
  const { shops } = useShops();

  const [members, setMembers] = useState<MemberRow[]>([]);
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingRoleFor, setUpdatingRoleFor] = useState<string | null>(null);

  // Form invite
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<InviteRole>('member');
  const [inviteScope, setInviteScope] = useState<AccessScope>('magrit_full');
  const [inviteShopIds, setInviteShopIds] = useState<string[]>([]);
  const [invitePerms, setInvitePerms] = useState<MemberPermissions>(DEFAULT_PERMISSIONS);
  const [sending, setSending] = useState(false);

  // Modale "Modifier les droits"
  const [editingPerms, setEditingPerms] = useState<MemberRow | null>(null);

  const canWrite = currentRole === 'owner' || currentRole === 'admin' || isSuperAdmin;

  const logEvent = async (
    eventType: 'created' | 'role_changed' | 'removed' | 'invited' | 'invitation_revoked',
    targetUserId: string | null,
    metadata: Record<string, unknown> = {}
  ) => {
    if (!currentTenant || !user) return;
    await supabase.from('tenant_member_events').insert({
      tenant_id: currentTenant.id,
      target_user_id: targetUserId,
      event_type: eventType,
      performed_by: user.id,
      metadata,
    });
  };

  const load = async () => {
    if (!currentTenant) return;
    setLoading(true);

    const { data: mem, error: memErr } = await supabase.rpc(
      'get_tenant_members_with_email',
      { p_tenant_id: currentTenant.id }
    );
    if (memErr) console.error('[DashboardUsers] members rpc failed', memErr);

    setMembers(
      ((mem as any[]) || []).map((m) => ({
        user_id: m.user_id,
        email: m.email,
        role: m.role,
        joined_at: m.joined_at,
        access_scope: m.access_scope ?? 'magrit_full',
        allowed_shop_ids: m.allowed_shop_ids ?? [],
        permissions: { ...DEFAULT_PERMISSIONS, ...(m.permissions ?? {}) },
      }))
    );

    const { data: inv } = await supabase
      .from('tenant_invitations')
      .select('id, email, role, expires_at, created_at, access_scope, allowed_shop_ids, permissions')
      .eq('tenant_id', currentTenant.id)
      .is('accepted_at', null)
      .order('created_at', { ascending: false });
    setInvitations(
      ((inv as any[]) || []).map((i) => ({
        ...i,
        access_scope: i.access_scope ?? 'magrit_full',
        allowed_shop_ids: i.allowed_shop_ids ?? [],
        permissions: { ...DEFAULT_PERMISSIONS, ...(i.permissions ?? {}) },
      }))
    );

    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [currentTenant?.id]);

  const resetInviteForm = () => {
    setInviteEmail('');
    setInviteRole('member');
    setInviteScope('magrit_full');
    setInviteShopIds([]);
    setInvitePerms(DEFAULT_PERMISSIONS);
  };

  const sendInvite = async () => {
    if (!currentTenant || !inviteEmail.trim() || !user) return;
    if (inviteScope === 'shop_only' && inviteShopIds.length === 0) {
      alert('Selectionnez au moins une boutique pour un acces shop_only.');
      return;
    }
    setSending(true);
    const cleanedEmail = inviteEmail.trim().toLowerCase();

    // R5-bis (refacto 2026-05-11) : passe par l'edge `invite-member`
    // transactionnelle qui consolide insert + email Resend avec rollback
    // automatique. Resout la race condition B4 (audit refacto §1.1) ou
    // une invitation pouvait exister en DB sans email envoye.
    const result = await callInviteMember({
      email: cleanedEmail,
      role: inviteRole,
      tenant_id: currentTenant.id,
      invited_by: user.id,
      access_scope: inviteScope,
      allowed_shop_ids: inviteScope === 'shop_only' ? inviteShopIds : [],
      permissions: invitePerms,
    });

    if (!result.invitationId) {
      alert("Echec de l'invitation : " + (result.error || 'inconnu'));
      setSending(false);
      return;
    }

    await logEvent('invited', null, {
      email: cleanedEmail,
      role: inviteRole,
      access_scope: inviteScope,
    });

    if (result.sent) {
      alert(`Invitation envoyee par email a ${cleanedEmail}.`);
    } else {
      // Cas degrade : invitation creee mais email non envoye (config Resend
      // absente). L'edge a renvoye ok=true + sent=false + link. On affiche
      // le lien manuel pour transmission.
      prompt(
        `Invitation creee. Email non envoye (${result.reason || 'config manquante'}). Transmettez ce lien au destinataire :`,
        result.link || `${window.location.origin}/invitations/`,
      );
    }
    resetInviteForm();
    setInviteOpen(false);
    await load();
    setSending(false);
  };

  const resendInvite = async (id: string, email: string) => {
    const result = await callSendInvitationEmail(id);
    if (result.sent) {
      alert(`Email d'invitation renvoye a ${email}.`);
    } else {
      const link = result.link || `${window.location.origin}/invitations/`;
      prompt(
        `Email non envoye (${result.reason || 'config manquante'}). Lien d'invitation a transmettre :`,
        link,
      );
    }
  };

  const revokeInvite = async (id: string, email: string) => {
    if (!confirm(`Revoquer l'invitation envoyee a ${email} ?`)) return;
    await supabase.from('tenant_invitations').delete().eq('id', id);
    await logEvent('invitation_revoked', null, { invitation_id: id, email });
    await load();
  };

  const changeRole = async (member: MemberRow, newRole: Role) => {
    if (!currentTenant || member.role === newRole) return;
    if (member.role === 'owner') {
      alert("Impossible de modifier le role d'un owner.");
      return;
    }
    setUpdatingRoleFor(member.user_id);
    const { error } = await supabase
      .from('tenant_members')
      .update({ role: newRole })
      .eq('tenant_id', currentTenant.id)
      .eq('user_id', member.user_id);
    if (error) {
      alert('Echec de la mise a jour du role : ' + error.message);
    } else {
      await logEvent('role_changed', member.user_id, {
        old_role: member.role,
        new_role: newRole,
      });
      await load();
    }
    setUpdatingRoleFor(null);
  };

  const savePermissions = async (
    member: MemberRow,
    nextScope: AccessScope,
    nextShopIds: string[],
    nextPerms: MemberPermissions
  ) => {
    if (!currentTenant) return;
    if (nextScope === 'shop_only' && nextShopIds.length === 0) {
      alert('Selectionnez au moins une boutique pour un acces shop_only.');
      return;
    }
    const { error } = await supabase
      .from('tenant_members')
      .update({
        access_scope: nextScope,
        allowed_shop_ids: nextScope === 'shop_only' ? nextShopIds : [],
        permissions: nextPerms,
      })
      .eq('tenant_id', currentTenant.id)
      .eq('user_id', member.user_id);
    if (error) {
      alert('Echec de la sauvegarde : ' + error.message);
    } else {
      await logEvent('role_changed', member.user_id, {
        access_scope_changed: { from: member.access_scope, to: nextScope },
        permissions: nextPerms,
      });
      setEditingPerms(null);
      await load();
    }
  };

  const removeMember = async (member: MemberRow) => {
    if (!currentTenant) return;
    if (member.role === 'owner') {
      alert('Impossible de retirer un owner.');
      return;
    }
    if (!confirm(
      `Retirer ${member.email ?? member.user_id} de l'espace ?\n\n` +
      "L'utilisateur conservera son compte Magrit, mais perdra l'acces a cet espace."
    )) return;
    const { error } = await supabase
      .from('tenant_members')
      .delete()
      .eq('tenant_id', currentTenant.id)
      .eq('user_id', member.user_id);
    if (error) {
      alert('Echec du retrait : ' + error.message);
    } else {
      await logEvent('removed', member.user_id, {
        email: member.email,
        old_role: member.role,
      });
      await load();
    }
  };

  if (!currentTenant) {
    return (
      <div className="text-ink-muted" style={{ fontSize: '13.5px' }}>
        Aucun tenant actif.
      </div>
    );
  }

  return (
    <section data-testid={TEST_IDS.user.sectionMagrit}>
      <header className="flex items-center justify-between mb-3">
        <div>
          <h2
            className="text-ink m-0"
            style={{ fontWeight: 400, fontSize: '20px', letterSpacing: '-0.015em' }}
          >
            Utilisateurs Magrit
            <span className="ml-2 text-ink-mute-2 font-mono" style={{ fontSize: '12px' }}>
              · {members.length}
            </span>
          </h2>
          <p className="mt-1 text-ink-muted" style={{ fontSize: '13px', fontWeight: 300 }}>
            Personnes qui se connectent a <span className="text-ink">{currentTenant.name}</span>.
          </p>
        </div>
        {canWrite && !inviteOpen && (
          <button
            data-testid={TEST_IDS.user.inviteBtn}
            onClick={() => setInviteOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-ink text-paper hover:bg-black"
            style={{ fontSize: '13px', fontWeight: 500 }}
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={1.8} />
            Inviter
          </button>
        )}
      </header>

      {/* S-USERS-REFONTE Phase A : modal Inviter refait (multi-select rôles).
          L'ancien InviteForm legacy est conservé en code mort (cleanup Phase B). */}
      {canWrite && currentTenant && user && (
        <InviteUserModalV2
          open={inviteOpen}
          tenantId={currentTenant.id}
          invitedBy={user.id}
          baseUrl={window.location.origin}
          onInvited={async () => {
            await load();
          }}
          onClose={() => setInviteOpen(false)}
        />
      )}

      <div className="border border-line rounded-md overflow-hidden bg-paper mb-6 mt-4">
        {loading ? (
          <div className="px-4 py-6 text-center text-ink-muted" style={{ fontSize: '13px' }}>
            Chargement…
          </div>
        ) : members.length === 0 ? (
          <div className="px-4 py-6 text-center text-ink-mute-2" style={{ fontSize: '13px' }}>
            Aucun membre.
          </div>
        ) : (
          <table data-testid={TEST_IDS.user.table} className="w-full" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr className="border-b border-line bg-bg/50">
                <th className="px-4 py-2 text-left font-mono text-ink-mute-2"
                    style={{ fontSize: '10.5px', letterSpacing: '0.06em', fontWeight: 500 }}>
                  Email
                </th>
                <th className="px-4 py-2 text-left font-mono text-ink-mute-2"
                    style={{ fontSize: '10.5px', letterSpacing: '0.06em', fontWeight: 500 }}>
                  Role
                </th>
                <th className="px-4 py-2 text-left font-mono text-ink-mute-2"
                    style={{ fontSize: '10.5px', letterSpacing: '0.06em', fontWeight: 500 }}>
                  Acces
                </th>
                <th className="px-4 py-2 text-right font-mono text-ink-mute-2"
                    style={{ fontSize: '10.5px', letterSpacing: '0.06em', fontWeight: 500 }}>
                  Rejoint
                </th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const isMe = m.user_id === user?.id;
                const isOwner = m.role === 'owner';
                return (
                  <tr
                    key={m.user_id}
                    data-testid={TEST_IDS.user.row}
                    data-user-id={m.user_id}
                    className="border-b border-line last:border-b-0"
                  >
                    <td className="px-4 py-2.5 text-ink" style={{ fontSize: '13px' }}>
                      {m.email ?? <span className="font-mono text-ink-mute-2">{m.user_id.slice(0, 8)}…</span>}
                      {isMe && (
                        <span
                          className="ml-2 px-1.5 py-0.5 rounded bg-brand text-brand-ink font-mono"
                          style={{ fontSize: '9.5px', letterSpacing: '0.04em', fontWeight: 600 }}
                        >
                          VOUS
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {canWrite && !isOwner && !isMe ? (
                        <select
                          data-testid={TEST_IDS.user.roleSelect}
                          value={m.role}
                          disabled={updatingRoleFor === m.user_id}
                          onChange={(e) => changeRole(m, e.target.value as Role)}
                          className="px-2 py-1 border border-line rounded font-mono text-ink bg-paper"
                          style={{ fontSize: '11px', letterSpacing: '0.04em', fontWeight: 600 }}
                        >
                          <option value="admin">ADMIN</option>
                          <option value="member">MEMBER</option>
                          <option value="partner">PARTNER</option>
                        </select>
                      ) : (
                        <RoleBadge role={m.role} />
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <ScopeBadge member={m} shops={shops} />
                    </td>
                    <td
                      className="px-4 py-2.5 text-ink-muted text-right"
                      style={{ fontSize: '12px' }}
                    >
                      {new Date(m.joined_at).toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="inline-flex items-center gap-1">
                        {canWrite && !isOwner && (
                          <button
                            data-testid={TEST_IDS.user.editPermissionsBtn}
                            onClick={() => setEditingPerms(m)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded text-ink-muted hover:bg-line/60 hover:text-ink"
                            style={{ fontSize: '11.5px', fontWeight: 500 }}
                            title="Modifier les droits"
                          >
                            <Settings className="w-3 h-3" strokeWidth={1.5} />
                            Droits
                          </button>
                        )}
                        {canWrite && !isOwner && !isMe && (
                          <button
                            data-testid={TEST_IDS.user.removeBtn}
                            onClick={() => removeMember(m)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded text-err-fg hover:bg-err-bg"
                            style={{ fontSize: '11.5px', fontWeight: 500 }}
                          >
                            <UserMinus className="w-3 h-3" strokeWidth={1.5} />
                            Retirer
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {invitations.length > 0 && (
        <div className="mb-2">
          <h3
            className="mb-2 text-ink"
            style={{ fontWeight: 400, fontSize: '15px', letterSpacing: '-0.005em' }}
          >
            Invitations en attente
            <span className="ml-2 text-ink-mute-2 font-mono" style={{ fontSize: '11px' }}>
              · {invitations.length}
            </span>
          </h3>
          <div className="border border-line rounded-md overflow-hidden bg-paper">
            <table className="w-full" style={{ borderCollapse: 'collapse' }}>
              <tbody>
                {invitations.map((inv) => (
                  <tr
                    key={inv.id}
                    data-testid={TEST_IDS.user.invitationRow}
                    data-invite-id={inv.id}
                    className="border-b border-line last:border-b-0"
                  >
                    <td className="px-4 py-2 text-ink" style={{ fontSize: '13px' }}>
                      {inv.email}
                    </td>
                    <td
                      className="px-4 py-2 font-mono text-ink-muted"
                      style={{ fontSize: '11px', letterSpacing: '0.04em' }}
                    >
                      {inv.role.toUpperCase()}
                    </td>
                    <td className="px-4 py-2">
                      <ScopeBadge member={inv as any} shops={shops} />
                    </td>
                    <td
                      className="px-4 py-2 text-ink-muted text-right"
                      style={{ fontSize: '11.5px' }}
                    >
                      Expire le{' '}
                      {new Date(inv.expires_at).toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: 'short',
                      })}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {canWrite && (
                        <div className="inline-flex items-center gap-1">
                          <button
                            data-testid={TEST_IDS.user.invitationResendBtn}
                            onClick={() => resendInvite(inv.id, inv.email)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded text-ink-muted hover:bg-bg"
                            style={{ fontSize: '11.5px', fontWeight: 500 }}
                            title="Renvoyer l email d invitation"
                          >
                            <Send className="w-3 h-3" strokeWidth={1.5} />
                            Renvoyer
                          </button>
                          <button
                            data-testid={TEST_IDS.user.invitationRevokeBtn}
                            onClick={() => revokeInvite(inv.id, inv.email)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded text-err-fg hover:bg-err-bg"
                            style={{ fontSize: '11.5px', fontWeight: 500 }}
                          >
                            Revoquer
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* S-USERS-REFONTE Phase A : modal Permissions refait (matrix rôles).
          L'ancien EditPermissionsModal legacy est conservé en code mort. */}
      {editingPerms && currentTenant && user && (
        <EditUserRolesModal
          open={true}
          targetUserId={editingPerms.user_id}
          targetUserEmail={editingPerms.email}
          tenantId={currentTenant.id}
          currentUserId={user.id}
          onChanged={async () => {
            await load();
          }}
          onClose={() => setEditingPerms(null)}
        />
      )}
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Sub-components Magrit Users
// ────────────────────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: Role }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono ${
        role === 'owner'
          ? 'bg-brand text-brand-ink'
          : role === 'admin'
          ? 'bg-info-bg text-info-fg'
          : 'bg-bg text-ink-muted'
      }`}
      style={{ fontSize: '10.5px', letterSpacing: '0.04em', fontWeight: 600 }}
    >
      <Shield className="w-3 h-3" strokeWidth={1.5} />
      {role.toUpperCase()}
    </span>
  );
}

function ScopeBadge({
  member,
  shops,
}: {
  member: { access_scope: AccessScope; allowed_shop_ids: string[] };
  shops: { id: string; name: string }[];
}) {
  if (member.access_scope === 'magrit_full') {
    return (
      <span
        className="inline-block px-2 py-0.5 rounded bg-bg text-ink-muted font-mono"
        style={{ fontSize: '10.5px', letterSpacing: '0.04em', fontWeight: 600 }}
      >
        MAGRIT COMPLET
      </span>
    );
  }
  const names = member.allowed_shop_ids
    .map((id) => shops.find((s) => s.id === id)?.name)
    .filter(Boolean) as string[];
  return (
    <span
      className="inline-block px-2 py-0.5 rounded bg-warn-bg text-warn-fg font-mono"
      style={{ fontSize: '10.5px', letterSpacing: '0.04em', fontWeight: 600 }}
      title={names.join(', ')}
    >
      BOUTIQUE · {member.allowed_shop_ids.length}
    </span>
  );
}

function InviteForm(props: {
  email: string;
  role: InviteRole;
  scope: AccessScope;
  shopIds: string[];
  permissions: MemberPermissions;
  shops: { id: string; name: string }[];
  sending: boolean;
  onChangeEmail: (v: string) => void;
  onChangeRole: (v: InviteRole) => void;
  onChangeScope: (v: AccessScope) => void;
  onToggleShop: (id: string) => void;
  onChangePermission: (k: keyof MemberPermissions, v: boolean) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <div data-testid={TEST_IDS.user.inviteModal} className="mt-2 p-4 rounded-md border border-line bg-paper space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex-1 min-w-[240px]">
          <span
            className="block text-ink-muted mb-1"
            style={{ fontSize: '11.5px', fontWeight: 500 }}
          >
            Email du collaborateur
          </span>
          <input
            data-testid={TEST_IDS.user.inviteEmailInput}
            type="email"
            value={props.email}
            onChange={(e) => props.onChangeEmail(e.target.value)}
            placeholder="jean@imprimerie-dupont.fr"
            className="w-full px-3 py-1.5 border border-line rounded-md bg-paper text-ink focus:outline-none focus:border-line-2"
            style={{ fontSize: '13px' }}
          />
        </label>
        <label>
          <span
            className="block text-ink-muted mb-1"
            style={{ fontSize: '11.5px', fontWeight: 500 }}
          >
            Role
          </span>
          <select
            data-testid={TEST_IDS.user.inviteRoleSelect}
            value={props.role}
            onChange={(e) => props.onChangeRole(e.target.value as InviteRole)}
            className="px-3 py-1.5 border border-line rounded-md bg-paper text-ink"
            style={{ fontSize: '13px' }}
          >
            <option value="admin">Admin</option>
            <option value="member">Member</option>
            <option value="partner">Partner (externe)</option>
          </select>
        </label>
      </div>

      <ScopeAndPermissionsFieldset
        scope={props.scope}
        shopIds={props.shopIds}
        permissions={props.permissions}
        shops={props.shops}
        onChangeScope={props.onChangeScope}
        onToggleShop={props.onToggleShop}
        onChangePermission={props.onChangePermission}
      />

      <div className="flex gap-2 pt-2">
        <button
          onClick={props.onCancel}
          className="px-3 py-1.5 border border-line rounded-md text-ink-muted hover:text-ink"
          style={{ fontSize: '13px', fontWeight: 500 }}
        >
          Annuler
        </button>
        <button
          data-testid={TEST_IDS.user.inviteSubmitBtn}
          onClick={props.onSubmit}
          disabled={props.sending || !props.email.trim()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-ink text-paper hover:bg-black disabled:opacity-40"
          style={{ fontSize: '13px', fontWeight: 500 }}
        >
          <Mail className="w-3.5 h-3.5" strokeWidth={1.8} />
          {props.sending ? 'Envoi…' : 'Envoyer l\'invitation'}
        </button>
      </div>
    </div>
  );
}

function ScopeAndPermissionsFieldset(props: {
  scope: AccessScope;
  shopIds: string[];
  permissions: MemberPermissions;
  shops: { id: string; name: string }[];
  onChangeScope: (v: AccessScope) => void;
  onToggleShop: (id: string) => void;
  onChangePermission: (k: keyof MemberPermissions, v: boolean) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <span
          className="block text-ink-muted mb-1.5"
          style={{ fontSize: '11.5px', fontWeight: 500 }}
        >
          Acces
        </span>
        <div className="flex gap-2">
          <ScopeRadio
            current={props.scope}
            value="magrit_full"
            label="Magrit complet"
            description="Voit tout le dashboard"
            onChange={props.onChangeScope}
            testId={TEST_IDS.user.accessScopeRadio}
          />
          <ScopeRadio
            current={props.scope}
            value="shop_only"
            label="Boutique uniquement"
            description="Acces limite a une ou plusieurs boutiques"
            onChange={props.onChangeScope}
            testId={TEST_IDS.user.accessScopeRadio}
          />
        </div>
      </div>

      {props.scope === 'shop_only' && (
        <div data-testid={TEST_IDS.user.allowedShopsMultiselect}>
          <span
            className="block text-ink-muted mb-1.5"
            style={{ fontSize: '11.5px', fontWeight: 500 }}
          >
            Boutiques accessibles
          </span>
          {props.shops.length === 0 ? (
            <p className="text-ink-mute-2" style={{ fontSize: '12px' }}>
              Aucune boutique creee. Creez-en une avant d'inviter un user shop_only.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-1.5">
              {props.shops.map((s) => (
                <label
                  key={s.id}
                  data-testid={TEST_IDS.user.allowedShopOption}
                  data-shop-id={s.id}
                  className="flex items-center gap-2 px-2 py-1 border border-line rounded cursor-pointer hover:bg-line/60"
                >
                  <input
                    type="checkbox"
                    checked={props.shopIds.includes(s.id)}
                    onChange={() => props.onToggleShop(s.id)}
                  />
                  <span style={{ fontSize: '12.5px' }}>{s.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      <div>
        <span
          className="block text-ink-muted mb-1.5"
          style={{ fontSize: '11.5px', fontWeight: 500 }}
        >
          Permissions
        </span>
        <div className="flex flex-wrap gap-3">
          <PermCheckbox
            data-testid={TEST_IDS.user.permissionCanQuoteCheckbox}
            label="Créer des devis"
            checked={props.permissions.can_quote}
            onChange={(v) => props.onChangePermission('can_quote', v)}
          />
          <PermCheckbox
            data-testid={TEST_IDS.user.permissionCanOrderCheckbox}
            label="Passer commande"
            checked={props.permissions.can_order}
            onChange={(v) => props.onChangePermission('can_order', v)}
          />
          <PermCheckbox
            data-testid={TEST_IDS.user.permissionCanInviteCheckbox}
            label="Inviter d'autres utilisateurs"
            checked={props.permissions.can_invite}
            onChange={(v) => props.onChangePermission('can_invite', v)}
          />
        </div>
      </div>
    </div>
  );
}

function ScopeRadio(props: {
  current: AccessScope;
  value: AccessScope;
  label: string;
  description: string;
  onChange: (v: AccessScope) => void;
  testId?: string;
}) {
  const selected = props.current === props.value;
  return (
    <label
      data-testid={props.testId}
      data-scope={props.value}
      className={`flex-1 cursor-pointer p-2.5 rounded border ${
        selected ? 'border-ink bg-bg' : 'border-line hover:bg-line/60'
      }`}
    >
      <input
        type="radio"
        className="sr-only"
        checked={selected}
        onChange={() => props.onChange(props.value)}
      />
      <span className="block text-ink" style={{ fontSize: '13px', fontWeight: selected ? 500 : 400 }}>
        {props.label}
      </span>
      <span className="block text-ink-muted mt-0.5" style={{ fontSize: '11.5px' }}>
        {props.description}
      </span>
    </label>
  );
}

function PermCheckbox(props: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  'data-testid'?: string;
}) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer">
      <input
        data-testid={props['data-testid']}
        type="checkbox"
        checked={props.checked}
        onChange={(e) => props.onChange(e.target.checked)}
      />
      <span className="text-ink" style={{ fontSize: '12.5px' }}>
        {props.label}
      </span>
    </label>
  );
}

function EditPermissionsModal(props: {
  member: MemberRow;
  shops: { id: string; name: string }[];
  onClose: () => void;
  onSave: (scope: AccessScope, shopIds: string[], perms: MemberPermissions) => void;
}) {
  const [scope, setScope] = useState<AccessScope>(props.member.access_scope);
  const [shopIds, setShopIds] = useState<string[]>(props.member.allowed_shop_ids);
  const [perms, setPerms] = useState<MemberPermissions>(props.member.permissions);

  return (
    <div
      data-testid={TEST_IDS.user.permissionsModal}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
      onClick={props.onClose}
    >
      <div
        className="bg-paper rounded-xl shadow-2xl w-full max-w-lg p-5 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        style={{ fontFamily: 'var(--font-ui)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-ink m-0" style={{ fontWeight: 400, fontSize: '17px' }}>
              Modifier les droits
            </h3>
            <p className="mt-1 text-ink-muted" style={{ fontSize: '12px' }}>
              {props.member.email ?? props.member.user_id}
            </p>
          </div>
          <button
            onClick={props.onClose}
            className="p-1 rounded hover:bg-line"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <ScopeAndPermissionsFieldset
          scope={scope}
          shopIds={shopIds}
          permissions={perms}
          shops={props.shops}
          onChangeScope={setScope}
          onToggleShop={(id) =>
            setShopIds((prev) =>
              prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
            )
          }
          onChangePermission={(k, v) => setPerms((p) => ({ ...p, [k]: v }))}
        />

        <div className="flex gap-2 pt-4 mt-2 border-t border-line">
          <button
            onClick={props.onClose}
            className="flex-1 px-3 py-2 border border-line rounded-md text-ink-muted hover:text-ink"
            style={{ fontSize: '13px', fontWeight: 500 }}
          >
            Annuler
          </button>
          <button
            data-testid={TEST_IDS.user.permissionsSaveBtn}
            onClick={() => props.onSave(scope, shopIds, perms)}
            className="flex-1 px-3 py-2 rounded-md bg-ink text-paper hover:bg-black"
            style={{ fontSize: '13px', fontWeight: 500 }}
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// SECTION 2 — Contacts CRM (carnet d'adresses imprimeur)
// ────────────────────────────────────────────────────────────────────────────

type EmptyClient = Omit<Client, 'id' | 'user_id' | 'created_at'>;

const EMPTY_CONTACT: EmptyClient = {
  company: '',
  contact_name: '',
  email: '',
  phone: '',
  address: '',
  notes: '',
};

function CrmContactsSection() {
  const { clients, loading, addClient, updateClient, deleteClient } = useClients();
  const [editing, setEditing] = useState<Client | null>(null);
  const [draft, setDraft] = useState<EmptyClient>(EMPTY_CONTACT);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const openNew = () => {
    setEditing(null);
    setDraft(EMPTY_CONTACT);
    setModalOpen(true);
  };

  const openEdit = (c: Client) => {
    setEditing(c);
    setDraft({
      company: c.company,
      contact_name: c.contact_name,
      email: c.email,
      phone: c.phone,
      address: c.address,
      notes: c.notes,
    });
    setModalOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    if (editing) {
      await updateClient(editing.id, draft);
    } else {
      await addClient(draft);
    }
    setSaving(false);
    setModalOpen(false);
  };

  return (
    <section data-testid={TEST_IDS.user.sectionCrm}>
      <header className="flex items-center justify-between mb-3">
        <div>
          <h2
            className="text-ink m-0"
            style={{ fontWeight: 400, fontSize: '20px', letterSpacing: '-0.015em' }}
          >
            Contacts CRM
            <span className="ml-2 text-ink-mute-2 font-mono" style={{ fontSize: '12px' }}>
              · {clients.length}
            </span>
          </h2>
          <p
            className="mt-1 text-ink-muted"
            style={{ fontSize: '13px', fontWeight: 300 }}
          >
            Carnet d'adresses pour associer un client a un devis ou une commande.
          </p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-3 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Ajouter un contact
        </button>
      </header>

      {loading ? (
        <p className="text-sm text-gray-500">Chargement...</p>
      ) : clients.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <UsersIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Aucun contact. Commencez par en ajouter un.</p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-line rounded-md bg-paper">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-left">
              <tr>
                <th className="px-3 py-2">Societe</th>
                <th className="px-3 py-2">Contact</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Telephone</th>
                <th className="px-3 py-2 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {clients.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium">{c.company}</td>
                  <td className="px-3 py-2">{c.contact_name}</td>
                  <td className="px-3 py-2 text-gray-600">{c.email}</td>
                  <td className="px-3 py-2 text-gray-600">{c.phone}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <button
                        onClick={() => openEdit(c)}
                        className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Supprimer ${c.company} ?`)) deleteClient(c.id);
                        }}
                        className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">
                {editing ? 'Modifier le contact' : 'Nouveau contact'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={submit} className="space-y-3">
              {[
                { key: 'company', label: 'Societe', type: 'text', required: true },
                { key: 'contact_name', label: 'Nom du contact', type: 'text' },
                { key: 'email', label: 'Email', type: 'email' },
                { key: 'phone', label: 'Telephone', type: 'tel' },
                { key: 'address', label: 'Adresse', type: 'text' },
              ].map((f) => (
                <div key={f.key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
                  <input
                    type={f.type}
                    required={f.required}
                    value={(draft as any)[f.key]}
                    onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={draft.notes}
                  onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 font-medium flex items-center justify-center gap-2"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editing ? 'Enregistrer' : 'Creer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// MAIN — DashboardUsers compose les 2 sections
// ────────────────────────────────────────────────────────────────────────────

export function DashboardUsers() {
  return (
    <div data-testid={TEST_IDS.user.page} className="max-w-[1200px] space-y-10" style={{ fontFamily: 'var(--font-ui)' }}>
      <div>
        <h1
          className="text-ink m-0"
          style={{ fontWeight: 300, fontSize: '34px', letterSpacing: '-0.025em' }}
        >
          Utilisateurs et rôles
        </h1>
        <p
          className="mt-1.5 text-ink-muted"
          style={{ fontSize: '13.5px', fontWeight: 300 }}
        >
          Gérez les utilisateurs de votre tenant et les rôles que vous leur attribuez.
        </p>
      </div>

      <MagritUsersSection />

      <hr className="border-line" />

      {/* S-USERS-REFONTE Phase A (2026-05-25) : nouvel onglet Rôles
          (catalog rôles + assignation users via capabilities modulaires).
          La section CrmContactsSection legacy a été retirée (table clients
          reste en DB pour back-compat des 15 fichiers qui import useClients
          — refactor en Phase B). */}
      <DashboardRolesSection />
    </div>
  );
}
