/**
 * DashboardUsers — Onglet "Utilisateurs" du dashboard tenant
 * ===========================================================
 * UM3 (2026-08-14) : l écran sépare les deux populations que l ancien tableau
 * unique mélangeait, conformément aux règles UM1 et au plan UM de Xavier :
 *
 *   1. ÉQUIPE MAGRIT              — les personnes qui travaillent dans
 *      l espace : admin et collaborateurs à rôles. Pas de notion de boutique.
 *   2. UTILISATEURS DES BOUTIQUES — les personnes qui n accèdent qu aux
 *      boutiques clientes. Boutiques affichées PAR NOM, sans jargon
 *      `shop_only`. Population transitoire, appelée à migrer vers des comptes
 *      boutique (SPEC-IDENTITY-STORE-01, UM7).
 *
 * Chaque section porte son propre parcours d invitation (UM3) : la modale
 * s ouvre verrouillée sur le type d accès de la section.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  UserMinus, Shield, Plus, Store,
  Settings, Send,
} from 'lucide-react';
import {
  useTenant,
  AccessScope,
  MemberPermissions,
} from '../../contexts/TenantContext';
import { useAuth } from '../../contexts/AuthContext';
import { useShops } from '../../contexts/ShopsContext';
import { TEST_IDS } from '../../lib/testIds';
import { DashboardRolesSection } from './DashboardRolesSection';
import { InviteUserModalV2 } from './InviteUserModalV2';
import { EditUserRolesModal } from './EditUserRolesModal';
import { InvitationsApiClient } from '../../../modules/invitations';
import { MembersApiClient } from '../../../modules/members';
import { ApiClientError, FetchApiClient } from '../../../platform/api';

type Role = 'admin' | 'member' | 'partner';

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
  role: Role;
  expires_at: string;
  created_at: string;
  access_scope: AccessScope;
  allowed_shop_ids: string[];
  permissions: MemberPermissions;
}

function UsersSections() {
  const { user, session } = useAuth();
  const { currentTenant, currentRole, isSuperAdmin } = useTenant();
  const { shops } = useShops();

  const [members, setMembers] = useState<MemberRow[]>([]);
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingRoleFor, setUpdatingRoleFor] = useState<string | null>(null);

  // UM3 : un seul état pour la modale, typé par le parcours qui l ouvre.
  const [inviteScope, setInviteScope] = useState<AccessScope | null>(null);

  // Modale "Droits" (rôles métier + périmètre)
  const [editingPerms, setEditingPerms] = useState<MemberRow | null>(null);
  const invitationsApi = useMemo(() => new InvitationsApiClient(new FetchApiClient(
    '', globalThis.fetch, () => session?.access_token ?? null,
  )), [session?.access_token]);
  const membersApi = useMemo(() => new MembersApiClient(new FetchApiClient(
    '', globalThis.fetch, () => session?.access_token ?? null,
  )), [session?.access_token]);

  const canWrite = currentRole === 'admin' || isSuperAdmin;

  const load = async () => {
    if (!currentTenant) return;
    setLoading(true);

    try {
      const tenantMembers = await membersApi.list(currentTenant.id);
      setMembers(tenantMembers.map((member) => ({
        user_id: member.userId, email: member.email, role: member.role,
        joined_at: member.joinedAt, access_scope: member.accessScope,
        allowed_shop_ids: member.allowedShopIds,
        permissions: { can_quote: member.permissions.canQuote, can_order: member.permissions.canOrder, can_invite: member.permissions.canInvite },
      })));
    } catch (memberError) {
      console.error('[DashboardUsers] members API failed', memberError);
      setMembers([]);
    }

    try {
      const pending = await invitationsApi.pending(currentTenant.id);
      setInvitations(pending.map((invitation) => ({
        id: invitation.id, email: invitation.email, role: invitation.role,
        expires_at: invitation.expiresAt, created_at: invitation.createdAt,
        access_scope: invitation.accessScope, allowed_shop_ids: invitation.allowedShopIds,
        permissions: {
          can_quote: invitation.permissions.canQuote,
          can_order: invitation.permissions.canOrder,
          can_invite: invitation.permissions.canInvite,
        },
      })));
    } catch (invitationError) {
      console.error('[DashboardUsers] invitations API failed', invitationError);
      setInvitations([]);
    }

    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [currentTenant?.id, invitationsApi, membersApi]);

  const resendInvite = async (id: string, email: string) => {
    let result;
    try {
      result = await invitationsApi.resend(id, window.location.origin);
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
      await invitationsApi.revoke(id);
      await load();
    } catch (error) {
      alert(error instanceof ApiClientError ? error.message : "Echec de la révocation de l'invitation.");
    }
  };

  const changeRole = async (member: MemberRow, newRole: Role) => {
    if (!currentTenant || member.role === newRole) return;
    setUpdatingRoleFor(member.user_id);
    try {
      await membersApi.changeRole(currentTenant.id, member.user_id, { role: newRole });
      await load();
    } catch (error) {
      alert('Echec de la mise a jour du role : ' + (error instanceof Error ? error.message : 'inconnue'));
    }
    setUpdatingRoleFor(null);
  };

  const removeMember = async (member: MemberRow) => {
    if (!currentTenant) return;
    if (!confirm(
      `Retirer ${member.email ?? member.user_id} de l'espace ?\n\n` +
      "L'utilisateur conservera son compte Magrit, mais perdra l'acces a cet espace."
    )) return;
    try {
      await membersApi.remove(currentTenant.id, member.user_id);
      await load();
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

  // UM1 §1 : la population se lit dans le périmètre d accès, pas dans un
  // type de compte. `magrit_full` = équipe ; `shop_only` = utilisateur boutique.
  const teamMembers = members.filter((m) => m.access_scope === 'magrit_full');
  const shopMembers = members.filter((m) => m.access_scope === 'shop_only');
  const teamInvitations = invitations.filter((i) => i.access_scope === 'magrit_full');
  const shopInvitations = invitations.filter((i) => i.access_scope === 'shop_only');

  const dateFr = (value: string) =>
    new Date(value).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });

  const memberActions = (m: MemberRow, isMe: boolean) => (
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
  );

  const invitationRows = (rows: InvitationRow[], showShops: boolean) => (
    <div className="mb-2 mt-4">
      <h3
        className="mb-2 text-ink"
        style={{ fontWeight: 400, fontSize: '15px', letterSpacing: '-0.005em' }}
      >
        Invitations en attente
        <span className="ml-2 text-ink-mute-2 font-mono" style={{ fontSize: '11px' }}>
          · {rows.length}
        </span>
      </h3>
      <div className="border border-line rounded-md overflow-hidden bg-paper">
        <table className="w-full" style={{ borderCollapse: 'collapse' }}>
          <tbody>
            {rows.map((inv) => (
              <tr
                key={inv.id}
                data-testid={TEST_IDS.user.invitationRow}
                data-invite-id={inv.id}
                className="border-b border-line last:border-b-0"
              >
                <td className="px-4 py-2 text-ink" style={{ fontSize: '13px' }}>
                  {inv.email}
                </td>
                <td className="px-4 py-2">
                  {showShops ? (
                    <ShopNames shopIds={inv.allowed_shop_ids} shops={shops} />
                  ) : (
                    <span
                      className="font-mono text-ink-muted"
                      style={{ fontSize: '11px', letterSpacing: '0.04em' }}
                    >
                      {inv.role.toUpperCase()}
                    </span>
                  )}
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
  );

  const headCell = (label: string, align: 'left' | 'right' = 'left') => (
    <th
      className={`px-4 py-2 text-${align} font-mono text-ink-mute-2`}
      style={{ fontSize: '10.5px', letterSpacing: '0.06em', fontWeight: 500 }}
    >
      {label}
    </th>
  );

  return (
    <>
      {/* ── Équipe Magrit ─────────────────────────────────────────────────── */}
      <section data-testid={TEST_IDS.user.sectionMagrit}>
        <header className="flex items-center justify-between mb-3">
          <div>
            <h2
              className="text-ink m-0"
              style={{ fontWeight: 400, fontSize: '20px', letterSpacing: '-0.015em' }}
            >
              Équipe Magrit
              <span className="ml-2 text-ink-mute-2 font-mono" style={{ fontSize: '12px' }}>
                · {teamMembers.length}
              </span>
            </h2>
            <p className="mt-1 text-ink-muted" style={{ fontSize: '13px', fontWeight: 300 }}>
              Les personnes qui travaillent dans <span className="text-ink">{currentTenant.name}</span> :
              administration et rôles métier.
            </p>
          </div>
          {canWrite && (
            <button
              data-testid={TEST_IDS.user.inviteBtn}
              onClick={() => setInviteScope('magrit_full')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-ink text-paper hover:bg-black"
              style={{ fontSize: '13px', fontWeight: 500 }}
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={1.8} />
              Inviter un collaborateur
            </button>
          )}
        </header>

        <div className="border border-line rounded-md overflow-hidden bg-paper mb-2 mt-4">
          {loading ? (
            <div className="px-4 py-6 text-center text-ink-muted" style={{ fontSize: '13px' }}>
              Chargement…
            </div>
          ) : teamMembers.length === 0 ? (
            <div className="px-4 py-6 text-center text-ink-mute-2" style={{ fontSize: '13px' }}>
              Aucun membre.
            </div>
          ) : (
            <table data-testid={TEST_IDS.user.table} className="w-full" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr className="border-b border-line bg-bg/50">
                  {headCell('Email')}
                  {headCell('Role')}
                  {headCell('Rejoint', 'right')}
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {teamMembers.map((m) => {
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
                            <option value="member">MEMBER</option>
                            <option value="partner">PARTNER</option>
                          </select>
                        ) : (
                          <RoleBadge role={m.role} />
                        )}
                      </td>
                      <td
                        className="px-4 py-2.5 text-ink-muted text-right"
                        style={{ fontSize: '12px' }}
                      >
                        {dateFr(m.joined_at)}
                      </td>
                      <td className="px-4 py-2.5 text-right">{memberActions(m, isMe)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {teamInvitations.length > 0 && invitationRows(teamInvitations, false)}
      </section>

      <hr className="border-line my-8" />

      {/* ── Utilisateurs des boutiques ────────────────────────────────────── */}
      <section data-testid={TEST_IDS.user.sectionShops}>
        <header className="flex items-center justify-between mb-3">
          <div>
            <h2
              className="text-ink m-0"
              style={{ fontWeight: 400, fontSize: '20px', letterSpacing: '-0.015em' }}
            >
              Utilisateurs des boutiques
              <span className="ml-2 text-ink-mute-2 font-mono" style={{ fontSize: '12px' }}>
                · {shopMembers.length}
              </span>
            </h2>
            <p className="mt-1 text-ink-muted" style={{ fontSize: '13px', fontWeight: 300 }}>
              Les personnes qui accèdent uniquement à vos boutiques clientes.
            </p>
          </div>
          {canWrite && (
            <button
              data-testid={TEST_IDS.user.inviteShopBtn}
              onClick={() => setInviteScope('shop_only')}
              disabled={shops.length === 0}
              title={shops.length === 0 ? 'Créez une boutique avant d inviter un utilisateur boutique.' : undefined}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-ink text-ink hover:bg-line/60 disabled:opacity-50"
              style={{ fontSize: '13px', fontWeight: 500 }}
            >
              <Store className="w-3.5 h-3.5" strokeWidth={1.8} />
              Inviter un utilisateur boutique
            </button>
          )}
        </header>

        <div className="border border-line rounded-md overflow-hidden bg-paper mb-2 mt-4">
          {loading ? (
            <div className="px-4 py-6 text-center text-ink-muted" style={{ fontSize: '13px' }}>
              Chargement…
            </div>
          ) : shopMembers.length === 0 ? (
            <div className="px-4 py-6 text-center text-ink-mute-2" style={{ fontSize: '13px' }}>
              Aucun utilisateur boutique.
            </div>
          ) : (
            <table className="w-full" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr className="border-b border-line bg-bg/50">
                  {headCell('Email')}
                  {headCell('Boutiques')}
                  {headCell('Rejoint', 'right')}
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {shopMembers.map((m) => {
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
                        <ShopNames shopIds={m.allowed_shop_ids} shops={shops} />
                      </td>
                      <td
                        className="px-4 py-2.5 text-ink-muted text-right"
                        style={{ fontSize: '12px' }}
                      >
                        {dateFr(m.joined_at)}
                      </td>
                      <td className="px-4 py-2.5 text-right">{memberActions(m, isMe)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {shopInvitations.length > 0 && invitationRows(shopInvitations, true)}
      </section>

      {/* UM3 : une seule modale, verrouillée sur le parcours de la section. */}
      {canWrite && currentTenant && user && (
        <InviteUserModalV2
          open={inviteScope !== null}
          tenantId={currentTenant.id}
          baseUrl={window.location.origin}
          initialScope={inviteScope ?? 'magrit_full'}
          lockScope
          onInvited={async () => {
            await load();
          }}
          onClose={() => setInviteScope(null)}
        />
      )}

      {/* Rôles métier + périmètre — même modale pour les deux populations. */}
      {editingPerms && currentTenant && user && (
        <EditUserRolesModal
          open={true}
          targetUserId={editingPerms.user_id}
          targetUserEmail={editingPerms.email}
          tenantId={currentTenant.id}
          onChanged={async () => {
            await load();
          }}
          onClose={() => setEditingPerms(null)}
        />
      )}
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Sous-composants
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
      {role.toUpperCase()}
    </span>
  );
}

/**
 * UM3 : les boutiques accessibles s affichent par leur NOM — le jargon
 * `shop_only` et les compteurs opaques n atteignent plus l écran.
 */
function ShopNames({
  shopIds,
  shops,
}: {
  shopIds: string[];
  shops: { id: string; name: string }[];
}) {
  const names = shopIds
    .map((id) => shops.find((s) => s.id === id)?.name)
    .filter((name): name is string => Boolean(name));
  if (names.length === 0) {
    return (
      <span className="text-ink-mute-2" style={{ fontSize: '12px' }}>
        Aucune boutique
      </span>
    );
  }
  return (
    <span className="inline-flex flex-wrap gap-1">
      {names.map((name) => (
        <span
          key={name}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-bg text-ink-muted"
          style={{ fontSize: '11.5px' }}
        >
          <Store className="w-3 h-3" strokeWidth={1.5} />
          {name}
        </span>
      ))}
    </span>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// MAIN
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
          Votre équipe d un côté, les utilisateurs de vos boutiques de l autre.
        </p>
      </div>

      <UsersSections />

      <hr className="border-line" />

      <DashboardRolesSection />
    </div>
  );
}
