import { Settings, Shield, UserMinus } from 'lucide-react';
import { TEST_IDS } from '../../../../shared/presentation/testIds';
import type { MagritMemberRow, MemberRole } from '../hooks/useMembersWorkspace';

export function MembersTable({
  members,
  loading,
  actorUserId,
  canWrite,
  updatingRoleFor,
  onChangeRole,
  onEditOptions,
  onRemove,
}: {
  members: readonly MagritMemberRow[];
  loading: boolean;
  actorUserId: string | null;
  canWrite: boolean;
  updatingRoleFor: string | null;
  onChangeRole(member: MagritMemberRow, role: MemberRole): void;
  onEditOptions(member: MagritMemberRow): void;
  onRemove(member: MagritMemberRow): void;
}) {
  return (
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
              <th className="px-4 py-2 text-left font-mono text-ink-mute-2" style={{ fontSize: '10.5px', letterSpacing: '0.06em', fontWeight: 500 }}>Email</th>
              <th className="px-4 py-2 text-left font-mono text-ink-mute-2" style={{ fontSize: '10.5px', letterSpacing: '0.06em', fontWeight: 500 }}>Role</th>
              <th className="px-4 py-2 text-left font-mono text-ink-mute-2" style={{ fontSize: '10.5px', letterSpacing: '0.06em', fontWeight: 500 }}>Rejoint</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {members.map((member) => {
              const isMe = member.user_id === actorUserId;
              return (
                <tr key={member.user_id} data-testid={TEST_IDS.user.row} data-user-id={member.user_id} className="border-b border-line last:border-b-0">
                  <td className="px-4 py-2.5 text-ink" style={{ fontSize: '13px' }}>
                    {member.email ?? <span className="font-mono text-ink-mute-2">{member.user_id.slice(0, 8)}…</span>}
                    {isMe && <span className="ml-2 px-1.5 py-0.5 rounded bg-brand text-brand-ink font-mono" style={{ fontSize: '9.5px', letterSpacing: '0.04em', fontWeight: 600 }}>VOUS</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    {canWrite && !isMe ? (
                      <select
                        data-testid={TEST_IDS.user.roleSelect}
                        value={member.role}
                        disabled={updatingRoleFor === member.user_id}
                        onChange={(event) => onChangeRole(member, event.target.value as MemberRole)}
                        className="px-2 py-1 border border-line rounded font-mono text-ink bg-paper"
                        style={{ fontSize: '11px', letterSpacing: '0.04em', fontWeight: 600 }}
                      >
                        <option value="admin">ADMIN</option>
                        <option value="member">UTILISATEUR</option>
                      </select>
                    ) : <RoleBadge role={member.role} />}
                  </td>
                  <td className="px-4 py-2.5 text-ink-muted text-right" style={{ fontSize: '12px' }}>
                    {new Date(member.joined_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="inline-flex items-center gap-1">
                      {canWrite && (
                        <button data-testid={TEST_IDS.user.editPermissionsBtn} onClick={() => onEditOptions(member)} className="inline-flex items-center gap-1 px-2 py-1 rounded text-ink-muted hover:bg-line/60 hover:text-ink" style={{ fontSize: '11.5px', fontWeight: 500 }} title="Modifier les droits">
                          <Settings className="w-3 h-3" strokeWidth={1.5} /> Droits
                        </button>
                      )}
                      {canWrite && !isMe && (
                        <button data-testid={TEST_IDS.user.removeBtn} onClick={() => onRemove(member)} className="inline-flex items-center gap-1 px-2 py-1 rounded text-err-fg hover:bg-err-bg" style={{ fontSize: '11.5px', fontWeight: 500 }}>
                          <UserMinus className="w-3 h-3" strokeWidth={1.5} /> Retirer
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
  );
}
function RoleBadge({ role }: { role: MemberRole }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono ${role === 'admin' ? 'bg-info-bg text-info-fg' : 'bg-bg text-ink-muted'}`} style={{ fontSize: '10.5px', letterSpacing: '0.04em', fontWeight: 600 }}>
      <Shield className="w-3 h-3" strokeWidth={1.5} />
      {role === 'admin' ? 'ADMIN' : 'UTILISATEUR'}
    </span>
  );
}
