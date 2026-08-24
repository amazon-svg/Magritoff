import { useWorkspaceApi, useWorkspaceUiRuntime } from '@/platform/runtime/workspace-ui-runtime';
import { QuotesApiClient } from '@/modules/quotes';
/**
 * QuotesContext (S-QUOTES-2)
 * ──────────────────────────
 * CRUD sur les devis multi-lignes (`quotes` + `quote_lines`).
 *
 * - Liste (bibliotheque) : entetes seuls, filtres par `scope` :
 *     · 'mine' → mes devis (user_id = moi) — defaut
 *     · 'all'  → tous les devis du tenant — exposé seulement aux admins/superadmins
 *   (La RLS laisse deja passer tout le tenant en SELECT ; le cloisonnement
 *   "mine vs all" est donc applicatif, cf. migration 20260702000100.)
 * - Editeur : `getQuote(id)` charge entete + lignes ; `saveQuote(id, patch)`
 *   persiste l'entete + reecrit les lignes (delete + reinsert) et recalcule les
 *   totaux (total_ht = somme lignes, total_ttc via le taux TVA du tenant).
 *
 * Monte dans AppShell APRES CartProvider (a besoin de tenant + auth + cart shape).
 */

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { useAuth } from '@/modules/account/ui/runtime';
import { useTenant } from '@/modules/tenants/ui/runtime';
import { CartProduct } from '@/modules/orders/ui/runtime';
import { getTaxRate, applyTax } from '@/modules/orders/ui/helpers';
import { makeQuoteReference } from '@/modules/quotes/ui/helpers/quote';
import { lineTotal, round2, sumLinesHT } from '@/modules/quotes/ui/helpers/quoteMath';
import { type QuoteLine as ApiQuoteLine, type QuoteLineDraft as ApiQuoteLineDraft, type QuoteRecord as ApiQuoteRecord, type QuoteScope as ApiQuoteScope, type QuoteWithLines as ApiQuoteWithLines } from '@/modules/quotes';
import { ApiClientError } from '@/platform/api';

// ─── Types ─────────────────────────────────────────────────────────────────

export type QuoteLine = ApiQuoteLine;

/** Ligne en cours d'edition (id optionnel : les nouvelles n'en ont pas encore). */
export type QuoteLineDraft = ApiQuoteLineDraft & { id?: string };

export type QuoteRecord = ApiQuoteRecord;

export type QuoteWithLines = ApiQuoteWithLines;

export type QuoteScope = ApiQuoteScope;

interface QuotesContextType {
  quotes: QuoteRecord[];
  loading: boolean;
  scope: QuoteScope;
  /** true si l'utilisateur peut basculer sur "tous les devis du tenant". */
  canViewAll: boolean;
  setScope: (s: QuoteScope) => void;
  createQuoteFromCart: (
    items: { product: CartProduct }[],
    clientName?: string
  ) => Promise<string | null>;
  getQuote: (id: string) => Promise<QuoteWithLines | null>;
  saveQuote: (
    id: string,
    patch: { client_name?: string | null; status?: string; lines: QuoteLineDraft[] }
  ) => Promise<void>;
  setStatus: (id: string, status: string) => Promise<void>;
  deleteQuote: (id: string) => Promise<void>;
  duplicateQuote: (id: string) => Promise<string | null>;
  reload: () => Promise<void>;
}

const QuotesContext = createContext<QuotesContextType | undefined>(undefined);

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Prix "de base" HT d'un produit panier (forfait pour la quantite encodee). */
function baseForfaitHT(p: CartProduct): number {
  const cp: any = (p as any).clariprintQuote;
  const v = cp?.costs?.total ?? cp?.priceHT ?? p.price_ht ?? p.price ?? 0;
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0;
}

function readQuantity(p: CartProduct): number {
  const q = Number((p as any).quantity ?? (p as any).config?.quantity ?? 1);
  return Number.isFinite(q) && q > 0 ? Math.round(q) : 1;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function QuotesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const quotesApi = useWorkspaceApi(QuotesApiClient);
  const { currentTenant, currentRole, isSuperAdmin } = useTenant();
  const [quotes, setQuotes] = useState<QuoteRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [scope, setScope] = useState<QuoteScope>('mine');

  const canViewAll = isSuperAdmin || currentRole === 'admin';
  const taxRate = getTaxRate(currentTenant);

  // Force le scope a 'mine' si l'utilisateur perd le droit (changement de tenant)
  useEffect(() => {
    if (!canViewAll && scope !== 'mine') setScope('mine');
  }, [canViewAll, scope]);

  const reload = useCallback(async () => {
    if (!user || !currentTenant) {
      setQuotes([]);
      return;
    }
    setLoading(true);
    try {
      setQuotes(await quotesApi.list(currentTenant.id, scope === 'all' && canViewAll ? 'all' : 'mine'));
    } catch (error) {
      console.error('[quotes] load error:', apiMessage(error));
      setQuotes([]);
    }
    setLoading(false);
  }, [user, currentTenant?.id, scope, canViewAll, quotesApi]);

  useEffect(() => {
    reload();
  }, [reload]);

  // ─── Lecture d'un devis complet (entete + lignes) ──────────────────────────
  const getQuote = useCallback(async (id: string): Promise<QuoteWithLines | null> => {
    if (!currentTenant) return null;
    try { return await quotesApi.get(currentTenant.id, id); }
    catch (error) { console.error('[quotes] getQuote error:', apiMessage(error)); return null; }
  }, [currentTenant?.id, quotesApi]);

  // ─── Creation depuis le panier ─────────────────────────────────────────────
  const createQuoteFromCart = useCallback(
    async (items: { product: CartProduct }[], clientName?: string): Promise<string | null> => {
      if (!user || !currentTenant || items.length === 0) return null;
      const reference = makeQuoteReference();
      const first = items[0]!.product;

      // Chaque item du panier devient une ligne. On ramene le forfait a un prix
      // unitaire (forfait / quantite) pour que quantite * prix soit lineaire et
      // editable. Marge initiale = 0 (cout = prix a la creation), le deviseur
      // ajoute sa marge dans l'editeur.
      const lineRows = items.map((it, idx) => {
        const p = it.product;
        const q = readQuantity(p);
        const unit = round2(baseForfaitHT(p) / q);
        return {
          product_name: String(p?.name ?? `Produit ${idx + 1}`),
          product_config: p as any,
          quantity: q,
          unit_cost_ht: unit,
          unit_price_ht: unit,
          margin_pct: 0,
          line_total_ht: lineTotal(q, unit),
          position: idx,
        };
      });

      const totalHT = sumLinesHT(lineRows);
      try {
        const head = await quotesApi.create(currentTenant.id, { reference, productName: String(first?.name ?? 'Devis'), clientName: clientName ?? null, totalHt: totalHT, totalTtc: round2(applyTax(totalHT, taxRate)), lines: lineRows });
        await reload();
        return head.id;
      } catch (error) { console.error('[quotes] create error:', apiMessage(error)); return null; }
    },
    [user, currentTenant?.id, taxRate, reload, quotesApi]
  );

  // ─── Sauvegarde de l'editeur (entete + reecriture des lignes) ──────────────
  const saveQuote = useCallback(
    async (
      id: string,
      patch: { client_name?: string | null; status?: string; lines: QuoteLineDraft[] }
    ): Promise<void> => {
      const rows = patch.lines.map((l, idx) => ({
        product_name: l.product_name,
        product_config: l.product_config ?? null,
        quantity: l.quantity,
        unit_cost_ht: l.unit_cost_ht,
        unit_price_ht: l.unit_price_ht,
        margin_pct: l.margin_pct,
        line_total_ht: lineTotal(l.quantity, l.unit_price_ht),
        position: idx,
      }));
      const totalHT = sumLinesHT(rows);
      if (!currentTenant) return;
      try {
        await quotesApi.save(currentTenant.id, id, { totalHt: totalHT, totalTtc: round2(applyTax(totalHT, taxRate)), lines: rows, ...(patch.client_name === undefined ? {} : { clientName: patch.client_name }), ...(patch.status === undefined ? {} : { status: patch.status }), ...(rows[0] ? { productName: rows[0].product_name } : {}) });
        await reload();
      } catch (error) { console.error('[quotes] saveQuote error:', apiMessage(error)); }
    },
    [currentTenant?.id, taxRate, reload, quotesApi]
  );

  const setStatus = useCallback(
    async (id: string, status: string): Promise<void> => {
      if (!currentTenant) return;
      try { await quotesApi.setStatus(currentTenant.id, id, status); await reload(); }
      catch (error) { console.error('[quotes] setStatus error:', apiMessage(error)); }
    },
    [currentTenant?.id, reload, quotesApi]
  );

  const deleteQuote = useCallback(
    async (id: string): Promise<void> => {
      if (!currentTenant) return;
      try { await quotesApi.remove(currentTenant.id, id); await reload(); }
      catch (error) { console.error('[quotes] delete error:', apiMessage(error)); }
    },
    [currentTenant?.id, reload, quotesApi]
  );

  const duplicateQuote = useCallback(
    async (id: string): Promise<string | null> => {
      if (!user || !currentTenant) return null;
      try { const head = await quotesApi.duplicate(currentTenant.id, id, makeQuoteReference()); await reload(); return head.id; }
      catch (error) { console.error('[quotes] duplicate error:', apiMessage(error)); return null; }
    },
    [user, currentTenant?.id, reload, quotesApi]
  );

  return (
    <QuotesContext.Provider
      value={{
        quotes,
        loading,
        scope,
        canViewAll,
        setScope,
        createQuoteFromCart,
        getQuote,
        saveQuote,
        setStatus,
        deleteQuote,
        duplicateQuote,
        reload,
      }}
    >
      {children}
    </QuotesContext.Provider>
  );
}

export function useQuotes() {
  const ctx = useContext(QuotesContext);
  if (!ctx) throw new Error('useQuotes must be used within a QuotesProvider');
  return ctx;
}

function apiMessage(error: unknown): string {
  return error instanceof ApiClientError ? `${error.problem.code}: ${error.message}` : error instanceof Error ? error.message : String(error);
}
