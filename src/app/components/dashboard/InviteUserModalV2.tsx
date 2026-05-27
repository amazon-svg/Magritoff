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
 * L'edge function invite-member est étendue (Phase A B2) pour accepter
 * role_definition_ids: string[]. Le RPC accept_tenant_invitation propage
 * ces rôles en tenant_role_assignments à l'acceptation (cf. migration
 * 20260525000200).
 *
 * Note : l'ancien role/access_scope/permissions est toujours envoyé en
 * back-compat (valeurs par défaut), mais c'est role_definition_ids qui
 * détermine réellement les capabilities après acceptation.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Mail, X, Check } from 'lucide-react';
import { supabase } from '/utils/supabase/client';
import { TEST_IDS } from '../../lib/testIds';

interface RoleOption {
  id: string;
  name: string;
  description: string;
}

interface ShopOption {
  id: string;
  name: string;
}

type AccessScope = 'magrit_full' | 'shop_only';

export interface InviteUserModalV2Props {
  open: boolean;
  tenantId: string;
  invitedBy: string;
  baseUrl: string;
  /** Callback appelé après une invitation réussie (refresh parent). */
  onInvited: () => void | Promise<void>;
  onClose: () => void;
}

export function InviteUserModalV2({
  open,
  tenantId,
  invitedBy,
  baseUrl,
  onInvited,
  onClose,
}: InviteUserModalV2Props) {
  const [email, setEmail] = useState('');
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [selectedRoleIds, setSelectedRoleIds] = useState<Set<string>>(new Set());
  const [shops, setShops] = useState<ShopOption[]>([]);
  // Scope d'accès : magrit_full = dashboard complet, shop_only = boutiques précises.
  const [scope, setScope] = useState<AccessScope>('shop_only');
  const [selectedShopIds, setSelectedShopIds] = useState<Set<string>>(new Set());
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRoles = useCallback(async () => {
    setLoadingRoles(true);
    const rolesQ = supabase
      .from('tenant_role_definitions')
      .select('id, name, description, ordering_index')
      .eq('tenant_id', tenantId)
      .is('archived_at', null)
      .order('ordering_index', { ascending: true });
    const shopsQ = supabase
      .from('shops')
      .select('id, name')
      .eq('tenant_id', tenantId)
      .order('name', { ascending: true });
    const [rolesR, shopsR] = await Promise.all([rolesQ, shopsQ]);
    if (rolesR.error) {
      setError(`Chargement rôles : ${rolesR.error.message}`);
    } else {
      setRoles((rolesR.data ?? []) as RoleOption[]);
    }
    if (!shopsR.error) {
      setShops((shopsR.data ?? []) as ShopOption[]);
    }
    setLoadingRoles(false);
  }, [tenantId]);

  useEffect(() => {
    if (open) {
      setEmail('');
      setSelectedRoleIds(new Set());
      setScope('shop_only');
      setSelectedShopIds(new Set());
      setError(null);
      void loadRoles();
    }
  }, [open, loadRoles]);

  const toggleRole = (roleId: string) => {
    setSelectedRoleIds((s) => {
      const next = new Set(s);
      if (next.has(roleId)) next.delete(roleId);
      else next.add(roleId);
      return next;
    });
  };

  const toggleShop = (shopId: string) => {
    setSelectedShopIds((s) => {
      const next = new Set(s);
      if (next.has(shopId)) next.delete(shopId);
      else next.add(shopId);
      return next;
    });
  };

  // shop_only exige au moins une boutique sélectionnée.
  const shopScopeValid = scope === 'magrit_full' || selectedShopIds.size > 0;
  const canSubmit =
    email.trim().length > 0 &&
    /\S+@\S+\.\S+/.test(email) &&
    shopScopeValid &&
    !sending &&
    !loadingRoles;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSending(true);
    setError(null);

    const cleanedEmail = email.trim().toLowerCase();
    const roleIds = Array.from(selectedRoleIds);

    try {
      const { data, error: e } = await supabase.functions.invoke<{
        ok: boolean;
        invitationId?: string;
        sent?: boolean;
        link?: string;
        reason?: string;
        error?: string;
      }>('invite-member', {
        body: {
          email: cleanedEmail,
          tenant_id: tenantId,
          invited_by: invitedBy,
          baseUrl,
          // S-USERS-REFONTE Phase A : rôles (capabilities)
          role_definition_ids: roleIds,
          // Scope d'accès + boutiques (fix 2026-05-27 : c'est ce qui route
          // l'utilisateur vers SA boutique au login via ShopOnlyRedirect).
          role: 'member',
          access_scope: scope,
          allowed_shop_ids: scope === 'shop_only' ? Array.from(selectedShopIds) : [],
          permissions: { can_quote: true, can_order: true, can_invite: false },
        },
      });

      if (e || !data?.ok) {
        setError(`Échec : ${data?.error || e?.message || 'invocation échouée'}`);
        setSending(false);
        return;
      }

      // Succès — afficher feedback selon que l'email a été envoyé ou non
      if (data.sent) {
        alert(`Invitation envoyée par email à ${cleanedEmail}.`);
      } else {
        prompt(
          `Invitation créée. Email non envoyé (${data.reason || 'config manquante'}). Transmettez ce lien au destinataire :`,
          data.link || `${baseUrl}/invitations/`,
        );
      }

      await onInvited();
      setSending(false);
      onClose();
    } catch (err: any) {
      setError(`Erreur réseau : ${err?.message || 'inconnue'}`);
      setSending(false);
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

          {/* Scope d'accès : dashboard complet vs boutiques précises */}
          <div>
            <span
              className="block text-ink-muted mb-1.5"
              style={{ fontSize: '11.5px', fontWeight: 500 }}
            >
              Type d'accès
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setScope('shop_only')}
                disabled={sending}
                data-testid={TEST_IDS.user.inviteScopeShopOnly}
                aria-pressed={scope === 'shop_only'}
                className={`px-3 py-2 rounded border text-left transition-colors disabled:opacity-50 ${
                  scope === 'shop_only'
                    ? 'bg-ok-bg border-ok-fg/40'
                    : 'bg-paper border-line hover:border-ink-mute-2'
                }`}
              >
                <div className="text-ink" style={{ fontSize: '12.5px', fontWeight: 600 }}>
                  Boutique(s)
                </div>
                <div className="text-ink-muted mt-0.5" style={{ fontSize: '11px' }}>
                  Accès limité aux boutiques choisies (acheteur)
                </div>
              </button>
              <button
                type="button"
                onClick={() => setScope('magrit_full')}
                disabled={sending}
                data-testid={TEST_IDS.user.inviteScopeFull}
                aria-pressed={scope === 'magrit_full'}
                className={`px-3 py-2 rounded border text-left transition-colors disabled:opacity-50 ${
                  scope === 'magrit_full'
                    ? 'bg-ok-bg border-ok-fg/40'
                    : 'bg-paper border-line hover:border-ink-mute-2'
                }`}
              >
                <div className="text-ink" style={{ fontSize: '12.5px', fontWeight: 600 }}>
                  Dashboard complet
                </div>
                <div className="text-ink-muted mt-0.5" style={{ fontSize: '11px' }}>
                  Accès admin (tout le tenant)
                </div>
              </button>
            </div>
          </div>

          {/* Boutiques accessibles (si scope shop_only) */}
          {scope === 'shop_only' && (
            <div>
              <span
                className="block text-ink-muted mb-1.5"
                style={{ fontSize: '11.5px', fontWeight: 500 }}
              >
                Boutiques accessibles ({selectedShopIds.size} sélectionnée{selectedShopIds.size > 1 ? 's' : ''})
              </span>
              {shops.length === 0 ? (
                <p className="text-ink-muted" style={{ fontSize: '12px' }}>
                  Aucune boutique dans ce tenant.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {shops.map((s) => {
                    const active = selectedShopIds.has(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => toggleShop(s.id)}
                        disabled={sending}
                        data-testid={TEST_IDS.user.inviteShopOption}
                        data-shop-id={s.id}
                        aria-pressed={active}
                        className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded border text-left transition-colors disabled:opacity-50 ${
                          active ? 'bg-ok-bg border-ok-fg/40' : 'bg-paper border-line hover:border-ink-mute-2'
                        }`}
                      >
                        <span
                          className={`inline-flex items-center justify-center w-4 h-4 rounded border shrink-0 ${
                            active ? 'bg-ok-fg border-ok-fg text-paper' : 'bg-paper border-line'
                          }`}
                        >
                          {active && <Check className="w-3 h-3" strokeWidth={3} />}
                        </span>
                        <span className="text-ink" style={{ fontSize: '12.5px', fontWeight: 500 }}>
                          {s.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
              {selectedShopIds.size === 0 && shops.length > 0 && (
                <p className="mt-1.5 text-warn-fg" style={{ fontSize: '11px' }}>
                  Sélectionnez au moins une boutique pour un accès boutique.
                </p>
              )}
            </div>
          )}

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
        </div>

        <footer className="flex justify-end gap-2 px-5 py-3 border-t border-line">
          <button
            onClick={onClose}
            disabled={sending}
            className="px-3 py-1.5 border border-line rounded-md text-ink-muted hover:text-ink disabled:opacity-40"
            style={{ fontSize: '13px', fontWeight: 500 }}
          >
            Annuler
          </button>
          <button
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
          </button>
        </footer>
      </div>
    </div>
  );
}
