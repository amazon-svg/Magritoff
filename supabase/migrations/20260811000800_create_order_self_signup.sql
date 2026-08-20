-- AF7.1 — un compte déjà authentifié depuis la boutique doit être rattaché
-- automatiquement avant sa première commande si la boutique est self_signup.

-- Certaines bases de développement ont déjà reçu cette extraction lors des
-- tests de migration. Ne renommer la fonction historique que si le cœur
-- n'existe pas encore permet de reprendre un push interrompu sans écraser sa
-- définition.
do $$
begin
  if to_regprocedure(
    'public.api_create_tenant_order_core(uuid,text,text,jsonb,text)'
  ) is null then
    alter function public.api_create_tenant_order(uuid, text, text, jsonb, text)
      rename to api_create_tenant_order_core;
  end if;
end;
$$;

revoke all on function public.api_create_tenant_order_core(uuid, text, text, jsonb, text)
  from public, anon, authenticated;

create or replace function public.api_create_tenant_order(
  p_shop_id uuid,
  p_currency text,
  p_notes text,
  p_items jsonb,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_access_mode text;
  v_tenant_id uuid;
begin
  if v_actor is null then
    raise exception 'authentication_required';
  end if;

  select tenant_id, access_mode
    into v_tenant_id, v_access_mode
    from public.shops
   where id = p_shop_id
     and active = true;

  if v_tenant_id is null then
    raise exception 'shop_not_found';
  end if;

  if v_access_mode = 'self_signup'
     and not exists (
       select 1
         from public.tenant_members members
        where members.tenant_id = v_tenant_id
          and members.user_id = v_actor
     ) then
    perform public.self_register_shop_buyer(p_shop_id);
  end if;

  return public.api_create_tenant_order_core(
    p_shop_id,
    p_currency,
    p_notes,
    p_items,
    p_idempotency_key
  );
end;
$$;

revoke all on function public.api_create_tenant_order(uuid, text, text, jsonb, text)
  from public, anon;

grant execute on function public.api_create_tenant_order(uuid, text, text, jsonb, text)
  to authenticated;

comment on function public.api_create_tenant_order(uuid, text, text, jsonb, text) is
  'Création Orders atomique. Auto-rattache au tenant les acheteurs des boutiques self_signup.';

notify pgrst, 'reload schema';
