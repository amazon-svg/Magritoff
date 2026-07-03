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

import { useCallback, useEffect, useState } from 'react';
import { Loader2, X, Check } from 'lucide-react';
import { supabase } from '/utils/supabase/client';
import { TEST_IDS } from '../../lib/testIds';

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
  currentUserId: string;
  /** Callback après une modification (refresh parent). */
  onChanged: () => void | Promise<void>;
  onClose: () => void;
}

export function EditUserRolesModal({
  open,
  targetUserId,
  targetUserEmail,
  tenantId,
  currentUserId,
  onChanged,
  onClose,
}: EditUserRolesModalProps) {
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [shops, setShops] = useState<ShopOption[]>([]);
  const [scope, setScope] = useState<AccessScope>('shop_only');
  const [selectedShopIds, setSelectedShopIds] = useState<Set<string>>(new Set());
  const [savingAccess, setSavingAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingRoleIds, setPendingRoleIds] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const rolesQ = supabase
      .from('tenant_role_definitions')
      .select('id, name, description, ordering_index')
      .eq('tenant_id', tenantId)
      .is('archived_at', null)
      .order('ordering_index', { ascending: true });

    const assignmentsQ = supabase
      .from('tenant_role_assignments')
      .select('id, role_definition_id')
      .eq('user_id', targetUserId)
      .is('revoked_at', null);

    const shopsQ = supabase
      .from('shops')
      .select('id, name')
      .eq('tenant_id', tenantId)
      .order('name', { ascending: true });

    // Scope + boutiques actuels du membre (tenant_members)
    const memberQ = supabase
      .from('tenant_members')
      .select('access_scope, allowed_shop_ids')
      .eq('tenant_id', tenantId)
      .eq('user_id', targetUserId)
      .maybeSingle();

    const [rolesR, assignmentsR, shopsR, memberR] = await Promise.all([
      rolesQ,
      assignmentsQ,
      shopsQ,
      memberQ,
    ]);

    if (rolesR.error) {
      setError(`Rôles : ${rolesR.error.message}`);
      setLoading(false);
      return;
    }

    setRoles((rolesR.data ?? []) as RoleOption[]);
    if (!shopsR.error) setShops((shopsR.data ?? []) as ShopOption[]);
    if (!memberR.error && memberR.data) {
      const m = memberR.data as { access_scope?: string; allowed_shop_ids?: string[] };
      setScope((m.access_scope as AccessScope) ?? 'shop_only');
      setSelectedShopIds(new Set(m.allowed_shop_ids ?? []));
    }
    if (!assignmentsR.error) {
      const tenantRoleIds = new Set((rolesR.data ?? []).map((r: any) => r.id));
      setAssignments(
        ((assignmentsR.data ?? []) as AssignmentRow[]).filter((a) =>
          tenantRoleIds.has(a.role_definition_id),
        ),
      );
    }
    setLoading(false);
  }, [tenantId, targetUserId]);

  const saveAccess = async () => {
    setSavingAccess(true);
    setError(null);
    const { error: e } = await supabase
      .from('tenant_members')
      .update({
        access_scope: scope,
        allowed_shop_ids: scope === 'shop_only' ? Array.from(selectedShopIds) : [],
      })
      .eq('tenant_id', tenantId)
      .eq('user_id', targetUserId);
    setSavingAccess(false);
    if (e) {
      setError(`Accès : ${e.message}`);
      return;
    }
    await onChanged();
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
      if (existing) {
        const { error: e } = await supabase
          .from('tenant_role_assignments')
          .update({
            revoked_at: new Date().toISOString(),
            revoked_by: currentUserId,
          })
          .eq('id', existing.id);
        if (e) throw e;
      } else {
        const { error: e } = await supabase.from('tenant_role_assignments').insert({
          role_definition_id: roleId,
          user_id: targetUserId,
          assigned_by: currentUserId,
        });
        if (e) throw e;
      }
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
