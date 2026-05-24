-- =============================================================================
-- Migration : tenant_order_items.product_id nullable (Story P0.11)
-- Date      : 2026-05-18
-- Rationale : la contrainte product_id NOT NULL etablie par S1.4
--             (migration 20260509_01_e1_orders_v1_1.sql:71) etait trop stricte.
--             Les produits library (legacy v3 prefixe `lib-...`) ne sont pas
--             des UUID valides et ne peuvent pas etre referencees. Le code
--             applicatif S-MIGRATION-ORDERS reproduit le pattern shop_orders
--             ou ces items ont source_id text + product_id null.
--             Sans assouplissement, submitCart() bloque sur panier mixte
--             (erreur Supabase signalee par Arnaud 2026-05-18 test E2E).
--
-- Tracabilite produit : conservee pour les vrais produits (UUID reference).
-- Pour items library, snapshot product_label + clariprint_options JSONB
-- suffisent (MVP). Migration future S-FIX-LIBRARY-UUID possible pour
-- normaliser product_library en UUID strict V2+.
-- =============================================================================

alter table public.tenant_order_items
  alter column product_id drop not null;

-- ─── Smoke check (a executer post-application) ──────────────────────────────
-- select column_name, is_nullable from information_schema.columns
--   where table_name = 'tenant_order_items' and column_name = 'product_id';
-- Attendu : is_nullable = YES
