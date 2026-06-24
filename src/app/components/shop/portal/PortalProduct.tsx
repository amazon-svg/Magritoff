import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Minus, Plus, Calculator, Loader2, CheckCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import type { ShopProduct } from '../../../contexts/ShopsContext';
import { resolveProductImage } from '../../../utils/productImages';
import type { Gamme, ProductDefinition } from '../../../utils/productEnrichment';
import { resolveGamme } from '../../../utils/productEnrichment';
import { ProductMockup } from '../../brand/ProductMockup';
import { priceFingerprint, type ClariprintQuoteResult } from '../../../utils/clariprintQuote';
import { computeClariprintQuoteSafe } from '../../../../server/clariprint/ClariprintAdapter';
import { estimateMarketPriceHT, resolvePrice } from '../../../utils/priceResolver';
import { useTenant } from '../../../contexts/TenantContext';
import { applyTax, getTaxRate } from '../../../utils/tax';

interface Props {
  product: ShopProduct;
  onBack: () => void;
  onAddToCart: (p: ShopProduct, qty: number, opts: Record<string, string>) => void;
  pimGammes?: Gamme[];
  pimDefinitions?: ProductDefinition[];
}

// F3 — Fiche produit + configurateur
// Design source : .design-handoff/designs/05 - Portail B2B.html (section .f3)
export function PortalProduct({ product, onBack, onAddToCart, pimGammes, pimDefinitions }: Props) {
  const { currentTenant } = useTenant();
  const taxRate = getTaxRate(currentTenant);
  // CR §2 (13/05) : afficher la gamme PIM résolue dans le breadcrumb plutôt
  // que `product.category` brut (qui vaut "leaflet" pour ~90% des products
  // library, hérité du kind Clariprint). Fallback : kind Clariprint masqué,
  // category sinon, ou "Produit" si ni l'un ni l'autre.
  const breadcrumbGammeLabel = useMemo(() => {
    if (pimGammes && pimGammes.length > 0) {
      const gamme = resolveGamme(product.config, pimGammes, product.name);
      if (gamme?.name) return gamme.name;
    }
    const cat = product.category;
    if (cat && !/^(leaflet|folded|book|cover|section)$/i.test(cat)) {
      return cat;
    }
    return 'Produit';
  }, [pimGammes, product.config, product.name, product.category]);
  const initialQty = Number((product.config as any)?.quantity) || 500;
  const [qty, setQty] = useState(initialQty);
  const [selectedOpts, setSelectedOpts] = useState<Record<string, string>>({
    paper: '350g velours',
    finish: 'Soft touch',
    corners: 'Droits',
  });

  // ─── Calcul Clariprint ──────────────────────────────────────────────────
  // Reprend le prix deja calcule s'il est stocke dans la config du produit,
  // sinon state initial vide. Marque le prix comme 'stale' si les parametres
  // qui l'influencent (qty en particulier) ont change depuis le calcul.
  const initialQuote =
    (product.config as any)?.clariprintQuote ??
    (product.price_ht > 0
      ? ({ success: true, priceHT: product.price_ht } as ClariprintQuoteResult)
      : null);
  const [quote, setQuote] = useState<ClariprintQuoteResult | null>(initialQuote);
  const [quoteFingerprint, setQuoteFingerprint] = useState<string>(
    initialQuote ? priceFingerprint({ ...((product.config as any)?.clariprintData ?? product.config), quantity: initialQty }) : ''
  );
  const [calcLoading, setCalcLoading] = useState(false);

  // Fingerprint courant : change quand qty ou les options mappees changent
  const currentFingerprint = useMemo(() => {
    const clariprintData = (product.config as any)?.clariprintData ?? product.config;
    return priceFingerprint({ ...clariprintData, quantity: qty });
  }, [product, qty]);

  const priceStale = quote != null && currentFingerprint !== quoteFingerprint;
  const hasCalcd = quote?.success && quote.priceHT != null;

  const calculatePrice = async () => {
    setCalcLoading(true);
    const clariprintData = (product.config as any)?.clariprintData ?? product.config ?? {};
    const payload = { ...clariprintData, quantity: qty };
    const result = await computeClariprintQuoteSafe(payload);
    setQuote(result);
    setQuoteFingerprint(currentFingerprint);
    setCalcLoading(false);
  };

  // Si l'user arrive sur la fiche sans prix calcule et que la config est
  // valide (kind + dimensions), on lance le calcul une fois automatiquement.
  useEffect(() => {
    const c = (product.config as any)?.clariprintData ?? product.config;
    if (!quote && c?.kind) {
      void calculatePrice();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);

  const quantityPresets = [100, 250, 500, 1000, 2500];

  // Prix affiche : priorite au calcul Clariprint, sinon prix marche (decision
  // Arnaud 2026-05-09). Le prix marche est TOUJOURS disponible meme sans
  // Clariprint, ce qui debride le bouton "Ajouter au panier" en contexte demo.
  // Resolution unifiee via priceResolver pour rester aligne avec ProductCard,
  // PricingPanel, etc. Sera remplace en V2+ par appel au panel Magrit.
  const priceResolution = resolvePrice(product, quote);
  // Si on a un Clariprint valide → priceHT direct, sinon scaling proportionnel
  // sur le prix marche (qty / 500 = ratio par rapport au quantum de reference)
  const activePriceHT = hasCalcd
    ? (quote!.priceHT as number)
    : (priceResolution.source === 'library_cached'
        ? priceResolution.priceHT * (qty / 500)
        : estimateMarketPriceHT({ ...product, quantity: qty }));
  const priceTTC = applyTax(activePriceHT, taxRate);
  const isMarketPrice = !hasCalcd; // True quand on n a pas Clariprint

  const imgSrc = resolveProductImage({
    name: product.name,
    id: product.id,
    image_url: product.image_url,
    kind: (product.config as any)?.kind,
    clariprintData: product.config,
    gammes: pimGammes,
    definitions: pimDefinitions,
  });

  const cfg = product.config || {};

  const paperOptions = ['250g couché', '350g velours', '400g coton', 'Recyclé 300g'];
  const finishOptions = ['Sans finition', 'Soft touch', 'Pelliculage mat', 'Pelliculage brillant'];
  const cornerOptions = ['Droits', 'Ronds', 'Carrés biseautés'];

  const setOpt = (key: string, value: string) => {
    setSelectedOpts({ ...selectedOpts, [key]: value });
  };

  return (
    <div className="p-9 bg-paper" style={{ fontFamily: 'var(--font-ui)' }}>
      {/* Breadcrumbs */}
      <div
        className="font-mono text-ink-mute-2 mb-4"
        style={{ fontSize: '12px', letterSpacing: '0.02em' }}
      >
        <button onClick={onBack} className="hover:text-ink">Catalogue</button>
        <ChevronRight className="inline w-3 h-3 mx-1.5" strokeWidth={1.5} />
        <span className="text-ink-muted">{breadcrumbGammeLabel}</span>
        <ChevronRight className="inline w-3 h-3 mx-1.5" strokeWidth={1.5} />
        <span className="text-ink" style={{ fontWeight: 500 }}>{product.name}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-10">
        {/* Visuel */}
        <div>
          <div className="aspect-[4/3] rounded-xl overflow-hidden border border-line relative bg-bg">
            {imgSrc ? (
              <img src={imgSrc} alt={product.name} className="w-full h-full object-contain" />
            ) : (
              <ProductMockup
                name={product.name}
                kind={(product.config as any)?.kind}
                category={product.category}
                className="w-full h-full"
              />
            )}
          </div>

          {/* S-CONSO-1 (Sprint 4 Phase 2) : thumbs placeholder retires —
              ils suggeraient des vues multiples non implementees. Story
              future S-PRODUCT-VIEWS-MULTI hors scope v1.1. */}
        </div>

        {/* Info + configurateur */}
        <div className="flex flex-col gap-5">
          <div>
            <div className="flex items-baseline gap-3 mb-3">
              <h3
                className="text-ink m-0"
                style={{ fontSize: '29px', fontWeight: 400, letterSpacing: '-0.025em', lineHeight: 1.1 }}
              >
                {product.name}
              </h3>
              {product.category && (
                <span
                  className="font-mono uppercase px-2 py-0.5 rounded bg-ink text-paper"
                  style={{ fontSize: '10.5px', letterSpacing: '0.06em', fontWeight: 500 }}
                >
                  {product.category}
                </span>
              )}
            </div>
            {product.description && (
              <p
                className="text-ink-muted m-0"
                style={{ fontSize: '14px', fontWeight: 400, lineHeight: 1.55 }}
              >
                {product.description}
              </p>
            )}
          </div>

          {/* Configurateur */}
          <div className="flex flex-col gap-3.5 p-4.5 bg-bg border border-line rounded-lg">
            {/* Papier */}
            <div className="flex items-center gap-4">
              <span
                className="w-36 shrink-0 font-mono text-ink-2"
                style={{ fontSize: '12.5px', fontWeight: 500, letterSpacing: '0.02em' }}
              >
                PAPIER
              </span>
              <div className="flex flex-wrap gap-1.5">
                {paperOptions.map((opt) => {
                  const on = selectedOpts.paper === opt;
                  return (
                    <button
                      key={opt}
                      onClick={() => setOpt('paper', opt)}
                      className={`px-2.5 py-1.5 rounded border ${
                        on
                          ? 'bg-ink text-paper border-ink'
                          : 'bg-paper text-ink-2 border-line hover:border-line-2'
                      }`}
                      style={{ fontSize: '12.5px', fontWeight: on ? 500 : 400 }}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Finition */}
            <div className="flex items-center gap-4">
              <span
                className="w-36 shrink-0 font-mono text-ink-2"
                style={{ fontSize: '12.5px', fontWeight: 500, letterSpacing: '0.02em' }}
              >
                FINITION
              </span>
              <div className="flex flex-wrap gap-1.5">
                {finishOptions.map((opt) => {
                  const on = selectedOpts.finish === opt;
                  return (
                    <button
                      key={opt}
                      onClick={() => setOpt('finish', opt)}
                      className={`px-2.5 py-1.5 rounded border ${
                        on
                          ? 'bg-ink text-paper border-ink'
                          : 'bg-paper text-ink-2 border-line hover:border-line-2'
                      }`}
                      style={{ fontSize: '12.5px', fontWeight: on ? 500 : 400 }}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Coins */}
            <div className="flex items-center gap-4">
              <span
                className="w-36 shrink-0 font-mono text-ink-2"
                style={{ fontSize: '12.5px', fontWeight: 500, letterSpacing: '0.02em' }}
              >
                COINS
              </span>
              <div className="flex flex-wrap gap-1.5">
                {cornerOptions.map((opt) => {
                  const on = selectedOpts.corners === opt;
                  return (
                    <button
                      key={opt}
                      onClick={() => setOpt('corners', opt)}
                      className={`px-2.5 py-1.5 rounded border ${
                        on
                          ? 'bg-ink text-paper border-ink'
                          : 'bg-paper text-ink-2 border-line hover:border-line-2'
                      }`}
                      style={{ fontSize: '12.5px', fontWeight: on ? 500 : 400 }}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quantite */}
            <div className="flex items-center gap-4">
              <span
                className="w-36 shrink-0 font-mono text-ink-2"
                style={{ fontSize: '12.5px', fontWeight: 500, letterSpacing: '0.02em' }}
              >
                QUANTITÉ
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="inline-flex items-center border border-line rounded-md overflow-hidden bg-paper">
                  <button
                    onClick={() => setQty(Math.max(1, qty - 100))}
                    className="px-3 py-1.5 hover:bg-bg"
                    aria-label="Diminuer"
                  >
                    <Minus className="w-3.5 h-3.5" strokeWidth={1.5} />
                  </button>
                  <input
                    type="number"
                    value={qty}
                    onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-[80px] text-center bg-paper text-ink font-mono border-0 focus:outline-none"
                    style={{ fontSize: '13px', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}
                  />
                  <button
                    onClick={() => setQty(qty + 100)}
                    className="px-3 py-1.5 hover:bg-bg"
                    aria-label="Augmenter"
                  >
                    <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
                  </button>
                </div>
                {quantityPresets.map((n) => (
                  <button
                    key={n}
                    onClick={() => setQty(n)}
                    className={`font-mono px-2 py-1 rounded border ${
                      qty === n
                        ? 'border-ink text-ink'
                        : 'border-line text-ink-muted hover:text-ink hover:border-line-2'
                    }`}
                    style={{ fontSize: '11px', fontWeight: 500 }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Zone Prix : Clariprint calcule ou placeholder avec bouton 'Calculer' */}
          {hasCalcd ? (
            <div className="rounded-lg bg-ink text-paper overflow-hidden">
              <div className="flex items-baseline gap-3.5 px-4.5 py-4">
                <div
                  className="font-mono tabular-nums"
                  style={{ fontSize: '26px', fontWeight: 500, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}
                >
                  {priceTTC.toFixed(0)}€
                </div>
                <div style={{ fontSize: '12.5px', color: '#B5B5BC', fontWeight: 400 }}>
                  TTC · {qty} ex. · {activePriceHT.toFixed(2)}€ HT
                </div>
                <div
                  className="ml-auto font-mono"
                  style={{ fontSize: '12.5px', color: '#B5B5BC', fontWeight: 400 }}
                >
                  {quote?.delais ? `Livraison ${quote.delais} j` : 'Livraison 72 h'}
                </div>
              </div>
              {(quote?.fournisseur || priceStale) && (
                <div
                  className="flex items-center justify-between px-4.5 py-2 border-t"
                  style={{ borderColor: 'rgba(255,255,255,0.1)' }}
                >
                  {quote?.fournisseur && (
                    <span
                      className="font-mono inline-flex items-center gap-1.5"
                      style={{ fontSize: '11px', color: '#B5B5BC', fontWeight: 400, letterSpacing: '0.02em' }}
                    >
                      <CheckCircle className="w-3 h-3" strokeWidth={1.5} />
                      Clariprint · {quote.fournisseur}
                    </span>
                  )}
                  {priceStale && (
                    <button
                      onClick={calculatePrice}
                      disabled={calcLoading}
                      className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-warn-bg text-warn-fg hover:brightness-105 disabled:opacity-50"
                      style={{ fontSize: '11.5px', fontWeight: 500 }}
                    >
                      {calcLoading ? (
                        <Loader2 className="w-3 h-3 animate-spin" strokeWidth={1.5} />
                      ) : (
                        <RefreshCw className="w-3 h-3" strokeWidth={1.5} />
                      )}
                      Recalculer le prix
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-lg border-2 border-dashed border-line-2 bg-bg p-4.5 flex items-center gap-3">
              <div
                className="grid place-items-center w-10 h-10 rounded-full bg-paper border border-line"
              >
                <Calculator className="w-4 h-4 text-ink" strokeWidth={1.5} />
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className="text-ink"
                  style={{ fontSize: '14px', fontWeight: 500, letterSpacing: '-0.005em' }}
                >
                  Prix réel Clariprint à calculer
                </div>
                <div
                  className="text-ink-muted mt-0.5"
                  style={{ fontSize: '12.5px', fontWeight: 400 }}
                >
                  Ajustez la quantité, les options, puis lancez le calcul.
                </div>
                {quote && !quote.success && (
                  <div
                    className="mt-1.5 inline-flex items-center gap-1.5 text-err-fg"
                    style={{ fontSize: '12px', fontWeight: 400 }}
                  >
                    <AlertTriangle className="w-3 h-3" strokeWidth={1.5} />
                    {quote.message || quote.error || 'Erreur Clariprint, réessayez.'}
                  </div>
                )}
              </div>
              <button
                onClick={calculatePrice}
                disabled={calcLoading}
                className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-ink text-paper hover:bg-black disabled:opacity-50"
                style={{ fontSize: '13px', fontWeight: 500 }}
              >
                {calcLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />
                ) : (
                  <Calculator className="w-3.5 h-3.5" strokeWidth={1.5} />
                )}
                Calculer le prix
              </button>
            </div>
          )}

          <button
            onClick={() => {
              // S-FIX-PANIER-11/05 (bug #5 Arnaud) : `qty` est la quantite
              // d'exemplaires (500 cartes, 1000 flyers…), pas le nombre de
              // packs. Le `price_ht` est forfaitaire pour cette quantite.
              // → on passe `qty=1` (= 1 pack) au panier, en stockant la qty
              // d'ex dans `product.config.quantity` pour affichage / commande.
              // Cela evite la multiplication `price * qtyEx` qui faisait
              // exploser le total (35 € × 500 ex = 17 500 € au lieu de 35 €).
              const baseConfig = { ...(product.config ?? {}), quantity: qty };
              const productWithPrice = hasCalcd
                ? { ...product, price_ht: activePriceHT, config: { ...baseConfig, clariprintQuote: quote } }
                : { ...product, price_ht: activePriceHT, config: { ...baseConfig, priceSource: 'prix_marche' } };
              onAddToCart(productWithPrice, 1, selectedOpts);
            }}
            disabled={calcLoading}
            className="py-3.5 px-5 rounded-lg bg-brand text-brand-ink hover:bg-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ fontSize: '14.5px', fontWeight: 500, fontFamily: 'var(--font-ui)' }}
          >
            {calcLoading
              ? 'Calcul en cours…'
              : hasCalcd
                ? `Ajouter au panier · ${qty} ex.`
                : `Ajouter au panier · ${qty} ex. · Prix marché`}
          </button>
          {isMarketPrice && !calcLoading && (
            <p className="mt-2 text-xs text-orange-700 italic">
              ⚠️ Prix marché (estimation Magrit). Le prix réel Clariprint sera confirmé à la validation de la commande par l&apos;imprimeur.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
