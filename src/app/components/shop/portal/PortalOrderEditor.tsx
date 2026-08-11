/**
 * PortalOrderEditor (2026-07-08) — édition d'une commande BROUILLON par son
 * auteur, depuis l'onglet « Mes commandes » de la boutique.
 *
 * Miroir léger de DashboardQuoteEditor (édition de devis), adapté au modèle
 * commande :
 *  - Édite quantité + prix unitaire HT + libellé de chaque ligne.
 *  - Supprime une ligne.
 *  - Recalcule le total HT live (réutilise quoteMath.lineTotal / round2).
 *
 * Contraintes (ADR-ORDERS-1) :
 *  - Édition réservée aux commandes status='draft' de l'auteur ; l API
 *    revalide ces deux invariants dans la transaction.
 *  - Persistance atomique via l API Orders : lignes + total sont validés et
 *    écrits dans une transaction serveur idempotente.
 *  - Pas d'ajout de ligne : une nouvelle référence passe par le catalogue → panier.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Save, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { lineTotal, round2 } from '../../../utils/quoteMath';
import { TEST_IDS } from '../../../lib/testIds';
import { useAuth } from '../../../contexts/AuthContext';
import { OrdersApiClient } from '../../../../modules/orders';
import { FetchApiClient } from '../../../../platform/api';
import type { OrderUI } from './PortalOrders.helpers';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../ui/dialog';

interface EditableLine {
  /** id DB de la ligne (tenant_order_items.id). */
  id: string;
  product_id: string | null;
  product_label: string;
  quantity: number;
  unit_price_ht: number;
  line_total_ht: number;
  clariprint_options: unknown;
}

interface Props {
  /** Commande à éditer (null = fermé). Doit être un draft v1.1 de l'auteur. */
  order: OrderUI | null;
  onClose: () => void;
  /** Rappel après sauvegarde réussie (le parent recharge la liste). */
  onSaved: () => void | Promise<void>;
}

function shortId(id: string): string {
  return id.replace(/-/g, '').slice(0, 8).toUpperCase();
}

export function PortalOrderEditor({ order, onClose, onSaved }: Props) {
  const { session } = useAuth();
  const [lines, setLines] = useState<EditableLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ordersApi = useMemo(() => new OrdersApiClient(
    new FetchApiClient('', globalThis.fetch, () => session?.access_token ?? null),
  ), [session?.access_token]);
  const saveCommandKey = useRef(crypto.randomUUID());

  // Charge les lignes réelles (avec id + product_id + snapshot config) à
  // l'ouverture — OrderUI.items est allégé (name/qty/price sans id).
  useEffect(() => {
    if (!order) {
      setLines([]);
      setError(null);
      return;
    }
    const controller = new AbortController();
    saveCommandKey.current = crypto.randomUUID();
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const draft = await ordersApi.getDraft(order.id, controller.signal);
        if (controller.signal.aborted) return;
        const loaded: EditableLine[] = draft.items.map((it) => ({
          id: it.id,
          product_id: it.productId,
          product_label: it.productLabel,
          quantity: it.quantity,
          unit_price_ht: it.unitPriceHt,
          line_total_ht: it.lineTotalHt,
          clariprint_options: it.clariprintOptions,
        }));
        setLines(loaded);
      } catch (cause) {
        if (controller.signal.aborted) return;
        const message = cause instanceof Error ? cause.message : 'erreur réseau';
        setError(`Impossible de charger les articles : ${message}`);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => {
      controller.abort();
    };
  }, [order, ordersApi]);

  const mutateLine = (idx: number, patch: Partial<EditableLine>) => {
    setLines((prev) =>
      prev.map((l, i) => {
        if (i !== idx) return l;
        const next = { ...l, ...patch };
        next.line_total_ht = lineTotal(next.quantity, next.unit_price_ht);
        return next;
      }),
    );
  };

  const onQtyChange = (idx: number, raw: string) =>
    mutateLine(idx, { quantity: Math.max(1, Math.round(Number(raw) || 1)) });

  const onPriceChange = (idx: number, raw: string) =>
    mutateLine(idx, { unit_price_ht: round2(Math.max(0, Number(raw) || 0)) });

  const removeLine = (idx: number) => setLines((prev) => prev.filter((_, i) => i !== idx));

  const totalHT = useMemo(() => round2(lines.reduce((s, l) => s + l.line_total_ht, 0)), [lines]);

  const handleSave = async () => {
    if (!order) return;
    if (lines.length === 0) {
      setError('Une commande doit conserver au moins un article — sinon utilisez « Annuler ».');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await ordersApi.updateDraft(order.id, {
        items: lines.map((line) => ({
          id: line.id,
          productLabel: line.product_label,
          quantity: line.quantity,
          unitPriceHt: line.unit_price_ht,
        })),
        idempotencyKey: saveCommandKey.current,
      });

      toast.success('Commande mise à jour.');
      saveCommandKey.current = crypto.randomUUID();
      await onSaved();
      onClose();
    } catch (cause) {
      const msg = cause instanceof Error ? cause.message : 'erreur réseau';
      setError(
        /order_not_editable|non modifiable/i.test(msg)
          ? "Cette commande n'est plus modifiable (elle a peut-être été validée). Rechargez la page."
          : `Échec de l'enregistrement : ${msg}`,
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!order} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        data-testid={TEST_IDS.shop.orderEditor}
        className="max-w-2xl"
      >
        <DialogHeader>
          <DialogTitle>Éditer la commande {order ? `#${shortId(order.id)}` : ''}</DialogTitle>
          <DialogDescription>
            Ajustez les quantités et les prix. Modifiable tant que la commande est en brouillon.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-10 flex items-center justify-center text-ink-muted">
            <Loader2 className="w-5 h-5 animate-spin" strokeWidth={1.5} />
          </div>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto -mx-1 px-1">
            {lines.length === 0 ? (
              <p className="text-ink-muted text-center py-8" style={{ fontSize: '13px' }}>
                Aucun article dans cette commande.
              </p>
            ) : (
              <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr className="border-b border-line">
                    {['Article', 'Qté', 'Prix U. HT', 'Total HT', ''].map((h, i) => (
                      <th
                        key={i}
                        className="text-left px-2 py-2 font-mono uppercase text-ink-muted"
                        style={{ fontSize: '10px', fontWeight: 500, letterSpacing: '0.06em' }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, idx) => (
                    <tr key={l.id} className="border-b border-line">
                      <td className="px-2 py-1.5">
                        <input
                          type="text"
                          value={l.product_label}
                          onChange={(e) => mutateLine(idx, { product_label: e.target.value })}
                          className="w-full min-w-[150px] px-2 py-1 border border-transparent hover:border-line rounded bg-transparent text-ink-2 focus:outline-none focus:border-line-2 focus:bg-paper"
                          style={{ fontSize: '13px' }}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          data-testid={TEST_IDS.shop.orderEditorLineQty}
                          type="number"
                          min={1}
                          value={l.quantity}
                          onChange={(e) => onQtyChange(idx, e.target.value)}
                          className="w-[72px] px-2 py-1 border border-line rounded bg-paper text-ink font-mono text-right focus:outline-none focus:border-line-2"
                          style={{ fontSize: '12.5px' }}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          data-testid={TEST_IDS.shop.orderEditorLinePrice}
                          type="number"
                          step="0.01"
                          min={0}
                          value={l.unit_price_ht}
                          onChange={(e) => onPriceChange(idx, e.target.value)}
                          className="w-[96px] px-2 py-1 border border-line rounded bg-paper text-ink font-mono text-right focus:outline-none focus:border-line-2"
                          style={{ fontSize: '12.5px' }}
                        />
                      </td>
                      <td className="px-2 py-1.5 font-mono text-ink tabular-nums" style={{ fontSize: '12.5px', fontWeight: 500 }}>
                        {l.line_total_ht.toFixed(2)} €
                      </td>
                      <td className="px-1 py-1.5 text-right">
                        <button
                          type="button"
                          onClick={() => removeLine(idx)}
                          className="p-1 rounded text-err-fg hover:bg-err-bg disabled:opacity-30"
                          disabled={lines.length === 1}
                          title={lines.length === 1 ? 'Une commande garde au moins un article' : 'Retirer cet article'}
                          aria-label="Retirer cet article"
                        >
                          <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div className="flex justify-end mt-4">
              <div className="flex items-center gap-3 text-ink" style={{ fontSize: '15px', fontWeight: 500 }}>
                <span className="text-ink-muted" style={{ fontSize: '13px', fontWeight: 400 }}>Total HT</span>
                <span className="font-mono tabular-nums">{totalHT.toFixed(2)} €</span>
              </div>
            </div>
          </div>
        )}

        {error && (
          <p className="text-err-fg flex items-start gap-1.5 m-0" style={{ fontSize: '12.5px' }}>
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" strokeWidth={1.5} /> {error}
          </p>
        )}

        <DialogFooter>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-3.5 py-2 rounded-md border border-line bg-paper text-ink-2 hover:bg-bg disabled:opacity-50"
            style={{ fontSize: '13px', fontWeight: 400 }}
          >
            Fermer
          </button>
          <button
            type="button"
            data-testid={TEST_IDS.shop.orderEditorSaveBtn}
            onClick={handleSave}
            disabled={saving || loading || lines.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-ink text-paper hover:bg-black disabled:opacity-50"
            style={{ fontSize: '13px', fontWeight: 500 }}
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.8} /> : <Save className="w-3.5 h-3.5" strokeWidth={1.8} />}
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
