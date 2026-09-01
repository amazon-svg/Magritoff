import { useCallback, useEffect, useState } from 'react';
import { useWorkspaceApi } from '@/platform/runtime/workspace-ui-runtime';
import { CustomersApiClient } from '@/modules/customers/api/client';
import type {
  CreateCustomerContactCommand,
  CustomerDetailDto,
  SiretVerificationResultDto,
  UpdateCustomerCommand,
} from '@/modules/customers/api/contracts';
import { customersManagementError } from './useCustomersManagement';

/**
 * Fiche client detaillee (CA1, CA6) : coordonnees, interlocuteurs (CA4, CA5),
 * verification SIRET (CA3). Chaque mutation relit la ressource pour rester
 * synchro avec l `ETag` courant (CA9) — pas d etat optimiste local qui
 * pourrait diverger de la base.
 */
export function useCustomerDetail(customerId: string | null) {
  const api = useWorkspaceApi(CustomersApiClient);
  const [detail, setDetail] = useState<CustomerDetailDto | null>(null);
  const [etag, setEtag] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(customerId));
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [lastVerification, setLastVerification] = useState<SiretVerificationResultDto | null>(null);

  const load = useCallback(async () => {
    if (!customerId) {
      setDetail(null);
      setEtag(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await api.getForEdit(customerId);
      setDetail(result.data);
      setEtag(result.etag);
    } catch (cause) {
      setError(customersManagementError(cause, 'Chargement de la fiche client impossible.'));
    } finally {
      setLoading(false);
    }
  }, [api, customerId]);

  useEffect(() => {
    void load();
  }, [load]);

  const update = useCallback(
    async (command: UpdateCustomerCommand) => {
      if (!customerId || !etag) throw new Error('Fiche client non chargée.');
      setError(null);
      try {
        const result = await api.update(customerId, command, etag);
        setDetail((previous) => (previous ? { ...previous, ...result.data } : previous));
        setEtag(result.etag);
        return result.data;
      } catch (cause) {
        setError(customersManagementError(cause, 'Modification du client impossible.'));
        throw cause;
      }
    },
    [api, customerId, etag],
  );

  const verifySiret = useCallback(async () => {
    if (!customerId) return null;
    setVerifying(true);
    setError(null);
    try {
      const result = await api.verifySiret(customerId);
      setLastVerification(result);
      await load();
      return result;
    } catch (cause) {
      setError(customersManagementError(cause, 'Vérification SIRET impossible.'));
      throw cause;
    } finally {
      setVerifying(false);
    }
  }, [api, customerId, load]);

  const addContact = useCallback(
    async (command: CreateCustomerContactCommand) => {
      if (!customerId) throw new Error('Fiche client non chargée.');
      setError(null);
      try {
        const created = await api.createContact(customerId, command);
        await load();
        return created;
      } catch (cause) {
        setError(customersManagementError(cause, 'Création de l’interlocuteur impossible.'));
        throw cause;
      }
    },
    [api, customerId, load],
  );

  const setContactPrimary = useCallback(
    async (contactId: string, isPrimary: boolean) => {
      if (!customerId) throw new Error('Fiche client non chargée.');
      setError(null);
      try {
        const current = await api.getContactForEdit(customerId, contactId);
        if (!current.etag) throw new Error('ETag interlocuteur indisponible.');
        await api.updateContact(customerId, contactId, { is_primary: isPrimary }, current.etag);
        await load();
      } catch (cause) {
        setError(customersManagementError(cause, 'Modification de l’interlocuteur impossible.'));
        throw cause;
      }
    },
    [api, customerId, load],
  );

  return {
    detail,
    etag,
    loading,
    error,
    verifying,
    lastVerification,
    refresh: load,
    update,
    verifySiret,
    addContact,
    setContactPrimary,
  } as const;
}
