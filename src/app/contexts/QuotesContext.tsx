/**
 * QuotesContext (S-QUOTES-2)
 * ──────────────────────────
 * CRUD sur les devis multi-lignes (`quotes` + `quote_lines`).
 *
 * - Liste (bibliotheque) : entetes seuls, filtres par `scope` :
 *     · 'mine' → mes devis (user_id = moi) — defaut
 *     · 'all'  → tous les devis du tenant — EXPOSE seulement si owner/admin/superadmin
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
import { supabase } from '/utils/supabase/client';
import { useAuth } from './AuthContext';
import { useTenant } from './TenantContext';
import { CartProduct } from './CartContext';
import { getTaxRate, applyTax } from '../utils/tax';
import { makeQuoteReference } from '../utils/quote';
import { lineTotal, round2, sumLinesHT } from '../utils/quoteMath';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface QuoteLine {
  id: string;
  quote_id: string;
  product_name: string;
  product_config: any;
  quantity: number;
  unit_cost_ht: number;
  unit_price_ht: number;
  margin_pct: number;
  line_total_ht: number;
  position: number;
  created_at?: string;
}

/** Ligne en cours d'edition (id optionnel : les nouvelles n'en ont pas encore). */
export type QuoteLineDraft = Omit<QuoteLine, 'id' | 'quote_id' | 'created_at'> & {
  id?: string;
};

export interface QuoteRecord {
  id: string;
  user_id: string;
  tenant_id: string | null;
  reference: string;
  product_name: string;
  client_name: string | null;
  status: string;
  total_ht: number | null;
  total_ttc: number | null;
  created_at: string;
  updated_at: string;
}

export interface QuoteWithLines extends QuoteRecord {
  lines: QuoteLine[];
}

export type QuoteScope = 'mine' | 'all';

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
  const { currentTenant, currentRole, isSuperAdmin } = useTenant();
  const [quotes, setQuotes] = useState<QuoteRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [scope, setScope] = useState<QuoteScope>('mine');

  const canViewAll = isSuperAdmin || currentRole === 'owner' || currentRole === 'admin';
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
    let query = supabase
      .from('quotes')
      .select(
        'id, user_id, tenant_id, reference, product_name, client_name, status, total_ht, total_ttc, created_at, updated_at'
      )
      .eq('tenant_id', currentTenant.id)
      .order('created_at', { ascending: false });

    // Cloisonnement applicatif : hors scope 'all' autorise, on ne voit que les siens.
    if (scope === 'mine' || !canViewAll) {
      query = query.eq('user_id', user.id);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[quotes] load error:', error.message);
      setQuotes([]);
    } else {
      setQuotes((data ?? []) as QuoteRecord[]);
    }
    setLoading(false);
  }, [user, currentTenant?.id, scope, canViewAll]);

  useEffect(() => {
    reload();
  }, [reload]);

  // ─── Lecture d'un devis complet (entete + lignes) ──────────────────────────
  const getQuote = useCallback(async (id: string): Promise<QuoteWithLines | null> => {
    const { data: head, error: headErr } = await supabase
      .from('quotes')
      .select(
        'id, user_id, tenant_id, reference, product_name, client_name, status, total_ht, total_ttc, created_at, updated_at'
      )
      .eq('id', id)
      .maybeSingle();
    if (headErr || !head) {
      if (headErr) console.error('[quotes] getQuote error:', headErr.message);
      return null;
    }
    const { data: lines, error: linesErr } = await supabase
      .from('quote_lines')
      .select('*')
      .eq('quote_id', id)
      .order('position', { ascending: true });
    if (linesErr) console.error('[quote_lines] load error:', linesErr.message);
    return { ...(head as QuoteRecord), lines: (lines ?? []) as QuoteLine[] };
  }, []);

  // ─── Creation depuis le panier ─────────────────────────────────────────────
  const createQuoteFromCart = useCallback(
    async (items: { product: CartProduct }[], clientName?: string): Promise<string | null> => {
      if (!user || !currentTenant || items.length === 0) return null;
      const reference = makeQuoteReference();
      const first = items[0].product;

      const { data: head, error: headErr } = await supabase
        .from('quotes')
        .insert({
          user_id: user.id,
          tenant_id: currentTenant.id,
          reference,
          product_name: String(first?.name ?? 'Devis'),
          client_name: clientName ?? null,
          status: 'draft',
          total_ht: 0,
          total_ttc: 0,
        })
        .select('id')
        .single();
      if (headErr || !head) {
        console.error('[quotes] create error:', headErr?.message);
        return null;
      }

      // Chaque item du panier devient une ligne. On ramene le forfait a un prix
      // unitaire (forfait / quantite) pour que quantite * prix soit lineaire et
      // editable. Marge initiale = 0 (cout = prix a la creation), le deviseur
      // ajoute sa marge dans l'editeur.
      const lineRows = items.map((it, idx) => {
        const p = it.product;
        const q = readQuantity(p);
        const unit = round2(baseForfaitHT(p) / q);
        return {
          quote_id: head.id,
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

      const { error: linesErr } = await supabase.from('quote_lines').insert(lineRows);
      if (linesErr) console.error('[quote_lines] insert error:', linesErr.message);

      const totalHT = sumLinesHT(lineRows);
      await supabase
        .from('quotes')
        .update({ total_ht: totalHT, total_ttc: round2(applyTax(totalHT, taxRate)) })
        .eq('id', head.id);

      await reload();
      return head.id as string;
    },
    [user, currentTenant?.id, taxRate, reload]
  );

  // ─── Sauvegarde de l'editeur (entete + reecriture des lignes) ──────────────
  const saveQuote = useCallback(
    async (
      id: string,
      patch: { client_name?: string | null; status?: string; lines: QuoteLineDraft[] }
    ): Promise<void> => {
      // 1. Reecriture des lignes : delete + reinsert (positions normalisees).
      const { error: delErr } = await supabase.from('quote_lines').delete().eq('quote_id', id);
      if (delErr) console.error('[quote_lines] delete error:', delErr.message);

      const rows = patch.lines.map((l, idx) => ({
        quote_id: id,
        product_name: l.product_name,
        product_config: l.product_config ?? null,
        quantity: l.quantity,
        unit_cost_ht: l.unit_cost_ht,
        unit_price_ht: l.unit_price_ht,
        margin_pct: l.margin_pct,
        line_total_ht: lineTotal(l.quantity, l.unit_price_ht),
        position: idx,
      }));
      if (rows.length > 0) {
        const { error: insErr } = await supabase.from('quote_lines').insert(rows);
        if (insErr) console.error('[quote_lines] reinsert error:', insErr.message);
      }

      // 2. Entete : client_name / status + totaux recalcules + product_name derive.
      const totalHT = sumLinesHT(rows);
      const headPatch: Record<string, unknown> = {
        total_ht: totalHT,
        total_ttc: round2(applyTax(totalHT, taxRate)),
      };
      if (patch.client_name !== undefined) headPatch.client_name = patch.client_name;
      if (patch.status !== undefined) headPatch.status = patch.status;
      if (rows.length > 0) headPatch.product_name = rows[0].product_name;

      const { error: headErr } = await supabase.from('quotes').update(headPatch).eq('id', id);
      if (headErr) console.error('[quotes] saveQuote head error:', headErr.message);

      await reload();
    },
    [taxRate, reload]
  );

  const setStatus = useCallback(
    async (id: string, status: string): Promise<void> => {
      const { error } = await supabase.from('quotes').update({ status }).eq('id', id);
      if (error) console.error('[quotes] setStatus error:', error.message);
      await reload();
    },
    [reload]
  );

  const deleteQuote = useCallback(
    async (id: string): Promise<void> => {
      // quote_lines supprimees en cascade (FK on delete cascade).
      const { error } = await supabase.from('quotes').delete().eq('id', id);
      if (error) console.error('[quotes] delete error:', error.message);
      await reload();
    },
    [reload]
  );

  const duplicateQuote = useCallback(
    async (id: string): Promise<string | null> => {
      if (!user || !currentTenant) return null;
      const src = await getQuote(id);
      if (!src) return null;
      const reference = makeQuoteReference();
      const { data: head, error: headErr } = await supabase
        .from('quotes')
        .insert({
          user_id: user.id,
          tenant_id: currentTenant.id,
          reference,
          product_name: src.product_name,
          client_name: src.client_name,
          status: 'draft',
          total_ht: src.total_ht ?? 0,
          total_ttc: src.total_ttc ?? 0,
        })
        .select('id')
        .single();
      if (headErr || !head) {
        console.error('[quotes] duplicate error:', headErr?.message);
        return null;
      }
      if (src.lines.length > 0) {
        const rows = src.lines.map((l, idx) => ({
          quote_id: head.id,
          product_name: l.product_name,
          product_config: l.product_config ?? null,
          quantity: l.quantity,
          unit_cost_ht: l.unit_cost_ht,
          unit_price_ht: l.unit_price_ht,
          margin_pct: l.margin_pct,
          line_total_ht: l.line_total_ht,
          position: idx,
        }));
        await supabase.from('quote_lines').insert(rows);
      }
      await reload();
      return head.id as string;
    },
    [user, currentTenant?.id, getQuote, reload]
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
