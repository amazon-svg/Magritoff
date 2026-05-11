-- ─────────────────────────────────────────────────────────────────────────────
-- S-FIX-6 — Elargir la policy SELECT shop_orders pour permettre a l acheteur
-- authentifie de voir SES propres commandes (customer_email = auth.email()).
--
-- Bug detecte par Arnaud 2026-05-11 : "Mes commandes" ne fonctionne pas dans
-- la boutique Eram. Diagnostic : la policy d origine "shop_orders owner" ne
-- permet le SELECT QU au owner shop (shops.owner_user_id = auth.uid()). Donc
-- un acheteur B2B authentifie ne peut jamais voir ses commandes.
--
-- Cette migration ajoute une 2eme policy SELECT "shop_orders buyer" qui
-- autorise un user authentifie a SELECT les rows ou customer_email correspond
-- a son auth.email(). Combinee avec la policy owner existante (PostgreSQL
-- OR-ing entre policies non-restrictive), un user peut maintenant voir :
--   - SOIT ses propres commandes (en tant qu acheteur)
--   - SOIT toutes les commandes de la shop dont il est owner
--
-- Note : l owner shop voit aussi ses propres commandes (cas degenere) via la
-- policy owner si shop.owner_user_id=user.id, donc pas d intersection.
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists "shop_orders buyer" on public.shop_orders;
create policy "shop_orders buyer" on public.shop_orders
  for select using (
    auth.email() is not null
    and auth.email() = customer_email
  );

-- Verification post-migration :
--   select polname from pg_policy
--   where polrelid = 'public.shop_orders'::regclass
--   order by polname;
--
-- Doit retourner :
--   shop_orders buyer
--   shop_orders owner
--   shop_orders public insert
