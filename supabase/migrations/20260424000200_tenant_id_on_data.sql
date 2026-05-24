-- =============================================================================
-- Migration 02 / v3 — Ajout de tenant_id sur toutes les tables data
-- -----------------------------------------------------------------------------
-- Toutes les tables existantes sont scopees user_id (RLS "auth.uid() = user_id").
-- Dans Beta 3, l'unite d'isolation devient le TENANT. On ajoute donc tenant_id
-- sur chaque table qui contient de la data metier, et on re-plombera la RLS
-- dans la migration 04.
--
-- Les tables concernees :
--   * conversations
--   * user_preferences           → pas de tenant_id : reste par user
--   * clients                    ← tenant_id
--   * libraries                  ← tenant_id
--   * product_library            ← tenant_id (table legacy, cf libraries)
--   * shops                      ← tenant_id
--   * shop_products              ← tenant_id (herite via shops, mais denormalise pour perf RLS)
--   * quotes                     ← tenant_id
--   * quote_templates            ← tenant_id
--   * product_gammes             → reste GLOBAL (patrimoine Magrit, partage)
--   * product_definitions        → reste GLOBAL (idem)
--
-- Strategie de migration :
--   * colonne tenant_id nullable dans un premier temps
--   * pas de backfill automatique ici : on cree le tenant "magrit-root" dans
--     la migration 05 et toutes les lignes existantes (il ne devrait pas y
--     en avoir sur un projet neuf) seraient a assigner manuellement
--   * NOT NULL est applique dans la migration 04, une fois le backfill fait
-- =============================================================================

-- ─── conversations ─────────────────────────────────────────────────────────
alter table if exists public.conversations
  add column if not exists tenant_id uuid references public.tenants(id) on delete cascade;
create index if not exists conversations_tenant_idx on public.conversations(tenant_id);

-- ─── clients (CRM clients de l'imprimeur) ──────────────────────────────────
alter table if exists public.clients
  add column if not exists tenant_id uuid references public.tenants(id) on delete cascade;
create index if not exists clients_tenant_idx on public.clients(tenant_id);

-- ─── libraries ─────────────────────────────────────────────────────────────
alter table if exists public.libraries
  add column if not exists tenant_id uuid references public.tenants(id) on delete cascade;
create index if not exists libraries_tenant_idx on public.libraries(tenant_id);

-- ─── product_library (legacy, library_items) ───────────────────────────────
alter table if exists public.product_library
  add column if not exists tenant_id uuid references public.tenants(id) on delete cascade;
create index if not exists product_library_tenant_idx on public.product_library(tenant_id);

-- ─── shops ─────────────────────────────────────────────────────────────────
alter table if exists public.shops
  add column if not exists tenant_id uuid references public.tenants(id) on delete cascade;
create index if not exists shops_tenant_idx on public.shops(tenant_id);

-- ─── shop_products ─────────────────────────────────────────────────────────
-- Denormalise : on duplique tenant_id sur shop_products pour simplifier la RLS
-- (sinon il faut un join via shops a chaque requete = penible). Contrainte
-- applicative : toujours setter tenant_id = shops.tenant_id a l'insert.
alter table if exists public.shop_products
  add column if not exists tenant_id uuid references public.tenants(id) on delete cascade;
create index if not exists shop_products_tenant_idx on public.shop_products(tenant_id);

-- ─── quotes ────────────────────────────────────────────────────────────────
alter table if exists public.quotes
  add column if not exists tenant_id uuid references public.tenants(id) on delete cascade;
create index if not exists quotes_tenant_idx on public.quotes(tenant_id);

-- ─── quote_templates ───────────────────────────────────────────────────────
alter table if exists public.quote_templates
  add column if not exists tenant_id uuid references public.tenants(id) on delete cascade;
create index if not exists quote_templates_tenant_idx on public.quote_templates(tenant_id);

-- ─── user_preferences ──────────────────────────────────────────────────────
-- On ajoute last_tenant_id : dernier tenant actif pour l'user, utilise pour
-- restaurer le contexte apres login (la route /t/:slug prevaut, mais si
-- l'user arrive sur / alors on redir vers son dernier tenant).
alter table if exists public.user_preferences
  add column if not exists last_tenant_id uuid references public.tenants(id) on delete set null;

-- =============================================================================
-- ─── Note sur product_gammes / product_definitions ─────────────────────────
-- =============================================================================
-- Ces tables restent GLOBALES (patrimoine Magrit). Aucune colonne tenant_id
-- n'est ajoutee. L'isolation par tenant se fait via la table
-- `tenant_gamme_subscriptions` (migration 03) qui liste les gammes qu'un
-- tenant a souscrites. Les queries cote app filtrent product_definitions
-- par gamme souscrite.
-- =============================================================================
