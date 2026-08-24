/**
 * Gestion des options fonctionnelles d'un utilisateur Magrit.
 * Le catalogue interne des rôles n'est jamais exposé : seuls les deux
 * produits optionnels Boutiques et Commandes sont présentés.
 */

import { useMemo } from 'react';
import { Loader2, X, Check } from 'lucide-react';
import { TEST_IDS } from '../../../../shared/presentation/testIds';
import { useMemberOptions } from '../hooks/useMemberOptions';

export interface EditMemberOptionsDialogProps {
  open: boolean;
  /** UUID + email de l'user dont on édite les rôles. */
  targetUserId: string;
  targetUserEmail: string | null;
  targetRole: 'admin' | 'member';
  tenantId: string;
  /** Callback après une modification (refresh parent). */
  onChanged: () => void | Promise<void>;
  onClose: () => void;
}

export function EditMemberOptionsDialog({
  open,
  targetUserId,
  targetUserEmail,
  targetRole,
  tenantId,
  onChanged,
  onClose,
}: EditMemberOptionsDialogProps) {
  const {
    roles,
    loading,
    error,
    pendingRoleIds,
    assignmentByRoleId,
    toggleAssignment,
  } = useMemberOptions({ open, tenantId, targetUserId, onChanged });

  const options = useMemo(
    () => roles.filter((role) =>
      role.systemKey === 'option_shops' || role.systemKey === 'option_orders'),
    [roles],
  );

  if (!open) return null;

  return (
    <div
      data-testid={TEST_IDS.user.permissionsModal}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-paper border border-line rounded-lg w-full max-w-md shadow-xl">
        <header className="flex items-center justify-between px-5 py-3 border-b border-line">
          <div>
            <h3 className="m-0 text-ink" style={{ fontSize: '16px', fontWeight: 500 }}>
              Options de l’utilisateur
            </h3>
            <p className="m-0 mt-0.5 text-ink-muted" style={{ fontSize: '12px' }}>
              {targetUserEmail ?? targetUserId}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-bg rounded"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="p-5 space-y-3">
          {loading ? (
            <div className="flex items-center gap-2 text-ink-muted" style={{ fontSize: '12.5px' }}>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Chargement…
            </div>
          ) : (
          <>
          {targetRole === 'admin' ? (
            <p className="m-0 rounded-md border border-info-fg/20 bg-info-bg px-3 py-2 text-info-fg" style={{ fontSize: '12px' }}>
              Un administrateur dispose de tous les droits. Les options ne s’appliquent pas à ce profil.
            </p>
          ) : options.length === 0 ? (
            <p className="text-ink-muted" style={{ fontSize: '12.5px' }}>
              Aucune option disponible pour cet espace.
            </p>
          ) : (
            <div className="space-y-1.5 max-h-80 overflow-y-auto">
              {options.map((r) => {
                const active = assignmentByRoleId.has(r.id);
                const isPending = pendingRoleIds.has(r.id);
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => toggleAssignment(r.id)}
                    disabled={isPending}
                    data-testid={TEST_IDS.user.assignmentToggle}
                    data-user-id={targetUserId}
                    data-role-id={r.id}
                    aria-pressed={active}
                    className={`w-full flex items-start gap-2.5 px-3 py-2 rounded border text-left transition-colors disabled:opacity-50 ${
                      active
                        ? 'bg-ok-bg border-ok-fg/40'
                        : 'bg-paper border-line hover:border-ink-mute-2'
                    }`}
                  >
                    <span
                      className={`mt-0.5 inline-flex items-center justify-center w-5 h-5 rounded border shrink-0 ${
                        active
                          ? 'bg-ok-fg border-ok-fg text-paper'
                          : 'bg-paper border-line'
                      }`}
                    >
                      {isPending ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : active ? (
                        <Check className="w-3.5 h-3.5" strokeWidth={3} />
                      ) : null}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-ink" style={{ fontSize: '13px', fontWeight: 500 }}>
                        {r.name}
                      </div>
                      {r.description && (
                        <div
                          className="text-ink-muted mt-0.5"
                          style={{ fontSize: '11.5px', fontWeight: 400 }}
                        >
                          {r.description}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="px-3 py-2 rounded bg-err-bg border border-err-fg/20 text-err-fg"
              style={{ fontSize: '12.5px' }}
            >
              {error}
            </div>
          )}
          </>
          )}
        </div>

        <footer className="flex justify-end px-5 py-3 border-t border-line">
          <button
            onClick={onClose}
            className="px-3 py-1.5 border border-line rounded-md text-ink hover:bg-bg"
            style={{ fontSize: '13px', fontWeight: 500 }}
          >
            Fermer
          </button>
        </footer>
      </div>
    </div>
  );
}
