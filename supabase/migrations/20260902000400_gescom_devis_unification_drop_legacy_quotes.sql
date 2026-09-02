-- ============================================================================
-- Chantier post Sprint 5 — Unification des devis : retrait pur et simple du
-- systeme legacy `public.quotes`/`public.quote_lines`.
-- ----------------------------------------------------------------------------
-- Decision explicite d Arnaud (PDG, product owner), verbatim :
--   1. « L existant ne releve que de donnees de tests donc n a aucune
--      importance, ne pas le migrer, le supprimer purement et simplement »
--   2. « Nous supprimons l ancien module pour ne conserver que le nouveau
--      auquel nous associons les IHM existantes »
--   3. « Un devis est un devis, qu il soit initie par un client cote boutique
--      ou realise par un commercial depuis Magrit home, au final ce dernier
--      devra le gerer depuis l outil de gestion commerciale »
--
-- ── Pourquoi une suppression et pas une migration de donnees ────────────────
-- `public.quotes` (25 lignes) / `public.quote_lines` (30 lignes) sont des
-- donnees de test (activite mai -> fin aout 2026, arretee pile avant le debut
-- du Sprint 5, coherent avec le remplacement du panier par les Projets en
-- E10.1). Aucune dependance reelle : `orders.quote_id` (FK `on delete set
-- null`) a 0 ligne non-nulle referencant `quotes` ; `pim_candidates.source_quote_id`
-- a 0 ligne non-nulle. Le systeme cible, `commercial_quotes`/
-- `commercial_quote_lines` (E10.3, migration `20260901000600`), est un modele
-- INCOMPATIBLE documente en detail dans son en-tete — pas une extension de
-- celui-ci. Aucune ligne n est donc portee vers le nouveau systeme.
--
-- ── Ce qui disparait ──────────────────────────────────────────────────────
--   - `public.quotes` (et tout ce qui en depend : policies RLS, index, trigger
--     `trg_quotes_updated_at`, contraintes) ;
--   - `public.quote_lines` (idem) ;
--   - `public.set_quote_updated_at()` — fonction dediee au trigger ci-dessus,
--     utilisee par AUCUNE autre table ;
--   - `public.enqueue_pim_candidate_on_order()` — fonction dediee au trigger
--     `trg_enqueue_pim_candidate on public.quotes` (meme migration
--     `20260424000300`). Le trigger disparait deja avec le `DROP TABLE
--     public.quotes CASCADE` ci-dessous, mais la fonction elle-meme ne
--     depend d aucune table pour continuer d exister : elle doit etre
--     explicitement DROP, faute de quoi elle survit en orpheline en
--     referencant `public.quotes` et `source_quote_id`, deux objets qui
--     n existeront plus une fois cette migration appliquee (correction
--     qa-review B2 — l affirmation initiale de cet en-tete, qui ne
--     mentionnait que `set_quote_updated_at()` comme « fonction dediee »
--     retiree, etait incomplete) ;
--   - `orders.quote_id` — colonne de liaison vers l ancien systeme. 0 ligne
--     non-nulle (verifie avant redaction de cette migration) : conservee
--     seule, sans table cible, elle n aurait plus aucun sens (jamais
--     alimentee par `commercial_quotes`, qui n a pas vocation a etre
--     reference depuis `orders` par cette meme colonne). DROP plutot que
--     conservation "generique" : une colonne FK vers une table qui n existe
--     plus serait une source de confusion, pas une garantie de compatibilite.
--   - `pim_candidates.source_quote_id` — meme raisonnement (0 ligne
--     non-nulle, plus aucune source `quotes` possible pour l alimenter).
--
-- ── Fonctions PIM redefinies pour retirer la reference a `source_quote_id`
--    (correction qa-review B1, BLOQUANT) ───────────────────────────────────
-- `pim_candidates.source_quote_id` est aussi ecrite EN DUR dans le corps de
-- deux fonctions trigger actives, sans rapport avec `quotes` mais toujours
-- montees sur `tenant_order_items` / `shop_orders` (le pipeline d ingestion
-- PIM de la boutique, sans lien avec les devis) :
--   - `public.enqueue_pim_candidates_on_tenant_order_item()`
--     (migration `20260518000100`, trigger `trg_enqueue_pim_tenant_order_item
--     after insert on public.tenant_order_items`) ;
--   - `public.enqueue_pim_candidates_on_shop_order()`
--     (migration `20260511000300`, trigger `trg_enqueue_pim_shop_order`).
-- Un `ALTER TABLE ... DROP COLUMN` ne met PAS a jour le corps d une fonction
-- plpgsql qui reference cette colonne dans un `INSERT ... VALUES (...)` : la
-- colonne disparaitrait, puis le PREMIER insert dans `tenant_order_items`
-- (n importe quelle commande boutique, n importe quel tenant, base
-- partagee) ferait echouer le trigger avec `ERROR 42703: column
-- "source_quote_id" of relation "pim_candidates" does not exist`, et donc
-- toute la transaction de commande. Ces deux fonctions sont donc
-- CREATE OR REPLACE ci-dessous — corps identique a l original, seule la
-- colonne `source_quote_id` (et sa valeur `null`) est retiree de la clause
-- INSERT — AVANT le `DROP COLUMN pim_candidates.source_quote_id`, jamais
-- apres.
--
-- ── Ce qui NE disparait PAS ───────────────────────────────────────────────
--   - `public.commercial_quotes` / `public.commercial_quote_lines` (E10.3) :
--     systeme cible, desormais UNIQUE systeme de devis. Non touche par cette
--     migration.
--   - `public.orders` (table), `public.pim_candidates` (table) : seules les
--     deux colonnes de liaison vers l ancien systeme sont retirees.
--   - `public.enqueue_pim_candidates_on_tenant_order_item()` /
--     `public.enqueue_pim_candidates_on_shop_order()` (les fonctions
--     elles-memes, et leurs triggers) : redefinies, pas supprimees — le
--     pipeline d ingestion PIM de la boutique reste actif.
-- ============================================================================

-- ── 0. Fonctions PIM boutique : retrait de la reference a source_quote_id
--      AVANT le drop de la colonne (correction qa-review B1) ────────────────
create or replace function public.enqueue_pim_candidates_on_tenant_order_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _shop_tenant uuid;
  _shop_owner uuid;
  _order_creator uuid;
begin
  -- Recupere tenant_id (via tenant_orders) et owner du shop (via shops).
  -- Le created_by de l order est prefere comme source_user_id (acheteur
  -- authentifie qui a passe la commande). Fallback shop owner si null
  -- (cas extreme post-RLS, peu probable).
  select o.tenant_id, o.created_by, s.owner_user_id
    into _shop_tenant, _order_creator, _shop_owner
    from public.tenant_orders o
    join public.shops s on s.id = o.shop_id
    where o.id = new.order_id;

  if _shop_tenant is null then
    -- Order sans tenant (cas degenere ou shop sans tenant) : on ne pousse pas.
    return new;
  end if;

  insert into public.pim_candidates (
    source_tenant_id,
    source_user_id,
    raw_config,
    suggested_kind,
    suggested_gamme,
    status
  ) values (
    _shop_tenant,
    coalesce(_order_creator, _shop_owner),
    -- raw_config : preference au snapshot clariprint_options (immutable
    -- au moment du commit panier). Fallback aux colonnes typees si vide.
    coalesce(
      new.clariprint_options,
      jsonb_build_object(
        'name', new.product_label,
        'quantity', new.quantity,
        'price_ht', new.unit_price_ht
      )
    ),
    new.clariprint_options->>'kind',
    new.clariprint_options->>'gamme_slug',
    'pending'
  );

  return new;
end;
$$;

create or replace function public.enqueue_pim_candidates_on_shop_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _shop_tenant uuid;
  _shop_owner uuid;
  _item jsonb;
  _product_config jsonb;
  _product_id_raw text;
begin
  select tenant_id, owner_user_id
    into _shop_tenant, _shop_owner
    from public.shops
    where id = new.shop_id;

  if _shop_tenant is null then
    return new;
  end if;

  for _item in select jsonb_array_elements(coalesce(new.items, '[]'::jsonb))
  loop
    _product_config := null;
    _product_id_raw := _item->>'product_id';

    -- Defense bug #4d : cast UUID uniquement si le format matche v4.
    -- Sinon (ex: "lib-..." pour produit library), on saute le lookup
    -- shop_products et on tombe sur le fallback jsonb_build_object plus bas.
    if _product_id_raw is not null
       and _product_id_raw ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then
      select config into _product_config
        from public.shop_products
        where id = _product_id_raw::uuid
        limit 1;
    end if;

    if _product_config is null then
      _product_config := jsonb_build_object(
        'name', _item->>'name',
        'quantity', coalesce((_item->>'quantity_ex')::int, (_item->>'qty')::int),
        'price_ht', _item->>'price_ht'
      );
    end if;

    insert into public.pim_candidates (
      source_tenant_id,
      source_user_id,
      raw_config,
      suggested_kind,
      suggested_gamme,
      status
    ) values (
      _shop_tenant,
      _shop_owner,
      _product_config,
      _product_config->>'kind',
      _product_config->>'gamme_slug',
      'pending'
    );
  end loop;

  return new;
end;
$$;

-- ── 1. Colonnes de liaison vers l ancien systeme (0 ligne non-nulle) ────────
alter table if exists public.orders
  drop column if exists quote_id;

alter table if exists public.pim_candidates
  drop column if exists source_quote_id;

-- ── 2. Lignes de devis (doit etre droppee avant l entete, FK on delete cascade) ─
drop table if exists public.quote_lines cascade;

-- ── 3. Entete de devis — le trigger trg_enqueue_pim_candidate et
--      trg_quotes_updated_at disparaissent tous deux avec ce CASCADE ────────
drop table if exists public.quotes cascade;

-- ── 4. Fonctions de trigger dediees — droppees APRES le CASCADE ci-dessus,
--      qui a deja retire leurs triggers respectifs (trg_quotes_updated_at,
--      trg_enqueue_pim_candidate) ; un DROP FUNCTION avant leur trigger
--      echoue (2BP01, objet encore dependant) — correction qa-review B4 ───
drop function if exists public.set_quote_updated_at();
drop function if exists public.enqueue_pim_candidate_on_order();

notify pgrst, 'reload schema';

-- ============================================================================
-- REVERSIBILITE — le CLI Supabase ne gere pas de bloc `down`. SQL de retrait
-- (recree le SCHEMA vide, PAS les donnees — explicitement perdues et
-- acceptees comme telles par la decision produit ci-dessus), a jouer tel
-- quel dans une migration inverse si ce chantier est annule :
--
--   create table if not exists public.quotes (
--     id              uuid primary key default gen_random_uuid(),
--     user_id         uuid not null references auth.users(id) on delete cascade,
--     client_id       uuid references public.clients(id) on delete set null,
--     tenant_id       uuid references public.tenants(id),
--     reference       text not null,
--     product_name    text not null,
--     product_config  jsonb,
--     total_ht        numeric(12,2),
--     total_ttc       numeric(12,2),
--     status          text not null default 'draft'
--                       check (status in ('draft','sent','won','lost','pending','validated','rejected')),
--     client_name     text,
--     updated_at      timestamptz not null default now(),
--     created_at      timestamptz not null default now()
--   );
--   create index if not exists quotes_user_id_idx on public.quotes(user_id);
--   create index if not exists quotes_tenant_idx on public.quotes(tenant_id);
--   alter table public.quotes enable row level security;
--   create policy "quotes_select" on public.quotes for select using (
--     public.is_super_admin() or (tenant_id in (select public.current_user_tenant_ids()))
--   );
--   create policy "quotes_insert" on public.quotes for insert with check (
--     user_id = auth.uid() and (tenant_id in (select public.current_user_tenant_ids()))
--   );
--   create policy "quotes_update" on public.quotes for update using (
--     (user_id = auth.uid() and tenant_id in (select public.current_user_tenant_ids()))
--     or public.user_role_in_tenant(tenant_id) in ('owner', 'admin')
--     or public.is_super_admin()
--   );
--   create policy "quotes_delete" on public.quotes for delete using (
--     (user_id = auth.uid() and tenant_id in (select public.current_user_tenant_ids()))
--     or public.user_role_in_tenant(tenant_id) in ('owner', 'admin')
--     or public.is_super_admin()
--   );
--
--   create table if not exists public.quote_lines (
--     id             uuid primary key default gen_random_uuid(),
--     quote_id       uuid not null references public.quotes(id) on delete cascade,
--     product_name   text not null,
--     product_config jsonb,
--     quantity       integer not null default 1 check (quantity > 0),
--     unit_cost_ht   numeric(12,2) not null default 0,
--     unit_price_ht  numeric(12,2) not null default 0,
--     margin_pct     numeric(6,2)  not null default 0,
--     line_total_ht  numeric(12,2) not null default 0,
--     position       integer not null default 0,
--     created_at     timestamptz not null default now()
--   );
--   create index if not exists quote_lines_quote_id_idx on public.quote_lines(quote_id, position);
--   alter table public.quote_lines enable row level security;
--   create policy quote_lines_select on public.quote_lines for select using (
--     exists (select 1 from public.quotes q where q.id = quote_id
--       and (q.tenant_id in (select public.current_user_tenant_ids()) or public.is_super_admin()))
--   );
--   create policy quote_lines_write on public.quote_lines for all using (
--     exists (select 1 from public.quotes q where q.id = quote_id
--       and ((q.user_id = auth.uid() and q.tenant_id in (select public.current_user_tenant_ids()))
--         or public.user_role_in_tenant(q.tenant_id) in ('owner', 'admin')
--         or public.is_super_admin()))
--   );
--
--   create or replace function public.set_quote_updated_at()
--   returns trigger language plpgsql as $$
--   begin
--     new.updated_at = now();
--     return new;
--   end;
--   $$;
--   create trigger trg_quotes_updated_at
--     before update on public.quotes
--     for each row execute function public.set_quote_updated_at();
--
--   alter table public.orders add column if not exists quote_id uuid references public.quotes(id) on delete set null;
--   alter table public.pim_candidates add column if not exists source_quote_id uuid references public.quotes(id) on delete set null;
--
--   -- Corps ORIGINAL des deux fonctions PIM boutique, source_quote_id
--   -- reintegre (correction qa-review B3 : ce bloc doit restaurer le corps
--   -- exact qui existait avant cette migration, pas seulement les tables) :
--   create or replace function public.enqueue_pim_candidates_on_tenant_order_item()
--   returns trigger
--   language plpgsql
--   security definer
--   set search_path = public
--   as $$
--   declare
--     _shop_tenant uuid;
--     _shop_owner uuid;
--     _order_creator uuid;
--   begin
--     select o.tenant_id, o.created_by, s.owner_user_id
--       into _shop_tenant, _order_creator, _shop_owner
--       from public.tenant_orders o
--       join public.shops s on s.id = o.shop_id
--       where o.id = new.order_id;
--
--     if _shop_tenant is null then
--       return new;
--     end if;
--
--     insert into public.pim_candidates (
--       source_tenant_id,
--       source_user_id,
--       source_quote_id,
--       raw_config,
--       suggested_kind,
--       suggested_gamme,
--       status
--     ) values (
--       _shop_tenant,
--       coalesce(_order_creator, _shop_owner),
--       null,
--       coalesce(
--         new.clariprint_options,
--         jsonb_build_object(
--           'name', new.product_label,
--           'quantity', new.quantity,
--           'price_ht', new.unit_price_ht
--         )
--       ),
--       new.clariprint_options->>'kind',
--       new.clariprint_options->>'gamme_slug',
--       'pending'
--     );
--
--     return new;
--   end;
--   $$;
--
--   create or replace function public.enqueue_pim_candidates_on_shop_order()
--   returns trigger
--   language plpgsql
--   security definer
--   set search_path = public
--   as $$
--   declare
--     _shop_tenant uuid;
--     _shop_owner uuid;
--     _item jsonb;
--     _product_config jsonb;
--     _product_id_raw text;
--   begin
--     select tenant_id, owner_user_id
--       into _shop_tenant, _shop_owner
--       from public.shops
--       where id = new.shop_id;
--
--     if _shop_tenant is null then
--       return new;
--     end if;
--
--     for _item in select jsonb_array_elements(coalesce(new.items, '[]'::jsonb))
--     loop
--       _product_config := null;
--       _product_id_raw := _item->>'product_id';
--
--       if _product_id_raw is not null
--          and _product_id_raw ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
--       then
--         select config into _product_config
--           from public.shop_products
--           where id = _product_id_raw::uuid
--           limit 1;
--       end if;
--
--       if _product_config is null then
--         _product_config := jsonb_build_object(
--           'name', _item->>'name',
--           'quantity', coalesce((_item->>'quantity_ex')::int, (_item->>'qty')::int),
--           'price_ht', _item->>'price_ht'
--         );
--       end if;
--
--       insert into public.pim_candidates (
--         source_tenant_id,
--         source_user_id,
--         source_quote_id,
--         raw_config,
--         suggested_kind,
--         suggested_gamme,
--         status
--       ) values (
--         _shop_tenant,
--         _shop_owner,
--         null,
--         _product_config,
--         _product_config->>'kind',
--         _product_config->>'gamme_slug',
--         'pending'
--       );
--     end loop;
--
--     return new;
--   end;
--   $$;
--
--   -- Fonction + trigger d ingestion sur `quotes` (correction qa-review B3 :
--   -- presents dans l etat laisse par 20260702000100, absents du bloc
--   -- initial de ce fichier) :
--   create or replace function public.enqueue_pim_candidate_on_order()
--   returns trigger language plpgsql security definer set search_path = public as $$
--   declare
--     _config jsonb;
--   begin
--     if (TG_OP = 'UPDATE' and new.status = 'won' and (old.status is distinct from 'won')) then
--       _config := coalesce(new.product_config, '{}'::jsonb);
--       insert into public.pim_candidates (
--         source_tenant_id, source_user_id, source_quote_id,
--         raw_config, suggested_kind
--       ) values (
--         new.tenant_id, new.user_id, new.id,
--         _config, _config->>'kind'
--       );
--     end if;
--     return new;
--   end;
--   $$;
--
--   drop trigger if exists trg_enqueue_pim_candidate on public.quotes;
--   create trigger trg_enqueue_pim_candidate
--     after update on public.quotes
--     for each row execute function public.enqueue_pim_candidate_on_order();
--
--   notify pgrst, 'reload schema';
--
-- Aucune donnee n est restauree par ce retrait (elle a ete perdue au DROP) :
-- ce script recree le schema laisse par 20260702000100 (tables `quotes` /
-- `quote_lines` vides, fonction+trigger `enqueue_pim_candidate_on_order` sur
-- `quotes`, colonnes de liaison `orders.quote_id` / `pim_candidates.
-- source_quote_id`), PLUS les corps ORIGINAUX (avec `source_quote_id`) des
-- deux fonctions PIM boutique modifiees par cette migration
-- (`enqueue_pim_candidates_on_tenant_order_item`,
-- `enqueue_pim_candidates_on_shop_order`) — fidelite complete a l etat
-- pre-migration (correction qa-review B3).
-- ============================================================================
