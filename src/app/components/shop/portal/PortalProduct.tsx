import { useState } from 'react';
import { ChevronRight, Minus, Plus } from 'lucide-react';
import type { ShopProduct } from '../../../contexts/ShopsContext';
import { resolveProductImage } from '../../../utils/productImages';
import type { Gamme, ProductDefinition } from '../../../utils/productEnrichment';
import { ProductMockup } from '../../brand/ProductMockup';

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
  const [qty, setQty] = useState(500);
  const [selectedOpts, setSelectedOpts] = useState<Record<string, string>>({
    paper: '350g velours',
    finish: 'Soft touch',
    corners: 'Droits',
  });

  const quantityPresets = [100, 250, 500, 1000, 2500];
  const priceHT = product.price_ht * (qty / 500); // approx scale lineaire
  const priceTTC = priceHT * 1.2;

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
        <span className="text-ink-muted">{product.category}</span>
        <ChevronRight className="inline w-3 h-3 mx-1.5" strokeWidth={1.5} />
        <span className="text-ink" style={{ fontWeight: 500 }}>{product.name}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-10">
        {/* Visuel */}
        <div>
          <div className="aspect-[4/3] rounded-xl overflow-hidden border border-line relative">
            {imgSrc ? (
              <img src={imgSrc} alt={product.name} className="w-full h-full object-cover" />
            ) : (
              <ProductMockup
                name={product.name}
                kind={(product.config as any)?.kind}
                category={product.category}
                className="w-full h-full"
              />
            )}
          </div>

          {/* Thumbs placeholder — futures vues multiples */}
          <div className="flex gap-2 mt-3">
            {[true, false, false].map((active, i) => (
              <button
                key={i}
                className={`w-14 h-11 rounded border ${
                  active
                    ? 'border-brand ring-2 ring-brand/30'
                    : 'border-line'
                } bg-bg`}
                aria-label={`Vue ${i + 1}`}
              />
            ))}
          </div>
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

          {/* Total inversé */}
          <div
            className="flex items-baseline gap-3.5 px-4.5 py-4 rounded-lg bg-ink text-paper"
          >
            <div
              className="font-mono tabular-nums"
              style={{ fontSize: '26px', fontWeight: 500, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}
            >
              {priceTTC.toFixed(0)}€
            </div>
            <div style={{ fontSize: '12.5px', color: '#B5B5BC', fontWeight: 400 }}>
              TTC · {qty} ex. · {priceHT.toFixed(0)}€ HT
            </div>
            <div
              className="ml-auto font-mono"
              style={{ fontSize: '12.5px', color: '#B5B5BC', fontWeight: 400 }}
            >
              Livraison 72 h
            </div>
          </div>

          <button
            onClick={() => onAddToCart(product, qty, selectedOpts)}
            className="py-3.5 px-5 rounded-lg bg-brand text-brand-ink hover:bg-black transition-colors"
            style={{ fontSize: '14.5px', fontWeight: 500, fontFamily: 'var(--font-ui)' }}
          >
            Ajouter au panier · {qty} ex.
          </button>
        </div>
      </div>
    </div>
  );
}
