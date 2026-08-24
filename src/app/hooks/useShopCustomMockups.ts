import { useCallback, useEffect, useRef, useState } from 'react';
import type { MockupTemplateType, ShopCustomMockup } from '../../modules/shops';
import { useShopsApi } from '../contexts/ModuleClientsContext';

export function indexShopCustomMockups(
  records: ShopCustomMockup[],
): Record<string, ShopCustomMockup> {
  return Object.fromEntries(records.map((record) => [
    `${record.templateType}-${record.view}`,
    record,
  ]));
}

export function shopCustomMockupError(cause: unknown, fallback: string): string {
  return cause instanceof Error && cause.message ? cause.message : fallback;
}

export function useShopCustomMockups(tenantId: string, shopId: string) {
  const shopsApi = useShopsApi();
  const requestVersion = useRef(0);
  const targetKey = `${tenantId}:${shopId}`;
  const targetKeyRef = useRef(targetKey);
  targetKeyRef.current = targetKey;
  const [overrides, setOverrides] = useState<Record<string, ShopCustomMockup>>({});
  const [loading, setLoading] = useState(true);
  const [uploadingKey, setUploadingKey] = useState<MockupTemplateType | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true);
    setError(null);
    try {
      const records = await shopsApi.customMockups(tenantId, shopId);
      if (version === requestVersion.current) {
        setOverrides(indexShopCustomMockups(records));
      }
    } catch (cause) {
      if (version === requestVersion.current) {
        setError(`Chargement échoué : ${shopCustomMockupError(cause, 'erreur réseau')}`);
      }
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [shopId, shopsApi, tenantId]);

  useEffect(() => {
    setOverrides({});
    setUploadingKey(null);
    void refresh();
    return () => {
      requestVersion.current += 1;
    };
  }, [refresh]);

  const upload = async (templateType: MockupTemplateType, file: File) => {
    const operationTarget = targetKey;
    setError(null);
    setUploadingKey(templateType);
    try {
      await shopsApi.uploadCustomMockup(tenantId, shopId, templateType, 'front', file);
      if (operationTarget === targetKeyRef.current) await refresh();
    } catch (cause) {
      if (operationTarget === targetKeyRef.current) {
        setError(shopCustomMockupError(cause, 'Erreur inconnue'));
      }
    } finally {
      if (operationTarget === targetKeyRef.current) setUploadingKey(null);
    }
  };

  const restore = async (templateType: MockupTemplateType) => {
    const operationTarget = targetKey;
    setError(null);
    setUploadingKey(templateType);
    try {
      await shopsApi.restoreCustomMockup(tenantId, shopId, templateType, 'front');
      if (operationTarget === targetKeyRef.current) await refresh();
    } catch (cause) {
      if (operationTarget === targetKeyRef.current) {
        setError(shopCustomMockupError(cause, 'Erreur inconnue'));
      }
    } finally {
      if (operationTarget === targetKeyRef.current) setUploadingKey(null);
    }
  };

  return {
    overrides,
    loading,
    uploadingKey,
    error,
    refresh,
    upload,
    restore,
  } as const;
}
