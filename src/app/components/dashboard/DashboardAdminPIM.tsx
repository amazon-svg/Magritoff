import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Sparkles, Pencil, Trash2, Plus, Loader2, Check, X, AlertCircle, Zap, Download, Inbox, Play } from 'lucide-react';
import { usePIM } from '../../contexts/PIMContext';
import { useIsAdmin } from '../../hooks/useIsAdmin';
import { useTenant } from '../../contexts/TenantContext';
import { supabase } from '/utils/supabase/client';
import type { Gamme, ProductDefinition } from '../../utils/productEnrichment';

// Type du rapport renvoye par l'edge function pim-ingest
interface IngestReport {
  dryRun: boolean;
  totalCandidates: number;
  matched: Array<{ candidateId: string; matchedTo: string; gamme: string }>;
  rejected: Array<{ candidateId: string; reason: string }>;
  enriched: Array<{ candidateId: string; definitionId: string; gamme: string }>;
  errors: Array<{ candidateId: string; error: string }>;
}

const LOCALES = ['fr', 'en'];

export function DashboardAdminPIM() {
  // v3 : l'acces admin PIM est ouvert a 2 categories d'utilisateurs :
  //   - isAdmin : ancien flag user_preferences.is_admin (compat v1/v2)
  //   - isSuperAdmin : membre owner/admin du tenant system 'magrit-root' (v3)
  // L'un des deux suffit.
  const isAdmin = useIsAdmin();
  const { isSuperAdmin } = useTenant();
  const hasAccess = isAdmin || isSuperAdmin;
  const { gammes, definitions, upsertDefinition, deleteDefinition, refresh } = usePIM();

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
  const [ingestReport, setIngestReport] = useState<IngestReport | null>(null);
  const [ingestError, setIngestError] = useState<string | null>(null);

  const refreshPendingCount = async () => {
    const { count, error } = await supabase
      .from('pim_candidates')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');
    if (!error) setPendingCount(count ?? 0);
  };

  useEffect(() => {
    if (hasAccess) refreshPendingCount();
  }, [hasAccess]);

  const runIngest = async (dryRun: boolean) => {
    setIngestRunning(dryRun ? 'dry' : 'live');
    setIngestError(null);
    setIngestReport(null);
    try {
      // R5 (refacto 2026-05-11) : passe par functions.invoke() (ADR-R3).
      const { data, error } = await supabase.functions.invoke<IngestReport>(
        'pim-ingest',
        { body: { dryRun } },
      );
      if (error) throw new Error(error.message);
      if (!data) throw new Error('pim-ingest : reponse vide');
      setIngestReport(data);
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
        <h2 className="text-xl font-bold text-gray-900 mb-2">Accès admin requis</h2>
        <p className="text-sm text-gray-600">
          Cette page est réservée aux super-administrateurs Magrit. Il faut être
          membre owner ou admin du tenant système <code className="bg-gray-100 px-1.5 py-0.5 rounded">magrit-root</code>.
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
      // R5 (refacto 2026-05-11) : functions.invoke() (ADR-R3).
      const { data: body, error: invokeErr } = await supabase.functions.invoke<{ generated?: Record<string, unknown> }>(
        'pim-generate',
        {
          body: {
            gamme_slug: gamme.slug,
            gamme_name: gamme.name,
            gamme_matching_rules: gamme.matching_rules,
            locale: editing.locale,
            variation_filter: editing.variation_filter ?? {},
            mode: 'generate',
          },
        },
      );
      if (invokeErr) throw new Error(invokeErr.message);
      if (!body?.generated) throw new Error('Réponse LLM vide');
      // Fusion dans l'édition courante
      setEditing((prev) => ({
        ...prev,
        ...body.generated,
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
        // R5 (refacto 2026-05-11) : functions.invoke() (ADR-R3).
        const { data: body, error: invokeErr } = await supabase.functions.invoke<{ generated?: Record<string, unknown> }>(
          'pim-generate',
          {
            body: {
              gamme_slug: gamme.slug,
              gamme_name: gamme.name,
              gamme_matching_rules: gamme.matching_rules,
              locale,
              variation_filter: {},
              mode: 'generate',
            },
          },
        );
        if (invokeErr) throw new Error(invokeErr.message);
        if (!body?.generated) throw new Error('réponse LLM vide');

        await upsertDefinition({
          ...body.generated,
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
      <div key={g.slug} className="border-b border-gray-100 last:border-0">
        <div
          className="flex items-center gap-2 py-2 hover:bg-gray-50 cursor-pointer"
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => toggle(g.slug)}
        >
          {children.length > 0 || defs.length > 0 ? (
            isExpanded ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />
          ) : (
            <span className="w-4" />
          )}
          <span className={`${depth === 0 ? 'font-semibold' : ''} text-sm text-gray-900`}>{g.name}</span>
          <code className="text-xs text-gray-400">{g.slug}</code>
          <span className="ml-auto text-xs text-gray-500 mr-3">
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
                    className="flex items-center gap-2 px-2 py-1.5 bg-gray-50 border border-gray-200 rounded text-xs"
                  >
                    <span className="uppercase font-mono font-semibold text-gray-500">{d.locale}</span>
                    <span className="text-gray-700 flex-1 truncate">
                      {d.name || d.title_template || '(sans titre)'}
                    </span>
                    {Object.keys(d.variation_filter || {}).length > 0 && (
                      <span className="text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded text-[10px]">
                        variation
                      </span>
                    )}
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        d.validated_by === 'human'
                          ? 'bg-green-100 text-green-700'
                          : d.validated_by === 'llm'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {d.validated_by ?? 'pending'}
                    </span>
                    {d.quality_score != null && (
                      <span className="text-[10px] text-gray-500">{d.quality_score.toFixed(2)}</span>
                    )}
                    {d.validated_by !== 'human' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          markValidated(d);
                        }}
                        className="p-1 text-green-600 hover:bg-green-50 rounded"
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
                      className="p-1 text-gray-500 hover:bg-gray-200 rounded"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Supprimer cette définition ?`)) deleteDefinition(d.id);
                      }}
                      className="p-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
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
                  className="px-2 py-1 border border-dashed border-gray-300 text-gray-600 rounded hover:border-gray-500 hover:bg-gray-50 flex items-center gap-1"
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
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Admin · PIM</h2>
        <p className="text-sm text-gray-600">
          Base partagée de définitions produits (SEO / GEO / commercial). Lecture libre, écriture admin.
        </p>
        <div className="flex gap-4 mt-2 text-xs text-gray-500">
          <span>Gammes : {gammes.length}</span>
          <span>Définitions : {definitions.length}</span>
          <span>Validées humain : {definitions.filter((d) => d.validated_by === 'human').length}</span>
        </div>
      </div>

      {/* ─── Pipeline d'ingestion automatique ─── */}
      <div className="border border-gray-200 rounded-xl bg-white p-4 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Inbox className="w-4 h-4 text-indigo-600" />
              File d'ingestion PIM
              {pendingCount != null && pendingCount > 0 && (
                <span className="ml-1 px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-xs font-semibold">
                  {pendingCount} en attente
                </span>
              )}
            </h3>
            <p className="text-sm text-gray-600 max-w-2xl">
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
              className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 text-sm font-medium flex items-center gap-2"
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
          <div className="px-3 py-2 rounded-lg bg-red-50 text-red-800 text-sm">
            <strong>Erreur :</strong> {ingestError}
          </div>
        )}

        {ingestReport && (
          <div className="border-t border-gray-200 pt-3 space-y-2">
            <div className="text-sm text-gray-700">
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
              <details className="text-xs text-gray-600">
                <summary className="cursor-pointer hover:text-gray-900">
                  Détails rejets et erreurs
                </summary>
                <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                  {ingestReport.rejected.map((r) => (
                    <div key={r.candidateId} className="font-mono">
                      ⚠️ {r.candidateId.slice(0, 8)}… : {r.reason}
                    </div>
                  ))}
                  {ingestReport.errors.map((e) => (
                    <div key={e.candidateId} className="font-mono text-red-700">
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
      <div className="border border-gray-200 rounded-xl bg-white p-4 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              Pré-générer en masse
            </h3>
            <p className="text-sm text-gray-600">
              Génère via LLM les définitions manquantes pour toutes les gammes × langues.
              Les résultats atterrissent en <strong>validated_by=pending</strong> pour relecture.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => runBatchGenerate(false)}
              disabled={batch.running}
              className="px-3 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 text-sm font-medium flex items-center gap-2"
            >
              {batch.running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Pré-générer ce qui manque
            </button>
            <button
              onClick={() => runBatchGenerate(true)}
              disabled={batch.running}
              className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 text-sm font-medium"
            >
              Tout régénérer
            </button>
          </div>
        </div>

        {(batch.running || batch.done > 0) && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-700">
                {batch.running ? `En cours : ${batch.current}` : 'Terminé'}
              </span>
              <span className="font-medium text-gray-900">
                {batch.done} / {batch.total}
              </span>
            </div>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gray-900 transition-all"
                style={{ width: `${batch.total ? (batch.done / batch.total) * 100 : 0}%` }}
              />
            </div>
            {batch.errors.length > 0 && (
              <details className="text-xs text-red-600 bg-red-50 p-2 rounded">
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

      <div className="border border-gray-200 rounded-xl bg-white">
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
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-900">
            Définition : <code className="text-sm bg-gray-100 px-2 py-0.5 rounded">{editing.gamme_slug}</code>{' '}
            <span className="text-gray-400 text-sm">({editing.locale})</span>
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
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
          <span className="text-xs text-gray-500 self-center">
            Le LLM remplira les champs ci-dessous. Tu peux ensuite ajuster puis enregistrer.
          </span>
        </div>

        {error && <p className="mb-3 text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}

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
                className="mt-2 h-24 w-auto rounded border border-gray-200 object-cover"
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

          <div className="flex items-center gap-3 text-xs text-gray-600">
            <span>generated_by: <strong>{editing.generated_by ?? '—'}</strong></span>
            <span>validated_by: <strong>{editing.validated_by ?? 'pending'}</strong></span>
          </div>
        </div>

        <div className="flex gap-2 pt-5 mt-4 border-t border-gray-200">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium">
            Annuler
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="flex-1 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 font-medium flex items-center justify-center gap-2"
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
      <label className="block text-xs font-semibold text-gray-700 mb-1">
        {label} {hint && <span className="font-normal text-gray-400">— {hint}</span>}
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
    <div className="flex items-center gap-2 my-2 bg-white border border-blue-100 rounded px-2 py-1.5">
      <label
        className="text-[10px] font-mono uppercase tracking-wider text-gray-500 shrink-0"
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
        className="flex-1 min-w-0 bg-transparent border-0 focus:outline-none text-xs text-gray-900"
      />
      {val && (
        <img
          src={val}
          alt=""
          className="h-8 w-8 object-cover rounded border border-gray-200"
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
    blue: 'bg-blue-50 border-blue-200 text-blue-800',
    amber: 'bg-amber-50 border-amber-200 text-amber-800',
    red: 'bg-red-50 border-red-200 text-red-800',
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
