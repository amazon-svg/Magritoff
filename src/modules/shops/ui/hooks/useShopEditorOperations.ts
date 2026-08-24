import { useWorkspaceApi, useWorkspaceUiRuntime } from '@/platform/runtime/workspace-ui-runtime';
import { ShopsApiClient } from '@/modules/shops';
import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  ShopBrandAssetKind,
  ShopProduct,
  ShopProductDto,
  ShopPricingOverride,
} from '@/modules/shops';

const BRAND_ASSET_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const BRAND_ASSET_MAX_BYTES = 5_242_880;

export function toShopProduct(dto: ShopProductDto): ShopProduct {
  return {
    id: dto.id,
    shop_id: dto.shopId,
    product_id: dto.productId,
    name: dto.name,
    category: dto.category,
    description: dto.description,
    price_ht: dto.priceHt,
    image_url: dto.imageUrl,
    config: dto.config,
    display_order: dto.displayOrder,
    created_at: dto.createdAt,
    tenant_id: dto.tenantId,
    gamme_slug: dto.gammeSlug,
  };
}

export function indexShopPricing(
  overrides: ShopPricingOverride[],
): Record<string, number> {
  return Object.fromEntries(overrides.map((override) => [
    override.libraryProductId,
    Number(override.priceHtOverride),
  ]));
}

export function validateShopBrandAsset(file: File): string | null {
  if (!BRAND_ASSET_TYPES.has(file.type)) {
    return 'Format non supporté — PNG, JPG ou WebP attendu.';
  }
  if (file.size > BRAND_ASSET_MAX_BYTES) {
    return 'Fichier trop lourd — 5 Mo maximum.';
  }
  return null;
}

function operationError(cause: unknown, fallback: string): string {
  return cause instanceof Error && cause.message ? cause.message : fallback;
}

export function useShopEditorOperations({
  tenantId,
  shopId,
}: {
  tenantId: string | null;
  shopId: string | null;
}) {
  const shopsApi = useWorkspaceApi(ShopsApiClient);
  const requestVersion = useRef(0);
  const targetKey = `${tenantId ?? ''}:${shopId ?? ''}`;
  const targetKeyRef = useRef(targetKey);
  targetKeyRef.current = targetKey;

  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [pricingOverrides, setPricingOverrides] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(Boolean(tenantId && shopId));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [uploadingAsset, setUploadingAsset] = useState<ShopBrandAssetKind | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pricingError, setPricingError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const version = ++requestVersion.current;
    if (!tenantId || !shopId) {
      setProducts([]);
      setPricingOverrides({});
      setLoadError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);
    try {
      const [productDtos, overrides] = await Promise.all([
        shopsApi.products(tenantId, shopId),
        shopsApi.pricing(tenantId, shopId),
      ]);
      if (version !== requestVersion.current) return;
      setProducts(productDtos.map(toShopProduct));
      setPricingOverrides(indexShopPricing(overrides));
    } catch (cause) {
      if (version === requestVersion.current) {
        setLoadError(operationError(cause, 'Chargement des données boutique impossible.'));
      }
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [shopId, shopsApi, tenantId]);

  useEffect(() => {
    setProducts([]);
    setPricingOverrides({});
    setUploadError(null);
    setPricingError(null);
    void refresh();
    return () => {
      requestVersion.current += 1;
    };
  }, [refresh]);

  const uploadBrandAsset = async (
    kind: ShopBrandAssetKind,
    file: File,
  ): Promise<string | null> => {
    const validationError = validateShopBrandAsset(file);
    if (validationError) {
      setUploadError(validationError);
      return null;
    }
    if (!tenantId || !shopId) return null;

    const operationTarget = targetKey;
    setUploadError(null);
    setUploadingAsset(kind);
    try {
      const assetUrl = await shopsApi.uploadBrandAsset(tenantId, shopId, kind, file);
      return operationTarget === targetKeyRef.current ? assetUrl : null;
    } catch (cause) {
      if (operationTarget === targetKeyRef.current) {
        setUploadError(`Upload échoué : ${operationError(cause, 'erreur réseau')}.`);
      }
      return null;
    } finally {
      if (operationTarget === targetKeyRef.current) setUploadingAsset(null);
    }
  };

  const savePricingOverride = async (
    libraryProductId: string,
    nextValue: number | null,
  ): Promise<void> => {
    if (!tenantId || !shopId) return;
    const operationTarget = targetKey;
    const normalized = nextValue !== null && Number.isFinite(nextValue) && nextValue > 0
      ? nextValue
      : null;
    setPricingError(null);
    try {
      await shopsApi.setPricing(tenantId, shopId, libraryProductId, normalized);
      if (operationTarget !== targetKeyRef.current) return;
      setPricingOverrides((previous) => {
        if (normalized !== null) return { ...previous, [libraryProductId]: normalized };
        const next = { ...previous };
        delete next[libraryProductId];
        return next;
      });
    } catch (cause) {
      if (operationTarget === targetKeyRef.current) {
        setPricingError(operationError(cause, 'Enregistrement du prix négocié impossible.'));
      }
    }
  };

  const forgetProduct = (productId: string) => {
    setProducts((previous) => previous.filter((product) => product.id !== productId));
  };

  return {
    products,
    pricingOverrides,
    loading,
    loadError,
    uploadingAsset,
    uploadError,
    pricingError,
    refresh,
    uploadBrandAsset,
    savePricingOverride,
    forgetProduct,
  } as const;
}
