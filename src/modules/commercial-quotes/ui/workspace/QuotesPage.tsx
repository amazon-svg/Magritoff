/**
 * QuotesPage — liste des devis du tenant (chantier d unification des devis,
 * post Sprint 5 : voir docs/api/CONVENTIONS.md §8.10).
 *
 * Ecran manquant signale par la story E10.3 elle-meme (cf. en-tete de
 * `../../surface-contributions.ts` a l origine) : le point d entree de
 * creation existant (bouton "Creer un devis" dans un projet) n avait aucune
 * bibliotheque pour retrouver les devis deja crees. Porte sur le backend
 * `commercial_quotes` (`GET /api/v1/quotes`, deja livre par E10.3) — l ancien
 * ecran `src/modules/quotes/ui/workspace/QuotesPage.tsx` (backend legacy
 * `public.quotes`, supprime) n a pas ete reutilise tel quel : ses colonnes
 * (montant HT/TTC, "mes devis" vs "tous", duplication) n ont pas d equivalent
 * dans le modele E10.3 (pas de prix de vente hors PricingEngine E10.21 tant
 * qu il n est pas cable sur cette ressource, pas de notion de proprietaire
 * distinct du createur, pas d endpoint de duplication).
 *
 * Simplifications assumees par rapport a l ancien ecran :
 *   - pas de colonnes montant HT/TTC : `public_price`/`customer_price` sont
 *     toujours `null` tant qu E10.21 n est pas cablee sur cette ressource
 *     (cf. `api/contracts.ts`) — les afficher inventerait un prix.
 *   - pas de bascule "mes devis / tous les devis du tenant" : la RLS
 *     `commercial_quotes_select` donne deja tout le tenant, sans distinction
 *     applicative "mine/all" comme l ancien systeme.
 *   - pas d action "dupliquer" : `POST /quotes/{id}/duplicate` n existe pas
 *     au contrat E10.3 (seul `POST /quotes` depuis un projet existe).
 *
 * `DefaultValidityDaysPanel` (arbitrage Arnaud 2026-09-19, Q18,
 * docs/api/CONVENTIONS.md §8.25 point 13 (3)) vit ICI depuis ce lot, et pas
 * dans `PricingRulesPage` (E10.6) ou elle a d abord ete cablee : « le
 * parametre doit etre dans le menu devis », dans les mots d Arnaud. C est le
 * MEME composant, deplace, pas duplique — meme ressource singleton
 * `/commercial-settings`, meme client API, memes testid.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { FileText, Loader2, Search, Trash2 } from 'lucide-react';
import { useTenantPath } from '@/modules/tenants/ui/hooks';
import { useWorkspaceApi } from '@/platform/runtime/workspace-ui-runtime';
import { useAccessProfile } from '@/modules/roles/ui/runtime';
import { CustomersApiClient, type CustomerDto } from '@/modules/customers';
import { customerDisplayName } from '@/modules/projects/ui';
import { TEST_IDS } from '@/shared/presentation/testIds';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/ui/alert-dialog';
import { CommercialSettingsApiClient } from '@/modules/commercial-settings';
import { CommercialQuotesApiClient } from '../../api/client';
import type { QuoteDto } from '../../api/contracts';
import { QUOTE_STATUS_GROUPS, statusGroup, statusGroupDef, type QuoteStatusGroup } from '../helpers';

const T = TEST_IDS.commercialQuote;

const inputCls =
  'w-full px-3 py-2 border border-line-2 rounded-lg bg-paper text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand';
const btnPrimary =
  'px-4 py-2 bg-brand text-brand-ink rounded-lg hover:opacity-90 disabled:opacity-50 text-sm font-medium flex items-center gap-2';

type FilterKey = 'all' | QuoteStatusGroup;

const PAGE_SIZE = 50;

export function DashboardQuotes() {
  const tp = useTenantPath();
  const quotesApi = useWorkspaceApi(CommercialQuotesApiClient);
  // `can_manage_pricing` garde l ECRITURE de `/commercial-settings` cote
  // serveur (RLS `commercial_settings_write`) — meme droit que
  // `PricingRulesPage` (E10.11) et le journal d entete de `QuoteEditorPage`
  // (E10.10a). Un membre sans ce droit ne voit pas le panneau : ergonomie,
  // pas la garde d autorisation elle-meme.
  const { hasCapability } = useAccessProfile();
  const canManagePricing = hasCapability('can_manage_pricing') === true;
  const customersApi = useWorkspaceApi(CustomersApiClient);

  const [quotes, setQuotes] = useState<QuoteDto[]>([]);
  const [customersById, setCustomersById] = useState<Readonly<Record<string, CustomerDto>>>({});
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [search, setSearch] = useState('');
  const [toDelete, setToDelete] = useState<QuoteDto | null>(null);

  const loadCustomers = useCallback(
    async (rows: readonly QuoteDto[]) => {
      const missingIds = Array.from(new Set(rows.map((q) => q.customer_id))).filter(
        (id) => !(id in customersById),
      );
      if (missingIds.length === 0) return;
      const fetched = await Promise.all(
        missingIds.map(async (id) => {
          try {
            return [id, await customersApi.getDetail(id)] as const;
          } catch {
            return null;
          }
        }),
      );
      setCustomersById((current) => {
        const next = { ...current };
        for (const entry of fetched) {
          if (entry) next[entry[0]] = entry[1];
        }
        return next;
      });
    },
    [customersApi, customersById],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await quotesApi.list({ pageSize: PAGE_SIZE });
      setQuotes(page.items as QuoteDto[]);
      setNextCursor(page.nextCursor);
      await loadCustomers(page.items);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Chargement des devis impossible.');
    } finally {
      setLoading(false);
    }
    // loadCustomers volontairement absent des deps : sa propre dependance
    // (customersById) changerait a chaque appel et reclencherait la charge.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quotesApi]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await quotesApi.list({ pageSize: PAGE_SIZE, pageCursor: nextCursor });
      setQuotes((current) => [...current, ...(page.items as QuoteDto[])]);
      setNextCursor(page.nextCursor);
      await loadCustomers(page.items);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Chargement des devis impossible.');
    } finally {
      setLoadingMore(false);
    }
  };

  const visible = useMemo(() => {
    return quotes.filter((q) => {
      if (filter !== 'all' && statusGroup(q.status) !== filter) return false;
      if (search.trim()) {
        const needle = search.toLowerCase();
        const customerName = customersById[q.customer_id]
          ? customerDisplayName(customersById[q.customer_id]!)
          : '';
        const hay = `${q.number} ${customerName}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [quotes, filter, search, customersById]);

  const counts = useMemo(() => {
    const c: Record<FilterKey, number> = { all: quotes.length, en_cours: 0, valide: 0, rejete: 0 };
    for (const q of quotes) c[statusGroup(q.status)]++;
    return c;
  }, [quotes]);

  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      await quotesApi.remove(toDelete.id);
      setQuotes((current) => current.filter((q) => q.id !== toDelete.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Suppression du devis impossible.');
    } finally {
      setToDelete(null);
    }
  };

  const filterDefs: Array<{ key: FilterKey; label: string }> = [
    { key: 'all', label: 'Tous' },
    ...QUOTE_STATUS_GROUPS.map((g) => ({ key: g.key, label: g.label })),
  ];

  return (
    <div data-testid={T.listPage} className="max-w-[1400px]" style={{ fontFamily: 'var(--font-ui)' }}>
      <div className="flex items-baseline justify-between gap-4 mb-6">
        <h1
          className="text-ink m-0"
          style={{ fontWeight: 300, fontSize: '34px', letterSpacing: '-0.025em', lineHeight: 1.05 }}
        >
          Devis
        </h1>
        <Link
          to={tp('/dashboard/projects')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-line bg-paper text-ink-2 hover:bg-bg"
          style={{ fontSize: '13px', fontWeight: 400 }}
        >
          Nouveau devis depuis un projet
        </Link>
      </div>

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {filterDefs.map((f) => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              data-testid={T.listStatusFilter}
              data-status-group={f.key}
              onClick={() => setFilter(f.key)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border transition-colors ${
                active ? 'bg-ink text-paper border-ink' : 'bg-paper text-ink-muted border-line hover:text-ink hover:border-line-2'
              }`}
              style={{ fontSize: '12.5px', fontWeight: active ? 500 : 400 }}
            >
              {f.label}
              <span
                className={`font-mono ${active ? 'opacity-70' : 'text-ink-mute-2'}`}
                style={{ fontSize: '11px', fontWeight: 500 }}
                title={
                  nextCursor
                    ? `${counts[f.key]} sur les devis chargés — d'autres devis existent, "Charger plus" pour les compter`
                    : `${counts[f.key]} devis`
                }
              >
                {counts[f.key]}
                {nextCursor ? '+' : ''}
              </span>
            </button>
          );
        })}
        <div className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-line bg-paper min-w-[240px]">
          <Search className="w-3.5 h-3.5 text-ink-mute-2" strokeWidth={1.5} />
          <input
            type="text"
            data-testid={T.listSearchInput}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un numéro, un client…"
            className="flex-1 bg-transparent outline-none text-ink placeholder:text-ink-mute-2"
            style={{ fontSize: '12.5px', fontWeight: 400 }}
          />
        </div>
      </div>

      {error && <p className="text-sm text-err-fg mb-3">{error}</p>}

      <div className="border border-line rounded-md overflow-hidden bg-paper">
        {loading ? (
          <div className="py-12 text-center text-ink-muted" style={{ fontSize: '13px' }}>Chargement…</div>
        ) : visible.length === 0 ? (
          <div className="py-16 text-center text-ink-mute-2">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" strokeWidth={1.5} />
            <p style={{ fontSize: '13.5px', fontWeight: 400 }}>
              {quotes.length === 0 ? "Aucun devis pour l'instant." : 'Aucun résultat pour ce filtre.'}
            </p>
          </div>
        ) : (
          <table className="w-full" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr className="border-b border-line bg-bg">
                {['N°', 'Client', 'État', 'Créé', ''].map((h, i) => (
                  <th
                    key={i}
                    className="text-left px-4 py-2 font-mono uppercase text-ink-muted"
                    style={{ fontSize: '10.5px', fontWeight: 500, letterSpacing: '0.06em' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((q) => {
                const st = statusGroupDef(q.status);
                const customer = customersById[q.customer_id];
                return (
                  <tr
                    key={q.id}
                    data-testid={T.listRow}
                    data-quote-id={q.id}
                    className="border-b border-line hover:bg-bg transition-colors"
                  >
                    <td className="px-4 py-2 font-mono text-ink" style={{ fontSize: '12.5px', fontWeight: 500 }}>
                      <Link to={tp(`/dashboard/commercial-quotes/${q.id}`)} className="hover:underline">
                        {q.number}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-ink-2" style={{ fontSize: '13px' }}>
                      {customer ? customerDisplayName(customer) : <span className="text-ink-mute-2">—</span>}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex font-mono px-2 py-0.5 rounded ${st.cls}`} style={{ fontSize: '11px', fontWeight: 500, letterSpacing: '0.02em' }}>
                        {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-ink-muted" style={{ fontSize: '12px' }}>
                      {new Date(q.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                    </td>
                    <td className="px-2 py-2 text-right">
                      {q.status === 'draft' && (
                        <button
                          data-testid={T.listDeleteBtn}
                          onClick={() => setToDelete(q)}
                          className="p-1.5 rounded-md text-ink-muted hover:text-err-fg hover:bg-err-bg"
                          aria-label="Supprimer"
                        >
                          <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {!loading && nextCursor && (
        <div className="mt-3 flex justify-center">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="px-4 py-1.5 rounded-md border border-line bg-paper text-ink-2 hover:bg-bg disabled:opacity-50"
            style={{ fontSize: '12.5px', fontWeight: 500 }}
          >
            {loadingMore ? 'Chargement…' : 'Charger plus'}
          </button>
        </div>
      )}

      {canManagePricing && (
        <div className="mt-6">
          <DefaultValidityDaysPanel />
        </div>
      )}

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent data-testid={T.listDeleteDialog}>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce devis ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le devis {toDelete?.number} et toutes ses lignes seront définitivement supprimés. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction data-testid={T.listDeleteConfirmBtn} onClick={confirmDelete}>
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/**
 * Duree de validite par defaut des devis (E10.10a, point 9 du cadrage,
 * docs/api/CONVENTIONS.md §8.12) — ressource singleton `/commercial-settings`
 * du tenant, PATCH garde par `can_manage_pricing` cote serveur.
 *
 * DEPLACE ICI par l arbitrage d Arnaud du 2026-09-19 (Q18, §8.25 point
 * 13 (3)) : « une valeur par defaut qui doit etre aussi un parametre dans
 * le menu devis ». Vivait auparavant dans `PricingRulesPage`
 * (src/modules/pricing/ui/workspace/PricingRulesPage.tsx) — retire de la
 * ou il a d abord ete cable, jamais duplique : une seule surface ecrit
 * `default_validity_days`, sans quoi les deux divergeraient a la premiere
 * retouche.
 *
 * Applique UNIQUEMENT a l ENVOI d un devis (`sendQuote`) et seulement si
 * `valid_until` est encore `null` — jamais retroactif sur un devis existant,
 * jamais a la creation. La borne 1-3650 jours est deja posee en base (`check
 * (... between 1 and 3650)`, migration 20260906160000, portee a 30 par
 * defaut par 20260919000200) et au contrat (`minimum: 1`/`maximum: 3650`) :
 * ce composant ne la reimplemente pas, `min`/`max` sur l input HTML restent
 * un confort de saisie, jamais la seule garde.
 */
function DefaultValidityDaysPanel() {
  const api = useWorkspaceApi(CommercialSettingsApiClient);
  const [days, setDays] = useState('');
  const [etag, setEtag] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .get()
      .then(({ data, etag: nextEtag }) => {
        if (cancelled) return;
        setDays(data.default_validity_days !== null ? String(data.default_validity_days) : '');
        setEtag(nextEtag ?? null);
      })
      .catch((cause) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'Lecture de la validite par defaut impossible.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [api]);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!etag) return;
    const trimmed = days.trim();
    const parsed = trimmed === '' ? null : Number(trimmed);
    if (parsed !== null && (!Number.isInteger(parsed) || parsed < 1)) {
      setError('La duree de validite doit etre un nombre entier de jours, ou vide (aucune validite par defaut).');
      return;
    }
    setSaving(true);
    setError(null);
    setSavedAt(null);
    try {
      const result = await api.update({ default_validity_days: parsed }, etag);
      setEtag(result.etag ?? null);
      setSavedAt(Date.now());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Enregistrement de la validite par defaut impossible.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="border border-line-2 rounded-lg p-4 space-y-3"
      data-testid={TEST_IDS.commercialSettings.defaultValiditySection}
    >
      <div>
        <h2 className="text-sm font-semibold text-ink">Validité par défaut des devis</h2>
        <p className="text-xs text-ink-muted mt-0.5">
          Nombre de jours appliqué à l’envoi d’un devis qui ne porte pas déjà une date de validité manuelle.
          Vide = aucune validité par défaut. Ne modifie aucun devis déjà créé.
        </p>
      </div>
      <form onSubmit={handleSave} className="flex items-center gap-2">
        <input
          type="number"
          min={1}
          max={3650}
          step={1}
          value={days}
          onChange={(event) => setDays(event.target.value)}
          disabled={loading}
          placeholder="Ex. 30"
          className={inputCls}
          style={{ maxWidth: 120 }}
          data-testid={TEST_IDS.commercialSettings.defaultValidityInput}
        />
        <span className="text-sm text-ink-muted">jours</span>
        <button
          type="submit"
          disabled={saving || loading || !etag}
          className={btnPrimary}
          data-testid={TEST_IDS.commercialSettings.defaultValiditySaveBtn}
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Enregistrer
        </button>
      </form>
      {error && <p className="text-sm text-err-fg">{error}</p>}
      {savedAt !== null && !error && <p className="text-sm text-green-700">Validité par défaut enregistrée.</p>}
    </div>
  );
}
