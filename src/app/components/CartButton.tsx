import { useEffect, useState } from 'react';
import { ShoppingCart, X, Trash2, FileText } from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { useClients, Client } from '../contexts/ClientsContext';
import {
  makeQuoteReference,
  persistQuote,
  getDefaultTemplate,
  renderQuoteHtml,
} from '../utils/quote';
import { useQuoteTemplates } from '../contexts/QuoteTemplatesContext';
import { useTenant } from '../contexts/TenantContext';
import { useTenantPath } from '../hooks/useTenantPath';

interface CartButtonProps {
  /** `rail` : icon-only, pour le rail lateral du chat v2.
   *  `pill` : bouton avec label, pour le Header global.
   */
  variant?: 'rail' | 'pill';
}

export function CartButton({ variant = 'pill' }: CartButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { items, removeFromCart, clearCart, getTotalPrice, updateItemClient } = useCart();
  const { user } = useAuth();
  const { clients } = useClients();
  const tp = useTenantPath();
  const { currentTenant } = useTenant();
  const { templates, defaultTemplateId } = useQuoteTemplates();

  // Selection du gabarit a appliquer aux devis imprimes depuis le panier.
  // Le defaut de la modale suit le defaut utilisateur (ou builtin-classique).
  // L'user peut override juste avant d'imprimer.
  const effectiveDefaultId = defaultTemplateId ?? 'builtin-classique';
  const [selectedTemplateId, setSelectedTemplateId] =
    useState<string>(effectiveDefaultId);
  useEffect(() => {
    setSelectedTemplateId(effectiveDefaultId);
  }, [effectiveDefaultId]);
  const effectiveTemplate =
    templates.find((t) => t.id === selectedTemplateId) ?? getDefaultTemplate();

  const totalPrice = getTotalPrice();
  const totalTTC = totalPrice * 1.2;

  // Groupe les items du panier par client_id (null = "sans client")
  const groupByClient = () => {
    const map = new Map<string | null, typeof items>();
    for (const item of items) {
      const key = (item.product?.client_id as string) || null;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return Array.from(map.entries());
  };

  const uniqueClientCount = new Set(items.map((i) => i.product?.client_id || null)).size;

  const handlePrintQuotes = () => {
    if (items.length === 0) return;
    const groups = groupByClient();

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Le navigateur a bloque la fenetre d'impression. Autorisez les popups pour ce site.");
      return;
    }

    const devisBlocks: string[] = [];
    const toPersist: Array<{ ref: string; clientId: string | null; items: typeof items }> = [];

    for (const [clientId, groupItems] of groups) {
      const client: Client | null = clients.find((c) => c.id === clientId) || null;
      const reference = makeQuoteReference();
      toPersist.push({ ref: reference, clientId, items: groupItems });

      devisBlocks.push(
        renderQuoteHtml({
          template: effectiveTemplate,
          reference,
          client,
          items: groupItems.map((it) => {
            const p = it.product;
            const cp = p.clariprintQuote;
            const ht = cp?.costs?.total ?? cp?.priceHT ?? p.price ?? 0;
            return {
              name: p.name,
              quantity: p.quantity,
              format: p.format ?? `${p.dimensions?.width ?? ''}x${p.dimensions?.height ?? ''}mm`,
              material: `${p.material ?? ''} ${p.weight ? `${p.weight}g` : ''}`.trim(),
              priceHT: ht,
            };
          }),
        })
      );
    }

    if (user && currentTenant) {
      void Promise.all(
        toPersist.flatMap(({ ref, clientId, items }) =>
          items.map((item) => {
            const p = item.product;
            const cp = p.clariprintQuote;
            const totalHT = cp?.costs?.total ?? cp?.priceHT ?? p.price ?? 0;
            return persistQuote(user.id, currentTenant.id, {
              reference: ref,
              client_id: clientId,
              product_name: p.name,
              product_config: p,
              total_ht: totalHT,
              total_ttc: totalHT * 1.2,
            });
          })
        )
      );
    }

    // Template-driven wrapper
    const brand = effectiveTemplate.brand_color || '#111';
    const accent = effectiveTemplate.accent_color || '#f59e0b';
    printWindow.document.write(`
      <!DOCTYPE html><html><head><meta charset="utf-8"><title>Devis groupes</title>
      <style>
        body{font-family:${effectiveTemplate.font_family || 'Arial, sans-serif'};padding:40px;color:#111;background:#fff}
        h1{color:${brand};margin:0 0 8px 0;font-size:28px}
        .meta{color:#666;font-size:13px;margin-bottom:24px}
        .parties{display:flex;gap:24px;margin-bottom:24px}
        .partie{flex:1;padding:16px;border:2px solid #e5e7eb;border-radius:8px}
        .partie-title{font-weight:bold;color:${brand};font-size:13px;text-transform:uppercase;margin-bottom:10px}
        .partie-field{font-size:13px;color:#444;margin-bottom:6px}
        table{width:100%;border-collapse:collapse;margin:16px 0}
        th,td{border-bottom:1px solid #e5e7eb;padding:8px;font-size:13px;text-align:left}
        th{background:#f3f4f6;color:${brand}}
        .totals{margin-top:16px;display:flex;flex-direction:column;align-items:flex-end;gap:4px;font-size:14px}
        .totals .final{font-size:18px;font-weight:bold;color:${brand};border-top:2px solid ${brand};padding-top:8px;margin-top:8px}
        .devis{margin-bottom:40px;border-top:4px solid ${accent};padding-top:24px}
        .devis + .devis{page-break-before:always}
        .tpl-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;gap:24px}
        .tpl-emitter{font-size:12px;color:#444;line-height:1.5}
        .tpl-logo img{max-width:160px;max-height:72px;object-fit:contain}
      </style></head><body>
        ${devisBlocks.join('')}
      </body></html>
    `);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 250);
  };

  // ── Trigger ───────────────────────────────────────────────────────────────

  const trigger =
    variant === 'rail' ? (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label={`Panier (${items.length})`}
        title={`Panier · ${items.length} article${items.length > 1 ? 's' : ''}`}
        className="relative w-9 h-9 rounded-lg grid place-items-center text-ink-muted hover:bg-line hover:text-ink transition-colors"
      >
        <ShoppingCart className="w-4 h-4" strokeWidth={1.5} />
        {items.length > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-brand text-brand-ink font-mono grid place-items-center"
            style={{ fontSize: '10px', fontWeight: 500 }}
          >
            {items.length}
          </span>
        )}
      </button>
    ) : (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="relative inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-line bg-paper text-ink hover:bg-bg transition-colors"
        style={{ fontSize: '13px', fontWeight: 500 }}
      >
        <ShoppingCart className="w-4 h-4" strokeWidth={1.5} />
        Panier
        {items.length > 0 && (
          <span
            className="ml-1 min-w-[18px] h-[18px] px-1 rounded-full bg-ink text-paper font-mono grid place-items-center"
            style={{ fontSize: '10.5px', fontWeight: 500 }}
          >
            {items.length}
          </span>
        )}
      </button>
    );

  return (
    <>
      {trigger}

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div
            className="bg-paper rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-line"
            style={{ boxShadow: 'var(--v2-shadow-lg)' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-line bg-paper">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-ink" strokeWidth={1.5} />
                <h2 className="text-ink" style={{ fontSize: '17px', fontWeight: 500 }}>
                  Mon panier
                </h2>
                <span
                  className="font-mono text-ink-mute-2"
                  style={{ fontSize: '12px', letterSpacing: '0.02em' }}
                >
                  · {items.length} article{items.length > 1 ? 's' : ''}
                </span>
                {uniqueClientCount > 1 && (
                  <span
                    className="ml-2 px-2 py-0.5 rounded-full bg-warn-bg text-warn-fg font-mono"
                    style={{ fontSize: '11px', fontWeight: 500 }}
                  >
                    {uniqueClientCount} clients
                  </span>
                )}
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-bg rounded-lg text-ink-muted hover:text-ink"
                aria-label="Fermer"
              >
                <X className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {items.length === 0 ? (
                <div className="text-center py-16">
                  <ShoppingCart
                    className="w-12 h-12 text-ink-mute-2 mx-auto mb-3"
                    strokeWidth={1.2}
                  />
                  <p className="text-ink" style={{ fontSize: '15px', fontWeight: 400 }}>
                    Votre panier est vide
                  </p>
                  <p
                    className="text-ink-muted mt-1"
                    style={{ fontSize: '13px', fontWeight: 300 }}
                  >
                    Ajoutez des produits depuis une productcard pour les imprimer en devis groupes.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map((item, index) => {
                    const p = item.product;
                    const cp = p.clariprintQuote;
                    const ht = cp?.costs?.total ?? cp?.priceHT ?? p.price ?? 0;
                    return (
                      <div
                        key={item.id}
                        className="border border-line rounded-xl p-4 flex items-start justify-between bg-paper hover:border-line-2 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <span
                              className="font-mono text-ink-mute-2"
                              style={{ fontSize: '11px', letterSpacing: '0.04em' }}
                            >
                              #{String(index + 1).padStart(2, '0')}
                            </span>
                            <h3
                              className="text-ink truncate"
                              style={{ fontSize: '14.5px', fontWeight: 500 }}
                            >
                              {p.name}
                            </h3>
                          </div>

                          {/* Selecteur de client par item */}
                          <div className="mb-3">
                            <label
                              className="block text-ink-muted mb-1"
                              style={{ fontSize: '11.5px', fontWeight: 500 }}
                            >
                              Client associe a ce devis
                            </label>
                            {!user ? (
                              <p className="text-ink-mute-2" style={{ fontSize: '12px' }}>
                                Connectez-vous pour associer un client.
                              </p>
                            ) : clients.length === 0 ? (
                              <p className="text-ink-mute-2" style={{ fontSize: '12px' }}>
                                Aucun client.{' '}
                                <a
                                  href={tp('/dashboard/clients')}
                                  className="text-brand hover:underline"
                                >
                                  Ajouter un client
                                </a>
                              </p>
                            ) : (
                              <select
                                value={p.client_id || ''}
                                onChange={(e) =>
                                  updateItemClient(item.id, e.target.value || null)
                                }
                                className="w-full px-2.5 py-1.5 border border-line rounded-lg bg-paper text-ink focus:outline-none focus:border-line-2"
                                style={{ fontSize: '13px' }}
                              >
                                <option value="">— Aucun client —</option>
                                {clients.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.company}
                                    {c.contact_name ? ` — ${c.contact_name}` : ''}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>

                          <div
                            className="grid grid-cols-2 gap-x-4 gap-y-1 text-ink-2"
                            style={{ fontSize: '12.5px', fontWeight: 400 }}
                          >
                            <div>
                              <span className="text-ink-muted">Quantite :</span>{' '}
                              {p.quantity ?? '—'}
                            </div>
                            <div>
                              <span className="text-ink-muted">Format :</span>{' '}
                              {p.format ||
                                `${p.dimensions?.width ?? ''}x${p.dimensions?.height ?? ''}mm`}
                            </div>
                            <div>
                              <span className="text-ink-muted">Support :</span>{' '}
                              {p.material || '—'}
                            </div>
                            <div>
                              <span className="text-ink-muted">Grammage :</span>{' '}
                              {p.weight ? `${p.weight}g/m2` : '—'}
                            </div>
                            <div className="col-span-2">
                              <span className="text-ink-muted">Finition :</span>{' '}
                              {p.finish || p.finishRecto || '—'}
                            </div>
                          </div>

                          <div className="mt-3 pt-3 border-t border-line flex items-baseline justify-between">
                            <span
                              className="text-ink-muted"
                              style={{ fontSize: '12px', fontWeight: 400 }}
                            >
                              Prix HT
                            </span>
                            <span
                              className="text-ink font-mono"
                              style={{ fontSize: '15px', fontWeight: 500 }}
                            >
                              {ht.toFixed(2)} €
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="ml-3 p-2 text-err-fg hover:bg-err-bg rounded-lg transition-colors"
                          aria-label="Retirer du panier"
                        >
                          <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <div className="border-t border-line px-6 py-5 bg-bg">
                {/* Selecteur de gabarit — applique aux devis imprimes */}
                <div className="mb-4 flex items-end gap-3 flex-wrap">
                  <div className="flex-1 min-w-[220px]">
                    <label
                      className="block text-ink-muted mb-1"
                      style={{ fontSize: '11.5px', fontWeight: 500 }}
                    >
                      Gabarit applique aux devis
                    </label>
                    <select
                      value={selectedTemplateId}
                      onChange={(e) => setSelectedTemplateId(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-line rounded-lg bg-paper text-ink focus:outline-none focus:border-line-2"
                      style={{ fontSize: '13px' }}
                    >
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.builtin ? '★ ' : ''}
                          {t.name}
                          {t.id === defaultTemplateId ? ' — par defaut' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <a
                    href={tp('/dashboard/quote-templates')}
                    className="text-ink-muted hover:text-ink underline"
                    style={{ fontSize: '12px' }}
                  >
                    Gerer mes gabarits
                  </a>
                </div>

                <div className="space-y-1.5 mb-4">
                  <div
                    className="flex justify-between text-ink-2"
                    style={{ fontSize: '13px', fontWeight: 400 }}
                  >
                    <span>Total HT</span>
                    <span className="font-mono">{totalPrice.toFixed(2)} €</span>
                  </div>
                  <div
                    className="flex justify-between text-ink-muted"
                    style={{ fontSize: '13px', fontWeight: 400 }}
                  >
                    <span>TVA (20%)</span>
                    <span className="font-mono">{(totalPrice * 0.2).toFixed(2)} €</span>
                  </div>
                  <div
                    className="flex justify-between text-ink pt-2 border-t border-line"
                    style={{ fontSize: '17px', fontWeight: 500 }}
                  >
                    <span>Total TTC</span>
                    <span className="font-mono">{totalTTC.toFixed(2)} €</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={clearCart}
                    className="flex-1 min-w-[120px] px-4 py-2.5 border border-line bg-paper text-ink-2 hover:bg-bg rounded-xl transition-colors"
                    style={{ fontSize: '13.5px', fontWeight: 500 }}
                  >
                    Vider le panier
                  </button>
                  <button
                    onClick={handlePrintQuotes}
                    className="flex-[2] min-w-[200px] px-4 py-2.5 bg-ink text-paper hover:bg-black rounded-xl transition-colors inline-flex items-center justify-center gap-2"
                    style={{ fontSize: '13.5px', fontWeight: 500 }}
                  >
                    <FileText className="w-4 h-4" strokeWidth={1.5} />
                    Imprimer {uniqueClientCount > 1 ? `${uniqueClientCount} devis groupes` : 'le devis'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
