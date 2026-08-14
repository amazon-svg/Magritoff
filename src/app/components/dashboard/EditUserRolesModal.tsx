/**
 * EditUserRolesModal — Modal de gestion des rôles d'un user existant.
 * S-USERS-REFONTE Phase A (2026-05-25).
 *
 * Remplace l'ancien modal "Modifier les permissions" qui exposait les
 * checkboxes legacy can_quote/can_order/can_invite. Désormais : matrix
 * verticale "rôles du tenant" × "actif pour cet user" avec toggle live
 * (insert ou revoke d'un tenant_role_assignment).
 *
 * Logique identique à la matrix DashboardRolesSection mais focalisée
 * sur 1 seul user (UX : pour les admins qui éditent un user à la fois
 * depuis la table Magrit Users).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, X, Check } from 'lucide-react';
import { TEST_IDS } from '../../lib/testIds';
import { useAuth } from '../../contexts/AuthContext';
import { RolesApiClient } from '../../../modules/roles';
import { MembersApiClient } from '../../../modules/members';
import { FetchApiClient } from '../../../platform/api';

interface RoleOption {
  id: string;
  name: string;
  description: string;
}

interface AssignmentRow {
  id: string;
  role_definition_id: string;
}

interface ShopOption {
  id: string;
  name: string;
}

type AccessScope = 'magrit_full' | 'shop_only';

export interface EditUserRolesModalProps {
  open: boolean;
  /** UUID + email de l'user dont on édite les rôles. */
  targetUserId: string;
  targetUserEmail: string;
  tenantId: string;
  /** Callback après une modification (refresh parent). */
  onChanged: () => void | Promise<void>;
  onClose: () => void;
}

export function EditUserRolesModal({
  open,
  targetUserId,
  targetUserEmail,
  tenantId,
  onChanged,
  onClose,
}: EditUserRolesModalProps) {
  const { session } = useAuth();
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [shops, setShops] = useState<ShopOption[]>([]);
  const [scope, setScope] = useState<AccessScope>('shop_only');
  const [selectedShopIds, setSelectedShopIds] = useState<Set<string>>(new Set());
  const [savingAccess, setSavingAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingRoleIds, setPendingRoleIds] = useState<Set<string>>(new Set());
  const api = useMemo(() => new FetchApiClient('', globalThis.fetch, () => session?.access_token ?? null), [session?.access_token]);
  const rolesApi = useMemo(() => new RolesApiClient(api), [api]);
  const membersApi = useMemo(() => new MembersApiClient(api), [api]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const detail = await rolesApi.userDetail(tenantId, targetUserId);
      // UM (2026-08-14) : les options produit (Boutiques, Commandes) appartiennent
      // a l equipe Magrit — la fiche d un utilisateur boutique n en propose que
      // les roles de workflow.
      setRoles(detail.roles.filter((role) => role.systemKey === null).map((role) => ({ id: role.id, name: role.name, description: role.description })));
      setAssignments(detail.assignments.map((assignment) => ({ id: assignment.id, role_definition_id: assignment.roleId })));
      setShops(detail.shops);
      setScope(detail.accessScope);
      setSelectedShopIds(new Set(detail.allowedShopIds));
    } catch (loadError) {
      setError(`Rôles : ${loadError instanceof Error ? loadError.message : 'chargement impossible'}`);
    }
    setLoading(false);
  }, [rolesApi, tenantId, targetUserId]);

  const saveAccess = async () => {
    setSavingAccess(true);
    setError(null);
    try {
      const member = (await membersApi.list(tenantId)).find((candidate) => candidate.userId === targetUserId);
      if (!member) throw new Error('Membre introuvable.');
      await membersApi.updateAccess(tenantId, targetUserId, {
        accessScope: scope, allowedShopIds: scope === 'shop_only' ? Array.from(selectedShopIds) : [],
        permissions: member.permissions,
      });
      await onChanged();
    } catch (saveError) {
      setError(`Accès : ${saveError instanceof Error ? saveError.message : 'enregistrement impossible'}`);
    } finally {
      setSavingAccess(false);
    }
  };

  useEffect(() => {
    if (open) {
      void loadData();
    }
  }, [open, loadData]);

  const assignmentByRoleId = new Map(assignments.map((a) => [a.role_definition_id, a]));

  const handleToggle = async (roleId: string) => {
    if (pendingRoleIds.has(roleId)) return;
    setPendingRoleIds((s) => new Set(s).add(roleId));
    setError(null);

    const existing = assignmentByRoleId.get(roleId);
    try {
      await rolesApi.setAssignment(tenantId, targetUserId, roleId, !existing);
      await loadData();
      await onChanged();
    } catch (err: any) {
      setError(`Erreur : ${err?.message || 'inconnue'}`);
    } finally {
      setPendingRoleIds((s) => {
        const next = new Set(s);
        next.delete(roleId);
        return next;
      });
    }
  };

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
              Rôles de l'utilisateur
            </h3>
            <p className="m-0 mt-0.5 text-ink-muted" style={{ fontSize: '12px' }}>
              {targetUserEmail}
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
          {/* Section Accès : scope + boutiques (fix 2026-05-27) */}
          <div className="pb-3 border-b border-line">
            <span className="block text-ink-muted mb-1.5" style={{ fontSize: '11.5px', fontWeight: 600 }}>
              Type d'accès
            </span>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <button
                type="button"
                onClick={() => setScope('shop_only')}
                data-testid={TEST_IDS.user.editScopeShopOnly}
                aria-pressed={scope === 'shop_only'}
                className={`px-3 py-1.5 rounded border text-left transition-colors ${
                  scope === 'shop_only' ? 'bg-ok-bg border-ok-fg/40' : 'bg-paper border-line hover:border-ink-mute-2'
                }`}
              >
                <span className="text-ink" style={{ fontSize: '12px', fontWeight: 600 }}>Boutique(s)</span>
              </button>
              <button
                type="button"
                onClick={() => setScope('magrit_full')}
                data-testid={TEST_IDS.user.editScopeFull}
                aria-pressed={scope === 'magrit_full'}
                className={`px-3 py-1.5 rounded border text-left transition-colors ${
                  scope === 'magrit_full' ? 'bg-ok-bg border-ok-fg/40' : 'bg-paper border-line hover:border-ink-mute-2'
                }`}
              >
                <span className="text-ink" style={{ fontSize: '12px', fontWeight: 600 }}>Dashboard complet</span>
              </button>
            </div>
            {scope === 'shop_only' && (
              <div className="space-y-1 max-h-32 overflow-y-auto mb-2">
                {shops.map((s) => {
                  const active = selectedShopIds.has(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() =>
                        setSelectedShopIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(s.id)) next.delete(s.id);
                          else next.add(s.id);
                          return next;
                        })
                      }
                      data-testid={TEST_IDS.user.editShopOption}
                      data-shop-id={s.id}
                      aria-pressed={active}
                      className={`w-full flex items-center gap-2 px-2.5 py-1 rounded border text-left transition-colors ${
                        active ? 'bg-ok-bg border-ok-fg/40' : 'bg-paper border-line hover:border-ink-mute-2'
                      }`}
                    >
                      <span className={`inline-flex items-center justify-center w-4 h-4 rounded border shrink-0 ${active ? 'bg-ok-fg border-ok-fg text-paper' : 'bg-paper border-line'}`}>
                        {active && <Check className="w-3 h-3" strokeWidth={3} />}
                      </span>
                      <span className="text-ink" style={{ fontSize: '12px' }}>{s.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
            <button
              type="button"
              onClick={saveAccess}
              disabled={savingAccess || (scope === 'shop_only' && selectedShopIds.size === 0)}
              data-testid={TEST_IDS.user.editAccessSaveBtn}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-ink text-paper hover:bg-black disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ fontSize: '12.5px', fontWeight: 500 }}
            >
              {savingAccess && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Enregistrer l'accès
            </button>
          </div>

          <span className="block text-ink-muted pt-1" style={{ fontSize: '11.5px', fontWeight: 600 }}>
            Rôles
          </span>
          {roles.length === 0 ? (
            <p className="text-ink-muted" style={{ fontSize: '12.5px' }}>
              Aucun rôle défini dans ce tenant.
            </p>
          ) : (
            <div className="space-y-1.5 max-h-80 overflow-y-auto">
              {roles.map((r) => {
                const active = assignmentByRoleId.has(r.id);
                const isPending = pendingRoleIds.has(r.id);
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => handleToggle(r.id)}
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
