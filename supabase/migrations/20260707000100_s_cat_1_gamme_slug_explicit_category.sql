-- S-CAT-1 (ADR-4.17, décision Arnaud 2026-07-07)
-- Catégorie explicite AUTORITAIRE : chaque produit porte une gamme_slug (FK
-- product_gammes.slug) qui prime sur la résolution par format/taille partout
-- (badge carte, méga-menu, pilules, filtres, fiche). Le format ne détermine
-- plus la catégorie.
--
-- Nullable : les produits non catégorisés retombent sur la résolution par
-- règles (resolveProductGamme -> resolveGamme) tant que gamme_slug est NULL.
-- Le peuplement initial (seed par inférence nom) est un one-shot séparé (S-CAT-3).
--
-- FK ON DELETE SET NULL : supprimer une gamme ne casse pas les produits (ils
-- retombent sur la résolution par règles).

-- product_library (catalogue tenant, source des produits boutique liés)
ALTER TABLE public.product_library
  ADD COLUMN IF NOT EXISTS gamme_slug text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'product_library_gamme_slug_fkey'
      AND table_name = 'product_library'
  ) THEN
    ALTER TABLE public.product_library
      ADD CONSTRAINT product_library_gamme_slug_fkey
      FOREIGN KEY (gamme_slug) REFERENCES public.product_gammes(slug) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_product_library_gamme_slug
  ON public.product_library(gamme_slug);

-- shop_products (produits manuels attachés directement à une boutique)
ALTER TABLE public.shop_products
  ADD COLUMN IF NOT EXISTS gamme_slug text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'shop_products_gamme_slug_fkey'
      AND table_name = 'shop_products'
  ) THEN
    ALTER TABLE public.shop_products
      ADD CONSTRAINT shop_products_gamme_slug_fkey
      FOREIGN KEY (gamme_slug) REFERENCES public.product_gammes(slug) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_shop_products_gamme_slug
  ON public.shop_products(gamme_slug);

COMMENT ON COLUMN public.product_library.gamme_slug IS
  'ADR-4.17 : categorie explicite autoritaire (FK product_gammes.slug). Prime sur la resolution par format. NULL = repli regles.';
COMMENT ON COLUMN public.shop_products.gamme_slug IS
  'ADR-4.17 : categorie explicite autoritaire (FK product_gammes.slug). Prime sur la resolution par format. NULL = repli regles.';
