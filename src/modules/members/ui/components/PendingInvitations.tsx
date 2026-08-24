import { Send } from 'lucide-react';
import { TEST_IDS } from '../../../../shared/presentation/testIds';
import type { MagritInvitationRow } from '../hooks/useMembersWorkspace';

export function PendingInvitations({
  invitations,
  canWrite,
  onResend,
  onRevoke,
}: {
  invitations: readonly MagritInvitationRow[];
  canWrite: boolean;
  onResend(id: string, email: string): void;
  onRevoke(id: string, email: string): void;
}) {
  if (invitations.length === 0) return null;

  return (
    <div className="mb-2">
      <h3 className="mb-2 text-ink" style={{ fontWeight: 400, fontSize: '15px', letterSpacing: '-0.005em' }}>
        Invitations en attente
        <span className="ml-2 text-ink-mute-2 font-mono" style={{ fontSize: '11px' }}>· {invitations.length}</span>
      </h3>
      <div className="border border-line rounded-md overflow-hidden bg-paper">
        <table className="w-full" style={{ borderCollapse: 'collapse' }}>
          <tbody>
            {invitations.map((invitation) => {
              const expired = new Date(invitation.expires_at).getTime() <= Date.now();
              return (
                <tr key={invitation.id} data-testid={TEST_IDS.user.invitationRow} data-invite-id={invitation.id} className="border-b border-line last:border-b-0">
                  <td className="px-4 py-2 text-ink" style={{ fontSize: '13px' }}>{invitation.email}</td>
                  <td className="px-4 py-2 font-mono text-ink-muted" style={{ fontSize: '11px', letterSpacing: '0.04em' }}>{invitation.role.toUpperCase()}</td>
                  <td className="px-4 py-2 text-ink-muted text-right" style={{ fontSize: '11.5px' }}>
                    {expired ? 'Lien expiré' : 'Expire le'}{' '}
                    {new Date(invitation.expires_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {canWrite && (
                      <div className="inline-flex items-center gap-1">
                        <button data-testid={TEST_IDS.user.invitationResendBtn} onClick={() => onResend(invitation.id, invitation.email)} className="inline-flex items-center gap-1 px-2 py-1 rounded text-ink-muted hover:bg-bg" style={{ fontSize: '11.5px', fontWeight: 500 }} title="Renvoyer l email d invitation">
                          <Send className="w-3 h-3" strokeWidth={1.5} /> Renvoyer
                        </button>
                        <button data-testid={TEST_IDS.user.invitationRevokeBtn} onClick={() => onRevoke(invitation.id, invitation.email)} className="inline-flex items-center gap-1 px-2 py-1 rounded text-err-fg hover:bg-err-bg" style={{ fontSize: '11.5px', fontWeight: 500 }}>
                          Revoquer
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
