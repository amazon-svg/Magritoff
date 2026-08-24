import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  IssueStorefrontActivationResult,
  ShopCustomerAccount,
} from '../../modules/shop-customers';
import { useShopCustomersApi } from '../contexts/ModuleClientsContext';

export function shopCustomerManagementError(cause: unknown, fallback: string): string {
  return cause instanceof Error && cause.message ? cause.message : fallback;
}

export function useShopCustomerAccountManagement(tenantId: string, shopId: string) {
  const api = useShopCustomersApi();
  const requestVersion = useRef(0);
  const targetKey = `${tenantId}:${shopId}`;
  const targetKeyRef = useRef(targetKey);
  targetKeyRef.current = targetKey;
  const [accounts, setAccounts] = useState<ShopCustomerAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issuingFor, setIssuingFor] = useState<string | null>(null);
  const [activation, setActivation] = useState<IssueStorefrontActivationResult | null>(null);
  const [delegating, setDelegating] = useState(false);

  const refresh = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true);
    setError(null);
    try {
      const nextAccounts = await api.list(tenantId, shopId);
      if (version === requestVersion.current) setAccounts(nextAccounts);
    } catch (cause) {
      if (version === requestVersion.current) {
        setError(shopCustomerManagementError(cause, 'Impossible de charger les comptes boutique.'));
      }
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [api, shopId, tenantId]);

  useEffect(() => {
    setSaving(false);
    setIssuingFor(null);
    setActivation(null);
    setDelegating(false);
    void refresh();
    return () => {
      requestVersion.current += 1;
    };
  }, [refresh]);

  const inviteByEmail = async (email: string): Promise<boolean> => {
    const operationTarget = targetKey;
    setSaving(true);
    setActivation(null);
    setError(null);
    try {
      const result = await api.invite(tenantId, shopId, { email });
      if (operationTarget !== targetKeyRef.current) return false;

      setActivation(result.activation);
      setAccounts((current) => {
        const withoutAccount = current.filter(
          (candidate) => candidate.id !== result.customer.id,
        );
        return [result.customer, ...withoutAccount];
      });
      return true;
    } catch (cause) {
      if (operationTarget === targetKeyRef.current) {
        setError(shopCustomerManagementError(cause, 'Impossible d’envoyer cette invitation.'));
      }
      return false;
    } finally {
      if (operationTarget === targetKeyRef.current) setSaving(false);
    }
  };

  const issueActivation = async (accountId: string) => {
    const operationTarget = targetKey;
    setIssuingFor(accountId);
    setActivation(null);
    setError(null);
    try {
      const result = await api.issueActivation(tenantId, shopId, accountId);
      if (operationTarget === targetKeyRef.current) setActivation(result);
    } catch (cause) {
      if (operationTarget === targetKeyRef.current) {
        setError(shopCustomerManagementError(cause, 'Impossible de générer le lien d’activation.'));
      }
    } finally {
      if (operationTarget === targetKeyRef.current) setIssuingFor(null);
    }
  };

  const startSelfDelegation = async (): Promise<string | null> => {
    const operationTarget = targetKey;
    setDelegating(true);
    setError(null);
    try {
      const result = await api.startSelfDelegation(tenantId, shopId, {
        reason: 'Accès depuis l’éditeur de boutique',
      });
      return operationTarget === targetKeyRef.current ? result.storefrontPath : null;
    } catch (cause) {
      if (operationTarget === targetKeyRef.current) {
        setError(shopCustomerManagementError(cause, 'Impossible d’ouvrir la boutique en mode délégué.'));
      }
      return null;
    } finally {
      if (operationTarget === targetKeyRef.current) setDelegating(false);
    }
  };

  return {
    accounts,
    loading,
    saving,
    error,
    reportError: setError,
    issuingFor,
    activation,
    delegating,
    refresh,
    inviteByEmail,
    issueActivation,
    startSelfDelegation,
  } as const;
}
