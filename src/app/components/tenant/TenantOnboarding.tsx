/**
 * TenantOnboarding
 * ────────────────
 * Page /tenants/new : wizard de creation d'un tenant racine (cas signup
 * initial ou user qui veut creer une 2e imprimerie).
 *
 * Forme minimaliste pour la phase 1 : juste slug + nom. Branding, logo,
 * souscriptions aux gammes PIM → viennent dans la phase 2 (wizard 4 etapes).
 */

import { useNavigate } from 'react-router';
import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useTenant } from '../../contexts/TenantContext';

export function TenantOnboarding() {
  const { createTenant } = useTenant();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-derive slug from name (URL-safe lowercase with hyphens)
  const autoSlug = (n: string) =>
    n
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

  const handleNameChange = (v: string) => {
    setName(v);
    setSlug(autoSlug(v));
  };

  const submit = async () => {
    setError(null);
    if (!name.trim() || !slug.trim()) {
      setError('Nom et identifiant requis.');
      return;
    }
    setSaving(true);
    const tenantId = await createTenant({ slug: slug.trim(), name: name.trim() });
    setSaving(false);
    if (!tenantId) {
      setError(
        'Creation impossible. Le slug est peut-etre deja utilise, ou vous n\'etes pas connecte.'
      );
      return;
    }
    navigate(`/t/${slug}`);
  };

  return (
    <div
      className="min-h-[calc(100vh-56px)] bg-bg px-6 py-10"
      style={{ fontFamily: 'var(--font-ui)' }}
    >
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <Sparkles className="w-8 h-8 text-brand mx-auto mb-3" strokeWidth={1.5} />
          <h1
            className="text-ink m-0"
            style={{
              fontWeight: 200,
              fontSize: '36px',
              letterSpacing: '-0.025em',
              lineHeight: 1.05,
            }}
          >
            Creer un nouvel espace
          </h1>
          <p
            className="mt-3 text-ink-muted max-w-xl mx-auto"
            style={{ fontSize: '14.5px', fontWeight: 300, lineHeight: 1.55 }}
          >
            Un espace = un dataset isole : vos devis, clients, boutiques et
            bibliotheques ne sont accessibles qu'aux membres de cet espace.
          </p>
        </div>

        <div className="bg-paper border border-line rounded-md p-6 space-y-4">
          <label className="block">
            <span
              className="block text-ink-muted mb-1"
              style={{ fontSize: '11.5px', fontWeight: 500 }}
            >
              Nom de l'espace
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Imprimerie Dupont"
              className="w-full px-3 py-2 border border-line rounded-md bg-paper text-ink focus:outline-none focus:border-line-2"
              style={{ fontSize: '14px' }}
            />
          </label>

          <label className="block">
            <span
              className="block text-ink-muted mb-1"
              style={{ fontSize: '11.5px', fontWeight: 500 }}
            >
              Identifiant d'URL (slug)
            </span>
            <div
              className="flex items-center border border-line rounded-md bg-paper overflow-hidden"
              style={{ fontSize: '14px' }}
            >
              <span
                className="px-3 py-2 bg-bg text-ink-mute-2 font-mono border-r border-line"
                style={{ fontSize: '12.5px' }}
              >
                magrit.app/t/
              </span>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(autoSlug(e.target.value))}
                placeholder="imprimerie-dupont"
                className="flex-1 px-3 py-2 bg-transparent outline-none text-ink font-mono"
                style={{ fontSize: '13px' }}
              />
            </div>
            <p
              className="mt-1 text-ink-mute-2"
              style={{ fontSize: '11.5px', fontWeight: 300 }}
            >
              Lettres minuscules, chiffres et tirets uniquement. Doit etre unique.
            </p>
          </label>

          {error && (
            <div
              className="px-3 py-2 rounded-md bg-err-bg text-err-fg"
              style={{ fontSize: '12.5px', fontWeight: 400 }}
            >
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-line">
            <button
              onClick={() => navigate('/tenants')}
              className="px-3 py-1.5 rounded-md border border-line bg-paper text-ink-2 hover:bg-bg"
              style={{ fontSize: '13px', fontWeight: 500 }}
            >
              Annuler
            </button>
            <button
              onClick={submit}
              disabled={saving}
              className="px-3.5 py-1.5 rounded-md bg-ink text-paper hover:bg-black disabled:opacity-40"
              style={{ fontSize: '13px', fontWeight: 500 }}
            >
              {saving ? 'Creation…' : 'Creer l\'espace'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
