/**
 * Tests unitaires hook useOrderRoles (S-ORDER-ROLES-3 hook, 2026-06-01).
 *
 * Focus sur les helpers purs (mergeCapabilities, canDoAction, isTerminalStatus)
 * et la sémantique métier. Le hook lui-même intègre l'appel SDK Supabase, son
 * comportement integration est validé indirectement via les tests RPC
 * order_roles_rpc.test.ts qui exercent les vraies tables sur la DB B5.
 */

import { describe, expect, it } from 'vitest';
import {
  canDoAction,
  isTerminalStatus,
  mergeCapabilities,
  type OrderRoleAssignment,
  type OrderRolesState,
} from '../../src/app/hooks/useOrderRoles';

const makeRole = (
  caps: Partial<OrderRoleAssignment['capabilities']>,
  overrides: Partial<Omit<OrderRoleAssignment, 'capabilities'>> = {},
): OrderRoleAssignment => ({
  assignment_id: 'a-' + Math.random().toString(36).slice(2, 8),
  role_definition_id: 'r-' + Math.random().toString(36).slice(2, 8),
  name: overrides.name ?? 'Test Role',
  capabilities: caps,
  notify_policy: overrides.notify_policy ?? 'chain_next',
  ordering_index: overrides.ordering_index ?? 0,
});

describe('mergeCapabilities', () => {
  it('retourne toutes false sans rôle', () => {
    const merged = mergeCapabilities([]);
    expect(merged.can_validate).toBe(false);
    expect(merged.can_cancel).toBe(false);
    expect(merged.can_modify).toBe(false);
    expect(merged.can_export).toBe(false);
  });

  it('expose les capabilities d un seul rôle', () => {
    const merged = mergeCapabilities([
      makeRole({ can_validate: true, can_export: true }),
    ]);
    expect(merged.can_validate).toBe(true);
    expect(merged.can_export).toBe(true);
    expect(merged.can_cancel).toBe(false);
  });

  it('OR cumulatif sur plusieurs rôles (cumul Q2 spec)', () => {
    // User a 2 rôles : Acheteur (can_quote/can_order) + Validateur (can_validate)
    const merged = mergeCapabilities([
      makeRole({ can_quote: true, can_order: true }, { name: 'Acheteur' }),
      makeRole({ can_validate: true, can_cancel: true }, { name: 'Validateur' }),
    ]);
    expect(merged.can_quote).toBe(true);
    expect(merged.can_order).toBe(true);
    expect(merged.can_validate).toBe(true);
    expect(merged.can_cancel).toBe(true);
  });

  it('ignore les capabilities undefined (pas implicitement true)', () => {
    const merged = mergeCapabilities([makeRole({})]);
    expect(merged.can_validate).toBe(false);
  });
});

describe('isTerminalStatus', () => {
  it.each([
    ['delivered', true],
    ['invoiced', true],
    ['cancelled', true],
    ['draft', false],
    ['validated', false],
    ['in_production', false],
    ['shipped', false],
    ['totally_made_up', false],
  ])('statut %s → terminal=%s', (status, expected) => {
    expect(isTerminalStatus(status)).toBe(expected);
  });
});

describe('canDoAction', () => {
  const baseState = (caps: Partial<Record<keyof OrderRolesState['capabilities'], boolean>>, isCreator = false): OrderRolesState => ({
    loading: false,
    error: null,
    roles: [],
    capabilities: {
      can_quote: false, can_order: false, can_invite: false,
      can_validate: false, can_cancel: false, can_modify: false, can_export: false,
      can_manage_catalog: false, can_manage_roles: false,
      ...caps,
    },
    isCreator,
    refresh: async () => {},
  });

  // cancel
  it('cancel : self-service creator sur draft = autorisé', () => {
    expect(canDoAction('cancel', baseState({}, true), 'draft')).toBe(true);
  });
  it('cancel : creator sans capability sur validated = bloqué (plus draft)', () => {
    expect(canDoAction('cancel', baseState({}, true), 'validated')).toBe(false);
  });
  it('cancel : can_cancel sur validated = autorisé', () => {
    expect(canDoAction('cancel', baseState({ can_cancel: true }), 'validated')).toBe(true);
  });
  it('cancel : can_cancel sur cancelled (terminal) = bloqué', () => {
    expect(canDoAction('cancel', baseState({ can_cancel: true }), 'cancelled')).toBe(false);
  });
  it('cancel : non-creator sans capability = bloqué', () => {
    expect(canDoAction('cancel', baseState({}, false), 'draft')).toBe(false);
  });

  // validate
  it('validate : can_validate sur draft = autorisé', () => {
    expect(canDoAction('validate', baseState({ can_validate: true }), 'draft')).toBe(true);
  });
  it('validate : can_validate sur validated = bloqué (déjà validé)', () => {
    expect(canDoAction('validate', baseState({ can_validate: true }), 'validated')).toBe(false);
  });
  it('validate : sans capability = bloqué', () => {
    expect(canDoAction('validate', baseState({}), 'draft')).toBe(false);
  });

  // modify
  it('modify : can_modify sur validated = autorisé', () => {
    expect(canDoAction('modify', baseState({ can_modify: true }), 'validated')).toBe(true);
  });
  it('modify : can_modify sur delivered (terminal) = bloqué', () => {
    expect(canDoAction('modify', baseState({ can_modify: true }), 'delivered')).toBe(false);
  });

  // export
  it('export : can_export = toujours autorisé (même sur terminal)', () => {
    expect(canDoAction('export', baseState({ can_export: true }), 'cancelled')).toBe(true);
    expect(canDoAction('export', baseState({ can_export: true }), 'invoiced')).toBe(true);
    expect(canDoAction('export', baseState({ can_export: true }), 'draft')).toBe(true);
  });
  it('export : sans capability = bloqué', () => {
    expect(canDoAction('export', baseState({}), 'invoiced')).toBe(false);
  });

  // loading state
  it('toutes actions bloquées si loading=true', () => {
    const state: OrderRolesState = {
      ...baseState({ can_validate: true, can_cancel: true }, true),
      loading: true,
    };
    expect(canDoAction('validate', state, 'draft')).toBe(false);
    expect(canDoAction('cancel', state, 'draft')).toBe(false);
  });
});
