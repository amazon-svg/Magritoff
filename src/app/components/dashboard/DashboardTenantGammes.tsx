/**
 * DashboardTenantGammes
 * ─────────────────────
 * Permet a un admin tenant de choisir, parmi les 22 gammes du PIM global
 * Magrit, lesquelles sont exposees a ses users dans ce tenant.
 *
 * La table `tenant_gamme_subscriptions` (migration 03) fait le lien :
 *   (tenant_id, gamme_slug, active, display_order)
 *
 * L'UI est une liste de checkboxes groupees par parent (carterie, flyer,
 * affiche, depliant, brochure) avec des sous-gammes nested. Toggle =
 * upsert avec active=true, untoggle = update active=false (pas delete pour
 * conserver l'historique).
 *
 * Ce que le tenant NE peut PAS faire ici :
 *   - editer les definitions du PIM (reserve a l'admin Magrit global)
 *   - creer une gamme (le PIM est patrimoine Magrit)
 */

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Check, Loader2 } from 'lucide-react';
import { supabase } from '/utils/supabase/client';
import { usePIM } from '../../contexts/PIMContext';
import { useTenant } from '../../contexts/TenantContext';
import type { Gamme } from '../../utils/productEnrichment';

export function DashboardTenantGammes() {
  const { gammes, loading: pimLoading } = usePIM();
  const { currentTenant, currentRole, isSuperAdmin } = useTenant();

  const canWrite = currentRole === 'owner' || currentRole === 'admin' || isSuperAdmin;

  const [activeSlugs, setActiveSlugs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // ─── Charge les souscriptions du tenant courant ────────────────────────
  const loadSubscriptions = async () => {
    if (!currentTenant) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('tenant_gamme_subscriptions')
      .select('gamme_slug, active')
      .eq('tenant_id', currentTenant.id);
    if (error) {
      console.error('[gammes] load failed', error.message);
    }
    const set = new Set<string>();
    (data ?? []).forEach((row: any) => {
      if (row.active) set.add(row.gamme_slug);
    });
    setActiveSlugs(set);
    setLoading(false);
  };

  useEffect(() => {
    loadSubscriptions();
  }, [currentTenant?.id]);

  // ─── Toggle une gamme ───────────────────────────────────────────────────
  const toggle = async (slug: string) => {
    if (!currentTenant || !canWrite) return;
    setSaving(slug);
    const isActive = activeSlugs.has(slug);
    const newActive = !isActive;

    const { error } = await supabase
      .from('tenant_gamme_subscriptions')
      .upsert(
        {
          tenant_id: currentTenant.id,
          gamme_slug: slug,
          active: newActive,
        },
        { onConflict: 'tenant_id,gamme_slug' }
      );

    setSaving(null);
    if (error) {
      console.error('[gammes] toggle failed', error.message);
      return;
    }

    setActiveSlugs((prev) => {
      const next = new Set(prev);
      if (newActive) next.add(slug);
      else next.delete(slug);
      return next;
    });
  };

  // ─── Toggle un parent : coche/decoche le parent + toutes ses sous-gammes ─
  const toggleGroup = async (parentSlug: string) => {
    if (!currentTenant || !canWrite) return;
    const children = gammes.filter((g) => g.parent_slug === parentSlug).map((g) => g.slug);
    const all = [parentSlug, ...children];
    const allActive = all.every((s) => activeSlugs.has(s));
    const newActive = !allActive;

    setSaving(parentSlug);
    const rows = all.map((slug) => ({
      tenant_id: currentTenant.id,
      gamme_slug: slug,
      active: newActive,
    }));
    const { error } = await supabase
      .from('tenant_gamme_subscriptions')
      .upsert(rows, { onConflict: 'tenant_id,gamme_slug' });
    setSaving(null);
    if (error) {
      console.error('[gammes] group toggle failed', error.message);
      return;
    }
    setActiveSlugs((prev) => {
      const next = new Set(prev);
      for (const s of all) {
        if (newActive) next.add(s);
        else next.delete(s);
      }
      return next;
    });
  };

  // ─── Groupe par parent ──────────────────────────────────────────────────
  const rootGammes = useMemo(() => gammes.filter((g) => !g.parent_slug), [gammes]);
  const childrenByParent = useMemo(() => {
    const map = new Map<string, Gamme[]>();
    for (const g of gammes) {
      if (!g.parent_slug) continue;
      if (!map.has(g.parent_slug)) map.set(g.parent_slug, []);
      map.get(g.parent_slug)!.push(g);
    }
    return map;
  }, [gammes]);

  const toggleExpand = (slug: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  if (pimLoading || loading) {
    return (
      <div className="text-ink-muted" style={{ fontSize: '13.5px' }}>
        Chargement des gammes…
      </div>
    );
  }

  if (!currentTenant) {
    return (
      <div className="text-ink-muted" style={{ fontSize: '13.5px' }}>
        Aucun tenant actif.
      </div>
    );
  }

  return (
    <div className="max-w-[900px]" style={{ fontFamily: 'var(--font-ui)' }}>
      <div className="mb-6">
        <h1
          className="text-ink m-0"
          style={{ fontWeight: 300, fontSize: '34px', letterSpacing: '-0.025em' }}
        >
          Gammes actives
        </h1>
        <p
          className="mt-1.5 text-ink-muted max-w-2xl"
          style={{ fontSize: '13.5px', fontWeight: 300, lineHeight: 1.5 }}
        >
          Choisissez quelles gammes du PIM Magrit sont exposees aux users de{' '}
          <span className="text-ink">{currentTenant.name}</span>. Cochez une gamme
          parent pour activer toutes ses sous-gammes d'un coup. Seules les gammes
          actives apparaissent en recherche, dans le chat et dans les boutiques.
        </p>
        <p
          className="mt-2 text-ink-mute-2"
          style={{ fontSize: '12px', fontWeight: 300 }}
        >
          {activeSlugs.size} / {gammes.length} gamme{gammes.length > 1 ? 's' : ''} active{activeSlugs.size > 1 ? 's' : ''}
          {!canWrite && ' · lecture seule (role member/partner)'}
        </p>
      </div>

      <div className="border border-line rounded-md overflow-hidden bg-paper">
        {rootGammes.map((parent) => {
          const children = childrenByParent.get(parent.slug) ?? [];
          const isParentActive = activeSlugs.has(parent.slug);
          const activeChildrenCount = children.filter((c) => activeSlugs.has(c.slug)).length;
          const isExpanded = expanded.has(parent.slug);
          const isSaving = saving === parent.slug;

          return (
            <div key={parent.slug} className="border-b border-line last:border-b-0">
              {/* Parent */}
              <div className="flex items-center gap-2 px-4 py-2.5 hover:bg-bg">
                {children.length > 0 ? (
                  <button
                    onClick={() => toggleExpand(parent.slug)}
                    className="p-0.5 text-ink-muted hover:text-ink"
                    aria-label={isExpanded ? 'Reduire' : 'Developper'}
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5" strokeWidth={1.5} />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" strokeWidth={1.5} />
                    )}
                  </button>
                ) : (
                  <div className="w-[18px]" />
                )}

                <label className="flex items-center gap-2 cursor-pointer flex-1">
                  <button
                    onClick={() => toggleGroup(parent.slug)}
                    disabled={!canWrite || isSaving}
                    className={`w-4 h-4 rounded border transition-colors shrink-0 grid place-items-center ${
                      isParentActive
                        ? 'bg-ink border-ink'
                        : 'bg-paper border-line-2 hover:border-ink'
                    } ${!canWrite ? 'opacity-40 cursor-not-allowed' : ''}`}
                    aria-label={`Toggle ${parent.name}`}
                  >
                    {isParentActive && <Check className="w-3 h-3 text-paper" strokeWidth={3} />}
                    {isSaving && <Loader2 className="w-3 h-3 text-paper animate-spin" />}
                  </button>
                  <span
                    className="text-ink flex-1"
                    style={{ fontSize: '14px', fontWeight: 500 }}
                  >
                    {parent.name}
                  </span>
                </label>

                {children.length > 0 && (
                  <span
                    className="font-mono text-ink-mute-2"
                    style={{ fontSize: '11px' }}
                  >
                    {activeChildrenCount}/{children.length}
                  </span>
                )}
              </div>

              {/* Children */}
              {isExpanded && children.length > 0 && (
                <div className="bg-bg border-t border-line">
                  {children.map((child) => {
                    const isActive = activeSlugs.has(child.slug);
                    const isChildSaving = saving === child.slug;
                    return (
                      <div
                        key={child.slug}
                        className="flex items-center gap-2 px-4 py-2 pl-12 border-b border-line last:border-b-0 hover:bg-paper"
                      >
                        <label className="flex items-center gap-2 cursor-pointer flex-1">
                          <button
                            onClick={() => toggle(child.slug)}
                            disabled={!canWrite || isChildSaving}
                            className={`w-4 h-4 rounded border transition-colors shrink-0 grid place-items-center ${
                              isActive
                                ? 'bg-ink border-ink'
                                : 'bg-paper border-line-2 hover:border-ink'
                            } ${!canWrite ? 'opacity-40 cursor-not-allowed' : ''}`}
                            aria-label={`Toggle ${child.name}`}
                          >
                            {isActive && <Check className="w-3 h-3 text-paper" strokeWidth={3} />}
                            {isChildSaving && (
                              <Loader2 className="w-3 h-3 text-paper animate-spin" />
                            )}
                          </button>
                          <span
                            className="text-ink-2"
                            style={{ fontSize: '13.5px', fontWeight: 400 }}
                          >
                            {child.name}
                          </span>
                        </label>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p
        className="mt-4 text-ink-mute-2"
        style={{ fontSize: '11.5px', fontWeight: 300, lineHeight: 1.5 }}
      >
        Les gammes non cochees ne sont jamais supprimees — vous pouvez les
        reactiver a tout moment. Les sous-tenants heritent automatiquement des
        gammes du tenant parent.
      </p>
    </div>
  );
}
