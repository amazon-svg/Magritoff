import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Sparkles, Pencil, Trash2, Plus, Loader2, Check, X, AlertCircle, Zap, Download, Inbox, Play } from 'lucide-react';
import { usePIM } from '../../contexts/PIMContext';
import { useIsAdmin } from '../../hooks/useIsAdmin';
import { useTenant } from '../../contexts/TenantContext';
import { type PimIngestReport } from '../../../modules/catalog';
import { useCatalogApi } from '../../contexts/ModuleClientsContext';
import type { Gamme, ProductDefinition } from '../../utils/productEnrichment';

const LOCALES = ['fr', 'en'];

export function DashboardAdminPIM() {
  // v3 : l'acces admin PIM est ouvert a 2 categories d'utilisateurs :
  //   - isAdmin : ancien flag user_preferences.is_admin (compat v1/v2)
  //   - isSuperAdmin : membre owner/admin du tenant system 'magrit-root' (v3)
  // L'un des deux suffit.
  const isAdmin = useIsAdmin();
  const { isSuperAdmin } = useTenant();
  const catalogApi = useCatalogApi();
  const hasAccess = isAdmin || isSuperAdmin;
  const { gammes, definitions, upsertGamme, upsertDefinition, deleteDefinition, refresh } = usePIM();

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Partial<ProductDefinition> | null>(null);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [batch, setBatch] = useState<{
    running: boolean;
    done: number;
    total: number;
    current: string;
    errors: string[];
  }>({ running: false, done: 0, total: 0, current: '', errors: [] });

  // ─── Ingestion queue ───────────────────────────────────────────────────
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [ingestRunning, setIngestRunning] = useState<false | 'dry' | 'live'>(false);
  const [ingestReport, setIngestReport] = useState<PimIngestReport | null>(null);
  const [ingestError, setIngestError] = useState<string | null>(null);

  const refreshPendingCount = useCallback(async () => {
    try { setPendingCount(await catalogApi.pimPendingCandidates()); }
    catch (error) { setIngestError(error instanceof Error ? error.message : 'Lecture de la file PIM impossible.'); }
  }, [catalogApi]);

  useEffect(() => {
    if (hasAccess) refreshPendingCount();
  }, [hasAccess, refreshPendingCount]);

  const runIngest = async (dryRun: boolean) => {
    setIngestRunning(dryRun ? 'dry' : 'live');
    setIngestError(null);
    setIngestReport(null);
    try {
      const report = await catalogApi.runPimIngest(dryRun);
      setIngestReport(report);
      if (!dryRun) {
        await refreshPendingCount();
        await refresh(); // Refresh PIM context pour voir les nouvelles definitions
      }
    } catch (err) {
      setIngestError((err as Error).message);
    } finally {
      setIngestRunning(false);
    }
  };

  const gammesByParent = useMemo(() => {
    const map = new Map<string | null, Gamme[]>();
    for (const g of gammes) {
      const key = g.parent_slug ?? null;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(g);
    }
    return map;
  }, [gammes]);

  const defsByGamme = useMemo(() => {
    const map = new Map<string, ProductDefinition[]>();
    for (const d of definitions) {
      if (!map.has(d.gamme_slug)) map.set(d.gamme_slug, []);
      map.get(d.gamme_slug)!.push(d);
    }
    return map;
  }, [definitions]);

  if (!hasAccess) {
    return (
      <div className="max-w-lg text-center py-12">
        <AlertCircle className="w-12 h-12 mx-auto text-amber-500 mb-3" />
        <h2 className="text-xl font-bold text-ink mb-2">Accès admin requis</h2>
        <p className="text-sm text-ink-muted">
          Cette page est réservée aux super-administrateurs Magrit. Il faut être
          membre owner ou admin du tenant système <code className="bg-bg px-1.5 py-0.5 rounded">magrit-root</code>.
        </p>
      </div>
    );
  }

  const toggle = (slug: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const startNew = (gamme: Gamme, locale: string) => {
    setEditing({
      gamme_slug: gamme.slug,
      variation_filter: {},
      locale,
      schema_org_type: 'Product',
      usage_examples: [],
      faq: [],
      generated_by: 'human',
      validated_by: 'pending',
      version: 1,
    });
    setGenError(null);
  };

  const startEdit = (d: ProductDefinition) => {
    setEditing({ ...d });
    setGenError(null);
  };

  const save = async () => {
    if (!editing?.gamme_slug || !editing?.locale) return;
    setSaving(true);
    await upsertDefinition({
      ...editing,
      gamme_slug: editing.gamme_slug,
      locale: editing.locale,
    } as any);
    setSaving(false);
    setEditing(null);
  };

  const generate = async () => {
    if (!editing?.gamme_slug || !editing?.locale) return;
    const gamme = gammes.find((g) => g.slug === editing.gamme_slug);
    if (!gamme) return;

    setGenerating(true);
    setGenError(null);
    try {
      const generated = await catalogApi.generatePimDefinition({
        gammeSlug: gamme.slug, gammeName: gamme.name, gammeMatchingRules: gamme.matching_rules,
        locale: editing.locale, variationFilter: editing.variation_filter ?? {}, mode: 'generate',
      });
      // Fusion dans l'édition courante
      setEditing((prev) => ({
        ...prev,
        ...generated,
        gamme_slug: prev?.gamme_slug,
        locale: prev?.locale,
        variation_filter: prev?.variation_filter ?? {},
        generated_by: 'llm',
        validated_by: 'pending',
      } as any));
    } catch (err: any) {
      setGenError(err.message || 'Erreur LLM');
    } finally {
      setGenerating(false);
    }
  };

  const markValidated = async (d: ProductDefinition) => {
    await upsertDefinition({
      ...d,
      validated_by: 'human',
      last_reviewed_at: new Date().toISOString() as any,
    } as any);
  };

  const runBatchGenerate = async (regenerateAll = false) => {
    const todo: Array<{ gamme: Gamme; locale: string }> = [];
    for (const g of gammes) {
      for (const loc of LOCALES) {
        const exists = definitions.some(
          (d) =>
            d.gamme_slug === g.slug &&
            d.locale === loc &&
            Object.keys(d.variation_filter || {}).length === 0
        );
        if (regenerateAll || !exists) todo.push({ gamme: g, locale: loc });
      }
    }

    if (todo.length === 0) {
      alert('Toutes les gammes sont déjà couvertes.');
      return;
    }

    const label = regenerateAll ? 'régénérer' : 'pré-générer';
    if (!confirm(`Vais ${label} ${todo.length} définition(s) (${gammes.length} gammes × ${LOCALES.length} langues). Cela peut prendre quelques minutes. Continuer ?`)) {
      return;
    }

    setBatch({ running: true, done: 0, total: todo.length, current: '', errors: [] });

    for (let i = 0; i < todo.length; i++) {
      const { gamme, locale } = todo[i];
      setBatch((s) => ({ ...s, done: i, current: `${gamme.name} · ${locale.toUpperCase()}` }));

      try {
        const generated = await catalogApi.generatePimDefinition({
          gammeSlug: gamme.slug, gammeName: gamme.name, gammeMatchingRules: gamme.matching_rules,
          locale, variationFilter: {}, mode: 'generate',
        });

        await upsertDefinition({
          ...generated,
          gamme_slug: gamme.slug,
          locale,
          variation_filter: {},
          generated_by: 'llm',
          validated_by: 'pending',
        } as any);
      } catch (err: any) {
        setBatch((s) => ({
          ...s,
          errors: [...s.errors, `${gamme.slug}/${locale}: ${err.message || err}`],
        }));
      }

      // Léger throttle pour ne pas hammer l'API
      await new Promise((r) => setTimeout(r, 300));
    }

    setBatch((s) => ({ ...s, running: false, done: s.total, current: '' }));
  };

  // ── Affichage hiérarchique des gammes ────────────────────────────────────
  const renderGamme = (g: Gamme, depth: number): React.ReactNode => {
    const children = gammesByParent.get(g.slug) || [];
    const defs = defsByGamme.get(g.slug) || [];
    const isExpanded = expanded.has(g.slug);

    return (
      <div key={g.slug} className="border-b border-line last:border-0">
        <div
          className="flex items-center gap-2 py-2 hover:bg-bg cursor-pointer"
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => toggle(g.slug)}
        >
          {children.length > 0 || defs.length > 0 ? (
            isExpanded ? <ChevronDown className="w-4 h-4 text-ink-muted" /> : <ChevronRight className="w-4 h-4 text-ink-muted" />
          ) : (
            <span className="w-4" />
          )}
          <span className={`${depth === 0 ? 'font-semibold' : ''} text-sm text-ink`}>{g.name}</span>
          <code className="text-xs text-ink-mute-2">{g.slug}</code>
          <span className="ml-auto text-xs text-ink-muted mr-3">
            {defs.length} définition{defs.length > 1 ? 's' : ''}
          </span>
        </div>

        {isExpanded && (
          <div className="pb-2" style={{ paddingLeft: `${depth * 16 + 28}px` }}>
            {/* Image par défaut de la gamme (utilisee si une definition n'a
                pas d'image_url propre). Input inline avec save onBlur. */}
            <GammeImageInput gamme={g} onSave={(url) => upsertGamme({ ...g, image_url: url })} />

            {/* Definitions de cette gamme */}
            {defs.length > 0 && (
              <div className="space-y-1 my-2">
                {defs.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center gap-2 px-2 py-1.5 bg-bg border border-line rounded text-xs"
                  >
                    <span className="uppercase font-mono font-semibold text-ink-muted">{d.locale}</span>
                    <span className="text-ink-2 flex-1 truncate">
                      {d.name || d.title_template || '(sans titre)'}
                    </span>
                    {Object.keys(d.variation_filter || {}).length > 0 && (
                      <span className="text-warn-fg bg-warn-bg border border-amber-200 px-1.5 py-0.5 rounded text-[10px]">
                        variation
                      </span>
                    )}
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        d.validated_by === 'human'
                          ? 'bg-green-100 text-ok-fg'
                          : d.validated_by === 'llm'
                          ? 'bg-blue-100 text-brand'
                          : 'bg-bg text-ink-muted'
                      }`}
                    >
                      {d.validated_by ?? 'pending'}
                    </span>
                    {d.quality_score != null && (
                      <span className="text-[10px] text-ink-muted">{d.quality_score.toFixed(2)}</span>
                    )}
                    {d.validated_by !== 'human' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          markValidated(d);
                        }}
                        className="p-1 text-green-600 hover:bg-ok-bg rounded"
                        title="Valider"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        startEdit(d);
                      }}
                      className="p-1 text-ink-muted hover:bg-line rounded"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Supprimer cette définition ?`)) deleteDefinition(d.id);
                      }}
                      className="p-1 text-ink-muted hover:text-err-fg hover:bg-err-bg rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Boutons nouvelle définition par locale */}
            <div className="flex gap-1 flex-wrap text-xs my-1">
              {LOCALES.map((loc) => (
                <button
                  key={loc}
                  onClick={(e) => {
                    e.stopPropagation();
                    startNew(g, loc);
                  }}
                  className="px-2 py-1 border border-dashed border-line-2 text-ink-muted rounded hover:border-line-2 hover:bg-bg flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  {loc.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Sous-gammes */}
            {children.map((child) => renderGamme(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-ink mb-1">PIM — Produits</h2>
          <p className="text-sm text-ink-muted">
            Base partagée de définitions produits (SEO / GEO / commercial). Lecture libre, écriture admin.
          </p>
          <div className="flex gap-4 mt-2 text-xs text-ink-muted">
            <span>Gammes : {gammes.length}</span>
            <span>Définitions : {definitions.length}</span>
            <span>Validées humain : {definitions.filter((d) => d.validated_by === 'human').length}</span>
          </div>
        </div>
        {/* REFONTE-UX v2 (2026-08-08, retour Arnaud point 2) — la creation d un
            produit existait mais etait enterree dans chaque gamme depliee.
            Bouton visible en tete de page : choix de la gamme puis meme
            editeur que le "+" par gamme. */}
        <NewProductButton gammes={gammes} onPick={(g, loc) => startNew(g, loc)} />
      </div>

      {/* ─── Pipeline d'ingestion automatique ─── */}
      <div className="border border-line rounded-xl bg-paper p-4 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-semibold text-ink flex items-center gap-2">
              <Inbox className="w-4 h-4 text-indigo-600" />
              File d'ingestion PIM
              {pendingCount != null && pendingCount > 0 && (
                <span className="ml-1 px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-xs font-semibold">
                  {pendingCount} en attente
                </span>
              )}
            </h3>
            <p className="text-sm text-ink-muted max-w-2xl">
              Les produits commandés sur les boutiques sont poussés ici par trigger DB.
              L'ingestion auto vérifie la richesse du candidat, matche contre les définitions
              existantes (dédup), et enrichit via Claude (SEO, commercial, FAQ) avant merge
              dans le PIM global.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => runIngest(true)}
              disabled={!!ingestRunning || (pendingCount ?? 0) === 0}
              className="px-3 py-2 border border-line-2 rounded-lg hover:bg-bg disabled:opacity-40 text-sm font-medium flex items-center gap-2"
              title="Simulation — aucun écrit en DB"
            >
              {ingestRunning === 'dry' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              Simulation
            </button>
            <button
              onClick={() => runIngest(false)}
              disabled={!!ingestRunning || (pendingCount ?? 0) === 0}
              className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40 text-sm font-medium flex items-center gap-2"
            >
              {ingestRunning === 'live' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              Lancer l'ingestion
            </button>
          </div>
        </div>

        {ingestError && (
          <div className="px-3 py-2 rounded-lg bg-err-bg text-red-800 text-sm">
            <strong>Erreur :</strong> {ingestError}
          </div>
        )}

        {ingestReport && (
          <div className="border-t border-line pt-3 space-y-2">
            <div className="text-sm text-ink-2">
              <strong>Rapport {ingestReport.dryRun ? '(simulation)' : 'd\'ingestion'}</strong>
              {' · '}
              {ingestReport.totalCandidates} candidat
              {ingestReport.totalCandidates > 1 ? 's' : ''} traité
              {ingestReport.totalCandidates > 1 ? 's' : ''}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <ReportBadge
                color="emerald"
                label="Enrichis"
                value={ingestReport.enriched.length}
                hint="Nouveaux produits créés dans le PIM via Claude"
              />
              <ReportBadge
                color="blue"
                label="Matchés"
                value={ingestReport.matched.length}
                hint="Déjà dans le PIM, order_count incrémenté"
              />
              <ReportBadge
                color="amber"
                label="Rejetés"
                value={ingestReport.rejected.length}
                hint="Trop pauvres ou aucune gamme matchée"
              />
              <ReportBadge
                color="red"
                label="Erreurs"
                value={ingestReport.errors.length}
                hint="Candidats en échec, restés en pending"
              />
            </div>
            {(ingestReport.rejected.length > 0 || ingestReport.errors.length > 0) && (
              <details className="text-xs text-ink-muted">
                <summary className="cursor-pointer hover:text-ink">
                  Détails rejets et erreurs
                </summary>
                <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                  {ingestReport.rejected.map((r) => (
                    <div key={r.candidateId} className="font-mono">
                      ⚠️ {r.candidateId.slice(0, 8)}… : {r.reason}
                    </div>
                  ))}
                  {ingestReport.errors.map((e) => (
                    <div key={e.candidateId} className="font-mono text-err-fg">
                      ❌ {e.candidateId.slice(0, 8)}… : {e.error}
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
      </div>

      {/* Actions batch */}
      <div className="border border-line rounded-xl bg-paper p-4 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-semibold text-ink flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              Pré-générer en masse
            </h3>
            <p className="text-sm text-ink-muted">
              Génère via LLM les définitions manquantes pour toutes les gammes × langues.
              Les résultats atterrissent en <strong>validated_by=pending</strong> pour relecture.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => runBatchGenerate(false)}
              disabled={batch.running}
              className="px-3 py-2 bg-brand text-white rounded-lg hover:bg-brand/90 disabled:opacity-50 text-sm font-medium flex items-center gap-2"
            >
              {batch.running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Pré-générer ce qui manque
            </button>
            <button
              onClick={() => runBatchGenerate(true)}
              disabled={batch.running}
              className="px-3 py-2 border border-line-2 rounded-lg hover:bg-bg disabled:opacity-50 text-sm font-medium"
            >
              Tout régénérer
            </button>
          </div>
        </div>

        {(batch.running || batch.done > 0) && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-2">
                {batch.running ? `En cours : ${batch.current}` : 'Terminé'}
              </span>
              <span className="font-medium text-ink">
                {batch.done} / {batch.total}
              </span>
            </div>
            <div className="w-full h-2 bg-bg rounded-full overflow-hidden">
              <div
                className="h-full bg-brand transition-all"
                style={{ width: `${batch.total ? (batch.done / batch.total) * 100 : 0}%` }}
              />
            </div>
            {batch.errors.length > 0 && (
              <details className="text-xs text-err-fg bg-err-bg p-2 rounded">
                <summary className="cursor-pointer font-medium">
                  {batch.errors.length} erreur(s)
                </summary>
                <ul className="mt-1 space-y-0.5 list-disc pl-4">
                  {batch.errors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </div>

      <div className="border border-line rounded-xl bg-paper">
        {(gammesByParent.get(null) || []).map((g) => renderGamme(g, 0))}
      </div>

      {editing && (
        <DefinitionEditorModal
          editing={editing}
          onChange={setEditing}
          onClose={() => setEditing(null)}
          onSave={save}
          onGenerate={generate}
          saving={saving}
          generating={generating}
          error={genError}
        />
      )}
    </div>
  );
}

// ─── Modale d'édition de définition ──────────────────────────────────────────

function DefinitionEditorModal(props: {
  editing: Partial<ProductDefinition>;
  onChange: (d: Partial<ProductDefinition>) => void;
  onClose: () => void;
  onSave: () => void;
  onGenerate: () => void;
  saving: boolean;
  generating: boolean;
  error: string | null;
}) {
  const { editing, onChange, onClose, onSave, onGenerate, saving, generating, error } = props;
  const set = (patch: Partial<ProductDefinition>) => onChange({ ...editing, ...patch });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-paper rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-ink">
            Définition : <code className="text-sm bg-bg px-2 py-0.5 rounded">{editing.gamme_slug}</code>{' '}
            <span className="text-ink-mute-2 text-sm">({editing.locale})</span>
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-bg rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex gap-2 mb-4">
          <button
            onClick={onGenerate}
            disabled={generating}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Générer / régénérer via LLM
          </button>
          <span className="text-xs text-ink-muted self-center">
            Le LLM remplira les champs ci-dessous. Tu peux ensuite ajuster puis enregistrer.
          </span>
        </div>

        {error && <p className="mb-3 text-sm text-err-fg bg-err-bg p-2 rounded">{error}</p>}

        <div className="space-y-3">
          <Field label="Nom interne">
            <input
              type="text"
              value={editing.name ?? ''}
              onChange={(e) => set({ name: e.target.value } as any)}
              className="input"
            />
          </Field>

          <Field label="Variation filter (JSON)" hint='ex: {"finishing_front":"PELLIC_ACETATE_MAT"} — vide = définition générique'>
            <textarea
              rows={2}
              value={JSON.stringify(editing.variation_filter ?? {})}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  set({ variation_filter: parsed } as any);
                } catch {
                  // ignore invalid JSON while typing
                }
              }}
              className="input font-mono text-xs"
            />
          </Field>

          <Field label="Title template">
            <input
              type="text"
              value={editing.title_template ?? ''}
              onChange={(e) => set({ title_template: e.target.value } as any)}
              placeholder="Ex: Cartes de visite {{format}} – {{grammage}}g {{papier}}"
              className="input"
            />
          </Field>

          <Field label="H1 template">
            <input
              type="text"
              value={editing.h1_template ?? ''}
              onChange={(e) => set({ h1_template: e.target.value } as any)}
              className="input"
            />
          </Field>

          <Field label="Short description template">
            <textarea
              rows={2}
              value={editing.short_description_template ?? ''}
              onChange={(e) => set({ short_description_template: e.target.value } as any)}
              className="input"
            />
          </Field>

          <Field label="Description template (markdown)">
            <textarea
              rows={6}
              value={editing.description_template ?? ''}
              onChange={(e) => set({ description_template: e.target.value } as any)}
              className="input font-mono text-sm"
            />
          </Field>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="SEO title (<60)">
              <input
                type="text"
                value={editing.seo_title ?? ''}
                onChange={(e) => set({ seo_title: e.target.value } as any)}
                className="input"
              />
            </Field>
            <Field label="SEO description (140–160)">
              <input
                type="text"
                value={editing.seo_description ?? ''}
                onChange={(e) => set({ seo_description: e.target.value } as any)}
                className="input"
              />
            </Field>
          </div>

          <Field label="Keywords (virgule)">
            <input
              type="text"
              value={(editing.keywords ?? []).join(', ')}
              onChange={(e) => set({ keywords: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) } as any)}
              className="input"
            />
          </Field>

          <Field label="Image URL" hint="image produit affichée sur la boutique (override variation-spécifique de l'image par défaut de la gamme)">
            <input
              type="url"
              value={editing.image_url ?? ''}
              onChange={(e) => set({ image_url: e.target.value } as any)}
              placeholder="https://…"
              className="input"
            />
            {editing.image_url && (
              <img
                src={editing.image_url}
                alt=""
                className="mt-2 h-24 w-auto rounded border border-line object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            )}
          </Field>

          <Field label="Usage examples (JSON)">
            <textarea
              rows={4}
              value={JSON.stringify(editing.usage_examples ?? [], null, 2)}
              onChange={(e) => {
                try { set({ usage_examples: JSON.parse(e.target.value) } as any); } catch {}
              }}
              className="input font-mono text-xs"
            />
          </Field>

          <Field label="FAQ (JSON)">
            <textarea
              rows={5}
              value={JSON.stringify(editing.faq ?? [], null, 2)}
              onChange={(e) => {
                try { set({ faq: JSON.parse(e.target.value) } as any); } catch {}
              }}
              className="input font-mono text-xs"
            />
          </Field>

          <div className="flex items-center gap-3 text-xs text-ink-muted">
            <span>generated_by: <strong>{editing.generated_by ?? '—'}</strong></span>
            <span>validated_by: <strong>{editing.validated_by ?? 'pending'}</strong></span>
          </div>
        </div>

        <div className="flex gap-2 pt-5 mt-4 border-t border-line">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-line-2 rounded-lg hover:bg-bg font-medium">
            Annuler
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="flex-1 px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand/90 disabled:opacity-50 font-medium flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Enregistrer
          </button>
        </div>

        <style>{`.input { width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; } .input:focus { outline: 2px solid rgb(59 130 246 / .5); }`}</style>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-ink-2 mb-1">
        {label} {hint && <span className="font-normal text-ink-mute-2">— {hint}</span>}
      </label>
      {children}
    </div>
  );
}

// Input inline pour editer l'image par defaut d'une gamme.
// Save onBlur pour ne pas trigger un upsert a chaque caractère.
function GammeImageInput({
  gamme,
  onSave,
}: {
  gamme: Gamme;
  onSave: (url: string) => void | Promise<any>;
}) {
  const [val, setVal] = useState(gamme.image_url ?? '');
  const initial = gamme.image_url ?? '';
  return (
    <div className="flex items-center gap-2 my-2 bg-paper border border-blue-100 rounded px-2 py-1.5">
      <label
        className="text-[10px] font-mono uppercase tracking-wider text-ink-muted shrink-0"
        style={{ letterSpacing: '0.08em' }}
      >
        IMAGE GAMME
      </label>
      <input
        type="url"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={() => {
          if (val !== initial) onSave(val);
        }}
        placeholder="URL d'image par défaut pour cette gamme…"
        className="flex-1 min-w-0 bg-transparent border-0 focus:outline-none text-xs text-ink"
      />
      {val && (
        <img
          src={val}
          alt=""
          className="h-8 w-8 object-cover rounded border border-line"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      )}
    </div>
  );
}

// ─── Badge du rapport d'ingestion ────────────────────────────────────────
function ReportBadge({
  color,
  label,
  value,
  hint,
}: {
  color: 'emerald' | 'blue' | 'amber' | 'red';
  label: string;
  value: number;
  hint: string;
}) {
  const bg = {
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    blue: 'bg-brand-soft border-line-2 text-blue-800',
    amber: 'bg-warn-bg border-amber-200 text-amber-800',
    red: 'bg-err-bg border-err-fg/30 text-red-800',
  }[color];
  return (
    <div
      className={`px-3 py-2 rounded-lg border ${bg}`}
      title={hint}
    >
      <div className="text-xs font-medium opacity-80">{label}</div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  );
}

/**
 * REFONTE-UX v2 (2026-08-08, point 2) — bouton global "Nouveau produit".
 * Ouvre un mini-selecteur gamme + langue puis delegue a startNew (meme
 * editeur que le "+" par gamme).
 */
function NewProductButton({
  gammes,
  onPick,
}: {
  gammes: Gamme[];
  onPick: (gamme: Gamme, locale: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [gammeSlug, setGammeSlug] = useState('');
  const [locale, setLocale] = useState('fr');

  const confirm = () => {
    const g = gammes.find((x) => x.slug === gammeSlug);
    if (!g) return;
    setOpen(false);
    onPick(g, locale);
  };

  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen(!open)}
        className="px-4 py-2 bg-brand text-white rounded-lg hover:opacity-90 text-sm font-medium flex items-center gap-2"
      >
        <Plus className="w-4 h-4" />
        Nouveau produit
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-72 bg-paper border border-line rounded-xl shadow-lg p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-ink-2 mb-1">Gamme</label>
            <select
              value={gammeSlug}
              onChange={(e) => setGammeSlug(e.target.value)}
              className="w-full px-3 py-2 border border-line-2 rounded-lg bg-paper text-ink text-sm"
            >
              <option value="">— choisir une gamme —</option>
              {gammes.map((g) => (
                <option key={g.slug} value={g.slug}>{g.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-2 mb-1">Langue</label>
            <select
              value={locale}
              onChange={(e) => setLocale(e.target.value)}
              className="w-full px-3 py-2 border border-line-2 rounded-lg bg-paper text-ink text-sm"
            >
              <option value="fr">Français</option>
              <option value="en">English</option>
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setOpen(false)}
              className="px-3 py-1.5 border border-line-2 rounded-lg text-sm text-ink-2 hover:bg-bg"
            >
              Annuler
            </button>
            <button
              onClick={confirm}
              disabled={!gammeSlug}
              className="px-3 py-1.5 bg-brand text-white rounded-lg hover:opacity-90 disabled:opacity-50 text-sm font-medium"
            >
              Créer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
