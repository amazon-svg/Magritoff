/**
 * MembersPage — Administration de l'équipe Magrit du tenant
 * ===========================================================
 * Cet écran ne présente que l'équipe Magrit. Les comptes clients boutique
 * sont gérés dans leur boutique et ne partagent ni profils ni permissions.
 */

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { LegacyShopCustomerMigrationSection } from '../../../shop-customers/ui';
import { ApiClientError } from '../../../../platform/api';
import { useWorkspaceUiRuntime } from '../../../../platform/runtime/workspace-ui-runtime';
import { TEST_IDS } from '../../../../shared/presentation/testIds';
import { InviteMemberDialog } from '../components/InviteMemberDialog';
import { EditMemberOptionsDialog } from '../components/EditMemberOptionsDialog';
import { MembersTable } from '../components/MembersTable';
import { PendingInvitations } from '../components/PendingInvitations';
import {
  type MagritMemberRow,
  type MemberRole,
  useMembersWorkspace,
} from '../hooks/useMembersWorkspace';

// ────────────────────────────────────────────────────────────────────────────
// SECTION 1 — Utilisateurs Magrit (membres tenant + invitations)
// ────────────────────────────────────────────────────────────────────────────

type Role = MemberRole;

function MagritUsersSection() {
  const { actor, tenant: currentTenant, isSuperAdmin } = useWorkspaceUiRuntime();
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
  } = useMembersWorkspace(currentTenant?.id ?? null);

  // Form invite
  const [inviteOpen, setInviteOpen] = useState(false);

  // Modale "Modifier les droits"
  const [editingPerms, setEditingPerms] = useState<MagritMemberRow | null>(null);

  const canWrite = currentTenant?.role === 'admin' || isSuperAdmin;
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
      {canWrite && currentTenant && actor && (
        <InviteMemberDialog
          open={inviteOpen}
          tenantId={currentTenant.id}
          baseUrl={window.location.origin}
          onInvited={async () => {
            await reload();
          }}
          onClose={() => setInviteOpen(false)}
        />
      )}

      <MembersTable
        members={magritMembers}
        loading={loading}
        actorUserId={actor?.userId ?? null}
        canWrite={canWrite}
        updatingRoleFor={updatingRoleFor}
        onChangeRole={changeRole}
        onEditOptions={setEditingPerms}
        onRemove={removeMember}
      />

      <PendingInvitations
        invitations={invitations}
        canWrite={canWrite}
        onResend={resendInvite}
        onRevoke={revokeInvite}
      />

      {/* Les options produit sont les seuls rôles système exposés ici. */}
      {editingPerms && currentTenant && actor && (
        <EditMemberOptionsDialog
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

// SECTION 2 — Contacts CRM SUPPRIME Sprint 10 Phase B users (decision Arnaud
// 2026-06-02 : consolidation utilisateurs via tenant_members uniquement).
// La section etait dead code depuis Phase A : ni appelee ni rendue dans
// MembersPage n'affiche que l'équipe Magrit et la migration legacy.
// Bloc fonctionnel supprime ci-dessous (200+ lignes), historique via git log.


// ────────────────────────────────────────────────────────────────────────────
// MAIN — MembersPage compose les deux sections
// ────────────────────────────────────────────────────────────────────────────

export function MembersPage() {
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

      {/*
        E10.5 CA1 — cet ecran ne liste que les membres internes du tenant
        (tenant_members) ; aucun interlocuteur client (customer_contacts,
        E10.4) n y apparait. `sectionInternal` enveloppe la meme section que
        `sectionMagrit` (dual-tag) : c est le testid cible du parcours P12.
      */}
      <div data-testid={TEST_IDS.user.sectionInternal}>
        <MagritUsersSection />
      </div>

      <LegacyShopCustomerMigrationSection />

    </div>
  );
}
