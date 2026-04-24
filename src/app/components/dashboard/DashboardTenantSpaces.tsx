/**
 * DashboardTenantSpaces
 * ─────────────────────
 * Dashboard > Espaces : gestion des sous-tenants d'un tenant racine.
 *
 * Un imprimeur (tenant racine) peut creer :
 *   - des sous-espaces "filiale" (role member par defaut) pour ses equipes internes
 *   - des sous-espaces "client" (role partner par defaut) pour ses gros comptes B2B
 *
 * L'admin du tenant racine garde l'acces en lecture/ecriture sur les sous-tenants
 * qu'il a crees (via heritage RLS).
 *
 * Non dispo pour : les sous-tenants (on ne cree pas de sous-sous-tenant), et
 * les tenants dont le role utilisateur est 'partner'.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Building, Plus, ExternalLink, Trash2 } from 'lucide-react';
import { supabase } from '/utils/supabase/client';
import { useTenant } from '../../contexts/TenantContext';

interface SubTenantRow {
  id: string;
  slug: string;
  name: string;
  created_at: string;
}

export function DashboardTenantSpaces() {
  const { currentTenant, currentRole, createSubTenant } = useTenant();

  const [children, setChildren] = useState<SubTenantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSubTenant = !!currentTenant?.parent_tenant_id;
  const canCreate =
    !!currentTenant &&
    !isSubTenant &&
    (currentRole === 'owner' || currentRole === 'admin');

  const load = async () => {
    if (!currentTenant) return;
    setLoading(true);
    const { data } = await supabase
      .from('tenants')
      .select('id, slug, name, created_at')
      .eq('parent_tenant_id', currentTenant.id)
      .order('created_at', { ascending: false });
    setChildren((data as SubTenantRow[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [currentTenant?.id]);

  const autoSlug = (n: string) =>
    n
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

  const submit = async () => {
    if (!currentTenant) return;
    setError(null);
    if (!name.trim() || !slug.trim()) {
      setError('Nom et identifiant requis.');
      return;
    }
    setSaving(true);
    const id = await createSubTenant({
      parentTenantId: currentTenant.id,
      slug: slug.trim(),
      name: name.trim(),
    });
    setSaving(false);
    if (!id) {
      setError('Creation impossible (slug deja pris ?).');
      return;
    }
    setFormOpen(false);
    setName('');
    setSlug('');
    await load();
  };

  const remove = async (id: string, spaceName: string) => {
    if (!confirm(`Supprimer l'espace "${spaceName}" et toutes ses donnees ?`)) return;
    await supabase.from('tenants').delete().eq('id', id);
    await load();
  };

  if (!currentTenant) {
    return (
      <div className="text-ink-muted" style={{ fontSize: '13.5px' }}>
        Aucun tenant actif.
      </div>
    );
  }

  return (
    <div className="max-w-[1200px]" style={{ fontFamily: 'var(--font-ui)' }}>
      <div className="flex items-baseline justify-between gap-4 mb-6">
        <div>
          <h1
            className="text-ink m-0"
            style={{ fontWeight: 300, fontSize: '34px', letterSpacing: '-0.025em' }}
          >
            Sous-espaces
          </h1>
          <p
            className="mt-1.5 text-ink-muted max-w-2xl"
            style={{ fontSize: '13.5px', fontWeight: 300, lineHeight: 1.5 }}
          >
            Creez des espaces isoles sous <span className="text-ink">{currentTenant.name}</span> :
            filiales internes ou portails dedies a vos gros comptes B2B. Chaque
            sous-espace herite de vos souscriptions aux gammes PIM.
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => setFormOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-ink text-paper hover:bg-black"
            style={{ fontSize: '13px', fontWeight: 500 }}
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={1.8} />
            Nouvel espace
          </button>
        )}
      </div>

      {isSubTenant && (
        <div
          className="px-3 py-2 rounded-md bg-info-bg text-info-fg mb-5"
          style={{ fontSize: '12.5px', fontWeight: 400 }}
        >
          Cet espace est deja un sous-espace — la hierarchie est limitee a 2
          niveaux. Pour creer un nouveau sous-espace, selectionnez d'abord le
          tenant racine.
        </div>
      )}

      {formOpen && canCreate && (
        <div className="mb-5 p-4 rounded-md border border-line bg-paper space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label>
              <span
                className="block text-ink-muted mb-1"
                style={{ fontSize: '11.5px', fontWeight: 500 }}
              >
                Nom de l'espace
              </span>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setSlug(autoSlug(e.target.value));
                }}
                placeholder="Carrefour France"
                className="w-full px-3 py-1.5 border border-line rounded-md bg-paper text-ink"
                style={{ fontSize: '13px' }}
              />
            </label>
            <label>
              <span
                className="block text-ink-muted mb-1"
                style={{ fontSize: '11.5px', fontWeight: 500 }}
              >
                Slug
              </span>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(autoSlug(e.target.value))}
                placeholder="carrefour-france"
                className="w-full px-3 py-1.5 border border-line rounded-md bg-paper text-ink font-mono"
                style={{ fontSize: '12.5px' }}
              />
            </label>
          </div>
          {error && (
            <div
              className="px-3 py-2 rounded-md bg-err-bg text-err-fg"
              style={{ fontSize: '12.5px' }}
            >
              {error}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setFormOpen(false)}
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
              {saving ? 'Creation…' : 'Creer le sous-espace'}
            </button>
          </div>
        </div>
      )}

      {/* Liste des sous-tenants */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {loading ? (
          <div className="text-ink-muted" style={{ fontSize: '13px' }}>
            Chargement…
          </div>
        ) : children.length === 0 ? (
          <div
            className="col-span-full border border-dashed border-line-2 rounded-md px-6 py-10 text-center text-ink-mute-2"
            style={{ fontSize: '13px' }}
          >
            Aucun sous-espace pour le moment.
            {canCreate && (
              <>
                {' '}
                <button
                  onClick={() => setFormOpen(true)}
                  className="text-brand hover:underline"
                >
                  Creer le premier.
                </button>
              </>
            )}
          </div>
        ) : (
          children.map((c) => (
            <div
              key={c.id}
              className="border border-line rounded-md bg-paper p-4 flex items-start gap-3"
            >
              <div className="w-8 h-8 rounded-md bg-bg border border-line grid place-items-center shrink-0">
                <Building className="w-4 h-4 text-ink-muted" strokeWidth={1.5} />
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className="text-ink truncate mb-0.5"
                  style={{ fontSize: '14px', fontWeight: 500 }}
                >
                  {c.name}
                </p>
                <p
                  className="font-mono text-ink-mute-2"
                  style={{ fontSize: '11px', letterSpacing: '0.02em' }}
                >
                  /t/{c.slug}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <Link
                    to={`/t/${c.slug}`}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded border border-line text-ink-2 hover:bg-bg"
                    style={{ fontSize: '11.5px', fontWeight: 500 }}
                  >
                    <ExternalLink className="w-3 h-3" strokeWidth={1.5} />
                    Ouvrir
                  </Link>
                  {canCreate && (
                    <button
                      onClick={() => remove(c.id, c.name)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded text-err-fg hover:bg-err-bg"
                      style={{ fontSize: '11.5px', fontWeight: 500 }}
                    >
                      <Trash2 className="w-3 h-3" strokeWidth={1.5} />
                      Supprimer
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
