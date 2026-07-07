import { Printer, Truck, Sparkles, ArrowRight, ShoppingCart } from 'lucide-react';
import type { Shop, ShopProduct } from '../../../contexts/ShopsContext';
import type { PortalView, CartLine } from './types';
import { resolveProductImage } from '../../../utils/productImages';
import type { Gamme, ProductDefinition } from '../../../utils/productEnrichment';
import { ProductMockup } from '../../brand/ProductMockup';
import { useTenant } from '../../../contexts/TenantContext';
import { applyTax, getTaxRate } from '../../../utils/tax';
// S2.15 (FR-ECOM-05) — Bloc Nouveautes : derniers produits integres, reutilise
// la ShopProductCard enrichie (badges/puces S2.11-13).
import { resolveNewProducts, summarizeCartResume } from '../../../utils/shopHomeSections';
import { ShopProductCard } from '../ShopProductCard';
import { TEST_IDS } from '../../../lib/testIds';

interface Props {
  shop: Shop;
  products: ShopProduct[];
  onView: (v: PortalView) => void;
  onSelectProduct: (p: ShopProduct) => void;
  onReorder: (p: ShopProduct) => void;
  pimGammes?: Gamme[];
  pimDefinitions?: ProductDefinition[];
  /** S2.16 — panier en cours (état local PublicShop) pour le bloc reprise. */
  cart?: CartLine[];
}

// F1 — Home portail B2B
// Design source : .design-handoff/designs/05 - Portail B2B.html  (section .f1)
export function PortalHome({
  shop,
  products,
  onView,
  onSelectProduct,
  onReorder,
  pimGammes,
  pimDefinitions,
  cart,
}: Props) {
  const { currentTenant } = useTenant();
  const taxRate = getTaxRate(currentTenant);

  // S2.16 — Panier en cours : reprise en un clic. Se replie si panier vide (AC3).
  const cartResume = summarizeCartResume(cart);
  // Raccourcis B2B — on n'affiche que des actions implémentées (pas de
  // "Templates brandés" tant que la section n'est pas câblée).
  const shortcuts = [
    {
      icon: Printer,
      title: 'Réimprimer une commande',
      desc: 'Reprenez vos derniers produits en un clic',
      onClick: () => onView('orders'),
    },
    {
      icon: Truck,
      title: 'Commande multi-sites',
      desc: 'Livrer sur plusieurs adresses simultanément',
      onClick: () => onView('cart'),
    },
    {
      icon: Sparkles,
      title: 'Devis sur mesure',
      desc: 'Chat direct avec un chef de projet Magrit',
      onClick: () => onView('catalog'),
    },
  ];

  // 3 produits « recents » affiches comme re-order (mock : les 3 premiers
  // du catalogue pour l'instant, sera remplace par shop_orders reels)
  const recentOrders = products.slice(0, 3);

  // S2.15 — Nouveautés : 4 derniers produits intégrés (created_at desc).
  const newProducts = resolveNewProducts(products, 4);

  const userName = 'Léa'; // mock : sera tiré du compte utilisateur connecté au portail

  return (
    <div style={{ fontFamily: 'var(--font-ui)' }}>
      {/* Hero contextualise */}
      <div
        className="px-9 py-9 bg-paper border-b border-line"
        style={{
          background: 'linear-gradient(180deg, #FFF 0%, var(--bg) 100%)',
        }}
      >
        <div
          className="font-mono uppercase text-ink-mute-2 mb-2.5"
          style={{ fontSize: '11px', letterSpacing: '0.08em', fontWeight: 500 }}
        >
          Bonjour {userName} · {shop.name}
        </div>
        <h2
          className="text-ink-2 m-0 mb-2 max-w-[720px]"
          style={{
            fontSize: '32px',
            fontWeight: 300,
            letterSpacing: '-0.025em',
            lineHeight: 1.15,
          }}
        >
          Vous avez{' '}
          <span className="text-ink" style={{ fontWeight: 500 }}>
            {products.length} template{products.length > 1 ? 's' : ''} brandé{products.length > 1 ? 's' : ''}
          </span>{' '}
          pré-validés par votre service Achats. Commandez en un clic.
        </h2>
        <p
          className="text-ink-muted m-0 max-w-[620px]"
          style={{ fontSize: '14.5px', fontWeight: 400, lineHeight: 1.55 }}
        >
          Prix négociés contractuellement, circuit de validation automatique, livraison
          moyenne 72&nbsp;h ouvrées sur les sites du Groupe.
        </p>
      </div>

      {/* Raccourcis — 3 actions implémentées */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-line border-b border-line">
        {shortcuts.map((s) => (
          <button
            key={s.title}
            onClick={s.onClick}
            className="bg-paper hover:bg-bg transition-colors text-left p-5 flex flex-col gap-2"
          >
            <div
              className="w-8 h-8 rounded-lg bg-bg grid place-items-center text-ink-muted"
              aria-hidden="true"
            >
              <s.icon className="w-4 h-4" strokeWidth={1.5} />
            </div>
            <h4
              className="text-ink m-0"
              style={{ fontSize: '14.5px', fontWeight: 500, letterSpacing: '-0.005em' }}
            >
              {s.title}
            </h4>
            <p
              className="text-ink-muted m-0"
              style={{ fontSize: '12.5px', fontWeight: 400, lineHeight: 1.45 }}
            >
              {s.desc}
            </p>
          </button>
        ))}
      </div>

      {/* S2.16 — Votre panier en cours : reprise en un clic. Data-driven, se
          replie si le panier est vide (AC3, symétrie avec Nouveautés). */}
      {cartResume && (
        <div className="px-9 pt-9 bg-bg" data-testid={TEST_IDS.shop.homeCartResume}>
          <section className="flex items-center gap-4 bg-paper border border-line rounded-xl px-5 py-4 max-w-[900px]">
            <div
              className="w-9 h-9 rounded-lg bg-bg grid place-items-center text-ink-muted shrink-0"
              aria-hidden="true"
            >
              <ShoppingCart className="w-4 h-4" strokeWidth={1.5} />
            </div>
            <div className="min-w-0">
              <h5
                className="text-ink m-0"
                style={{ fontSize: '14.5px', fontWeight: 500, letterSpacing: '-0.005em' }}
              >
                Votre panier en cours
              </h5>
              <p className="text-ink-muted m-0" style={{ fontSize: '12.5px', fontWeight: 400 }}>
                {cartResume.itemCount} article{cartResume.itemCount > 1 ? 's' : ''} ·{' '}
                <span className="font-mono text-ink" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {applyTax(cartResume.totalHT, taxRate).toFixed(2)}€
                </span>{' '}
                TTC
              </p>
            </div>
            <button
              data-testid={TEST_IDS.shop.homeCartResumeBtn}
              onClick={() => onView('cart')}
              className="ml-auto shrink-0 px-3.5 py-2 rounded-md bg-ink text-paper hover:bg-ink-2 inline-flex items-center gap-1.5"
              style={{ fontSize: '12.5px', fontWeight: 500 }}
            >
              Reprendre mon panier
              <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>
          </section>
        </div>
      )}

      {/* S2.15 — Nouveautés : derniers produits intégrés. Se replie si aucun
          produit (data-driven, pas de section vide béante). Réutilise la
          ShopProductCard enrichie (repère famille + badge Nouveau + puces). */}
      {newProducts.length > 0 && (
        <div className="px-9 pt-9 bg-bg" data-testid={TEST_IDS.shop.homeNewProducts}>
          <div className="flex items-baseline mb-4 max-w-[900px]">
            <h5
              className="text-ink m-0"
              style={{ fontSize: '14.5px', fontWeight: 500, letterSpacing: '-0.005em' }}
            >
              Nouveautés
            </h5>
            <button
              onClick={() => onView('catalog')}
              className="ml-auto text-ink-muted hover:text-ink inline-flex items-center gap-1"
              style={{ fontSize: '12.5px', fontWeight: 400 }}
            >
              Voir le catalogue <ArrowRight className="w-3 h-3" strokeWidth={1.5} />
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-[900px]">
            {newProducts.map((p) => (
              <ShopProductCard
                key={p.id}
                product={p}
                shop={shop}
                onConfigure={onSelectProduct}
                onAddToCart={onReorder}
                onCardClick={onSelectProduct}
                pimGammes={pimGammes}
              />
            ))}
          </div>
        </div>
      )}

      {/* Panel Commandes recentes — le panel "validations en cours" a ete
          retire tant que le workflow N+1 n'est pas branche au backend. */}
      <div className="p-9 bg-bg">
        <section className="bg-paper border border-line rounded-xl overflow-hidden max-w-[900px]">
          <div className="flex items-baseline px-5 py-4 border-b border-line">
            <h5
              className="text-ink m-0"
              style={{ fontSize: '14.5px', fontWeight: 500, letterSpacing: '-0.005em' }}
            >
              Commandes récentes
            </h5>
            <button
              onClick={() => onView('orders')}
              className="ml-auto text-ink-muted hover:text-ink inline-flex items-center gap-1"
              style={{ fontSize: '12.5px', fontWeight: 400 }}
            >
              Tout voir <ArrowRight className="w-3 h-3" strokeWidth={1.5} />
            </button>
          </div>
          <div className="flex flex-col">
            {recentOrders.length === 0 ? (
              <div className="px-5 py-8 text-ink-mute-2 text-center" style={{ fontSize: '13px' }}>
                Aucune commande pour l'instant.
              </div>
            ) : (
              recentOrders.map((p, i) => {
                const imgSrc = resolveProductImage({
                  name: p.name,
                  id: p.id,
                  image_url: p.image_url,
                  kind: (p.config as any)?.kind,
                  clariprintData: p.config,
                  gammes: pimGammes,
                  definitions: pimDefinitions,
                });
                return (
                  <div
                    key={p.id}
                    className={`grid grid-cols-[46px_1fr_auto_auto] gap-4 items-center px-5 py-3 ${
                      i < recentOrders.length - 1 ? 'border-b border-line' : ''
                    }`}
                  >
                    <div className="w-[46px] h-[46px] rounded-lg overflow-hidden bg-bg">
                      {imgSrc ? (
                        <img
                          src={imgSrc}
                          alt=""
                          className="w-full h-full object-contain"
                          loading="lazy"
                        />
                      ) : (
                        <ProductMockup
                          name={p.name}
                          kind={(p.config as any)?.kind}
                          category={p.category}
                          className="w-full h-full"
                        />
                      )}
                    </div>
                    <button
                      onClick={() => onSelectProduct(p)}
                      className="text-left min-w-0"
                    >
                      <p
                        className="text-ink m-0 truncate"
                        style={{ fontSize: '13.5px', fontWeight: 400 }}
                      >
                        {p.name}
                      </p>
                      <div
                        className="text-ink-muted font-mono"
                        style={{ fontSize: '11.5px', fontWeight: 400 }}
                      >
                        #CMD-{2480 + i} · livré il y a {i + 1} j
                      </div>
                    </button>
                    <div
                      className="font-mono text-ink"
                      style={{ fontSize: '13px', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}
                    >
                      {applyTax(p.price_ht, taxRate).toFixed(2)}€
                    </div>
                    <button
                      onClick={() => onReorder(p)}
                      className="px-3 py-1.5 rounded-md border border-line bg-paper text-ink-2 hover:bg-bg hover:text-ink"
                      style={{ fontSize: '12.5px', fontWeight: 500 }}
                    >
                      Réimprimer
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
