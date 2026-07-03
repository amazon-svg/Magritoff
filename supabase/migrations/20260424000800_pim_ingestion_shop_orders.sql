-- =============================================================================
-- Migration 08 / v3 — Ingestion PIM depuis les commandes boutique
-- -----------------------------------------------------------------------------
-- Le trigger initial (migration 03) pointait UNIQUEMENT sur quotes.status = won.
-- Mais le flow reel d'Arnaud : il passe commande depuis une boutique publique,
-- ce qui cree une ligne dans shop_orders (pas dans quotes.won). Le trigger ne
-- se declenchait donc jamais dans ce cas.
--
-- Ce fichier ajoute :
--   1. un trigger AFTER INSERT sur shop_orders qui parcourt les items (jsonb
--      array) et cree une ligne pim_candidates par item, avec le tenant_id
--      du shop.
--   2. une policy RLS plus permissive pour que le tenant source puisse voir
--      ses propres candidats (utile pour afficher un "ingestion status" dans
--      le dashboard tenant plus tard).
-- =============================================================================

-- ─── Trigger : enqueue candidats PIM a chaque shop_order ──────────────────
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
begin
  -- Recupere tenant_id + owner du shop
  select tenant_id, owner_user_id
    into _shop_tenant, _shop_owner
    from public.shops
    where id = new.shop_id;

  if _shop_tenant is null then
    -- Shop sans tenant (legacy) : on ne pousse pas de candidat.
    return new;
  end if;

  -- Parcours chaque item de la commande (items est un jsonb array)
  for _item in select jsonb_array_elements(coalesce(new.items, '[]'::jsonb))
  loop
    -- Retrouver la config produit depuis shop_products (via product_id si present).
    _product_config := null;
    if _item ? 'product_id' then
      select config into _product_config
        from public.shop_products
        where id = (_item->>'product_id')::uuid
        limit 1;
    end if;

    -- Fallback : si on ne trouve pas de config shop_products, on prend les
    -- infos basiques de l'item (name, qty, price) pour que le candidat soit
    -- quand meme cree. L'admin PIM pourra le rejeter si c'est trop maigre.
    if _product_config is null then
      _product_config := jsonb_build_object(
        'name', _item->>'name',
        'quantity', (_item->>'qty')::int,
        'price_ht', _item->>'price_ht'
      );
    end if;

    insert into public.pim_candidates (
      source_tenant_id,
      source_user_id,
      source_quote_id,
      raw_config,
      suggested_kind,
      suggested_gamme,
      status
    ) values (
      _shop_tenant,
      _shop_owner,
      null,
      _product_config,
      _product_config->>'kind',
      _product_config->>'gamme_slug',
      'pending'
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_enqueue_pim_shop_order on public.shop_orders;
create trigger trg_enqueue_pim_shop_order
  after insert on public.shop_orders
  for each row execute function public.enqueue_pim_candidates_on_shop_order();

-- ─── RLS : le tenant source peut LIRE ses propres candidats ───────────────
-- Cela permet d'afficher un banner dashboard "Ingestion en cours" ou "X
-- produits en attente d'integration PIM" pour le tenant owner/admin.
-- L'ecriture/validation reste reservee au superadmin Magrit.
drop policy if exists "pim_candidates_source_tenant_read" on public.pim_candidates;
create policy "pim_candidates_source_tenant_read" on public.pim_candidates
  for select using (
    is_super_admin()
    or source_tenant_id in (select public.current_user_tenant_ids())
  );

-- L'ancienne policy superadmin-only reste pour l'insert/update/delete.
-- On reecrit pour exclure le select (deja couvert ci-dessus).
drop policy if exists "pim_candidates_superadmin" on public.pim_candidates;
create policy "pim_candidates_superadmin_write" on public.pim_candidates
  for insert with check (is_super_admin());
create policy "pim_candidates_superadmin_update" on public.pim_candidates
  for update using (is_super_admin()) with check (is_super_admin());
create policy "pim_candidates_superadmin_delete" on public.pim_candidates
  for delete using (is_super_admin());

-- Note : le trigger insere via security definer, donc il bypass la policy
-- d'insert ci-dessus (security definer = privileges du owner de la fonction,
-- pas de l'user qui declenche le trigger). Donc l'insert fonctionne meme si
-- la policy insert exige is_super_admin().

notify pgrst, 'reload schema';
