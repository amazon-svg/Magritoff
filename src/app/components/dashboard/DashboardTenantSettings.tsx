/**
 * DashboardTenantSettings — Parametres de l'espace
 * =================================================
 * Implemente E9.4 : permettre a un owner/admin de renommer son espace.
 *
 * Regles :
 *   - Le nom (`name`) est editable par owner ou admin du tenant.
 *   - Le slug est editable UNIQUEMENT par un superadmin Magrit (impact URL/SEO).
 *     Le trigger DB `enforce_slug_change_authorization` enforce cote serveur.
 *   - Tout changement de slug est archive 90 jours dans tenant_slug_history
 *     pour permettre la redirection 301 cote frontend.
 */

import { FormEvent, useEffect, useState } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '/utils/supabase/client';
import { useTenant } from '../../contexts/TenantContext';
import { TEST_IDS } from '../../lib/testIds';

const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

export function DashboardTenantSettings() {
  const { currentTenant, currentRole, isSuperAdmin, reload } = useTenant();

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [originalSlug, setOriginalSlug] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const canEditName = currentRole === 'owner' || currentRole === 'admin' || isSuperAdmin;
  const canEditSlug = isSuperAdmin;

  useEffect(() => {
    if (currentTenant) {
      setName(currentTenant.name);
      setSlug(currentTenant.slug);
      setOriginalSlug(currentTenant.slug);
    }
  }, [currentTenant?.id]);

  const slugChanged = slug !== originalSlug;
  const slugValid = SLUG_REGEX.test(slug) && slug.length >= 3 && slug.length <= 60;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentTenant || !canEditName) return;
    if (slugChanged && !slugValid) {
      setMessage({ kind: 'err', text: 'Slug invalide : a-z, 0-9 et tirets uniquement, 3-60 caracteres.' });
      return;
    }

    setSaving(true);
    setMessage(null);

    const updates: Record<string, string> = { name };
    if (slugChanged && canEditSlug) updates.slug = slug;

    const { error } = await supabase
      .from('tenants')
      .update(updates)
      .eq('id', currentTenant.id);

    setSaving(false);

    if (error) {
      setMessage({ kind: 'err', text: error.message });
      return;
    }

    setMessage({
      kind: 'ok',
      text: slugChanged
        ? `Espace renomme. L'ancien lien /t/${originalSlug} reste actif 90 jours via redirection.`
        : 'Espace renomme.',
    });
    setOriginalSlug(slug);
    await reload();
  };

  if (!currentTenant) {
    return (
      <div className="text-ink-muted" style={{ fontSize: '13.5px' }}>
        Aucun tenant actif.
      </div>
    );
  }

  if (!canEditName) {
    return (
      <div className="max-w-xl space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Parametres de l'espace</h2>
        <p className="text-sm text-gray-600">
          Vous devez etre owner ou admin de cet espace pour modifier ses parametres.
        </p>
      </div>
    );
  }

  return (
    <form
      data-testid={TEST_IDS.tenant.settingsSection}
      onSubmit={submit}
      className="space-y-6 max-w-xl"
      style={{ fontFamily: 'var(--font-ui)' }}
    >
      <div>
        <h2 className="text-ink m-0" style={{ fontWeight: 400, fontSize: '20px', letterSpacing: '-0.015em' }}>
          Parametres de l'espace
        </h2>
        <p className="mt-1 text-ink-muted" style={{ fontSize: '13px', fontWeight: 300 }}>
          Modifiez le nom de votre espace.{' '}
          {canEditSlug
            ? "En tant que superadmin Magrit, vous pouvez aussi changer son slug d'URL."
            : "Le slug d'URL n'est modifiable que par un superadmin Magrit."}
        </p>
      </div>

      <div>
        <label className="block text-ink-muted mb-1" style={{ fontSize: '11.5px', fontWeight: 500 }}>
          Nom de l'espace
        </label>
        <input
          data-testid={TEST_IDS.tenant.nameEditInput}
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 border border-line rounded-md bg-paper text-ink focus:outline-none focus:border-line-2"
          style={{ fontSize: '13.5px' }}
        />
      </div>

      <div>
        <label className="block text-ink-muted mb-1" style={{ fontSize: '11.5px', fontWeight: 500 }}>
          Slug d'URL{' '}
          {!canEditSlug && (
            <span className="font-mono text-ink-mute-2 ml-1" style={{ fontSize: '10px' }}>
              · superadmin uniquement
            </span>
          )}
        </label>
        <div className="flex items-stretch border border-line rounded-md overflow-hidden bg-paper">
          <span className="px-3 py-2 text-ink-mute-2 font-mono bg-bg" style={{ fontSize: '12.5px' }}>
            /t/
          </span>
          <input
            data-testid={TEST_IDS.tenant.slugEditInput}
            type="text"
            required
            disabled={!canEditSlug}
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase())}
            className="flex-1 px-3 py-2 bg-paper text-ink focus:outline-none disabled:bg-bg disabled:text-ink-muted"
            style={{ fontSize: '13.5px', fontFamily: 'var(--font-mono, monospace)' }}
          />
        </div>
        {canEditSlug && slugChanged && (
          <p
            data-testid={TEST_IDS.tenant.renameWarningBanner}
            className="mt-2 flex items-start gap-1.5 text-warn-fg"
            style={{ fontSize: '12px' }}
          >
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" strokeWidth={1.8} />
            Changer le slug invalide les anciens liens partages (boutiques publiques, devis).
            Ils redirigeront pendant 90 jours puis seront casses.
          </p>
        )}
      </div>

      {message && (
        <p
          className={message.kind === 'ok' ? 'text-ok-fg' : 'text-err-fg'}
          style={{ fontSize: '12.5px' }}
        >
          {message.text}
        </p>
      )}

      <button
        data-testid={TEST_IDS.tenant.renameSaveBtn}
        type="submit"
        disabled={saving || (!slugChanged && name === currentTenant.name)}
        className="inline-flex items-center gap-2 px-4 py-2 bg-ink text-paper rounded-md hover:bg-black disabled:opacity-40"
        style={{ fontSize: '13px', fontWeight: 500 }}
      >
        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
        Enregistrer
      </button>
    </form>
  );
}
