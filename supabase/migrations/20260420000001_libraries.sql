-- Magrit : introduction des bibliothèques nommées (v2 du module biblio)
-- Chaque produit appartient à UNE bibliothèque. Les bibliothèques sont
-- contextualisées (client, thème, type de produit, etc.)

-- ─── Table libraries ─────────────────────────────────────────────────────────
create table if not exists public.libraries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  client_id   uuid references public.clients(id) on delete set null,
  name        text not null,
  description text default '',
  created_at  timestamptz not null default now()
);
create index if not exists libraries_user_id_idx on public.libraries(user_id);

alter table public.libraries enable row level security;
drop policy if exists "own libraries all" on public.libraries;
create policy "own libraries all" on public.libraries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── Column library_id sur product_library ───────────────────────────────────
alter table public.product_library
  add column if not exists library_id uuid references public.libraries(id) on delete cascade;
create index if not exists product_library_library_id_idx on public.product_library(library_id);

-- ─── Backfill : créer une bibliothèque par défaut et associer les produits ───

-- Pour chaque couple distinct (user_id, client_id) ayant des produits orphelins,
-- on crée une bibliothèque. Les produits sans client vont dans "Ma bibliothèque".
-- Les produits avec un client vont dans "Bibliothèque {company}".
insert into public.libraries (user_id, client_id, name, description)
select distinct pl.user_id,
       pl.client_id,
       case when pl.client_id is null then 'Ma bibliothèque' else 'Bibliothèque ' || c.company end,
       'Bibliothèque créée automatiquement lors de la migration'
from public.product_library pl
left join public.clients c on c.id = pl.client_id
where pl.library_id is null;

-- Associer les produits orphelins à la bibliothèque correspondante
update public.product_library pl
set library_id = l.id
from public.libraries l
where pl.library_id is null
  and pl.user_id = l.user_id
  and (
    pl.client_id = l.client_id
    or (pl.client_id is null and l.client_id is null)
  );
