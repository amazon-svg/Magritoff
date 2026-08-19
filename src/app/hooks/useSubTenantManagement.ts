import { useCallback, useEffect, useRef, useState } from 'react';
import type { SubTenant, SubTenantKpi } from '../../modules/session';
import { useSessionApi } from '../contexts/ModuleClientsContext';

export function toTenantSlug(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function useSubTenantManagement({
  tenantId,
  onChanged,
}: {
  tenantId: string | null;
  onChanged: () => Promise<void>;
}) {
  const sessionApi = useSessionApi();
  const requestVersion = useRef(0);
  const activeTenantId = useRef(tenantId);
  activeTenantId.current = tenantId;
  const [children, setChildren] = useState<SubTenant[]>([]);
  const [kpis, setKpis] = useState<SubTenantKpi[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const version = ++requestVersion.current;
    if (!tenantId) {
      setChildren([]);
      setKpis([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const dashboard = await sessionApi.subTenantsDashboard(tenantId);
      if (version !== requestVersion.current) return;
      setChildren(dashboard.subTenants);
      setKpis(dashboard.kpis);
    } catch (loadError) {
      if (version !== requestVersion.current) return;
      setChildren([]);
      setKpis([]);
      setError(loadError instanceof Error ? loadError.message : 'Chargement des sous-espaces impossible.');
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [sessionApi, tenantId]);

  useEffect(() => {
    setFormOpen(false);
    setName('');
    setSlug('');
    setSaving(false);
    setError(null);
    void load();
    return () => {
      requestVersion.current += 1;
    };
  }, [load]);

  const changeName = (value: string) => {
    setName(value);
    setSlug(toTenantSlug(value));
  };

  const changeSlug = (value: string) => setSlug(toTenantSlug(value));

  const submit = async () => {
    if (!tenantId) return;
    const actionTenantId = tenantId;
    setError(null);
    if (!name.trim() || !slug.trim()) {
      setError('Nom et identifiant requis.');
      return;
    }
    setSaving(true);
    try {
      await sessionApi.createSubTenant(actionTenantId, { slug: slug.trim(), name: name.trim() });
      if (activeTenantId.current !== actionTenantId) return;
      await onChanged();
    } catch (createError) {
      if (activeTenantId.current !== actionTenantId) return;
      setSaving(false);
      setError(createError instanceof Error ? createError.message : 'Création impossible.');
      return;
    }
    setSaving(false);
    setFormOpen(false);
    setName('');
    setSlug('');
    await load();
  };

  const remove = async (id: string) => {
    if (!tenantId) return;
    const actionTenantId = tenantId;
    setError(null);
    try {
      await sessionApi.removeSubTenant(actionTenantId, id);
      if (activeTenantId.current !== actionTenantId) return;
      await onChanged();
      await load();
    } catch (removeError) {
      if (activeTenantId.current !== actionTenantId) return;
      setError(removeError instanceof Error ? removeError.message : 'Suppression impossible.');
    }
  };

  return {
    children,
    kpis,
    loading,
    formOpen,
    setFormOpen,
    name,
    changeName,
    slug,
    changeSlug,
    saving,
    error,
    submit,
    remove,
  } as const;
}
