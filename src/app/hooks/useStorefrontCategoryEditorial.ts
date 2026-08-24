import { useEffect, useState } from 'react';
import type { ShopProduct } from '../../modules/shops';
import type { TaxonomyFamily } from '../utils/shopTaxonomy';
import { categoryEditorialCacheKey, type CategoryEditorial } from '../utils/catalogLanding';
import { useStorefrontDiagnosticsApi } from '../contexts/StorefrontModuleClientsContext';

const TIMEOUT_MS = 12_000;

export function useStorefrontCategoryEditorial(
  shopSlug: string,
  family: TaxonomyFamily | null,
  products: ShopProduct[],
) {
  const api = useStorefrontDiagnosticsApi();
  const [editorial, setEditorial] = useState<CategoryEditorial | null>(null);

  useEffect(() => {
    if (!family) {
      setEditorial(null);
      return;
    }
    let cancelled = false;
    const cacheKey = categoryEditorialCacheKey(family.key);
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        setEditorial(JSON.parse(cached));
        return;
      }
    } catch {
      // sessionStorage indisponible : le socle déterministe reste utilisable.
    }
    setEditorial(null);
    const request = api.storefrontCategoryEditorial(shopSlug, {
      familyName: family.label,
      subcategories: family.subcategories.filter((item) => item.count > 0).map((item) => item.label),
      sampleProducts: products.slice(0, 8).map((product) => product.name),
    });
    const timeout = new Promise<never>((_, reject) => {
      window.setTimeout(() => reject(new Error('category_editorial_timeout')), TIMEOUT_MS);
    });
    void Promise.race([request, timeout]).then((data) => {
      if (cancelled) return;
      const next = data.editorial as CategoryEditorial;
      setEditorial(next);
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify(next));
      } catch {
        // Cache best-effort.
      }
    }).catch(() => {
      if (!cancelled) setEditorial(null);
    });
    return () => { cancelled = true; };
  }, [api, family, products, shopSlug]);

  return editorial;
}
