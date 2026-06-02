-- Sprint 10 Phase B users — suppression du mini-CRM clients legacy
--
-- Décision Arnaud 2026-06-02 : « un utilisateur est soit un utilisateur
-- Magrit soit invité dans une boutique » → on consolide la gestion des
-- utilisateurs via tenant_members + tenant_role_definitions (Phase A
-- livrée Sprint 5) et on supprime entièrement la table `clients`
-- (mini-CRM company/contact/email/phone/address/notes) qui faisait
-- doublon conceptuel.
--
-- Audit prod B5 préalable (2026-06-02) :
--   - clients          : 1 row (seed test)
--   - libraries        : 0 rows avec client_id NOT NULL
--   - shops            : 1 row avec client_id NOT NULL (seed test)
--   - shop_products    : 0 rows avec client_id NOT NULL
--   - product_library  : non audité, considéré marginal idem
-- Impact data : minimal, suppression sans migration de données.

BEGIN;

-- 1. Suppression des FK qui pointent vers clients (dans toutes les tables)

ALTER TABLE IF EXISTS public.libraries
  DROP CONSTRAINT IF EXISTS libraries_client_id_fkey;

ALTER TABLE IF EXISTS public.shops
  DROP CONSTRAINT IF EXISTS shops_client_id_fkey;

ALTER TABLE IF EXISTS public.shop_products
  DROP CONSTRAINT IF EXISTS shop_products_client_id_fkey;

ALTER TABLE IF EXISTS public.product_library
  DROP CONSTRAINT IF EXISTS product_library_client_id_fkey;

ALTER TABLE IF EXISTS public.orders
  DROP CONSTRAINT IF EXISTS orders_client_id_fkey;

-- 2. Suppression des colonnes client_id (cascade ON DELETE déjà géré par FK)

ALTER TABLE IF EXISTS public.libraries DROP COLUMN IF EXISTS client_id;
ALTER TABLE IF EXISTS public.shops DROP COLUMN IF EXISTS client_id;
ALTER TABLE IF EXISTS public.shop_products DROP COLUMN IF EXISTS client_id;
ALTER TABLE IF EXISTS public.product_library DROP COLUMN IF EXISTS client_id;
ALTER TABLE IF EXISTS public.orders DROP COLUMN IF EXISTS client_id;

-- 3. Drop de la table clients elle-même

DROP TABLE IF EXISTS public.clients CASCADE;

COMMIT;
