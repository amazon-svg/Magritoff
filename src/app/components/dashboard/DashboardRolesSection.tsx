/**
 * DashboardRolesSection — Catalog rôles + assignation users
 * ============================================================
 * Story S-USERS-REFONTE Phase A (Sprint 5, 2026-05-25).
 *
 * Périmètre MVP :
 *   - Lecture des rôles définis du tenant courant (5 presets seedés DB
 *     par migration 20260525000100 : Owner, Admin, Acheteur, Validateur,
 *     Producteur). Affichage des capabilities sous forme de chips.
 *   - Lecture des assignations utilisateurs × rôles actifs.
 *   - Toggle d'une assignation via clic dans la matrice users × rôles
 *     (insert si pas d'assignment actif, update revoked_at sinon).
 *
 * Hors scope MVP (Phase B) :
 *   - Créer / éditer / archiver des rôles custom
 *   - UI capabilities individuelles modifiables par tenant
 *   - Notify policy + scope_shop_id (S-ORDER-ROLES-1 Sprint 6)
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Shield, Check, X } from 'lucide-react';
import { supabase } from '/utils/supabase/client';
import { useTenant } from '../../contexts/TenantContext';
import { useAuth } from '../../contexts/AuthContext';
import { TEST_IDS } from '../../lib/testIds';

/** Liste fermée des capabilities v1.1 — synchronisée avec migration DB. */
const CAPABILITY_LABELS: Record<string, string> = {
  can_quote: 'Créer devis',
  can_order: 'Passer commandes',
  can_invite: 'Inviter users',
  can_validate: 'Valider commandes',
  can_cancel: 'Annuler commandes',
  can_modify: 'Modifier commandes',
  can_export: 'Exporter',
  can_manage_catalog: 'Gérer catalogue',
  can_manage_roles: 'Gérer rôles',
};

interface RoleDefRow {
  id: string;
  tenant_id: string;
  name: string;
  description: string;
  capabilities: Record<string, boolean>;
  ordering_index: number;
  archived_at: string | null;
}

interface MemberRow {
  user_id: string;
  email: string;
  role: string; // legacy role tenant_members.role (back-compat)
}

interface AssignmentRow {
  id: string;
  role_definition_id: string;
  user_id: string;
}

export function DashboardRolesSection() {
  const { currentTenant } = useTenant();
  const { user: currentUser } = useAuth();
  const [roles, setRoles] = useState<RoleDefRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** Set de "role_definition_id:user_id" en cours de toggle (UI loading). */
  const [pending, setPending] = useState<Set<string>>(new Set());

  const tenantId = currentTenant?.id ?? null;

  const loadData = useCallback(async () => {
    if (!tenantId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    const rolesQ = supabase
      .from('tenant_role_definitions')
      .select('id, tenant_id, name, description, capabilities, ordering_index, archived_at')
      .eq('tenant_id', tenantId)
      .is('archived_at', null)
      .order('ordering_index', { ascending: true });

    const membersQ = supabase
      .rpc('get_tenant_members_with_email', { p_tenant_id: tenantId });

    const assignmentsQ = supabase
      .from('tenant_role_assignments')
      .select('id, role_definition_id, user_id')
      .is('revoked_at', null);

    const [rolesR, membersR, assignmentsR] = await Promise.all([rolesQ, membersQ, assignmentsQ]);

    if (rolesR.error) {
      setError(`Rôles : ${rolesR.error.message}`);
      setLoading(false);
      return;
    }
    if (membersR.error) {
      setError(`Users : ${membersR.error.message}`);
      setLoading(false);
      return;
    }

    setRoles((rolesR.data ?? []) as RoleDefRow[]);
    setMembers(
      ((membersR.data ?? []) as Array<{ user_id: string; email: string; role: string }>).map(
        (m) => ({ user_id: m.user_id, email: m.email, role: m.role }),
      ),
    );
    if (!assignmentsR.error) {
      // Filtrer les assignments aux roles du tenant (RLS le fait déjà, c'est défensif).
      const roleIds = new Set((rolesR.data ?? []).map((r: any) => r.id));
      setAssignments(
        ((assignmentsR.data ?? []) as AssignmentRow[]).filter((a) =>
          roleIds.has(a.role_definition_id),
        ),
      );
    }
    setLoading(false);
  }, [tenantId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Index : pour chaque (user, role), retourne l'assignment row (ou undefined).
  const assignmentByKey = useMemo(() => {
    const map = new Map<string, AssignmentRow>();
    for (const a of assignments) {
      map.set(`${a.user_id}:${a.role_definition_id}`, a);
    }
    return map;
  }, [assignments]);

  const handleToggle = async (userId: string, roleId: string) => {
    const key = `${userId}:${roleId}`;
    if (pending.has(key)) return;
    setPending((s) => new Set(s).add(key));

    const existing = assignmentByKey.get(key);
    try {
      if (existing) {
        // Révoquer l'assignment existant
        const { error: revokeErr } = await supabase
          .from('tenant_role_assignments')
          .update({ revoked_at: new Date().toISOString(), revoked_by: currentUser?.id ?? null })
          .eq('id', existing.id);
        if (revokeErr) throw revokeErr;
      } else {
        // Créer une nouvelle assignment
        const { error: insertErr } = await supabase.from('tenant_role_assignments').insert({
          role_definition_id: roleId,
          user_id: userId,
          assigned_by: currentUser?.id ?? null,
        });
        if (insertErr) throw insertErr;
      }
      await loadData();
    } catch (err: any) {
      console.error('[DashboardRolesSection] toggle failed:', err?.message ?? err);
      setError(`Erreur assignation : ${err?.message ?? 'inconnue'}`);
    } finally {
      setPending((s) => {
        const next = new Set(s);
        next.delete(key);
        return next;
      });
    }
  };

  if (loading) {
    return (
      <section data-testid={TEST_IDS.user.sectionRoles}>
        <header className="mb-3">
          <h2 className="text-ink m-0" style={{ fontWeight: 400, fontSize: '20px' }}>
            Rôles et droits
          </h2>
        </header>
        <p className="text-sm text-ink-muted flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Chargement…
        </p>
      </section>
    );
  }

  if (!tenantId) {
    return null;
  }

  return (
    <section data-testid={TEST_IDS.user.sectionRoles}>
      <header className="flex items-center justify-between mb-4">
        <div>
          <h2
            className="text-ink m-0 flex items-center gap-2"
            style={{ fontWeight: 400, fontSize: '20px', letterSpacing: '-0.015em' }}
          >
            <Shield className="w-4 h-4" />
            Rôles et droits
            <span className="ml-2 text-ink-mute-2 font-mono" style={{ fontSize: '12px' }}>
              · {roles.length} rôles · {members.length} utilisateurs
            </span>
          </h2>
          <p className="mt-1 text-ink-muted" style={{ fontSize: '13px', fontWeight: 300 }}>
            Assignez les rôles aux utilisateurs en cochant les cases ci-dessous. Un utilisateur peut cumuler plusieurs rôles.
          </p>
        </div>
      </header>

      {error && (
        <div
          role="alert"
          className="mb-4 px-3 py-2 rounded bg-err-bg border border-err-fg/20 text-err-fg"
          style={{ fontSize: '12.5px' }}
        >
          {error}
        </div>
      )}

      {/* Catalog rôles : descriptif des capabilities */}
      <div className="mb-6 border border-line rounded-md bg-paper overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-left">
            <tr>
              <th className="px-3 py-2 w-44">Rôle</th>
              <th className="px-3 py-2">Capabilities accordées</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {roles.map((r) => {
              const activeCaps = Object.entries(r.capabilities)
                .filter(([, v]) => v === true)
                .map(([k]) => k);
              return (
                <tr key={r.id} data-testid={TEST_IDS.user.roleRow} data-role-id={r.id}>
                  <td className="px-3 py-2 font-medium align-top">
                    <div>{r.name}</div>
                    <div className="text-xs text-ink-muted font-normal mt-0.5">{r.description}</div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1.5">
                      {activeCaps.length === 0 ? (
                        <span className="text-ink-mute-2 text-xs">Aucune capability</span>
                      ) : (
                        activeCaps.map((cap) => (
                          <span
                            key={cap}
                            className="inline-flex items-center px-2 py-0.5 rounded-full bg-info-bg text-info-fg border border-info-fg/20"
                            style={{ fontSize: '10.5px', fontWeight: 500 }}
                            title={cap}
                          >
                            {CAPABILITY_LABELS[cap] ?? cap}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Matrice users × rôles : assignments */}
      <div className="border border-line rounded-md bg-paper overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-left">
            <tr>
              <th className="px-3 py-2 sticky left-0 bg-gray-50">Utilisateur</th>
              {roles.map((r) => (
                <th key={r.id} className="px-3 py-2 text-center" style={{ minWidth: '88px' }}>
                  {r.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {members.length === 0 ? (
              <tr>
                <td colSpan={roles.length + 1} className="px-3 py-6 text-center text-ink-muted">
                  Aucun utilisateur dans ce tenant.
                </td>
              </tr>
            ) : (
              members.map((m) => (
                <tr key={m.user_id} data-testid={TEST_IDS.user.assignmentRow} data-user-id={m.user_id}>
                  <td className="px-3 py-2 sticky left-0 bg-paper">
                    <div className="font-medium">{m.email}</div>
                    <div className="text-xs text-ink-mute-2">{m.role}</div>
                  </td>
                  {roles.map((r) => {
                    const key = `${m.user_id}:${r.id}`;
                    const active = assignmentByKey.has(key);
                    const isPending = pending.has(key);
                    return (
                      <td key={r.id} className="px-3 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggle(m.user_id, r.id)}
                          disabled={isPending}
                          data-testid={TEST_IDS.user.assignmentToggle}
                          data-user-id={m.user_id}
                          data-role-id={r.id}
                          aria-pressed={active}
                          aria-label={
                            active
                              ? `Révoquer ${r.name} pour ${m.email}`
                              : `Assigner ${r.name} à ${m.email}`
                          }
                          className={`inline-flex items-center justify-center w-7 h-7 rounded border transition-colors ${
                            active
                              ? 'bg-ok-bg border-ok-fg/40 text-ok-fg hover:bg-ok-bg/80'
                              : 'bg-paper border-line text-ink-mute-2 hover:border-ink-mute-2'
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          {isPending ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : active ? (
                            <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
                          ) : (
                            <X className="w-3.5 h-3.5 opacity-30" strokeWidth={2} />
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
