/**
 * useOrderRoles — Hook S-ORDER-ROLES-3 (Sprint 6, 2026-06-01).
 *
 * Expose la surface API des rôles workflow pour les composants UI :
 *  - capabilities du user sur une commande (avec helpers user_has_order_role)
 *  - rôles assignés non-révoqués du user sur la commande
 *  - capabilities cumulées du user dans le tenant (Phase A user_has_capability)
 *
 * Consommé par :
 *  - PortalOrders (filtre tabs "À valider", "À approuver", "À produire")
 *  - Composants ligne commande (boutons Valider/Annuler/Modifier/Exporter
 *    conditionnels selon capabilities)
 *  - S-N1-APPROVAL workflow (edge order-workflow-step lit aussi)
 *  - S3.5 audit trail UI (lit notify_policy + capabilities historiques)
 *
 * Refonte UI PortalOrders avec tabs (AC3-AC5 de la spec) tracée comme story
 * de suivi S-ORDER-ROLES-3-UI : nécessite Sally UX wireframes (DoD #5).
 */

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '/utils/supabase/client';

export type OrderCapability =
  | 'can_quote'
  | 'can_order'
  | 'can_invite'
  | 'can_validate'
  | 'can_cancel'
  | 'can_modify'
  | 'can_export'
  | 'can_manage_catalog'
  | 'can_manage_roles';

export interface OrderRoleAssignment {
  assignment_id: string;
  role_definition_id: string;
  name: string;
  capabilities: Partial<Record<OrderCapability, boolean>>;
  notify_policy: 'chain_next' | 'all_roles' | 'none';
  ordering_index: number;
}

export interface OrderRolesState {
  loading: boolean;
  error: string | null;
  /** Rôles non-révoqués du user sur la commande. */
  roles: OrderRoleAssignment[];
  /** Capabilities cumulées du user via tous ses rôles sur la commande. */
  capabilities: Record<OrderCapability, boolean>;
  /** True si le user est le créateur (passeur) de la commande. */
  isCreator: boolean;
  refresh: () => Promise<void>;
}

const EMPTY_CAPS: Record<OrderCapability, boolean> = {
  can_quote: false,
  can_order: false,
  can_invite: false,
  can_validate: false,
  can_cancel: false,
  can_modify: false,
  can_export: false,
  can_manage_catalog: false,
  can_manage_roles: false,
};

/**
 * Fusionne les capabilities de plusieurs rôles (OR logique).
 * Si user a 2 rôles dont un avec can_validate=true, capabilities.can_validate=true.
 */
export function mergeCapabilities(roles: OrderRoleAssignment[]): Record<OrderCapability, boolean> {
  const merged = { ...EMPTY_CAPS };
  for (const role of roles) {
    for (const key of Object.keys(merged) as OrderCapability[]) {
      if (role.capabilities[key] === true) {
        merged[key] = true;
      }
    }
  }
  return merged;
}

/**
 * Hook principal — capabilities du user authentifié sur une commande donnée.
 *
 * @param orderId UUID de la commande (null = pas de query, retourne loading=false + état vide)
 * @param userId UUID du user (récupéré via AuthContext côté caller — passé en arg pour testabilité)
 */
export function useOrderRoles(orderId: string | null, userId: string | null): OrderRolesState {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roles, setRoles] = useState<OrderRoleAssignment[]>([]);
  const [isCreator, setIsCreator] = useState(false);

  const fetch = useCallback(async () => {
    if (!orderId || !userId) {
      setRoles([]);
      setIsCreator(false);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    // Query 1 : rôles assignés non-révoqués du user sur cette commande
    // (join sur tenant_role_definitions pour avoir name/capabilities/notify_policy).
    // RLS shops_select : user_id = auth.uid() OR membre tenant — donc l'user
    // voit ses propres rôles + admins tenant voient tout.
    const { data: assignments, error: rolesErr } = await supabase
      .from('tenant_order_roles')
      .select(
        'id, role_definition_id, tenant_role_definitions(name, capabilities, notify_policy, ordering_index, archived_at)',
      )
      .eq('order_id', orderId)
      .eq('user_id', userId)
      .is('revoked_at', null);

    if (rolesErr) {
      setError(rolesErr.message);
      setLoading(false);
      return;
    }

    type Row = {
      id: string;
      role_definition_id: string;
      tenant_role_definitions: {
        name: string;
        capabilities: Partial<Record<OrderCapability, boolean>>;
        notify_policy: 'chain_next' | 'all_roles' | 'none';
        ordering_index: number;
        archived_at: string | null;
      } | null;
    };

    const parsedRoles: OrderRoleAssignment[] = ((assignments ?? []) as Row[])
      .filter((r) => r.tenant_role_definitions && r.tenant_role_definitions.archived_at === null)
      .map((r) => ({
        assignment_id: r.id,
        role_definition_id: r.role_definition_id,
        name: r.tenant_role_definitions!.name,
        capabilities: r.tenant_role_definitions!.capabilities,
        notify_policy: r.tenant_role_definitions!.notify_policy,
        ordering_index: r.tenant_role_definitions!.ordering_index,
      }));

    setRoles(parsedRoles);

    // Query 2 : vérifie si user est le créateur de la commande
    const { data: order, error: orderErr } = await supabase
      .from('tenant_orders')
      .select('created_by')
      .eq('id', orderId)
      .single();

    if (orderErr) {
      // Pas bloquant : on a déjà les rôles. On loggue.
      console.warn('[useOrderRoles] order fetch failed:', orderErr.message);
    } else {
      setIsCreator(order?.created_by === userId);
    }

    setLoading(false);
  }, [orderId, userId]);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  return {
    loading,
    error,
    roles,
    capabilities: mergeCapabilities(roles),
    isCreator,
    refresh: fetch,
  };
}

/**
 * Helper — décide si une action (cancel/validate/modify/export) est disponible
 * pour le user authn sur une commande, en croisant capabilities + statut courant.
 *
 * Aligné sur la matrice tenant_order_status_transitions seedée Sprint 6 :
 *  - draft -> cancelled : self-service creator OU can_cancel
 *  - draft -> validated : can_validate (admin tenant via RPC SECURITY DEFINER)
 *  - validated -> in_production : can_modify
 *  - in_production -> shipped : can_modify
 *  - * -> cancelled : can_cancel (sauf draft self-service)
 */
export function canDoAction(
  action: 'cancel' | 'validate' | 'modify' | 'export',
  state: OrderRolesState,
  orderStatus: string,
): boolean {
  if (state.loading) return false;

  switch (action) {
    case 'cancel':
      // Self-service creator sur draft, sinon can_cancel sur tout sauf terminaux
      if (orderStatus === 'draft' && state.isCreator) return true;
      if (state.capabilities.can_cancel && !isTerminalStatus(orderStatus)) return true;
      return false;
    case 'validate':
      return state.capabilities.can_validate && orderStatus === 'draft';
    case 'modify':
      return state.capabilities.can_modify && !isTerminalStatus(orderStatus);
    case 'export':
      return state.capabilities.can_export;
  }
}

const TERMINAL_STATUSES = new Set(['delivered', 'invoiced', 'cancelled']);

export function isTerminalStatus(status: string): boolean {
  return TERMINAL_STATUSES.has(status);
}
