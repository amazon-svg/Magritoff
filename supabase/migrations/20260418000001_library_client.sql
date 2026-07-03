-- Ajoute la notion de client à la bibliothèque de produits.
-- À exécuter après 20260418_shop_module.sql.

alter table public.product_library
  add column if not exists client_id uuid references public.clients(id) on delete set null;

create index if not exists product_library_client_id_idx on public.product_library(client_id);
