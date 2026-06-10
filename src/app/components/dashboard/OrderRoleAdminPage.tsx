/**
 * OrderRoleAdminPage — Page admin tenant catalog rôles workflow.
 *
 * Story S-ORDER-ROLES-3-UI T4 (Sprint 6+, wireframes Sally
 * .design-handoff/wireframes/S-ORDER-ROLES-3-admin-roles.md).
 *
 * Route : /t/:tenantSlug/dashboard/order-roles
 *
 * Garde d'accès : capability `can_manage_roles` (preset Owner / Admin par
 * défaut depuis migration 2026-06-09). Superadmin Magrit bypass.
 *
 * 4 blocs visuels :
 *  1. Rail visuel horizontal — cards par rôle (compteur assignments + tag
 *     créateur/validation/approbation/production)
 *  2. Catalog table — Ordre / Nom / Droits / Notif / Portée / ⋯ menu
 *  3. Assignations users × rôles — résumé compact + lien vers page Users
 *  4. Statuts custom — placeholder lecture seule (édition V2)
 *
 * Actions catalog :
 *  - Ajouter un rôle  → RoleEditorDialog mode création
 *  - Modifier         → RoleEditorDialog mode édition
 *  - Dupliquer        → RoleEditorDialog mode création préchargé
 *  - Monter / Descendre (UPDATE ordering_index swap)
 *  - Archiver (UPDATE archived_at = now(), confirme AlertDialog)
 *
 * Cohérence inter-écrans (lesson 2026-05-25 §refonte non-cassante) :
 * la matrice users × rôles reste éditable depuis DashboardUsers section
 * "Rôles". Ici on n'expose que le résumé en lecture seule + lien.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router';
import { Archive, Copy, Edit, MoreHorizontal, MoveDown, MoveUp, Plus } from 'lucide-react';
import { supabase } from '/utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { useShops } from '../../contexts/ShopsContext';
import { useUserCapability } from '../../hooks/useUserCapability';
import { TEST_IDS } from '../../lib/testIds';
import {
  RoleEditorDialog,
  type NotifyPolicy,
  type RoleScope,
  type TenantRoleDefinition,
} from './RoleEditorDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

// ─── Helpers ───────────────────────────────────────────────────────────────

const CANONICAL_ROLES_NON_ARCHIVABLE = new Set(['Owner', 'Admin', 'Acheteur', 'Producteur']);

interface AssignmentRow {
  role_definition_id: string;
  user_id: string;
  user_email: string | null;
}

const NOTIFY_LABELS: Record<NotifyPolicy, string> = {
  chain_next: 'Suivant',
  all_roles: 'Tout le monde',
  none: '—',
};

const NOTIFY_TOOLTIPS: Record<NotifyPolicy, string> = {
  chain_next: 'Prévient uniquement le rôle suivant dans la chaîne',
  all_roles: 'Prévient tous les rôles configurés',
  none: 'N\'envoie aucune notification',
};

const ALL_CAPS_LABELS = [
  { key: 'can_validate', label: 'valider', className: 'bg-info-bg text-info-fg border-info-fg/20' },
  { key: 'can_cancel', label: 'annuler', className: 'bg-warn-bg text-warn-fg border-warn-fg/20' },
  { key: 'can_modify', label: 'modifier', className: 'bg-ok-bg text-ok-fg border-ok-line' },
  { key: 'can_export', label: 'exporter', className: 'bg-paper text-ink-muted border-line' },
] as const;

/** Tag sémantique sur le rail visuel. */
function semanticTag(role: TenantRoleDefinition, maxValidatorOrdering: number | null): string {
  if (role.name === 'Acheteur') return 'créateur';
  if (role.name === 'Producteur') return 'production';
  if (role.capabilities.can_validate) {
    if (maxValidatorOrdering !== null && role.ordering_index === maxValidatorOrdering) {
      return 'approbation';
    }
    return 'validation';
  }
  return 'autre';
}

export function OrderRoleAdminPage() {
  const { user } = useAuth();
  const { currentTenant, isSuperAdmin } = useTenant();
  const { shops } = useShops();
  const { hasIt: canManageRoles, loading: capLoading } = useUserCapability('can_manage_roles');

  const [roles, setRoles] = useState<TenantRoleDefinition[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  // Dialogs
  const [editorMode, setEditorMode] = useState<'closed' | 'create' | 'edit' | 'duplicate'>('closed');
  const [editorRole, setEditorRole] = useState<TenantRoleDefinition | undefined>(undefined);
  const [roleToArchive, setRoleToArchive] = useState<TenantRoleDefinition | null>(null);
  const [archiveSubmitting, setArchiveSubmitting] = useState(false);

  // ─── Load ────────────────────────────────────────────────────────────
  const reload = useCallback(async () => {
    if (!currentTenant?.id) return;
    setLoading(true);
    setError(null);

    const [rolesRes, assignsRes] = await Promise.all([
      supabase
        .from('tenant_role_definitions')
        .select(
          'id, tenant_id, name, description, capabilities, notify_policy, scope, scope_shop_id, ordering_index, archived_at',
        )
        .eq('tenant_id', currentTenant.id)
        .order('ordering_index', { ascending: true }),
      supabase
        .from('tenant_role_assignments')
        .select(
          'role_definition_id, user_id, revoked_at, tenant_role_definitions!inner(tenant_id), profiles:auth_user_id_profiles_view(email)',
        )
        .is('revoked_at', null),
    ]);

    if (rolesRes.error) {
      console.warn('[OrderRoleAdminPage] roles fetch failed:', rolesRes.error.message);
      setError(rolesRes.error.message);
      setLoading(false);
      return;
    }

    setRoles((rolesRes.data ?? []) as TenantRoleDefinition[]);

    // Assignments : if la jointure profiles échoue (vue absente), on
    // dégrade gracieusement en n'affichant que les user_id (le résumé reste
    // utilisable, juste sans nom).
    if (assignsRes.error) {
      console.warn('[OrderRoleAdminPage] assignments fetch failed:', assignsRes.error.message);
      // Retry sans la jointure profiles
      const fallback = await supabase
        .from('tenant_role_assignments')
        .select(
          'role_definition_id, user_id, revoked_at, tenant_role_definitions!inner(tenant_id)',
        )
        .is('revoked_at', null);
      const allowedRoleIds = new Set((rolesRes.data ?? []).map((r: TenantRoleDefinition) => r.id));
      const rows = (fallback.data ?? [])
        .filter((r: any) => allowedRoleIds.has(r.role_definition_id))
        .map((r: any) => ({
          role_definition_id: r.role_definition_id,
          user_id: r.user_id,
          user_email: null,
        }));
      setAssignments(rows);
    } else {
      const allowedRoleIds = new Set((rolesRes.data ?? []).map((r: TenantRoleDefinition) => r.id));
      const rows = (assignsRes.data ?? [])
        .filter((r: any) => allowedRoleIds.has(r.role_definition_id))
        .map((r: any) => ({
          role_definition_id: r.role_definition_id,
          user_id: r.user_id,
          user_email: r.profiles?.email ?? null,
        }));
      setAssignments(rows);
    }

    setLoading(false);
  }, [currentTenant?.id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // ─── Derived data ────────────────────────────────────────────────────
  const visibleRoles = useMemo(
    () => roles.filter((r) => showArchived || r.archived_at === null),
    [roles, showArchived],
  );

  const maxValidatorOrdering = useMemo(() => {
    const validators = roles.filter(
      (r) => r.archived_at === null && r.capabilities.can_validate === true,
    );
    if (validators.length === 0) return null;
    return Math.max(...validators.map((r) => r.ordering_index));
  }, [roles]);

  const assignmentsByRoleId = useMemo(() => {
    const map = new Map<string, AssignmentRow[]>();
    for (const a of assignments) {
      if (!map.has(a.role_definition_id)) map.set(a.role_definition_id, []);
      map.get(a.role_definition_id)!.push(a);
    }
    return map;
  }, [assignments]);

  // Map shop_id → shop.name (lesson 2026-05-25 : afficher name pas slug)
  const shopNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of shops) m.set(s.id, s.name ?? s.slug ?? '—');
    return m;
  }, [shops]);

  const shopOptions = useMemo(
    () => shops.map((s) => ({ id: s.id, name: s.name ?? s.slug, slug: s.slug })),
    [shops],
  );

  const otherRoleNames = useMemo(() => {
    const baseList = roles.filter((r) => r.archived_at === null).map((r) => r.name);
    if (editorMode === 'edit' && editorRole) {
      return baseList.filter((n) => n !== editorRole.name);
    }
    return baseList;
  }, [roles, editorMode, editorRole]);

  const defaultNameForCreate = useMemo(() => {
    const validatorCount = roles.filter(
      (r) =>
        r.archived_at === null &&
        r.capabilities.can_validate === true &&
        r.name !== 'Owner' &&
        r.name !== 'Admin',
    ).length;
    return `Validateur ${validatorCount + 1}`;
  }, [roles]);

  // ─── Actions catalog ─────────────────────────────────────────────────
  function openCreate() {
    setEditorMode('create');
    setEditorRole(undefined);
  }
  function openEdit(role: TenantRoleDefinition) {
    setEditorMode('edit');
    setEditorRole(role);
  }
  function openDuplicate(role: TenantRoleDefinition) {
    // Précharge la modale création avec les valeurs du rôle source.
    // Nom modifié pour éviter le conflit unique (suffixe "(copie)").
    setEditorMode('duplicate');
    setEditorRole({
      ...role,
      id: '', // sera ignoré côté Dialog en mode "création"
      name: `${role.name} (copie)`,
      ordering_index: role.ordering_index + 1,
    });
  }
  function closeEditor() {
    setEditorMode('closed');
    setEditorRole(undefined);
  }

  async function moveRole(role: TenantRoleDefinition, direction: 'up' | 'down') {
    // Swap ordering_index avec le voisin direct (non archivé).
    const active = roles.filter((r) => r.archived_at === null);
    const idx = active.findIndex((r) => r.id === role.id);
    if (idx === -1) return;
    const swapWith = direction === 'up' ? active[idx - 1] : active[idx + 1];
    if (!swapWith) return;
    const a = role.ordering_index;
    const b = swapWith.ordering_index;
    // 2 updates : swap. Pas de transaction côté client mais idempotent : si
    // l'une échoue, le reload reflet l'état réel + on relance manuellement.
    const [r1, r2] = await Promise.all([
      supabase.from('tenant_role_definitions').update({ ordering_index: b }).eq('id', role.id),
      supabase.from('tenant_role_definitions').update({ ordering_index: a }).eq('id', swapWith.id),
    ]);
    if (r1.error || r2.error) {
      console.warn('[OrderRoleAdminPage] reorder failed:', r1.error?.message ?? r2.error?.message);
    }
    await reload();
  }

  async function confirmArchive() {
    if (!roleToArchive) return;
    setArchiveSubmitting(true);
    const { error: updErr } = await supabase
      .from('tenant_role_definitions')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', roleToArchive.id);
    setArchiveSubmitting(false);
    if (updErr) {
      console.warn('[OrderRoleAdminPage] archive failed:', updErr.message);
      return;
    }
    setRoleToArchive(null);
    await reload();
  }

  // ─── Guard access ─────────────────────────────────────────────────────
  if (capLoading || !currentTenant) {
    return (
      <div className="p-8 text-ink-muted" style={{ fontSize: '14px' }}>
        Chargement…
      </div>
    );
  }
  if (!canManageRoles && !isSuperAdmin) {
    return <Navigate to={`/t/${currentTenant.slug}/dashboard`} replace />;
  }

  // ─── Render ──────────────────────────────────────────────────────────
  return (
    <div
      data-testid={TEST_IDS.orderRole.page}
      className="max-w-6xl mx-auto px-8 py-10"
      style={{ fontFamily: 'var(--font-ui)' }}
    >
      <h2
        className="text-ink m-0 mb-2"
        style={{ fontSize: '26px', fontWeight: 300, letterSpacing: '-0.025em' }}
      >
        Workflow & rôles de commande
      </h2>
      <p
        className="text-ink-muted m-0 mb-10"
        style={{ fontSize: '13.5px', fontWeight: 400 }}
      >
        Configurez la chaîne de validation pour les commandes de cet espace.
      </p>

      {error && (
        <div
          role="alert"
          className="mb-4 px-3 py-2 rounded bg-err-bg border border-err-fg/20 text-err-fg"
          style={{ fontSize: '13px' }}
        >
          {error}
        </div>
      )}

      {/* ─── Bloc 1 : Rail visuel chaîne workflow ──────────────────────── */}
      <section
        data-testid={TEST_IDS.orderRole.workflowRail}
        className="mb-10 border border-line rounded-lg p-5 bg-paper"
      >
        <h3
          className="text-ink m-0 mb-1"
          style={{ fontSize: '14px', fontWeight: 500 }}
        >
          Aperçu de votre circuit de validation
        </h3>
        <p
          className="text-ink-muted m-0 mb-4"
          style={{ fontSize: '12.5px', lineHeight: 1.5 }}
        >
          Les commandes circulent dans cet ordre. Vous pouvez insérer un nouveau
          validateur entre deux étapes ou modifier les droits.
        </p>
        {loading ? (
          <div className="text-ink-muted" style={{ fontSize: '13px' }}>
            Chargement du circuit…
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {visibleRoles
              .filter((r) => r.archived_at === null)
              .map((role, idx, arr) => (
                <div key={role.id} className="flex items-center">
                  <div
                    data-testid={TEST_IDS.orderRole.workflowRailCard}
                    data-role-id={role.id}
                    className="min-w-[160px] border border-line rounded p-3 bg-bg"
                  >
                    <p
                      className="text-ink m-0 mb-0.5"
                      style={{ fontSize: '13px', fontWeight: 500 }}
                    >
                      {role.name}
                    </p>
                    <p
                      className="text-ink-muted m-0"
                      style={{ fontSize: '11.5px' }}
                    >
                      {(assignmentsByRoleId.get(role.id) ?? []).length} personne
                      {(assignmentsByRoleId.get(role.id) ?? []).length > 1 ? 's' : ''}
                    </p>
                    <p
                      className="text-ink-mute-2 m-0 mt-0.5 font-mono uppercase"
                      style={{ fontSize: '9.5px', letterSpacing: '0.06em' }}
                    >
                      ({semanticTag(role, maxValidatorOrdering)})
                    </p>
                  </div>
                  {idx < arr.length - 1 && (
                    <span
                      className="px-2 text-ink-mute-2 font-mono"
                      aria-hidden="true"
                      style={{ fontSize: '14px' }}
                    >
                      →
                    </span>
                  )}
                </div>
              ))}
          </div>
        )}
      </section>

      {/* ─── Bloc 2 : Catalog table ────────────────────────────────────── */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-ink m-0" style={{ fontSize: '16px', fontWeight: 500 }}>
            Catalogue des rôles
          </h3>
          <button
            type="button"
            onClick={openCreate}
            data-testid={TEST_IDS.orderRole.catalogAddBtn}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded bg-ink text-paper hover:bg-black transition-colors"
            style={{ fontSize: '13px', fontWeight: 500 }}
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2} aria-hidden="true" />
            Ajouter un rôle
          </button>
        </div>

        {loading ? (
          <div className="text-ink-muted" style={{ fontSize: '13px' }}>
            Chargement du catalogue…
          </div>
        ) : (
          <div className="border border-line rounded-lg overflow-hidden">
            <table
              data-testid={TEST_IDS.orderRole.catalogTable}
              className="w-full text-left"
              style={{ fontSize: '13px' }}
            >
              <thead className="bg-paper border-b border-line">
                <tr>
                  <th scope="col" className="py-2.5 px-4 font-mono uppercase text-ink-mute-2" style={{ fontSize: '10.5px', letterSpacing: '0.08em', fontWeight: 500 }}>
                    Ordre
                  </th>
                  <th scope="col" className="py-2.5 px-4 font-mono uppercase text-ink-mute-2" style={{ fontSize: '10.5px', letterSpacing: '0.08em', fontWeight: 500 }}>
                    Nom
                  </th>
                  <th scope="col" className="py-2.5 px-4 font-mono uppercase text-ink-mute-2" style={{ fontSize: '10.5px', letterSpacing: '0.08em', fontWeight: 500 }}>
                    Droits
                  </th>
                  <th scope="col" className="py-2.5 px-4 font-mono uppercase text-ink-mute-2" style={{ fontSize: '10.5px', letterSpacing: '0.08em', fontWeight: 500 }}>
                    Notification
                  </th>
                  <th scope="col" className="py-2.5 px-4 font-mono uppercase text-ink-mute-2" style={{ fontSize: '10.5px', letterSpacing: '0.08em', fontWeight: 500 }}>
                    Portée
                  </th>
                  <th scope="col" className="py-2.5 px-4 font-mono uppercase text-ink-mute-2 text-right" style={{ fontSize: '10.5px', letterSpacing: '0.08em', fontWeight: 500 }}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleRoles.map((role, idx, arr) => {
                  const isArchived = !!role.archived_at;
                  const isCanonical = CANONICAL_ROLES_NON_ARCHIVABLE.has(role.name);
                  const portee = role.scope === 'tenant'
                    ? 'Espace'
                    : `Boutique « ${shopNameById.get(role.scope_shop_id ?? '') ?? '—'} »`;
                  return (
                    <tr
                      key={role.id}
                      data-testid={TEST_IDS.orderRole.catalogRow}
                      data-role-id={role.id}
                      className={`border-b border-line last:border-b-0 ${isArchived ? 'opacity-50' : ''}`}
                    >
                      <td className="py-3 px-4 text-ink-muted font-mono" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {role.ordering_index}
                      </td>
                      <td className="py-3 px-4 text-ink">{role.name}</td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {ALL_CAPS_LABELS.filter((c) => role.capabilities[c.key]).map((c) => (
                            <span
                              key={c.key}
                              className={`inline-block px-1.5 py-0.5 rounded border font-mono uppercase ${c.className}`}
                              style={{ fontSize: '9.5px', letterSpacing: '0.06em', fontWeight: 500 }}
                            >
                              {c.label}
                            </span>
                          ))}
                          {role.name === 'Acheteur' && (
                            <span
                              className="inline-block px-1.5 py-0.5 rounded border font-mono uppercase border-line text-ink-muted"
                              style={{ fontSize: '9.5px', letterSpacing: '0.06em', fontWeight: 500 }}
                            >
                              créer
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-ink-muted" title={NOTIFY_TOOLTIPS[role.notify_policy as NotifyPolicy]}>
                        {NOTIFY_LABELS[role.notify_policy as NotifyPolicy]}
                      </td>
                      <td className="py-3 px-4 text-ink-muted">{portee}</td>
                      <td className="py-3 px-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              data-testid={TEST_IDS.orderRole.catalogMenuBtn}
                              aria-label={`Menu d'actions pour ${role.name}`}
                              className="inline-flex items-center justify-center w-7 h-7 rounded hover:bg-bg text-ink-muted hover:text-ink transition-colors"
                            >
                              <MoreHorizontal className="w-4 h-4" strokeWidth={2} aria-hidden="true" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              data-testid={TEST_IDS.orderRole.catalogMenuEdit}
                              onSelect={() => openEdit(role)}
                            >
                              <Edit className="w-3.5 h-3.5 mr-2" strokeWidth={2} aria-hidden="true" />
                              Modifier
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              data-testid={TEST_IDS.orderRole.catalogMenuDuplicate}
                              onSelect={() => openDuplicate(role)}
                            >
                              <Copy className="w-3.5 h-3.5 mr-2" strokeWidth={2} aria-hidden="true" />
                              Dupliquer
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {!isArchived && idx > 0 && (
                              <DropdownMenuItem
                                data-testid={TEST_IDS.orderRole.catalogMenuMoveUp}
                                onSelect={() => void moveRole(role, 'up')}
                              >
                                <MoveUp className="w-3.5 h-3.5 mr-2" strokeWidth={2} aria-hidden="true" />
                                Monter d'un cran
                              </DropdownMenuItem>
                            )}
                            {!isArchived && idx < arr.filter((r) => r.archived_at === null).length - 1 && (
                              <DropdownMenuItem
                                data-testid={TEST_IDS.orderRole.catalogMenuMoveDown}
                                onSelect={() => void moveRole(role, 'down')}
                              >
                                <MoveDown className="w-3.5 h-3.5 mr-2" strokeWidth={2} aria-hidden="true" />
                                Descendre d'un cran
                              </DropdownMenuItem>
                            )}
                            {!isCanonical && !isArchived && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  data-testid={TEST_IDS.orderRole.catalogMenuArchive}
                                  onSelect={() => setRoleToArchive(role)}
                                  className="text-err-fg focus:text-err-fg"
                                >
                                  <Archive className="w-3.5 h-3.5 mr-2" strokeWidth={2} aria-hidden="true" />
                                  Archiver
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Bouton "Voir l'archive" */}
        {roles.some((r) => r.archived_at !== null) && (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setShowArchived(!showArchived)}
              data-testid={TEST_IDS.orderRole.catalogShowArchivedBtn}
              className="text-ink-muted hover:text-ink transition-colors"
              style={{ fontSize: '12.5px' }}
            >
              {showArchived ? '− Masquer l\'archive' : '+ Voir l\'archive'}
            </button>
          </div>
        )}
      </section>

      {/* ─── Bloc 3 : Assignations summary (Option A lecture seule + lien) ── */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-ink m-0" style={{ fontSize: '16px', fontWeight: 500 }}>
            Personnes assignées par rôle
          </h3>
          <Link
            to={`/t/${currentTenant.slug}/dashboard/users`}
            data-testid={TEST_IDS.orderRole.assignmentsManageLink}
            className="inline-flex items-center gap-1 text-ink-muted hover:text-ink transition-colors"
            style={{ fontSize: '12.5px' }}
          >
            → Gérer dans la page Users
          </Link>
        </div>
        <div
          data-testid={TEST_IDS.orderRole.assignmentsSummary}
          className="border border-line rounded-lg p-4 bg-paper"
        >
          {loading ? (
            <div className="text-ink-muted" style={{ fontSize: '13px' }}>
              Chargement…
            </div>
          ) : (
            <ul className="m-0 p-0 list-none flex flex-col gap-2">
              {visibleRoles
                .filter((r) => r.archived_at === null)
                .map((role) => {
                  const rows = assignmentsByRoleId.get(role.id) ?? [];
                  const labels = rows.map((r) => r.user_email ?? '—').slice(0, 5);
                  const remainder = rows.length - labels.length;
                  return (
                    <li key={role.id} className="flex gap-2 items-baseline" style={{ fontSize: '13px' }}>
                      <span className="text-ink min-w-[140px]" style={{ fontWeight: 500 }}>
                        {role.name}
                      </span>
                      <span className="text-ink-muted">
                        {rows.length === 0
                          ? 'Personne'
                          : remainder > 0
                            ? `${labels.join(', ')} + ${remainder} autre${remainder > 1 ? 's' : ''}`
                            : labels.join(', ')}
                      </span>
                    </li>
                  );
                })}
            </ul>
          )}
        </div>
      </section>

      {/* ─── Bloc 4 : Statuts custom (placeholder V2) ───────────────────── */}
      <section
        data-testid={TEST_IDS.orderRole.statusesSection}
        className="mb-10 border border-line rounded-lg p-4 bg-paper"
      >
        <h3 className="text-ink m-0 mb-1" style={{ fontSize: '14px', fontWeight: 500 }}>
          Statuts personnalisés de commande{' '}
          <span
            className="ml-2 inline-block px-1.5 py-0.5 rounded border font-mono uppercase border-line text-ink-muted"
            style={{ fontSize: '9.5px', letterSpacing: '0.06em', fontWeight: 500 }}
          >
            Lecture seule — édition à venir
          </span>
        </h3>
        <p
          className="text-ink-muted m-0"
          style={{ fontSize: '12.5px', lineHeight: 1.55 }}
        >
          Brouillon · En attente de validation · Validée · En production · Expédiée
          · Livrée · Facturée · Annulée
        </p>
      </section>

      {/* ─── Dialogs ─────────────────────────────────────────────────────── */}
      <RoleEditorDialog
        open={editorMode !== 'closed'}
        role={editorMode === 'edit' ? editorRole : undefined}
        tenantId={currentTenant.id}
        shops={shopOptions}
        otherRoleNames={otherRoleNames}
        rolesOrdered={roles.filter((r) => r.archived_at === null)}
        defaultNameForCreate={
          editorMode === 'duplicate' ? editorRole?.name : defaultNameForCreate
        }
        onClose={closeEditor}
        onSaved={() => void reload()}
      />

      <AlertDialog
        open={roleToArchive !== null}
        onOpenChange={(open) => {
          if (!open && !archiveSubmitting) setRoleToArchive(null);
        }}
      >
        <AlertDialogContent data-testid={TEST_IDS.orderRole.catalogArchiveConfirmDialog}>
          <AlertDialogHeader>
            <AlertDialogTitle>Archiver le rôle ?</AlertDialogTitle>
            <AlertDialogDescription>
              Archiver le rôle{' '}
              <strong>« {roleToArchive?.name} »</strong>. Les commandes en cours
              conservent leurs assignations actuelles ; aucune nouvelle assignation
              ne sera possible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiveSubmitting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              data-testid={TEST_IDS.orderRole.catalogArchiveConfirmBtn}
              disabled={archiveSubmitting}
              onClick={(e) => {
                e.preventDefault();
                void confirmArchive();
              }}
              className="bg-err-fg text-paper hover:bg-err-fg/90"
            >
              Archiver
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
