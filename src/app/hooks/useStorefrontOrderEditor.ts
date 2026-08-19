import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { lineTotal, round2 } from '../utils/quoteMath';
import { useStorefrontOrdersApi } from '../contexts/StorefrontModuleClientsContext';
import type { OrderUI } from '../components/shop/portal/PortalOrders.helpers';

interface EditableLine {
  id: string;
  product_id: string | null;
  product_label: string;
  quantity: number;
  unit_price_ht: number;
  line_total_ht: number;
  clariprint_options: unknown;
}

export function useStorefrontOrderEditor(
  order: OrderUI | null,
  onSaved: () => void | Promise<void>,
  onClose: () => void,
) {
  const ordersApi = useStorefrontOrdersApi();
  const saveCommandKey = useRef(crypto.randomUUID());
  const [lines, setLines] = useState<EditableLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    void ordersApi.getDraft(order.id, controller.signal).then((draft) => {
      if (controller.signal.aborted) return;
      setLines(draft.items.map((item) => ({
        id: item.id,
        product_id: item.productId,
        product_label: item.productLabel,
        quantity: item.quantity,
        unit_price_ht: item.unitPriceHt,
        line_total_ht: item.lineTotalHt,
        clariprint_options: item.clariprintOptions,
      })));
    }).catch((cause) => {
      if (!controller.signal.aborted) {
        const message = cause instanceof Error ? cause.message : 'erreur réseau';
        setError(`Impossible de charger les articles : ${message}`);
      }
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [order, ordersApi]);

  const mutateLine = (index: number, patch: Partial<EditableLine>) => {
    setLines((current) => current.map((line, position) => {
      if (position !== index) return line;
      const next = { ...line, ...patch };
      return { ...next, line_total_ht: lineTotal(next.quantity, next.unit_price_ht) };
    }));
  };
  const changeQuantity = (index: number, raw: string) =>
    mutateLine(index, { quantity: Math.max(1, Math.round(Number(raw) || 1)) });
  const changePrice = (index: number, raw: string) =>
    mutateLine(index, { unit_price_ht: round2(Math.max(0, Number(raw) || 0)) });
  const removeLine = (index: number) =>
    setLines((current) => current.filter((_, position) => position !== index));
  const totalHT = useMemo(
    () => round2(lines.reduce((sum, line) => sum + line.line_total_ht, 0)),
    [lines],
  );

  const save = async () => {
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
      const message = cause instanceof Error ? cause.message : 'erreur réseau';
      setError(/order_not_editable|non modifiable/i.test(message)
        ? "Cette commande n'est plus modifiable (elle a peut-être été validée). Rechargez la page."
        : `Échec de l'enregistrement : ${message}`);
    } finally {
      setSaving(false);
    }
  };

  return { lines, loading, saving, error, mutateLine, changeQuantity, changePrice, removeLine, totalHT, save } as const;
}
