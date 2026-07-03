-- ─────────────────────────────────────────────────────────────────────────
-- Story S-QUOTES-1 — Bibliotheque de devis editables (schema + RLS)
-- ─────────────────────────────────────────────────────────────────────────
-- Fait evoluer le modele devis de "1 devis = 1 produit a plat" vers un modele
-- multi-lignes editables :
--   1. quotes            — ALTER : ajout client_name (nom client persiste) +
--                          updated_at (trigger), CHECK statut retro-compatible
--   2. quote_lines       — NOUVELLE table : N lignes par devis (produit,
--                          quantite, cout HT, prix vente HT, marge %, position)
--   3. Migration compat  — chaque devis existant devient 1 quote_line
--   4. RLS override admin — calque sur tenant_orders (20260509000100) :
--                          l'auteur edite ses devis, l'admin/owner tenant voit
--                          et edite tous les devis du tenant, superadmin bypass
--
-- ⚠️ La table clients a ete droppee au Sprint 10 (20260602000100). On ne la
-- reintroduit pas : client_name est un simple champ texte. La FK orpheline
-- quotes.client_id (deja on delete set null) n'est pas touchee.
--
-- Statuts : on reste en `text` + CHECK large (PAS de type Postgres qui
-- casserait les valeurs legacy won/lost/sent/pending et les KPIs
-- DashboardQuotes). Mapping d'affichage 3 statuts cote UI :
--   en cours = draft/sent/pending · valide = validated(+won) · rejete = rejected(+lost)
--
-- RLS tests vitest associes : tests/rls/quotes_lines_isolation.test.ts
-- (calque sur orders_isolation.test.ts).
-- ─────────────────────────────────────────────────────────────────────────

-- ─── 1. Evolution de la table quotes ─────────────────────────────────────
alter table public.quotes add column if not exists client_name text;
alter table public.quotes add column if not exists updated_at  timestamptz not null default now();

-- Statut : CHECK retro-compatible (legacy + nouveaux validated/rejected)
alter table public.quotes drop constraint if exists quotes_status_check;
alter table public.quotes add constraint quotes_status_check
  check (status in ('draft','sent','won','lost','pending','validated','rejected'));

-- ─── 2. Table quote_lines ────────────────────────────────────────────────
create table if not exists public.quote_lines (
  id             uuid primary key default gen_random_uuid(),
  quote_id       uuid not null references public.quotes(id) on delete cascade,
  product_name   text not null,
  product_config jsonb,                                        -- snapshot produit (Clariprint/library/market)
  quantity       integer not null default 1 check (quantity > 0),
  unit_cost_ht   numeric(12,2) not null default 0,             -- cout Clariprint (base marge)
  unit_price_ht  numeric(12,2) not null default 0,             -- prix de vente unitaire HT
  margin_pct     numeric(6,2)  not null default 0,             -- marge % derivee (snapshot audit)
  line_total_ht  numeric(12,2) not null default 0,             -- quantity * unit_price_ht (denormalise)
  position       integer not null default 0,
  created_at     timestamptz not null default now()
);
create index if not exists quote_lines_quote_id_idx on public.quote_lines(quote_id, position);

-- ─── 3. Migration data compat (devis existants 1-produit -> 1 quote_line) ─
-- Idempotent via `where not exists`. Les N devis dupliques historiques
-- (paniers imprimes avant, 1 devis/item) restent eclates : chacun devient 1
-- ligne, pas de refusion retroactive.
insert into public.quote_lines
  (quote_id, product_name, product_config, quantity, unit_cost_ht, unit_price_ht, margin_pct, line_total_ht, position, created_at)
select
  q.id,
  q.product_name,
  q.product_config,
  greatest(coalesce((q.product_config->>'quantity')::int, 1), 1),
  0,                              -- cout inconnu retroactivement
  -- prix vente UNITAIRE = forfait historique / quantite (modele lineaire
  -- editable : quantite * prix = total). Sans la division, editer la quantite
  -- ferait exploser le total (qte * forfait).
  round(coalesce(q.total_ht, 0) / greatest(coalesce((q.product_config->>'quantity')::int, 1), 1), 2),
  0,                              -- marge inconnue (cout 0)
  coalesce(q.total_ht, 0),        -- line_total = forfait historique (exact)
  0,
  q.created_at
from public.quotes q
where not exists (select 1 from public.quote_lines ql where ql.quote_id = q.id);

-- ─── 4. RLS : override admin sur quotes (calque tenant_orders) ────────────
alter table public.quotes enable row level security;

-- Remplace quotes_select/quotes_write (20260424000400) trop permissifs en write
-- ⚠️ "own quotes all" : policy FOR ALL heritee de la 1re migration
-- (20260418000003), jamais droppee par 20260424000400. Permissive + OR'd, elle
-- ouvrirait un INSERT cross-tenant (user_id=soi, tenant_id d'un autre) qui
-- contournerait l'isolation. On la supprime ici.
drop policy if exists "own quotes all" on public.quotes;
drop policy if exists "quotes_select" on public.quotes;
drop policy if exists "quotes_write"  on public.quotes;
drop policy if exists "quotes_insert" on public.quotes;
drop policy if exists "quotes_update" on public.quotes;
drop policy if exists "quotes_delete" on public.quotes;

-- SELECT : tenant-scoped + superadmin (le cloisonnement "les miens vs tous" est
-- applicatif : owner voit les siens, admin bascule sur tous via QuotesContext.scope)
create policy "quotes_select" on public.quotes for select using (
  public.is_super_admin()
  or (tenant_id in (select public.current_user_tenant_ids()))
);

-- INSERT : auteur uniquement, dans un tenant accessible
create policy "quotes_insert" on public.quotes for insert with check (
  user_id = auth.uid()
  and (tenant_id in (select public.current_user_tenant_ids()))
);

-- UPDATE : auteur (quel que soit le statut — un devis reste un brouillon
-- commercial modifiable) OU admin/owner tenant OU superadmin
create policy "quotes_update" on public.quotes for update using (
  (user_id = auth.uid() and tenant_id in (select public.current_user_tenant_ids()))
  or public.user_role_in_tenant(tenant_id) in ('owner', 'admin')
  or public.is_super_admin()
);

-- DELETE : auteur OU admin/owner tenant OU superadmin
create policy "quotes_delete" on public.quotes for delete using (
  (user_id = auth.uid() and tenant_id in (select public.current_user_tenant_ids()))
  or public.user_role_in_tenant(tenant_id) in ('owner', 'admin')
  or public.is_super_admin()
);

-- ─── 5. RLS : quote_lines heritent de l'acces au quote parent ────────────
alter table public.quote_lines enable row level security;

drop policy if exists quote_lines_select on public.quote_lines;
drop policy if exists quote_lines_write  on public.quote_lines;

create policy quote_lines_select on public.quote_lines for select using (
  exists (
    select 1 from public.quotes q
    where q.id = quote_id
      and (q.tenant_id in (select public.current_user_tenant_ids()) or public.is_super_admin())
  )
);

-- Ecriture (insert/update/delete) : memes droits que l'update du quote parent
create policy quote_lines_write on public.quote_lines for all using (
  exists (
    select 1 from public.quotes q
    where q.id = quote_id
      and ((q.user_id = auth.uid() and q.tenant_id in (select public.current_user_tenant_ids()))
        or public.user_role_in_tenant(q.tenant_id) in ('owner', 'admin')
        or public.is_super_admin())
  )
) with check (
  exists (
    select 1 from public.quotes q
    where q.id = quote_id
      and ((q.user_id = auth.uid() and q.tenant_id in (select public.current_user_tenant_ids()))
        or public.user_role_in_tenant(q.tenant_id) in ('owner', 'admin')
        or public.is_super_admin())
  )
);

-- ─── 6. Trigger updated_at sur quotes ────────────────────────────────────
create or replace function public.set_quote_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_quotes_updated_at on public.quotes;
create trigger trg_quotes_updated_at
  before update on public.quotes
  for each row execute function public.set_quote_updated_at();
