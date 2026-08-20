/**
 * InviteUserModalV2 — Modal d'invitation refait Phase A S-USERS-REFONTE (2026-05-25).
 *
 * Remplace l'ancien InviteForm legacy qui exposait role (enum) +
 * access_scope + allowed_shop_ids + permissions jsonb. Désormais :
 *
 *   - Email du futur user
 *   - Multi-select des rôles du tenant à appliquer à l'acceptation
 *     (parmi les 5 presets seedés : Owner, Admin, Acheteur, Validateur,
 *     Producteur, + tous les rôles custom créés par l'admin tenant)
 *
 * La commande navigateur passe par POST /api/v1/invitations. La création est
 * contrôlée par une commande SQL sécurisée et l’email passe par le port
 * InvitationEmailSender. Le RPC
 * accept_tenant_invitation propage les rôles en tenant_role_assignments à
 * l'acceptation (cf. migration 20260525000200).
 *
 * UM8 : cette modale ne crée que des utilisateurs Magrit. Les comptes clients
 * boutique ont leur propre cycle de vie dans l'éditeur de boutique ; aucun
 * access_scope shop_only n'est envoyé par le navigateur.
 */

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Mail, X, Check, Copy } from 'lucide-react';
import { TEST_IDS } from '../../lib/testIds';
import { ApiClientError } from '../../../platform/api';
import {
  InvitationSessionExpiredError,
  useMagritInvitationManagement,
} from '../../hooks/useMagritInvitationManagement';
import {
  invitationApiProblemMessage,
} from './InviteUserModalV2.helpers';

export interface InviteUserModalV2Props {
  open: boolean;
  tenantId: string;
  baseUrl: string;
  /** Callback appelé après une invitation réussie (refresh parent). */
  onInvited: () => void | Promise<void>;
  onClose: () => void;
}

export function InviteUserModalV2({
  open,
  tenantId,
  baseUrl,
  onInvited,
  onClose,
}: InviteUserModalV2Props) {
  const [email, setEmail] = useState('');
  const [selectedRoleIds, setSelectedRoleIds] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualInvitation, setManualInvitation] = useState<{
    email: string;
    link: string;
    reason: string;
  } | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const { roles, loadingRoles, loadError, createInvitation } =
    useMagritInvitationManagement({ open, tenantId });

  useEffect(() => {
    if (open) {
      setEmail('');
      setSelectedRoleIds(new Set());
      setError(null);
      setManualInvitation(null);
      setLinkCopied(false);
    }
  }, [open]);

  useEffect(() => {
    if (!loadError) return;
    setError(loadError instanceof ApiClientError
      ? invitationApiProblemMessage(loadError.problem.code, loadError.problem.detail)
      : 'Chargement des rôles et boutiques impossible.');
  }, [loadError]);

  const toggleRole = (roleId: string) => {
    setSelectedRoleIds((s) => {
      const next = new Set(s);
      if (next.has(roleId)) next.delete(roleId);
      else next.add(roleId);
      return next;
    });
  };

  const canSubmit =
    email.trim().length > 0 &&
    /\S+@\S+\.\S+/.test(email) &&
    !sending &&
    !loadingRoles;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSending(true);
    setError(null);

    const cleanedEmail = email.trim().toLowerCase();
    const roleIds = Array.from(selectedRoleIds);

    try {
      const data = await createInvitation({
        email: cleanedEmail,
        baseUrl,
        roleDefinitionIds: roleIds,
      });

      // Succès — afficher feedback selon que l'email a été envoyé ou non
      if (data.sent) {
        alert(`Invitation envoyée par email à ${cleanedEmail}.`);
      } else {
        setManualInvitation({
          email: cleanedEmail,
          link: data.link || `${baseUrl}/invitations/`,
          reason: data.reason || 'service email non configuré',
        });
        await onInvited();
        setSending(false);
        return;
      }

      await onInvited();
      setSending(false);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof InvitationSessionExpiredError
        ? err.message
        : err instanceof ApiClientError
        ? invitationApiProblemMessage(err.problem.code, err.problem.detail)
        : `Erreur réseau : ${err instanceof Error ? err.message : 'inconnue'}`);
      setSending(false);
    }
  };

  const copyManualLink = async () => {
    if (!manualInvitation) return;
    try {
      await navigator.clipboard.writeText(manualInvitation.link);
      setLinkCopied(true);
    } catch {
      setLinkCopied(false);
      setError('Copie automatique impossible. Sélectionnez le lien puis copiez-le manuellement.');
    }
  };

  const selectedCount = selectedRoleIds.size;
  const selectedSummary = useMemo(() => {
    if (selectedCount === 0) return 'Aucun rôle sélectionné';
    if (selectedCount === 1) {
      const r = roles.find((x) => selectedRoleIds.has(x.id));
      return r?.name ?? '1 rôle';
    }
    return `${selectedCount} rôles sélectionnés`;
  }, [selectedCount, roles, selectedRoleIds]);

  if (!open) return null;

  return (
    <div
      data-testid={TEST_IDS.user.inviteModal}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !sending) onClose();
      }}
    >
      <div className="bg-paper border border-line rounded-lg w-full max-w-md shadow-xl">
        <header className="flex items-center justify-between px-5 py-3 border-b border-line">
          <h3 className="m-0 text-ink" style={{ fontSize: '16px', fontWeight: 500 }}>
            Inviter un utilisateur
          </h3>
          <button
            onClick={onClose}
            disabled={sending}
            className="p-1 hover:bg-bg rounded disabled:opacity-40"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="p-5 space-y-4">
          {/* Email */}
          <label className="block">
            <span
              className="block text-ink-muted mb-1.5"
              style={{ fontSize: '11.5px', fontWeight: 500 }}
            >
              Email du collaborateur
            </span>
            <input
              data-testid={TEST_IDS.user.inviteEmailInput}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jean@imprimerie-dupont.fr"
              disabled={sending}
              className="w-full px-3 py-2 border border-line rounded-md bg-paper text-ink focus:outline-none focus:border-ink-mute-2 disabled:opacity-60"
              style={{ fontSize: '13.5px' }}
            />
          </label>

          <div className="rounded-md border border-info-fg/20 bg-info-bg px-3 py-2 text-ink-muted" style={{ fontSize: '11.5px' }}>
            Cette invitation crée uniquement un utilisateur Magrit ayant accès au dashboard.
            Les comptes clients sont créés séparément depuis l’éditeur de chaque boutique.
          </div>

          {/* Rôles à appliquer à l'acceptation */}
          <div>
            <span
              className="block text-ink-muted mb-1.5"
              style={{ fontSize: '11.5px', fontWeight: 500 }}
            >
              Rôles à appliquer ({selectedSummary})
            </span>
            {loadingRoles ? (
              <div className="flex items-center gap-2 text-ink-muted" style={{ fontSize: '12.5px' }}>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Chargement des rôles…
              </div>
            ) : roles.length === 0 ? (
              <p className="text-ink-muted" style={{ fontSize: '12.5px' }}>
                Aucun rôle défini dans ce tenant.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {roles.map((r) => {
                  const active = selectedRoleIds.has(r.id);
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => toggleRole(r.id)}
                      disabled={sending}
                      data-testid={TEST_IDS.user.inviteRoleOption}
                      data-role-id={r.id}
                      aria-pressed={active}
                      className={`w-full flex items-start gap-2.5 px-3 py-2 rounded border text-left transition-colors disabled:opacity-50 ${
                        active
                          ? 'bg-ok-bg border-ok-fg/40'
                          : 'bg-paper border-line hover:border-ink-mute-2'
                      }`}
                    >
                      <span
                        className={`mt-0.5 inline-flex items-center justify-center w-4 h-4 rounded border shrink-0 ${
                          active
                            ? 'bg-ok-fg border-ok-fg text-paper'
                            : 'bg-paper border-line'
                        }`}
                      >
                        {active && <Check className="w-3 h-3" strokeWidth={3} />}
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
            {selectedCount === 0 && !loadingRoles && roles.length > 0 && (
              <p className="mt-2 text-warn-fg" style={{ fontSize: '11.5px' }}>
                Aucun rôle sélectionné = utilisateur invité sans droits. Cochez au moins un rôle.
              </p>
            )}
          </div>

          {error && (
            <div
              role="alert"
              className="px-3 py-2 rounded bg-err-bg border border-err-fg/20 text-err-fg"
              style={{ fontSize: '12.5px' }}
            >
              {error}
            </div>
          )}

          {manualInvitation && (
            <div
              data-testid="invitation-manual-link"
              role="status"
              className="px-3 py-3 rounded bg-warn-bg border border-warn-fg/20 text-ink"
            >
              <p className="m-0" style={{ fontSize: '13px', fontWeight: 600 }}>
                Invitation créée, email non envoyé
              </p>
              <p className="mt-1 mb-2 text-ink-muted" style={{ fontSize: '12px' }}>
                {manualInvitation.reason}. Transmettez ce lien à {manualInvitation.email} :
              </p>
              <div className="flex gap-2 items-center">
                <input
                  aria-label="Lien manuel d'invitation"
                  readOnly
                  value={manualInvitation.link}
                  onFocus={(event) => event.currentTarget.select()}
                  className="min-w-0 flex-1 px-2 py-1.5 border border-line rounded bg-paper font-mono text-ink"
                  style={{ fontSize: '11px' }}
                />
                <button
                  type="button"
                  onClick={copyManualLink}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-line rounded bg-paper hover:border-ink-mute-2"
                  style={{ fontSize: '12px', fontWeight: 500 }}
                >
                  {linkCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {linkCopied ? 'Copié' : 'Copier'}
                </button>
              </div>
            </div>
          )}
        </div>

        <footer className="flex justify-end gap-2 px-5 py-3 border-t border-line">
          <button
            onClick={onClose}
            disabled={sending}
            className="px-3 py-1.5 border border-line rounded-md text-ink-muted hover:text-ink disabled:opacity-40"
            style={{ fontSize: '13px', fontWeight: 500 }}
          >
            {manualInvitation ? 'Fermer' : 'Annuler'}
          </button>
          {!manualInvitation && <button
            data-testid={TEST_IDS.user.inviteSubmitBtn}
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-ink text-paper hover:bg-black disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ fontSize: '13px', fontWeight: 500 }}
          >
            {sending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Mail className="w-3.5 h-3.5" strokeWidth={1.8} />
            )}
            {sending ? 'Envoi…' : "Envoyer l'invitation"}
          </button>}
        </footer>
      </div>
    </div>
  );
}
