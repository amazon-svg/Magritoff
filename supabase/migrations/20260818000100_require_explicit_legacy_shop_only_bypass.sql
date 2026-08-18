-- UM8.2 — Le bypass des écritures historiques doit être explicite.
--
-- Une connexion postgres ne suffit plus à autoriser `shop_only`. Les reprises
-- techniques doivent activer la variable transactionnelle ci-dessous, ce qui
-- rend le garde-fou vérifiable même dans les tests exécutés par postgres.

create or replace function public.freeze_legacy_shop_only_write()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if session_user = 'postgres'
     and current_setting('magrit.allow_legacy_shop_only_write', true) = 'on' then
    return new;
  end if;

  if tg_op = 'INSERT' and new.access_scope = 'shop_only' then
    raise exception 'legacy_shop_only_frozen: create a shop_customer_account instead';
  end if;

  if tg_op = 'UPDATE'
     and new.access_scope = 'shop_only'
     and (
       old.access_scope is distinct from new.access_scope
       or old.allowed_shop_ids is distinct from new.allowed_shop_ids
     ) then
    raise exception 'legacy_shop_only_frozen: shop access can no longer be assigned to a Magrit user';
  end if;

  return new;
end;
$$;

comment on function public.freeze_legacy_shop_only_write() is
  'UM8: interdit les nouvelles identités mixtes ; bypass explicite réservé aux reprises postgres.';

notify pgrst, 'reload schema';
