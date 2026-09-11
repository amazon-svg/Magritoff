/**
 * PricingRulesPage — liste, filtre et bascule des regles de prix (E10.6,
 * CA5, CA6), plus le panneau de marge publique standard par gamme (CA4).
 * L ecran n est monte que sous une route `requiredCapabilities:
 * ['can_manage_pricing']` (E10.11, voir `../../surface-contributions.ts`) :
 * une garde d ergonomie, pas d autorisation — celle-ci est tenue par la RLS
 * de `price_rules`/`product_range_default_margins`.
 *
 * Creation/modification passent par `PriceRuleFormModal` ; aucun calcul de
 * prix ni de marge n a lieu ici (E10.21 hors perimetre).
 */
import { useEffect, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { useAuth } from '@/modules/account/ui/runtime';
import { useTenant } from '@/modules/tenants/ui/runtime';
import { useWorkspaceApi } from '@/platform/runtime/workspace-ui-runtime';
import { TEST_IDS } from '@/shared/presentation/testIds';
import { CustomersApiClient, type CustomerDto } from '@/modules/customers';
import { CatalogApiClient } from '@/modules/catalog';
import { CommercialSettingsApiClient } from '@/modules/commercial-settings';
import { PriceRulesApiClient } from '@/modules/pricing/api/client';
import type { PriceRuleDto, PriceRuleSort, PriceRuleStatusFilter } from '@/modules/pricing/api/contracts';
import { usePriceRulesManagement } from '@/modules/pricing/ui/hooks';
import { PriceRuleFormModal } from './PriceRuleFormModal';
import { rateToPercentString, toRateString } from './rate-format';

const inputCls =
  'w-full px-3 py-2 border border-line-2 rounded-lg bg-paper text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand';
const btnPrimary =
  'px-4 py-2 bg-brand text-brand-ink rounded-lg hover:opacity-90 disabled:opacity-50 text-sm font-medium flex items-center gap-2';
const btnGhost =
  'px-3 py-1.5 border border-line-2 rounded-lg text-sm text-ink-2 hover:bg-bg hover:text-ink disabled:opacity-50';

const SCOPE_LABELS: Record<PriceRuleDto['scope'], string> = {
  global: 'Globale',
  range: 'Gamme',
  customer: 'Client',
  customer_range: 'Client + gamme',
};

function customerDisplayName(customer: CustomerDto): string {
  return customer.type === 'company'
    ? (customer.company_name ?? 'Client')
    : `${customer.first_name ?? ''} ${customer.last_name ?? ''}`.trim() || 'Client';
}

function formatPercent(rate: string): string {
  return `${rateToPercentString(rate)} %`;
}

function formatPeriod(rule: PriceRuleDto): string {
  return rule.ends_on ? `${rule.starts_on} → ${rule.ends_on}` : `${rule.starts_on} → sans terme`;
}

type EditingState = Readonly<{ rule: PriceRuleDto; etag: string }>;
type RangeOption = Readonly<{ id: string; name: string }>;

export function DashboardPricingRules() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const api = useWorkspaceApi(PriceRulesApiClient);
  const customersApi = useWorkspaceApi(CustomersApiClient);
  const catalogApi = useWorkspaceApi(CatalogApiClient);
  const enabled = Boolean(user && currentTenant);
  const {
    items,
    loading,
    error,
    q,
    setQ,
    status,
    setStatus,
    customerId,
    setCustomerId,
    productRangeId,
    setProductRangeId,
    sort,
    setSort,
    hasMore,
    loadingMore,
    loadMore,
    create,
    toggleActive,
    refresh,
  } = usePriceRulesManagement(enabled);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [customers, setCustomers] = useState<readonly CustomerDto[]>([]);
  const [ranges, setRanges] = useState<readonly RangeOption[]>([]);

  // Sources de reference partagees avec `PriceRuleFormModal` (memes clients
  // API) : cet ecran ne redecouvre pas une autre source de clients/gammes.
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    Promise.all([customersApi.list({ pageSize: 200 }), catalogApi.pimCatalog()])
      .then(([customersResponse, catalog]) => {
        if (cancelled) return;
        setCustomers(customersResponse.items);
        setRanges(catalog.gammes.map((gamme) => ({ id: gamme.id, name: gamme.name })));
      })
      .catch(() => {
        if (!cancelled) {
          setCustomers([]);
          setRanges([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, customersApi, catalogApi]);

  const openEdit = async (rule: PriceRuleDto) => {
    const { data, etag } = await api.getForEdit(rule.id);
    if (!etag) throw new Error('ETag de la règle indisponible.');
    setEditing({ rule: data, etag });
  };

  const handleToggle = async (rule: PriceRuleDto) => {
    setTogglingId(rule.id);
    try {
      await toggleActive(rule);
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="space-y-5" data-testid={TEST_IDS.pricing.page}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink">Règles de prix</h1>
          <p className="text-sm text-ink-muted mt-1">
            {items.length} règle{items.length > 1 ? 's' : ''} de marge ou de remise
            {hasMore ? ' affichées, d’autres restent à charger.' : '.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className={btnPrimary}
          data-testid={TEST_IDS.pricing.createBtn}
        >
          <Plus className="w-4 h-4" />
          Nouvelle règle
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Rechercher par nom..."
          className={`${inputCls} max-w-sm`}
          data-testid={TEST_IDS.pricing.searchInput}
        />
        <select
          value={status ?? ''}
          onChange={(event) =>
            setStatus(event.target.value ? (event.target.value as PriceRuleStatusFilter) : null)
          }
          className={inputCls}
          style={{ maxWidth: 200 }}
          data-testid={TEST_IDS.pricing.statusFilterSelect}
        >
          <option value="">Tous les statuts</option>
          <option value="active">Actives</option>
          <option value="disabled">Désactivées</option>
        </select>
        {/* E10.7 CA7 — tri par date de creation OU par date de debut de
            validite, dans les deux sens. Les 4 valeurs reprennent exactement
            `PriceRuleSort` du contrat (contrat `listPriceRules`). */}
        <select
          value={sort}
          onChange={(event) => setSort(event.target.value as PriceRuleSort)}
          className={inputCls}
          style={{ maxWidth: 220 }}
          data-testid={TEST_IDS.pricing.sortSelect}
        >
          <option value="-created_at">Création (plus récente d’abord)</option>
          <option value="created_at">Création (plus ancienne d’abord)</option>
          <option value="-starts_on">Début de validité (plus tardif d’abord)</option>
          <option value="starts_on">Début de validité (plus tôt d’abord)</option>
        </select>
        <select
          value={customerId ?? ''}
          onChange={(event) => setCustomerId(event.target.value || null)}
          className={inputCls}
          style={{ maxWidth: 220 }}
          data-testid={TEST_IDS.pricing.customerFilterSelect}
        >
          <option value="">Tous les clients</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customerDisplayName(customer)}
            </option>
          ))}
        </select>
        <select
          value={productRangeId ?? ''}
          onChange={(event) => setProductRangeId(event.target.value || null)}
          className={inputCls}
          style={{ maxWidth: 220 }}
          data-testid={TEST_IDS.pricing.rangeFilterSelect}
        >
          <option value="">Toutes les gammes</option>
          {ranges.map((range) => (
            <option key={range.id} value={range.id}>
              {range.name}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-sm text-err-fg">{error}</p>}

      {loading ? (
        <p className="text-sm text-ink-muted">Chargement…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-ink-muted py-8 text-center">Aucune règle de prix pour l’instant.</p>
      ) : (
        <>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-ink-muted border-b border-line">
                <th className="py-2 pr-3 font-medium">Nom</th>
                <th className="py-2 pr-3 font-medium">Portée</th>
                <th className="py-2 pr-3 font-medium">Valeur</th>
                <th className="py-2 pr-3 font-medium">Période</th>
                <th className="py-2 pr-3 font-medium">Statut</th>
                <th className="py-2 pr-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {items.map((rule) => (
                <tr
                  key={rule.id}
                  data-testid={TEST_IDS.pricing.row}
                  data-rule-id={rule.id}
                  data-status={rule.is_active ? 'active' : 'disabled'}
                  className="border-b border-line/60 hover:bg-bg"
                >
                  <td className="py-2 pr-3">
                    <button
                      type="button"
                      onClick={() => void openEdit(rule)}
                      className="text-ink hover:text-brand hover:underline text-left"
                    >
                      {rule.name}
                    </button>
                  </td>
                  <td className="py-2 pr-3 text-ink-muted">{SCOPE_LABELS[rule.scope]}</td>
                  <td className="py-2 pr-3 text-ink-muted">
                    {rule.value_type === 'margin_rate' ? 'Marge' : 'Remise'} {formatPercent(rule.value)}
                  </td>
                  <td className="py-2 pr-3 text-ink-muted">{formatPeriod(rule)}</td>
                  <td className="py-2 pr-3">
                    <span
                      data-testid={TEST_IDS.pricing.statusPill}
                      className={`inline-flex items-center gap-1.5 text-xs ${
                        rule.is_active ? 'text-green-700' : 'text-ink-muted'
                      }`}
                    >
                      <span
                        className={`inline-block w-2 h-2 rounded-full ${
                          rule.is_active ? 'bg-green-600' : 'bg-ink-muted'
                        }`}
                      />
                      {rule.is_active ? 'Active' : 'Désactivée'}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-right">
                    <button
                      type="button"
                      onClick={() => void handleToggle(rule)}
                      disabled={togglingId === rule.id}
                      className="text-xs text-ink-2 border border-line-2 rounded-lg px-2 py-1 hover:bg-bg disabled:opacity-50"
                      data-testid={TEST_IDS.pricing.toggleActiveBtn}
                    >
                      {rule.is_active ? 'Désactiver' : 'Activer'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {hasMore && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={() => void loadMore()}
                disabled={loadingMore}
                className={btnGhost}
                data-testid={TEST_IDS.pricing.loadMoreBtn}
              >
                {loadingMore && <Loader2 className="w-4 h-4 animate-spin" />}
                Charger la suite
              </button>
            </div>
          )}
        </>
      )}

      <DefaultMarginPanel ranges={ranges} />

      <DefaultValidityDaysPanel />

      <OrderFilePurgePanel />

      {showCreate && (
        <PriceRuleFormModal
          onClose={() => setShowCreate(false)}
          onCreate={create}
          onUpdate={(id, command, ifMatch) => api.update(id, command, ifMatch).then((r) => r.data)}
          onSaved={() => void refresh()}
        />
      )}

      {editing && (
        <PriceRuleFormModal
          editing={editing}
          onClose={() => setEditing(null)}
          onCreate={create}
          onUpdate={(id, command, ifMatch) => api.update(id, command, ifMatch).then((r) => r.data)}
          onSaved={() => void refresh()}
        />
      )}
    </div>
  );
}

/**
 * Panneau de marge publique standard par gamme (CA4). `getDefaultMargin`/
 * `setDefaultMargin` existaient deja dans `PriceRulesApiClient` sans surface
 * appelante (qa-review E10.6, R2) — cette surface minimale les cable, avec
 * le meme couple `ETag`/`If-Match` que le reste du module.
 */
function DefaultMarginPanel({ ranges }: { ranges: readonly RangeOption[] }) {
  const api = useWorkspaceApi(PriceRulesApiClient);
  const [rangeId, setRangeId] = useState('');
  const [marginPercent, setMarginPercent] = useState('');
  const [etag, setEtag] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!rangeId) {
      setMarginPercent('');
      setEtag(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSavedAt(null);
    api
      .getDefaultMargin(rangeId)
      .then(({ data, etag: nextEtag }) => {
        if (cancelled) return;
        setMarginPercent(data.margin_rate ? rateToPercentString(data.margin_rate) : '');
        setEtag(nextEtag ?? null);
      })
      .catch((cause) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'Lecture de la marge standard impossible.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [api, rangeId]);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!rangeId || !etag) return;
    const rate = toRateString(marginPercent);
    if (rate === null) {
      setError('Le taux doit être un nombre positif.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await api.setDefaultMargin(rangeId, { margin_rate: rate }, etag);
      setEtag(result.etag ?? null);
      setSavedAt(Date.now());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Enregistrement de la marge standard impossible.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="border border-line-2 rounded-lg p-4 space-y-3"
      data-testid={TEST_IDS.pricing.defaultMarginSection}
    >
      <div>
        <h2 className="text-sm font-semibold text-ink">Marge publique standard</h2>
        <p className="text-xs text-ink-muted mt-0.5">
          Marge appliquée par défaut sur une gamme quand aucune règle de prix ne s’applique (CA4).
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={rangeId}
          onChange={(event) => setRangeId(event.target.value)}
          className={inputCls}
          style={{ maxWidth: 260 }}
          data-testid={TEST_IDS.pricing.defaultMarginRangeSelect}
        >
          <option value="">Sélectionner une gamme</option>
          {ranges.map((range) => (
            <option key={range.id} value={range.id}>
              {range.name}
            </option>
          ))}
        </select>
        {rangeId && (
          <form onSubmit={handleSave} className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              step="0.01"
              value={marginPercent}
              onChange={(event) => setMarginPercent(event.target.value)}
              disabled={loading}
              placeholder="Ex. 30"
              className={inputCls}
              style={{ maxWidth: 120 }}
              data-testid={TEST_IDS.pricing.defaultMarginInput}
            />
            <span className="text-sm text-ink-muted">%</span>
            <button
              type="submit"
              disabled={saving || loading || !etag}
              className={btnPrimary}
              data-testid={TEST_IDS.pricing.defaultMarginSaveBtn}
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Enregistrer
            </button>
          </form>
        )}
      </div>
      {error && <p className="text-sm text-err-fg">{error}</p>}
      {savedAt !== null && !error && <p className="text-sm text-green-700">Marge standard enregistrée.</p>}
    </div>
  );
}

/**
 * Duree de validite par defaut des devis (E10.10a, point 9 du cadrage,
 * docs/api/CONVENTIONS.md §8.12) — ressource singleton `/commercial-settings`
 * du tenant, PATCH garde par `can_manage_pricing` cote serveur (meme droit
 * que cet ecran). Applique UNIQUEMENT a l ENVOI d un devis (`sendQuote`) et
 * seulement si `valid_until` est encore `null` — jamais retroactif sur un
 * devis existant, jamais a la creation.
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

function formatEffectiveFrom(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Pilotage PAR ESPACE de la purge automatique des fichiers de commande
 * (E10.22d, docs/api/CONVENTIONS.md §8.22bis §8) — TROISIEME panneau du meme
 * ecran (`can_manage_pricing`, meme droit), MEME ressource `/commercial-
 * settings`, MEME client API, MEME couple ETag/If-Match. Aucun calcul de
 * seuil ni de date n a lieu ici au-dela d un formatage d affichage : l etat
 * (activee/desactivee), le plancher d activation
 * (`order_file_purge_effective_from`) et l effet de la bascule sont
 * ENTIEREMENT decides par l API/la base (garde, trigger d activation,
 * echeance effective) — ce composant se contente de les afficher et de
 * poser la commande.
 *
 * Le texte reprend LITTERALEMENT ce que les rappels valides par Arnaud
 * annoncent deja (E10.22a) : « le lecteur consent a une destruction », le
 * panneau ne peut pas dire moins que le courriel qu il declenche.
 *
 * ECART DOCUMENTE (rapport de fin de story) : le contrat §8 prevoit une
 * phrase sur les rappels DEJA REMIS, affichee "seulement s il existe des
 * rappels emis" — aucun endpoint de lecture de
 * `commercial_order_file_purge_notices` n existe cote workspace (E10.22d
 * n en cree aucun, §9 du contrat : "aucun endpoint nouveau"). Cette
 * condition ne peut donc pas etre evaluee depuis l ecran sans inventer un
 * endpoint hors mandat de cette story. La phrase est affichee
 * INCONDITIONNELLEMENT a la desactivation plutot qu omise a tort : un
 * avertissement vrai affiche a tort est sans consequence, un avertissement
 * vrai jamais affiche laisserait croire a une reversibilite qui n existe
 * pas.
 */
function OrderFilePurgePanel() {
  const api = useWorkspaceApi(CommercialSettingsApiClient);
  const [enabled, setEnabled] = useState(false);
  const [effectiveFrom, setEffectiveFrom] = useState<string | null>(null);
  const [etag, setEtag] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .get()
      .then(({ data, etag: nextEtag }) => {
        if (cancelled) return;
        setEnabled(Boolean(data.order_file_purge_enabled));
        setEffectiveFrom(data.order_file_purge_effective_from ?? null);
        setEtag(nextEtag ?? null);
      })
      .catch((cause) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'Lecture du reglage de purge automatique impossible.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [api]);

  const handleToggle = async () => {
    if (!etag) return;
    setToggling(true);
    setError(null);
    try {
      const result = await api.update({ order_file_purge_enabled: !enabled }, etag);
      setEnabled(Boolean(result.data.order_file_purge_enabled));
      setEffectiveFrom(result.data.order_file_purge_effective_from ?? null);
      setEtag(result.etag ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Modification du reglage de purge automatique impossible.');
    } finally {
      setToggling(false);
    }
  };

  return (
    <div
      className="border border-line-2 rounded-lg p-4 space-y-3"
      data-testid={TEST_IDS.commercialSettings.orderFilePurgeSection}
    >
      <div>
        <h2 className="text-sm font-semibold text-ink">Purge automatique des fichiers de commande</h2>
        <p
          className="text-xs font-medium mt-0.5"
          data-testid={TEST_IDS.commercialSettings.orderFilePurgeStatusLabel}
        >
          Purge automatique : {enabled ? 'activée' : 'désactivée'}
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-ink-muted">Chargement…</p>
      ) : enabled ? (
        <p className="text-xs text-ink-muted">
          Les fichiers déposés sur vos commandes sont supprimés automatiquement 30 jours après leur dépôt. Deux
          rappels par courriel préviennent les administrateurs de l’espace avant chaque échéance ; aucune
          prorogation n’est possible — la seule action possible est de télécharger les fichiers avant la date
          annoncée.
          {effectiveFrom && (
            <>
              {' '}
              <span data-testid={TEST_IDS.commercialSettings.orderFilePurgeEffectiveFromText}>
                Premières suppressions possibles à partir du {formatEffectiveFrom(effectiveFrom)}.
              </span>
            </>
          )}
        </p>
      ) : (
        <div className="space-y-1.5">
          <p className="text-xs text-ink-muted">
            Aucun fichier n’est supprimé automatiquement, et aucun rappel n’est envoyé. Les fichiers s’accumulent
            dans votre espace de stockage.
          </p>
          <p className="text-xs text-ink-muted">
            Activer ne détruira rien avant trente jours pleins, même pour des fichiers déjà déposés. Désactiver
            n’annule pas les rappels déjà remis : un courriel parti ne se rappelle pas, et un destinataire a pu y
            lire une date de suppression qui n’arrivera pas.
          </p>
        </div>
      )}

      {error && <p className="text-sm text-err-fg">{error}</p>}

      <button
        type="button"
        onClick={() => void handleToggle()}
        disabled={loading || toggling || !etag}
        className={enabled ? btnGhost : btnPrimary}
        data-testid={TEST_IDS.commercialSettings.orderFilePurgeToggleBtn}
      >
        {toggling && <Loader2 className="w-4 h-4 animate-spin" />}
        {enabled ? 'Désactiver la purge automatique' : 'Activer la purge automatique'}
      </button>
    </div>
  );
}
