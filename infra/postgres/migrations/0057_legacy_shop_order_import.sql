create table public.legacy_shop_order_imports (
  source_order_id uuid primary key,
  tenant_order_id uuid not null unique references public.tenant_orders(id) on delete restrict,
  source_checksum bytea not null check (octet_length(source_checksum)=32),
  source_payload jsonb not null check (jsonb_typeof(source_payload)='object'),
  imported_at timestamptz not null default clock_timestamp()
);

revoke all on table public.legacy_shop_order_imports from public;

create function magrit.import_legacy_shop_order(
  requested_source_order_id uuid,
  requested_shop_id uuid,
  requested_customer_name text,
  requested_customer_email text,
  requested_customer_phone text,
  requested_items jsonb,
  requested_total_ht numeric,
  requested_total_ttc numeric,
  requested_notes text,
  requested_status text,
  requested_created_at timestamptz
)
returns table(tenant_order_id uuid,replayed boolean)
language plpgsql security definer set search_path=pg_catalog,public,magrit as $$
declare
  selected_tenant_id uuid;
  selected_account_id uuid;
  selected_order_id uuid;
  selected_status public.tenant_order_status;
  normalized_email text:=lower(btrim(requested_customer_email));
  source_payload jsonb;
  source_checksum bytea;
  previous_import public.legacy_shop_order_imports%rowtype;
  item jsonb;
  item_product_id uuid;
  item_quantity integer;
  item_price numeric(12,2);
  item_options jsonb;
begin
  if requested_source_order_id is null or requested_shop_id is null then
    raise exception using errcode='22023',message='legacy_order_missing_identity';
  end if;
  if normalized_email='' or position('@' in normalized_email)<=1 then
    raise exception using errcode='22023',message='legacy_order_invalid_customer_email';
  end if;
  if requested_items is null or jsonb_typeof(requested_items)<>'array'
     or jsonb_array_length(requested_items)=0 then
    raise exception using errcode='22023',message='legacy_order_invalid_items';
  end if;
  if requested_total_ht is null or requested_total_ht<0
     or requested_total_ttc is null or requested_total_ttc<0 then
    raise exception using errcode='22023',message='legacy_order_invalid_totals';
  end if;

  selected_status:=case requested_status
    when 'pending' then 'draft'::public.tenant_order_status
    when 'approved' then 'validated'::public.tenant_order_status
    when 'in_production' then 'in_production'::public.tenant_order_status
    when 'shipped' then 'shipped'::public.tenant_order_status
    when 'delivered' then 'delivered'::public.tenant_order_status
    when 'invoiced' then 'invoiced'::public.tenant_order_status
    when 'cancelled' then 'cancelled'::public.tenant_order_status
    else null
  end;
  if selected_status is null then
    raise exception using errcode='22023',message='legacy_order_unknown_status';
  end if;

  source_payload:=jsonb_build_object(
    'id',requested_source_order_id,
    'shop_id',requested_shop_id,
    'customer_name',requested_customer_name,
    'customer_email',requested_customer_email,
    'customer_phone',coalesce(requested_customer_phone,''),
    'items',requested_items,
    'total_ht',requested_total_ht,
    'total_ttc',requested_total_ttc,
    'notes',coalesce(requested_notes,''),
    'status',requested_status,
    'created_at',requested_created_at
  );
  source_checksum:=sha256(convert_to(source_payload::text,'utf8'));

  perform pg_advisory_xact_lock(hashtextextended('legacy-shop-order:'||requested_source_order_id::text,0));
  select * into previous_import from public.legacy_shop_order_imports
   where source_order_id=requested_source_order_id for update;
  if found then
    if previous_import.source_checksum<>source_checksum then
      raise exception using errcode='23000',message='legacy_order_changed_after_import';
    end if;
    return query select previous_import.tenant_order_id,true;
    return;
  end if;

  select shop.tenant_id into selected_tenant_id from public.shops shop
   where shop.id=requested_shop_id;
  if selected_tenant_id is null then
    raise exception using errcode='23503',message='legacy_order_shop_not_found';
  end if;
  if exists(select 1 from public.tenant_orders orders where orders.id=requested_source_order_id) then
    raise exception using errcode='23505',message='legacy_order_id_collision';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'legacy-shop-customer:'||requested_shop_id::text||':'||normalized_email,0
  ));
  select account.id into selected_account_id from public.shop_customer_accounts account
   where account.shop_id=requested_shop_id and account.normalized_email=normalized_email
   for update;
  if selected_account_id is null then
    insert into public.shop_customer_accounts(
      shop_id,tenant_id,email,normalized_email,full_name,status,created_at
    ) values(
      requested_shop_id,selected_tenant_id,btrim(requested_customer_email),normalized_email,
      coalesce(nullif(btrim(requested_customer_name),''),split_part(normalized_email,'@',1)),
      'delegated_only',coalesce(requested_created_at,clock_timestamp())
    ) returning id into selected_account_id;
  end if;

  insert into public.tenant_orders(
    id,tenant_id,shop_id,shop_customer_account_id,status,total_ht,currency,notes,
    has_unverified_prices,created_at,updated_at
  ) values(
    requested_source_order_id,selected_tenant_id,requested_shop_id,selected_account_id,
    'draft',round(requested_total_ht,2),'EUR',coalesce(requested_notes,''),false,
    coalesce(requested_created_at,clock_timestamp()),coalesce(requested_created_at,clock_timestamp())
  ) returning id into selected_order_id;

  for item in select value from jsonb_array_elements(requested_items)
  loop
    if jsonb_typeof(item)<>'object'
       or nullif(btrim(item->>'name'),'') is null
       or coalesce(item->>'qty','') !~ '^[1-9][0-9]*$'
       or coalesce(item->>'price_ht','') !~ '^[0-9]+([.][0-9]+)?$' then
      raise exception using errcode='22023',message='legacy_order_invalid_item';
    end if;
    item_quantity:=(item->>'qty')::integer;
    item_price:=round((item->>'price_ht')::numeric,2);
    item_product_id:=null;
    if coalesce(item->>'product_id','') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       and exists(
         select 1 from public.product_library product
          where product.id=(item->>'product_id')::uuid and product.tenant_id=selected_tenant_id
       ) then
      item_product_id:=(item->>'product_id')::uuid;
    end if;
    item_options:=case
      when jsonb_typeof(item->'clariprint_options')='object' then item->'clariprint_options'
      when jsonb_typeof(item->'options')='object' then item->'options'
      else '{}'::jsonb
    end;
    insert into public.tenant_order_items(
      order_id,product_id,product_label,clariprint_options,quantity,
      unit_price_ht,line_total_ht,price_origin,created_at
    ) values(
      selected_order_id,item_product_id,btrim(item->>'name'),item_options,item_quantity,
      item_price,round(item_price*item_quantity,2),'legacy',
      coalesce(requested_created_at,clock_timestamp())
    );
  end loop;

  if selected_status<>'draft'::public.tenant_order_status then
    perform set_config('magrit.order_transition','on',true);
    update public.tenant_orders set status=selected_status,
      cancelled_at=case when selected_status='cancelled' then coalesce(requested_created_at,clock_timestamp()) end,
      updated_at=coalesce(requested_created_at,clock_timestamp())
     where id=selected_order_id;
    insert into public.tenant_order_status_events(
      order_id,shop_customer_account_id,from_status,to_status,reason,metadata,created_at
    ) values(
      selected_order_id,selected_account_id,null,selected_status,'Import shop_orders',
      jsonb_build_object('source','legacy_shop_orders','source_order_id',requested_source_order_id),
      coalesce(requested_created_at,clock_timestamp())
    );
  end if;

  insert into public.legacy_shop_order_imports(
    source_order_id,tenant_order_id,source_checksum,source_payload
  ) values(requested_source_order_id,selected_order_id,source_checksum,source_payload);
  return query select selected_order_id,false;
end $$;

revoke all on function magrit.import_legacy_shop_order(
  uuid,uuid,text,text,text,jsonb,numeric,numeric,text,text,timestamptz
) from public,magrit_api;

comment on table public.legacy_shop_order_imports is
  'Preuve idempotente et snapshot integral de la reprise shop_orders vers tenant_orders.';
comment on function magrit.import_legacy_shop_order(
  uuid,uuid,text,text,text,jsonb,numeric,numeric,text,text,timestamptz
) is 'Fonction de cutover reservee au role de migration ; jamais exposee au runtime API.';
