import { useCallback, useEffect, useRef, useState } from 'react';
import type { CommercialOverview, CreatePriceRule } from '../../modules/commercial';
import { useCommercialApi } from '../contexts/ModuleClientsContext';

const EMPTY_OVERVIEW: CommercialOverview = {
  available: true,
  rules: [],
  groups: [],
  members: [],
  gammes: [],
};

export function commercialManagementError(
  cause: unknown,
  fallback = 'Opération commerciale impossible.',
): string {
  return cause instanceof Error && cause.message ? cause.message : fallback;
}

export function useCommercialManagement(tenantId: string | null) {
  const commercialApi = useCommercialApi();
  const requestVersion = useRef(0);
  const targetRef = useRef(tenantId);
  targetRef.current = tenantId;
  const [overview, setOverview] = useState<CommercialOverview>(EMPTY_OVERVIEW);
  const [loading, setLoading] = useState(Boolean(tenantId));
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const version = ++requestVersion.current;
    if (!tenantId) {
      setOverview(EMPTY_OVERVIEW);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const next = await commercialApi.overview(tenantId);
      if (version === requestVersion.current) setOverview(next);
    } catch (cause) {
      if (version === requestVersion.current) {
        setError(commercialManagementError(cause, 'Chargement de la gestion commerciale impossible.'));
      }
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [commercialApi, tenantId]);

  useEffect(() => {
    setOverview(EMPTY_OVERVIEW);
    void load();
    return () => {
      requestVersion.current += 1;
    };
  }, [load]);

  const forCurrentTenant = async <T,>(operation: (currentTenantId: string) => Promise<T>) => {
    if (!tenantId) throw new Error('Aucun espace actif.');
    const target = tenantId;
    setError(null);
    try {
      return await operation(tenantId);
    } catch (cause) {
      if (target === targetRef.current) setError(commercialManagementError(cause));
      throw cause;
    }
  };

  const toggleRule = async (ruleId: string, active: boolean) => {
    setOverview((previous) => ({
      ...previous,
      rules: previous.rules.map((rule) => rule.id === ruleId ? { ...rule, active } : rule),
    }));
    try {
      await forCurrentTenant((currentTenantId) => commercialApi.setRuleActive(currentTenantId, ruleId, active));
    } catch (cause) {
      await load();
      if (tenantId === targetRef.current) setError(commercialManagementError(cause));
    }
  };

  const removeRule = async (ruleId: string) => {
    await forCurrentTenant((currentTenantId) => commercialApi.removeRule(currentTenantId, ruleId));
    setOverview((previous) => ({
      ...previous,
      rules: previous.rules.filter((rule) => rule.id !== ruleId),
    }));
  };

  const createGroup = async (name: string) => {
    await forCurrentTenant((currentTenantId) => commercialApi.createGroup(currentTenantId, name));
    await load();
  };

  const removeGroup = async (groupId: string) => {
    await forCurrentTenant((currentTenantId) => commercialApi.removeGroup(currentTenantId, groupId));
    setOverview((previous) => ({
      ...previous,
      groups: previous.groups.filter((group) => group.id !== groupId),
    }));
  };

  const groupMembers = (groupId: string) => forCurrentTenant(
    (currentTenantId) => commercialApi.groupMembers(currentTenantId, groupId),
  );

  const setGroupMember = async (groupId: string, userId: string, member: boolean) => {
    await forCurrentTenant(
      (currentTenantId) => commercialApi.setGroupMember(currentTenantId, groupId, userId, member),
    );
    await load();
  };

  const createRule = async (command: CreatePriceRule) => {
    await forCurrentTenant((currentTenantId) => commercialApi.createRule(currentTenantId, command));
    await load();
  };

  return {
    ...overview,
    migrationMissing: !overview.available,
    loading,
    error,
    refresh: load,
    toggleRule,
    removeRule,
    createGroup,
    removeGroup,
    groupMembers,
    setGroupMember,
    createRule,
  } as const;
}
