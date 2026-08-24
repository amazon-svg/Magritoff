/**
 * DashboardUsers — Onglet "Utilisateurs" du dashboard tenant
 * ===========================================================
 * Cet écran ne présente que l'équipe Magrit. Les comptes clients boutique
 * sont gérés dans leur boutique et ne partagent ni profils ni permissions.
 */

import { useState } from 'react';
import {
  UserMinus, Shield, Plus, Settings, Send,
} from 'lucide-react';
import {
  useTenant,
  TenantRole,
} from '../../contexts/TenantContext';
import { useAuth } from '../../contexts/AuthContext';
import { TEST_IDS } from '../../lib/testIds';
import { InviteUserModalV2 } from './InviteUserModalV2';
import { EditUserRolesModal } from './EditUserRolesModal';
import { LegacyShopCustomerMigrationSection } from './LegacyShopCustomerMigrationSection';
import { ApiClientError } from '../../../platform/api';
import {
  type MagritMemberRow,
  useMagritUsersManagement,
} from '../../hooks/useMagritUsersManagement';

// ────────────────────────────────────────────────────────────────────────────
// SECTION 1 — Utilisateurs Magrit (membres tenant + invitations)
// ────────────────────────────────────────────────────────────────────────────

type Role = TenantRole;

function MagritUsersSection() {
  const { user } = useAuth();
  const { currentTenant, currentRole, isSuperAdmin } = useTenant();
  const {
    members,
    invitations,
    loading,
    updatingRoleFor,
    reload,
    resendInvitation,
    revokeInvitation,
    changeRole: persistRole,
    removeMember: persistRemoval,
  } = useMagritUsersManagement(currentTenant?.id ?? null);

  // Form invite
  const [inviteOpen, setInviteOpen] = useState(false);

  // Modale "Modifier les droits"
  const [editingPerms, setEditingPerms] = useState<MagritMemberRow | null>(null);

  const canWrite = currentRole === 'admin' || isSuperAdmin;
  const magritMembers = members.filter((member) => member.access_scope === 'magrit_full');

  const resendInvite = async (id: string, email: string) => {
    let result;
    try {
      result = await resendInvitation(id, window.location.origin);
    } catch (error) {
      alert(error instanceof ApiClientError ? error.message : "Echec du renvoi de l'invitation.");
      return;
    }
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
    try {
      await revokeInvitation(id);
    } catch (error) {
      alert(error instanceof ApiClientError ? error.message : "Echec de la révocation de l'invitation.");
    }
  };

  const changeRole = async (member: MagritMemberRow, newRole: Role) => {
    if (!currentTenant || member.role === newRole) return;
    try {
      await persistRole(member, newRole);
    } catch (error) {
      alert('Echec de la mise a jour du role : ' + (error instanceof Error ? error.message : 'inconnue'));
    }
  };

  const removeMember = async (member: MagritMemberRow) => {
    if (!currentTenant) return;
    if (!confirm(
      `Retirer ${member.email ?? member.user_id} de l'espace ?\n\n` +
      "L'utilisateur conservera son compte Magrit, mais perdra l'acces a cet espace."
    )) return;
    try {
      await persistRemoval(member.user_id);
    } catch (error) {
      alert('Echec du retrait : ' + (error instanceof Error ? error.message : 'inconnue'));
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
              · {magritMembers.length}
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

      {/* S-USERS-REFONTE : modal d'invitation multi-rôles via l'API Magrit. */}
      {canWrite && currentTenant && user && (
        <InviteUserModalV2
          open={inviteOpen}
          tenantId={currentTenant.id}
          baseUrl={window.location.origin}
          onInvited={async () => {
            await reload();
          }}
          onClose={() => setInviteOpen(false)}
        />
      )}

      <div className="border border-line rounded-md overflow-hidden bg-paper mb-6 mt-4">
        {loading ? (
          <div className="px-4 py-6 text-center text-ink-muted" style={{ fontSize: '13px' }}>
            Chargement…
          </div>
        ) : magritMembers.length === 0 ? (
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
                  Rejoint
                </th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {magritMembers.map((m) => {
                const isMe = m.user_id === user?.id;
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
                      {canWrite && !isMe ? (
                        <select
                          data-testid={TEST_IDS.user.roleSelect}
                          value={m.role}
                          disabled={updatingRoleFor === m.user_id}
                          onChange={(e) => changeRole(m, e.target.value as Role)}
                          className="px-2 py-1 border border-line rounded font-mono text-ink bg-paper"
                          style={{ fontSize: '11px', letterSpacing: '0.04em', fontWeight: 600 }}
                        >
                          <option value="admin">ADMIN</option>
                          <option value="member">UTILISATEUR</option>
                        </select>
                      ) : (
                        <RoleBadge role={m.role} />
                      )}
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
                        {canWrite && (
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
                        {canWrite && !isMe && (
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

      {/* Les options produit sont les seuls rôles système exposés ici. */}
      {editingPerms && currentTenant && user && (
        <EditUserRolesModal
          open={true}
          targetUserId={editingPerms.user_id}
          targetUserEmail={editingPerms.email}
          targetRole={editingPerms.role}
          tenantId={currentTenant.id}
          onChanged={async () => {
            await reload();
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
        role === 'admin'
          ? 'bg-info-bg text-info-fg'
          : 'bg-bg text-ink-muted'
      }`}
      style={{ fontSize: '10.5px', letterSpacing: '0.04em', fontWeight: 600 }}
    >
      <Shield className="w-3 h-3" strokeWidth={1.5} />
      {role === 'admin' ? 'ADMIN' : 'UTILISATEUR'}
    </span>
  );
}

// SECTION 2 — Contacts CRM SUPPRIME Sprint 10 Phase B users (decision Arnaud
// 2026-06-02 : consolidation utilisateurs via tenant_members uniquement).
// La section etait dead code depuis Phase A : ni appelee ni rendue dans
// DashboardUsers final n'affiche que l'équipe Magrit et la migration legacy.
// Bloc fonctionnel supprime ci-dessous (200+ lignes), historique via git log.


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
          Utilisateurs
        </h1>
        <p
          className="mt-1.5 text-ink-muted"
          style={{ fontSize: '13.5px', fontWeight: 300 }}
        >
          Gérez l’équipe Magrit, les profils administrateur/utilisateur et leurs options.
        </p>
      </div>

      <MagritUsersSection />

      <LegacyShopCustomerMigrationSection />

    </div>
  );
}
