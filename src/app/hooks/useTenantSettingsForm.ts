import { useEffect, useState, type FormEvent } from 'react';
import type { UpdateTenantSettings } from '../../modules/session';
import { useSessionApi } from '../contexts/ModuleClientsContext';

const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

type TenantSettingsTarget = Readonly<{
  id: string;
  name: string;
  slug: string;
}>;

type TenantSettingsMessage = Readonly<{
  kind: 'ok' | 'err';
  text: string;
}>;

export function useTenantSettingsForm({
  tenant,
  canEditName,
  canEditSlug,
  onSaved,
}: {
  tenant: TenantSettingsTarget | null;
  canEditName: boolean;
  canEditSlug: boolean;
  onSaved: () => Promise<void>;
}) {
  const sessionApi = useSessionApi();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [originalSlug, setOriginalSlug] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<TenantSettingsMessage | null>(null);

  useEffect(() => {
    if (!tenant) return;
    setName(tenant.name);
    setSlug(tenant.slug);
    setOriginalSlug(tenant.slug);
    setMessage(null);
  }, [tenant?.id, tenant?.name, tenant?.slug]);

  const slugChanged = slug !== originalSlug;
  const slugValid = SLUG_REGEX.test(slug) && slug.length >= 3 && slug.length <= 60;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!tenant || !canEditName) return;
    if (slugChanged && !slugValid) {
      setMessage({ kind: 'err', text: 'Slug invalide : a-z, 0-9 et tirets uniquement, 3-60 caracteres.' });
      return;
    }

    setSaving(true);
    setMessage(null);
    const updates: UpdateTenantSettings = { name };
    if (slugChanged && canEditSlug) updates.slug = slug;

    try {
      await sessionApi.updateTenantSettings(tenant.id, updates);
    } catch (error) {
      setSaving(false);
      setMessage({ kind: 'err', text: error instanceof Error ? error.message : 'Modification impossible.' });
      return;
    }

    setSaving(false);
    setMessage({
      kind: 'ok',
      text: slugChanged
        ? `Espace renomme. L'ancien lien /t/${originalSlug} reste actif 90 jours via redirection.`
        : 'Espace renomme.',
    });
    setOriginalSlug(slug);
    await onSaved();
  };

  return {
    name,
    setName,
    slug,
    setSlug,
    slugChanged,
    saving,
    message,
    submit,
  } as const;
}
