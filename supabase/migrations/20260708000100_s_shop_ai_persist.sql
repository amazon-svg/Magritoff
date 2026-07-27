-- =============================================================================
-- S-SHOP-AI-PERSIST (2026-07-08) — Persistance des produits calculés par Magrit
--
-- Retour Arnaud : « quand je demande un produit, la réponse est systématiquement
-- que ce produit n'existe pas alors même que je l'ai déjà calculé/commandé ».
-- Décision : dès qu'un produit est calculé par Magrit dans une boutique, il
-- devient PERSISTANT dans cette boutique (catalogue + recherche), dédupliqué.
--
-- Contrainte : l'acheteur (portail) n'est PAS owner du shop → la policy
-- « shop_products owner all » lui interdit l'INSERT direct. On expose donc un
-- RPC SECURITY DEFINER borné (accès boutique vérifié via current_user_can_access_shop).
--
-- Traçabilité : colonne `origin` ('manual' | 'ai') pour distinguer/nettoyer les
-- produits auto-persistés ; `config_hash` pour dédupliquer (même config = 1 seul
-- produit, prix rafraîchi).
-- =============================================================================

-- ─── Colonnes traçabilité + dédup ────────────────────────────────────────────
alter table public.shop_products
  add column if not exists origin text not null default 'manual';

do $$
begin
  if not exists (
    select 1 from information_schema.constraint_column_usage
    where table_name = 'shop_products' and constraint_name = 'shop_products_origin_chk'
  ) then
    alter table public.shop_products
      add constraint shop_products_origin_chk check (origin in ('manual', 'ai'));
  end if;
end $$;

alter table public.shop_products
  add column if not exists config_hash text;

-- Un même config (signature) ne persiste qu'une fois par boutique.
create unique index if not exists shop_products_shop_confighash_uidx
  on public.shop_products(shop_id, config_hash)
  where config_hash is not null;

-- ─── RPC de persistance (SECURITY DEFINER, borné à l'accès boutique) ─────────
create or replace function public.persist_shop_ai_product(
  p_shop_id     uuid,
  p_config_hash text,
  p_name        text,
  p_category    text,
  p_description text,
  p_price_ht    numeric,
  p_image_url   text,
  p_config      jsonb,
  p_gamme_slug  text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  -- Garde d'accès : seul un utilisateur ayant accès à la boutique peut persister
  -- (même prédicat que la policy SELECT / les commandes). Bloque l'écriture
  -- arbitraire dans le catalogue d'une boutique tierce.
  if not public.current_user_can_access_shop(p_shop_id) then
    raise exception 'access denied to shop %', p_shop_id using errcode = '42501';
  end if;

  if coalesce(btrim(p_config_hash), '') = '' then
    raise exception 'config_hash is required';
  end if;

  insert into public.shop_products
    (shop_id, name, category, description, price_ht, image_url, config,
     gamme_slug, display_order, origin, config_hash)
  values
    (p_shop_id,
     left(coalesce(nullif(btrim(p_name), ''), 'Produit'), 200),
     coalesce(nullif(btrim(p_category), ''), 'Autres'),
     coalesce(p_description, ''),
     greatest(coalesce(p_price_ht, 0), 0),
     coalesce(p_image_url, ''),
     coalesce(p_config, '{}'::jsonb),
     nullif(btrim(p_gamme_slug), ''),
     0,
     'ai',
     btrim(p_config_hash))
  on conflict (shop_id, config_hash) where config_hash is not null
    do update set
      price_ht    = excluded.price_ht,
      name        = excluded.name,
      description = excluded.description,
      image_url   = excluded.image_url,
      config      = excluded.config,
      gamme_slug  = excluded.gamme_slug
  returning id into v_id;

  return v_id;
end;
$$;

-- Réservé aux utilisateurs authentifiés (l'acheteur B2B connecté). Pas anon.
revoke all on function public.persist_shop_ai_product(uuid, text, text, text, text, numeric, text, jsonb, text) from public;
grant execute on function public.persist_shop_ai_product(uuid, text, text, text, text, numeric, text, jsonb, text) to authenticated;

comment on function public.persist_shop_ai_product is
  'S-SHOP-AI-PERSIST : persiste un produit calculé par Magrit dans une boutique '
  '(origin=ai, dédup par config_hash). SECURITY DEFINER borné par '
  'current_user_can_access_shop. Contourne la policy owner-only pour l''acheteur.';

notify pgrst, 'reload schema';
