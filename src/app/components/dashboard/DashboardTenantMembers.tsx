/**
 * DashboardTenantMembers
 * ──────────────────────
 * Dashboard > Membres : gestion des users du tenant courant.
 *
 * Phase 1 (maintenant) : affichage liste membres + invitations pending + form
 *                        d'invitation minimaliste.
 * Phase 2 (plus tard)  : changement de role inline, retrait, SSO bulk import.
 *
 * Droits :
 *   - lecture : tout membre du tenant
 *   - ecriture (invite/retire/role) : owner + admin
 */

import { useEffect, useState } from 'react';
import { Mail, Plus, UserMinus, Shield } from 'lucide-react';
import { supabase } from '/utils/supabase/client';
import { useTenant } from '../../contexts/TenantContext';
import { useAuth } from '../../contexts/AuthContext';

interface MemberRow {
  user_id: string;
  role: 'owner' | 'admin' | 'member' | 'partner';
  joined_at: string;
  email: string | null;
}

interface InvitationRow {
  id: string;
  email: string;
  role: 'admin' | 'member' | 'partner';
  expires_at: string;
  created_at: string;
}

export function DashboardTenantMembers() {
  const { user } = useAuth();
  const { currentTenant, currentRole } = useTenant();

  const [members, setMembers] = useState<MemberRow[]>([]);
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member' | 'partner'>('member');
  const [sending, setSending] = useState(false);

  const canWrite = currentRole === 'owner' || currentRole === 'admin';

  const load = async () => {
    if (!currentTenant) return;
    setLoading(true);

    // Memberships (auth.users email joined via view ou fallback)
    const { data: mem } = await supabase
      .from('tenant_members')
      .select('user_id, role, joined_at')
      .eq('tenant_id', currentTenant.id)
      .order('joined_at', { ascending: true });

    // On ne peut pas lire auth.users directement cote client. On remonte
    // ce qu'on peut depuis user_preferences (si on a stocke un display_name)
    // ou on se contente de l'id. La V2 en phase 2 ajoutera une vue RPC.
    setMembers(
      (mem || []).map((m: any) => ({
        user_id: m.user_id,
        role: m.role,
        joined_at: m.joined_at,
        email: null,
      }))
    );

    const { data: inv } = await supabase
      .from('tenant_invitations')
      .select('id, email, role, expires_at, created_at')
      .eq('tenant_id', currentTenant.id)
      .is('accepted_at', null)
      .order('created_at', { ascending: false });
    setInvitations((inv as InvitationRow[]) || []);

    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [currentTenant?.id]);

  const sendInvite = async () => {
    if (!currentTenant || !inviteEmail.trim() || !user) return;
    setSending(true);
    const token = crypto.randomUUID().replace(/-/g, '') + Date.now().toString(36);
    const expires = new Date(Date.now() + 14 * 86400_000).toISOString();
    const { error } = await supabase.from('tenant_invitations').insert({
      tenant_id: currentTenant.id,
      email: inviteEmail.trim().toLowerCase(),
      role: inviteRole,
      token,
      expires_at: expires,
      invited_by: user.id,
    });
    if (error) {
      alert('Echec de l\'invitation : ' + error.message);
    } else {
      // TODO(phase2) : trigger un send-email (edge function) avec le token.
      // Pour l'instant on affiche le lien a l'admin qui le copie-colle.
      const link = `${window.location.origin}/invitations/${token}`;
      prompt('Invitation creee. Envoyez ce lien au destinataire :', link);
      setInviteEmail('');
      await load();
    }
    setSending(false);
  };

  const revokeInvite = async (id: string) => {
    if (!confirm('Revoquer cette invitation ?')) return;
    await supabase.from('tenant_invitations').delete().eq('id', id);
    await load();
  };

  const removeMember = async (userId: string) => {
    if (!currentTenant) return;
    if (!confirm('Retirer ce membre du tenant ?')) return;
    await supabase
      .from('tenant_members')
      .delete()
      .eq('tenant_id', currentTenant.id)
      .eq('user_id', userId);
    await load();
  };

  if (!currentTenant) {
    return (
      <div className="text-ink-muted" style={{ fontSize: '13.5px' }}>
        Aucun tenant actif.
      </div>
    );
  }

  return (
    <div className="max-w-[1200px]" style={{ fontFamily: 'var(--font-ui)' }}>
      <div className="mb-6">
        <h1
          className="text-ink m-0"
          style={{ fontWeight: 300, fontSize: '34px', letterSpacing: '-0.025em' }}
        >
          Membres de l'espace
        </h1>
        <p
          className="mt-1.5 text-ink-muted"
          style={{ fontSize: '13.5px', fontWeight: 300 }}
        >
          Qui a acces a <span className="text-ink">{currentTenant.name}</span> et
          avec quel role.
        </p>
      </div>

      {/* ─ Form invitation ─ */}
      {canWrite && (
        <div className="mb-6 p-4 rounded-md border border-line bg-paper flex flex-wrap items-end gap-3">
          <label className="flex-1 min-w-[240px]">
            <span
              className="block text-ink-muted mb-1"
              style={{ fontSize: '11.5px', fontWeight: 500 }}
            >
              Email du collaborateur
            </span>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
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
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as any)}
              className="px-3 py-1.5 border border-line rounded-md bg-paper text-ink"
              style={{ fontSize: '13px' }}
            >
              <option value="admin">Admin</option>
              <option value="member">Member</option>
              <option value="partner">Partner (externe)</option>
            </select>
          </label>
          <button
            onClick={sendInvite}
            disabled={sending || !inviteEmail.trim()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-ink text-paper hover:bg-black disabled:opacity-40"
            style={{ fontSize: '13px', fontWeight: 500 }}
          >
            <Mail className="w-3.5 h-3.5" strokeWidth={1.8} />
            {sending ? 'Envoi…' : 'Inviter'}
          </button>
        </div>
      )}

      {/* ─ Liste membres ─ */}
      <h2
        className="mb-2 text-ink"
        style={{ fontWeight: 300, fontSize: '18px', letterSpacing: '-0.01em' }}
      >
        Membres actifs <span className="text-ink-mute-2 font-mono" style={{ fontSize: '12px' }}>· {members.length}</span>
      </h2>
      <div className="border border-line rounded-md overflow-hidden bg-paper mb-8">
        {loading ? (
          <div className="px-4 py-6 text-center text-ink-muted" style={{ fontSize: '13px' }}>
            Chargement…
          </div>
        ) : members.length === 0 ? (
          <div className="px-4 py-6 text-center text-ink-mute-2" style={{ fontSize: '13px' }}>
            Aucun membre.
          </div>
        ) : (
          <table className="w-full" style={{ borderCollapse: 'collapse' }}>
            <tbody>
              {members.map((m) => (
                <tr key={m.user_id} className="border-b border-line last:border-b-0">
                  <td
                    className="px-4 py-2.5 font-mono text-ink"
                    style={{ fontSize: '12.5px', fontWeight: 500 }}
                  >
                    {m.user_id.slice(0, 8)}…
                    {m.user_id === user?.id && (
                      <span
                        className="ml-2 px-1.5 py-0.5 rounded bg-brand text-brand-ink font-mono"
                        style={{ fontSize: '9.5px', letterSpacing: '0.04em', fontWeight: 600 }}
                      >
                        VOUS
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono ${
                        m.role === 'owner'
                          ? 'bg-brand text-brand-ink'
                          : m.role === 'admin'
                          ? 'bg-info-bg text-info-fg'
                          : 'bg-bg text-ink-muted'
                      }`}
                      style={{ fontSize: '10.5px', letterSpacing: '0.04em', fontWeight: 600 }}
                    >
                      <Shield className="w-3 h-3" strokeWidth={1.5} />
                      {m.role.toUpperCase()}
                    </span>
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
                    {canWrite && m.role !== 'owner' && m.user_id !== user?.id && (
                      <button
                        onClick={() => removeMember(m.user_id)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-err-fg hover:bg-err-bg"
                        style={{ fontSize: '11.5px', fontWeight: 500 }}
                      >
                        <UserMinus className="w-3 h-3" strokeWidth={1.5} />
                        Retirer
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ─ Invitations pending ─ */}
      {invitations.length > 0 && (
        <>
          <h2
            className="mb-2 text-ink"
            style={{ fontWeight: 300, fontSize: '18px', letterSpacing: '-0.01em' }}
          >
            Invitations en attente{' '}
            <span
              className="text-ink-mute-2 font-mono"
              style={{ fontSize: '12px' }}
            >
              · {invitations.length}
            </span>
          </h2>
          <div className="border border-line rounded-md overflow-hidden bg-paper">
            <table className="w-full" style={{ borderCollapse: 'collapse' }}>
              <tbody>
                {invitations.map((inv) => (
                  <tr key={inv.id} className="border-b border-line last:border-b-0">
                    <td
                      className="px-4 py-2 text-ink"
                      style={{ fontSize: '13px' }}
                    >
                      {inv.email}
                    </td>
                    <td className="px-4 py-2 font-mono text-ink-muted" style={{ fontSize: '11px' }}>
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
                        <button
                          onClick={() => revokeInvite(inv.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded text-err-fg hover:bg-err-bg"
                          style={{ fontSize: '11.5px', fontWeight: 500 }}
                        >
                          Revoquer
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
