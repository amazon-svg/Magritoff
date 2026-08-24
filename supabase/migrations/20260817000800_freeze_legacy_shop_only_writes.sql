-- UM8.1 — Geler la création de nouveaux profils mixtes Magrit/shop_only.
--
-- Les lignes historiques restent lisibles et peuvent être promues vers
-- magrit_full. Les migrations exécutées par la connexion postgres restent
-- possibles afin de tester et reprendre UM7 sans réouvrir cette frontière aux
-- sessions applicatives (anon, authenticated ou service_role via PostgREST).

create or replace function public.freeze_legacy_shop_only_write()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if session_user = 'postgres' then
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

drop trigger if exists tenant_members_freeze_legacy_shop_only on public.tenant_members;
create trigger tenant_members_freeze_legacy_shop_only
before insert or update of access_scope, allowed_shop_ids on public.tenant_members
for each row execute function public.freeze_legacy_shop_only_write();

drop trigger if exists tenant_invitations_freeze_legacy_shop_only on public.tenant_invitations;
create trigger tenant_invitations_freeze_legacy_shop_only
before insert or update of access_scope, allowed_shop_ids on public.tenant_invitations
for each row execute function public.freeze_legacy_shop_only_write();

comment on function public.freeze_legacy_shop_only_write() is
  'UM8: interdit toute nouvelle identité mixte ; conserve les lignes shop_only historiques en lecture.';

notify pgrst, 'reload schema';
