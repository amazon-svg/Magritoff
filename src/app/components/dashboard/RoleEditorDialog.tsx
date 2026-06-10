/**
 * RoleEditorDialog — modale création + édition d'un rôle workflow tenant.
 *
 * Story S-ORDER-ROLES-3-UI T5 (Sprint 6+, wireframes Sally
 * .design-handoff/wireframes/S-ORDER-ROLES-3-create-modal.md).
 *
 * Un seul composant gère création ET édition, différenciés par le prop
 * `role?` (présent = édition, absent = création). Le nom est auto-rempli
 * "Validateur X" en création (X = max ordering_index + 1 parmi validateurs).
 *
 * Form :
 *  - Nom (string, 2-50 char, unique par tenant)
 *  - 4 toggles capabilities (Valider / Annuler / Modifier / Exporter) ;
 *    au moins 1 doit être cochée
 *  - 3 radios notify_policy (Suivant / Tout le monde / Aucune)
 *  - Segmented ToggleGroup scope (tenant / shop) + Combobox boutique
 *    si scope=shop
 *  - Position dans le circuit (select "Insérer après X")
 *
 * Submit :
 *  - Création : INSERT tenant_role_definitions
 *  - Édition  : UPDATE tenant_role_definitions
 * RLS write garde via user_has_capability('can_manage_roles') côté DB.
 */

import { useEffect, useMemo, useState } from 'react';
import { Loader2, X as XIcon } from 'lucide-react';
import { supabase } from '/utils/supabase/client';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '../ui/command';
import { TEST_IDS } from '../../lib/testIds';

// ─── Types ────────────────────────────────────────────────────────────────

export type NotifyPolicy = 'chain_next' | 'all_roles' | 'none';
export type RoleScope = 'tenant' | 'shop';

export interface TenantRoleDefinition {
  id: string;
  tenant_id: string;
  name: string;
  description: string;
  capabilities: Record<string, boolean>;
  notify_policy: NotifyPolicy;
  scope: RoleScope;
  scope_shop_id: string | null;
  ordering_index: number;
  archived_at: string | null;
}

export interface ShopOption {
  id: string;
  name: string;
  slug: string;
}

export interface RoleEditorDialogProps {
  open: boolean;
  /** Si fourni : mode édition. Sinon : mode création. */
  role?: TenantRoleDefinition;
  tenantId: string;
  /** Liste des boutiques du tenant pour le Combobox scope=shop. */
  shops: ShopOption[];
  /**
   * Noms des autres rôles non archivés du tenant (pour validation unicité).
   * En mode édition, exclut le rôle courant.
   */
  otherRoleNames: string[];
  /** Rôles existants ordonnés pour le select "Insérer après X". */
  rolesOrdered: TenantRoleDefinition[];
  /** Auto-fill name proposé en création ("Validateur N"). */
  defaultNameForCreate?: string;
  onClose: () => void;
  /** Trigger reload côté parent post-save. */
  onSaved: () => void;
}

interface FormState {
  name: string;
  can_validate: boolean;
  can_cancel: boolean;
  can_modify: boolean;
  can_export: boolean;
  notify_policy: NotifyPolicy;
  scope: RoleScope;
  scope_shop_id: string | null;
  /** Position dans le circuit : id du rôle après lequel s'insérer, ou 'first'. */
  position_after_role_id: string | 'first';
}

const NAME_MIN = 2;
const NAME_MAX = 50;

function buildInitialState(role: TenantRoleDefinition | undefined, defaultName: string): FormState {
  if (role) {
    return {
      name: role.name,
      can_validate: !!role.capabilities.can_validate,
      can_cancel: !!role.capabilities.can_cancel,
      can_modify: !!role.capabilities.can_modify,
      can_export: !!role.capabilities.can_export,
      notify_policy: role.notify_policy,
      scope: role.scope,
      scope_shop_id: role.scope_shop_id,
      position_after_role_id: '', // pas modifiable en édition (UX simplifiée MVP)
    };
  }
  return {
    name: defaultName,
    can_validate: true,
    can_cancel: false,
    can_modify: false,
    can_export: false,
    notify_policy: 'chain_next',
    scope: 'tenant',
    scope_shop_id: null,
    position_after_role_id: 'first',
  };
}

export function RoleEditorDialog({
  open,
  role,
  tenantId,
  shops,
  otherRoleNames,
  rolesOrdered,
  defaultNameForCreate,
  onClose,
  onSaved,
}: RoleEditorDialogProps) {
  const isEdit = !!role;
  const [form, setForm] = useState<FormState>(() =>
    buildInitialState(role, defaultNameForCreate ?? 'Validateur 1'),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset état au changement de mode (création ↔ édition) / nouvelle ouverture
  useEffect(() => {
    if (open) {
      setForm(buildInitialState(role, defaultNameForCreate ?? 'Validateur 1'));
      setError(null);
    }
  }, [open, role, defaultNameForCreate]);

  // ─── Validation Zod-équivalent (sans dépendance Zod externe) ──────────
  const trimmedName = form.name.trim();
  const nameLength = trimmedName.length;
  const nameValid = nameLength >= NAME_MIN && nameLength <= NAME_MAX;
  const nameUnique = !otherRoleNames.includes(trimmedName);
  const atLeastOneCap =
    form.can_validate || form.can_cancel || form.can_modify || form.can_export;
  const scopeShopValid =
    form.scope === 'tenant' || (form.scope === 'shop' && !!form.scope_shop_id);

  const formValid = nameValid && nameUnique && atLeastOneCap && scopeShopValid;

  function handleOpenChange(next: boolean) {
    if (!next && !submitting) {
      setError(null);
      onClose();
    }
  }

  // ─── Submit (insert + update) ────────────────────────────────────────
  async function handleSubmit() {
    if (!formValid || submitting) return;
    setSubmitting(true);
    setError(null);

    // Construit le ordering_index cible.
    // - Édition : on garde l'ordering_index actuel (le réordonnancement est
    //   exposé par le menu ⋯ Monter/Descendre, hors scope du form).
    // - Création : calculé selon position_after_role_id. Si 'first', on prend
    //   min(ordering_index) - 10. Sinon, ordering_index = anchor + 5 (insert
    //   "entre" — le réordonnancement précis sera fait via Monter/Descendre).
    let ordering_index: number;
    if (isEdit) {
      ordering_index = role!.ordering_index;
    } else if (form.position_after_role_id === 'first') {
      const minIdx = rolesOrdered.length > 0 ? rolesOrdered[0].ordering_index : 100;
      ordering_index = Math.max(minIdx - 10, 1);
    } else {
      const anchor = rolesOrdered.find((r) => r.id === form.position_after_role_id);
      ordering_index = (anchor?.ordering_index ?? 10) + 5;
    }

    const capabilities = {
      can_validate: form.can_validate,
      can_cancel: form.can_cancel,
      can_modify: form.can_modify,
      can_export: form.can_export,
      // capabilities non éditables ici, on conserve celles existantes
      can_quote: role?.capabilities.can_quote ?? false,
      can_order: role?.capabilities.can_order ?? false,
      can_invite: role?.capabilities.can_invite ?? false,
      can_manage_catalog: role?.capabilities.can_manage_catalog ?? false,
      can_manage_roles: role?.capabilities.can_manage_roles ?? false,
    };

    const payload = {
      name: trimmedName,
      capabilities,
      notify_policy: form.notify_policy,
      scope: form.scope,
      scope_shop_id: form.scope === 'shop' ? form.scope_shop_id : null,
      ordering_index,
    };

    let rpcError: { message: string } | null = null;
    if (isEdit) {
      const { error: updErr } = await supabase
        .from('tenant_role_definitions')
        .update(payload)
        .eq('id', role!.id);
      rpcError = updErr;
    } else {
      const { error: insErr } = await supabase
        .from('tenant_role_definitions')
        .insert({ ...payload, tenant_id: tenantId });
      rpcError = insErr;
    }

    setSubmitting(false);

    if (rpcError) {
      console.warn('[RoleEditorDialog] save failed:', rpcError.message);
      setError(`Enregistrement impossible : ${rpcError.message}`);
      return;
    }

    onSaved();
    onClose();
  }

  const insertOptions = useMemo(() => {
    return [
      { value: 'first', label: 'Avant tous les rôles' },
      ...rolesOrdered
        .filter((r) => !role || r.id !== role.id)
        .map((r) => ({ value: r.id, label: `Après « ${r.name} »` })),
    ];
  }, [rolesOrdered, role]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        data-testid={TEST_IDS.orderRole.editorDialog}
        className="max-w-[560px]"
      >
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Modifier le rôle' : 'Ajouter un rôle'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Ajustez les droits, la notification et la portée. Le changement s\'applique aux nouvelles assignations.'
              : 'Définissez un rôle workflow pour cet espace. Le nom peut être personnalisé ensuite.'}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div
            role="alert"
            data-testid={TEST_IDS.orderRole.editorErrorBanner}
            className="px-3 py-2 rounded bg-err-bg border border-err-fg/20 text-err-fg"
            style={{ fontSize: '12.5px', lineHeight: 1.45 }}
          >
            {error}
          </div>
        )}

        <div className="flex flex-col gap-5 mt-2">
          {/* Nom */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="role-editor-name"
              className="font-mono uppercase text-ink-mute-2"
              style={{ fontSize: '10px', letterSpacing: '0.08em', fontWeight: 500 }}
            >
              Nom du rôle *
            </label>
            <input
              id="role-editor-name"
              type="text"
              data-testid={TEST_IDS.orderRole.editorNameInput}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              disabled={submitting}
              maxLength={NAME_MAX}
              className="px-3 py-2 border border-line rounded bg-paper text-ink"
              style={{ fontSize: '14px' }}
              placeholder="Validateur 1 / Direction Communication / DAF…"
            />
            <p
              className="text-ink-mute-2 m-0"
              style={{ fontSize: '12px', lineHeight: 1.45 }}
            >
              Personnalisez pour refléter votre organisation.{' '}
              {!nameUnique && trimmedName.length >= NAME_MIN && (
                <span className="text-warn-fg">Ce nom est déjà utilisé.</span>
              )}
              {trimmedName.length > 0 && trimmedName.length < NAME_MIN && (
                <span className="text-warn-fg">Minimum {NAME_MIN} caractères.</span>
              )}
            </p>
          </div>

          {/* Droits */}
          <div className="flex flex-col gap-1.5">
            <span
              className="font-mono uppercase text-ink-mute-2"
              style={{ fontSize: '10px', letterSpacing: '0.08em', fontWeight: 500 }}
            >
              Droits accordés au rôle *
            </span>
            <div className="flex flex-col gap-2 border border-line rounded p-3">
              {[
                {
                  key: 'can_validate' as const,
                  label: 'Valider',
                  desc: 'Approuve la commande et la fait avancer dans le circuit.',
                  testid: TEST_IDS.orderRole.editorCapValidate,
                },
                {
                  key: 'can_cancel' as const,
                  label: 'Annuler',
                  desc: 'Peut annuler la commande à n\'importe quelle étape non terminale.',
                  testid: TEST_IDS.orderRole.editorCapCancel,
                },
                {
                  key: 'can_modify' as const,
                  label: 'Modifier',
                  desc: 'Peut modifier les articles ou quantités, et piloter la production.',
                  testid: TEST_IDS.orderRole.editorCapModify,
                },
                {
                  key: 'can_export' as const,
                  label: 'Exporter',
                  desc: 'Peut exporter la commande en PDF / CSV.',
                  testid: TEST_IDS.orderRole.editorCapExport,
                },
              ].map((cap) => (
                <label
                  key={cap.key}
                  className="flex items-start gap-2.5 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    data-testid={cap.testid}
                    checked={form[cap.key]}
                    onChange={(e) => setForm({ ...form, [cap.key]: e.target.checked })}
                    disabled={submitting}
                    className="mt-0.5 cursor-pointer"
                  />
                  <span className="flex flex-col">
                    <span className="text-ink" style={{ fontSize: '13.5px', fontWeight: 500 }}>
                      {cap.label}
                    </span>
                    <span
                      className="text-ink-muted"
                      style={{ fontSize: '12px', lineHeight: 1.4 }}
                    >
                      {cap.desc}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            {!atLeastOneCap && (
              <p className="text-warn-fg m-0" style={{ fontSize: '12px' }}>
                Sélectionnez au moins un droit.
              </p>
            )}
          </div>

          {/* Notification */}
          <div className="flex flex-col gap-1.5">
            <span
              className="font-mono uppercase text-ink-mute-2"
              style={{ fontSize: '10px', letterSpacing: '0.08em', fontWeight: 500 }}
            >
              Notification à l'étape de ce rôle
            </span>
            <div className="flex flex-col gap-1.5">
              {[
                {
                  value: 'chain_next' as const,
                  label: 'Le rôle suivant uniquement',
                  testid: TEST_IDS.orderRole.editorNotifyChainNext,
                },
                {
                  value: 'all_roles' as const,
                  label: 'Tous les rôles du circuit',
                  testid: TEST_IDS.orderRole.editorNotifyAllRoles,
                },
                {
                  value: 'none' as const,
                  label: 'Aucune notification',
                  testid: TEST_IDS.orderRole.editorNotifyNone,
                },
              ].map((opt) => (
                <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="notify_policy"
                    data-testid={opt.testid}
                    checked={form.notify_policy === opt.value}
                    onChange={() => setForm({ ...form, notify_policy: opt.value })}
                    disabled={submitting}
                    className="cursor-pointer"
                  />
                  <span className="text-ink" style={{ fontSize: '13.5px' }}>
                    {opt.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Portée */}
          <div className="flex flex-col gap-1.5">
            <span
              className="font-mono uppercase text-ink-mute-2"
              style={{ fontSize: '10px', letterSpacing: '0.08em', fontWeight: 500 }}
            >
              Portée du rôle *
            </span>
            <ToggleGroup
              type="single"
              value={form.scope}
              onValueChange={(v) => {
                if (!v) return;
                setForm({ ...form, scope: v as RoleScope, scope_shop_id: v === 'tenant' ? null : form.scope_shop_id });
              }}
              className="justify-start"
            >
              <ToggleGroupItem
                value="tenant"
                data-testid={TEST_IDS.orderRole.editorScopeTenant}
                disabled={submitting}
              >
                Tout l'espace
              </ToggleGroupItem>
              <ToggleGroupItem
                value="shop"
                data-testid={TEST_IDS.orderRole.editorScopeShop}
                disabled={submitting}
              >
                Une boutique précise
              </ToggleGroupItem>
            </ToggleGroup>
            {form.scope === 'tenant' && (
              <p
                className="text-ink-mute-2 m-0"
                style={{ fontSize: '12px', lineHeight: 1.45 }}
              >
                Le rôle s'applique à toutes les commandes de l'espace.
              </p>
            )}
            {form.scope === 'shop' && (
              <div className="mt-1.5 flex flex-col gap-1.5">
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      data-testid={TEST_IDS.orderRole.editorScopeShopCombobox}
                      disabled={submitting}
                      className="inline-flex items-center justify-between gap-2 px-2.5 py-2 rounded border border-line bg-paper text-ink hover:border-ink-mute-2 transition-colors max-w-[320px]"
                      style={{ fontSize: '13.5px' }}
                    >
                      <span className="truncate text-left">
                        {form.scope_shop_id
                          ? shops.find((s) => s.id === form.scope_shop_id)?.name ?? 'Boutique introuvable'
                          : 'Choisir une boutique…'}
                      </span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[320px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Rechercher une boutique…" className="h-9" />
                      <CommandList>
                        <CommandEmpty>Aucune boutique.</CommandEmpty>
                        <CommandGroup>
                          {shops.map((s) => (
                            <CommandItem
                              key={s.id}
                              value={s.name}
                              onSelect={() => setForm({ ...form, scope_shop_id: s.id })}
                              data-testid={TEST_IDS.orderRole.editorScopeShopOption}
                              data-shop-id={s.id}
                            >
                              {s.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <p
                  className="text-ink-mute-2 m-0"
                  style={{ fontSize: '12px', lineHeight: 1.45 }}
                >
                  Le rôle ne s'applique qu'aux commandes passées dans cette boutique.
                </p>
              </div>
            )}
          </div>

          {/* Position circuit — création uniquement */}
          {!isEdit && (
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="role-editor-position"
                className="font-mono uppercase text-ink-mute-2"
                style={{ fontSize: '10px', letterSpacing: '0.08em', fontWeight: 500 }}
              >
                Position dans le circuit
              </label>
              <select
                id="role-editor-position"
                data-testid={TEST_IDS.orderRole.editorPositionSelect}
                value={form.position_after_role_id}
                onChange={(e) => setForm({ ...form, position_after_role_id: e.target.value })}
                disabled={submitting}
                className="px-2.5 py-2 border border-line rounded bg-paper text-ink max-w-[320px]"
                style={{ fontSize: '13.5px' }}
              >
                {insertOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p
                className="text-ink-mute-2 m-0"
                style={{ fontSize: '12px', lineHeight: 1.45 }}
              >
                Vous pourrez réordonner finement via le menu ⋯ après la création.
              </p>
            </div>
          )}

          {isEdit && (
            <div
              className="px-3 py-2 rounded border border-info-fg/20 bg-info-bg text-info-fg"
              style={{ fontSize: '12.5px', lineHeight: 1.45 }}
              role="status"
            >
              Les changements de droits s'appliquent aux nouvelles assignations.
              Les commandes déjà en cours conservent leurs droits historiques.
            </div>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <button
              type="button"
              data-testid={TEST_IDS.orderRole.editorCancelBtn}
              disabled={submitting}
              className="px-3.5 py-2 rounded border border-line bg-paper text-ink-muted hover:text-ink hover:border-ink-mute-2 transition-colors"
              style={{ fontSize: '13.5px' }}
            >
              Annuler
            </button>
          </DialogClose>
          <button
            type="button"
            data-testid={TEST_IDS.orderRole.editorSubmitBtn}
            disabled={!formValid || submitting}
            onClick={() => void handleSubmit()}
            className="px-3.5 py-2 rounded bg-ink text-paper hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ fontSize: '13.5px', fontWeight: 500 }}
          >
            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5 inline" />}
            {submitting
              ? isEdit
                ? 'Enregistrement…'
                : 'Création…'
              : isEdit
                ? 'Enregistrer les modifications'
                : 'Créer le rôle'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
