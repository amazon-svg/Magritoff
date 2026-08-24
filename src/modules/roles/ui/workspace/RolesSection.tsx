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

import { Loader2, Shield, Check, X } from 'lucide-react';
import { useTenant } from '@/modules/tenants/ui/runtime';
import { TEST_IDS } from '@/shared/presentation/testIds';
import { useRoleAssignmentMatrix } from '@/modules/roles/ui/hooks/useRoleAssignmentManagement';

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
  can_manage_shop_customers: 'Gérer clients boutique',
  can_impersonate_shop_customer: 'Se connecter à une boutique',
};

export function DashboardRolesSection() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id ?? null;
  const { roles, members, loading, error, pending, assignmentByKey, toggleAssignment } =
    useRoleAssignmentMatrix(tenantId);

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
          <thead className="bg-bg text-ink-muted text-left">
            <tr>
              <th className="px-3 py-2 w-44">Rôle</th>
              <th className="px-3 py-2">Capabilities accordées</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
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
          <thead className="bg-bg text-ink-muted text-left">
            <tr>
              <th className="px-3 py-2 sticky left-0 bg-bg">Utilisateur</th>
              {roles.map((r) => (
                <th key={r.id} className="px-3 py-2 text-center" style={{ minWidth: '88px' }}>
                  {r.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
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
                          onClick={() => toggleAssignment(m.user_id, r.id)}
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
