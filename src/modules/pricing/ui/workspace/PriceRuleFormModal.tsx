/**
 * PriceRuleFormModal — creation et modification d une regle de prix (E10.6,
 * CA1/CA2/CA5).
 *
 * `scope`, `customer_id`, `product_range_id` et `value_type` sont IMMUABLES
 * apres creation (contrat `UpdatePriceRuleCommand`, E10.7) : en mode edition,
 * ces champs sont affiches en lecture seule plutot que masques, pour que
 * l utilisateur comprenne pourquoi ils ne repondent pas au clic.
 *
 * Aucun calcul de prix ici : ce formulaire pose une regle, il n en applique
 * aucune (E10.21 reste hors perimetre, cf. `.claude/rules/frontend.md`).
 */
import { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { TEST_IDS } from '@/shared/presentation/testIds';
import { useWorkspaceApi } from '@/platform/runtime/workspace-ui-runtime';
import { CustomersApiClient, type CustomerDto } from '@/modules/customers';
import { CatalogApiClient } from '@/modules/catalog';
import type {
  CreatePriceRuleCommand,
  PriceRuleDto,
  PriceRuleScope,
  PriceRuleValueType,
  UpdatePriceRuleCommand,
} from '@/modules/pricing/api/contracts';

const inputCls =
  'w-full px-3 py-2 border border-line-2 rounded-lg bg-paper text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand disabled:opacity-60 disabled:bg-bg';
const labelCls = 'block text-sm font-medium text-ink-2 mb-1';
const btnPrimary =
  'px-4 py-2 bg-brand text-brand-ink rounded-lg hover:opacity-90 disabled:opacity-50 text-sm font-medium flex items-center justify-center gap-2';
const btnGhost =
  'px-3 py-1.5 border border-line-2 rounded-lg text-sm text-ink-2 hover:bg-bg hover:text-ink';

const SCOPE_LABELS: Record<PriceRuleScope, string> = {
  global: 'Globale (tout le catalogue, tous les clients)',
  range: 'Gamme de produits',
  customer: 'Client',
  customer_range: 'Client + gamme',
};

function customerDisplayName(customer: CustomerDto): string {
  return customer.type === 'company'
    ? (customer.company_name ?? 'Client')
    : `${customer.first_name ?? ''} ${customer.last_name ?? ''}`.trim() || 'Client';
}

export interface PriceRuleFormModalProps {
  onClose: () => void;
  /** Present en mode edition ; absent en mode creation. */
  editing?: Readonly<{ rule: PriceRuleDto; etag: string }>;
  onCreate: (command: CreatePriceRuleCommand) => Promise<PriceRuleDto>;
  onUpdate: (
    priceRuleId: string,
    command: UpdatePriceRuleCommand,
    ifMatch: string,
  ) => Promise<PriceRuleDto>;
  onSaved?: () => void;
}

export function PriceRuleFormModal({ onClose, editing, onCreate, onUpdate, onSaved }: PriceRuleFormModalProps) {
  const customersApi = useWorkspaceApi(CustomersApiClient);
  const catalogApi = useWorkspaceApi(CatalogApiClient);
  const [customers, setCustomers] = useState<readonly CustomerDto[]>([]);
  const [ranges, setRanges] = useState<readonly Readonly<{ id: string; name: string }>[]>([]);
  const [loadingRefs, setLoadingRefs] = useState(true);

  const [name, setName] = useState(editing?.rule.name ?? '');
  const [scope, setScope] = useState<PriceRuleScope>(editing?.rule.scope ?? 'global');
  const [customerId, setCustomerId] = useState(editing?.rule.customer_id ?? '');
  const [productRangeId, setProductRangeId] = useState(editing?.rule.product_range_id ?? '');
  const [valueType, setValueType] = useState<PriceRuleValueType>(editing?.rule.value_type ?? 'margin_rate');
  const [valuePercent, setValuePercent] = useState(
    editing ? String(Number(editing.rule.value) * 100) : '',
  );
  const [startsOn, setStartsOn] = useState(editing?.rule.starts_on ?? '');
  const [endsOn, setEndsOn] = useState(editing?.rule.ends_on ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingRefs(true);
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
      })
      .finally(() => {
        if (!cancelled) setLoadingRefs(false);
      });
    return () => {
      cancelled = true;
    };
  }, [customersApi, catalogApi]);

  const needsCustomer = scope === 'customer' || scope === 'customer_range';
  const needsRange = scope === 'range' || scope === 'customer_range';
  const isEditing = editing !== undefined;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !startsOn) return;
    if (needsCustomer && !customerId) return;
    if (needsRange && !productRangeId) return;

    const rate = toRateString(valuePercent);
    if (rate === null) {
      setError('Le taux doit être un nombre positif.');
      return;
    }

    setError(null);
    setSaving(true);
    try {
      if (isEditing) {
        await onUpdate(
          editing.rule.id,
          {
            name: name.trim(),
            value: rate,
            starts_on: startsOn,
            ends_on: endsOn || null,
          },
          editing.etag,
        );
      } else {
        await onCreate({
          name: name.trim(),
          scope,
          customer_id: needsCustomer ? customerId : null,
          product_range_id: needsRange ? productRangeId : null,
          value_type: valueType,
          value: rate,
          starts_on: startsOn,
          ends_on: endsOn || null,
          is_active: true,
        });
      }
      onSaved?.();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Enregistrement de la règle impossible.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-paper rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto"
        onClick={(event) => event.stopPropagation()}
        data-testid={TEST_IDS.pricing.modal}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-ink">
            {isEditing ? 'Modifier la règle de prix' : 'Nouvelle règle de prix'}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-bg rounded" aria-label="Fermer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelCls} htmlFor="price-rule-name">
              Nom de la règle
            </label>
            <input
              id="price-rule-name"
              type="text"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={inputCls}
              placeholder="Ex. Marge minimale carterie flash"
            />
          </div>

          <div>
            <label className={labelCls} htmlFor="price-rule-scope">
              Portée
            </label>
            <select
              id="price-rule-scope"
              value={scope}
              onChange={(event) => setScope(event.target.value as PriceRuleScope)}
              className={inputCls}
              disabled={isEditing}
              data-testid={TEST_IDS.pricing.scopeSelect}
            >
              {(Object.entries(SCOPE_LABELS) as [PriceRuleScope, string][]).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {needsCustomer && (
            <div>
              <label className={labelCls} htmlFor="price-rule-customer">
                Client
              </label>
              <select
                id="price-rule-customer"
                required
                value={customerId}
                onChange={(event) => setCustomerId(event.target.value)}
                className={inputCls}
                disabled={isEditing || loadingRefs}
                data-testid={TEST_IDS.pricing.customerSelect}
              >
                <option value="">{loadingRefs ? 'Chargement…' : 'Sélectionner un client'}</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customerDisplayName(customer)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {needsRange && (
            <div>
              <label className={labelCls} htmlFor="price-rule-range">
                Gamme de produits
              </label>
              <select
                id="price-rule-range"
                required
                value={productRangeId}
                onChange={(event) => setProductRangeId(event.target.value)}
                className={inputCls}
                disabled={isEditing || loadingRefs}
                data-testid={TEST_IDS.pricing.rangeSelect}
              >
                <option value="">{loadingRefs ? 'Chargement…' : 'Sélectionner une gamme'}</option>
                {ranges.map((range) => (
                  <option key={range.id} value={range.id}>
                    {range.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls} htmlFor="price-rule-value-type">
                Type
              </label>
              <select
                id="price-rule-value-type"
                value={valueType}
                onChange={(event) => setValueType(event.target.value as PriceRuleValueType)}
                className={inputCls}
                disabled={isEditing}
              >
                <option value="margin_rate">Marge</option>
                <option value="discount_rate">Remise</option>
              </select>
            </div>
            <div>
              <label className={labelCls} htmlFor="price-rule-value">
                Taux (%)
              </label>
              <input
                id="price-rule-value"
                type="number"
                min={0}
                step="0.01"
                required
                value={valuePercent}
                onChange={(event) => setValuePercent(event.target.value)}
                className={inputCls}
                placeholder="Ex. 50"
                data-testid={TEST_IDS.pricing.valueInput}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls} htmlFor="price-rule-valid-from">
                Début
              </label>
              <input
                id="price-rule-valid-from"
                type="date"
                required
                value={startsOn}
                onChange={(event) => setStartsOn(event.target.value)}
                className={inputCls}
                data-testid={TEST_IDS.pricing.validFromInput}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="price-rule-valid-to">
                Fin (optionnelle)
              </label>
              <input
                id="price-rule-valid-to"
                type="date"
                value={endsOn}
                onChange={(event) => setEndsOn(event.target.value)}
                className={inputCls}
                data-testid={TEST_IDS.pricing.validToInput}
              />
            </div>
          </div>

          {error && <p className="text-sm text-err-fg">{error}</p>}

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className={`flex-1 ${btnGhost}`}>
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className={`flex-1 ${btnPrimary}`}
              data-testid={TEST_IDS.pricing.saveBtn}
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Enregistrer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/** Convertit un pourcentage saisi ("50") en taux `Rate` (`"0.5000"`), ou `null` si invalide/negatif. */
function toRateString(percent: string): string | null {
  const parsed = Number(percent);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return (parsed / 100).toFixed(4);
}
