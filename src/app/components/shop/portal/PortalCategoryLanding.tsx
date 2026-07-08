import type { ShopProduct } from '../../../contexts/ShopsContext';
import type { Gamme, ProductDefinition } from '../../../utils/productEnrichment';
import type { CategoryLandingModel } from '../../../utils/catalogLanding';
import { resolveProductImage } from '../../../utils/productImages';
import { TEST_IDS } from '../../../lib/testIds';

interface Props {
  model: CategoryLandingModel;
  /** Repère couleur de la famille (badge / accent). */
  tone: string;
  /** Clic tuile sous-catégorie → filtre le catalogue (réutilise selectGammes). */
  onSelectSubcategory: (gammeSlugs: string[]) => void;
  onSelectProduct: (p: ShopProduct) => void;
  pimGammes?: Gamme[];
  pimDefinitions?: ProductDefinition[];
}

/**
 * S2.20 — En-tête éditorialisé d'une famille (Epic 2, FR-ECOM-10).
 * Rendu au-dessus de la grille quand une seule famille est active. Contenu
 * (titre + intro) auto-généré par LLM avec socle déterministe (jamais vide).
 */
export function PortalCategoryLanding({
  model,
  tone,
  onSelectSubcategory,
  onSelectProduct,
  pimGammes,
  pimDefinitions,
}: Props) {
  const imageFor = (p: ShopProduct): string =>
    resolveProductImage({
      name: p.name,
      id: p.id,
      image_url: p.image_url,
      clariprintData: (p.config as any)?.clariprintData ?? p.config,
      kind: (p.config as any)?.kind,
      category: p.category,
      gamme_slug: p.gamme_slug,
      gammes: pimGammes,
      definitions: pimDefinitions,
    });

  return (
    <section
      data-testid={TEST_IDS.shop.catalogLanding}
      className="px-12 pt-9 pb-7 bg-paper border-b border-line"
      style={{ fontFamily: 'var(--font-ui)' }}
    >
      {/* Titre + intro éditoriaux */}
      <div className="flex items-center gap-2.5 mb-3">
        <span
          className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: tone }}
          aria-hidden="true"
        />
        <h2
          className="text-ink m-0"
          style={{ fontSize: '26px', fontWeight: 400, letterSpacing: '-0.02em' }}
        >
          {model.title}
        </h2>
      </div>
      <p
        className="text-ink-2 m-0 max-w-[720px]"
        style={{ fontSize: '14.5px', lineHeight: 1.5 }}
      >
        {model.intro}
      </p>

      {/* Tuiles sous-catégories (masquées si aucune enfant avec produits) */}
      {model.subcategories.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-5">
          {model.subcategories.map((s) => (
            <button
              key={s.key}
              data-testid={TEST_IDS.shop.catalogLandingSubcat}
              onClick={() => onSelectSubcategory(s.gammeSlugs)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-bg border border-line hover:border-line-2 hover:bg-paper"
              style={{ fontSize: '13px', fontWeight: 400 }}
            >
              <span className="text-ink">{s.label}</span>
              <span className="font-mono text-ink-mute-2" style={{ fontSize: '11px' }}>
                {s.count}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Best-sellers mis en avant */}
      {model.bestSellers.length > 0 && (
        <div className="mt-7">
          <div
            className="font-mono uppercase text-ink-muted mb-3"
            style={{ fontSize: '10.5px', letterSpacing: '0.06em', fontWeight: 500 }}
          >
            Les plus demandés
          </div>
          <div className="flex flex-wrap gap-3">
            {model.bestSellers.map((p) => (
              <button
                key={p.id}
                data-testid={TEST_IDS.shop.catalogLandingBestseller}
                onClick={() => onSelectProduct(p)}
                className="group flex items-center gap-3 w-[260px] p-2.5 rounded-xl bg-bg border border-line hover:border-line-2 hover:bg-paper text-left"
              >
                <img
                  src={imageFor(p)}
                  alt=""
                  className="w-12 h-12 rounded-lg object-cover shrink-0 bg-paper"
                  loading="lazy"
                />
                <span className="flex-1 min-w-0">
                  <span className="block text-ink truncate" style={{ fontSize: '13px', fontWeight: 500 }}>
                    {p.name}
                  </span>
                  {p.description && (
                    <span className="block text-ink-mute-2 truncate" style={{ fontSize: '11.5px' }}>
                      {p.description}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
