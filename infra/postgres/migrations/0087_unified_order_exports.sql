-- E4.4b: additive common exports. Existing requests and layout 1 stay quote-only.
alter table public.commercial_order_exports drop constraint commercial_order_exports_layout_version_check;
alter table public.commercial_order_exports add constraint commercial_order_exports_layout_version_check check(layout_version in (1,2));

create function magrit.request_unified_order_export(
  requested_tenant_id uuid,requested_format text,requested_granularity text,requested_filters jsonb
) returns uuid language plpgsql security definer set search_path=pg_catalog,public,magrit as $$
declare actor_id uuid:=magrit.current_user_id();export_id uuid;actor_label text;
begin
  if actor_id is null then raise exception using errcode='28000',message='authentication_required'; end if;
  if requested_tenant_id is distinct from magrit.current_tenant_id()
    or not magrit.actor_has_capability(requested_tenant_id,'can_export_orders') then
    raise exception using errcode='42501',message='permission_denied';
  end if;
  if requested_format not in('xlsx','csv') or requested_granularity not in('order','line')
    or jsonb_typeof(coalesce(requested_filters,'{}'::jsonb))<>'object' then
    raise exception using errcode='22023',message='order_export.invalid_request';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('order-export:'||requested_tenant_id||':'||actor_id,0));
  if(select count(*) from public.commercial_order_exports
      where tenant_id=requested_tenant_id and requested_by=actor_id and status in('pending','running'))>=3 then
    raise exception using errcode='P0001',message='order_export.pending_limit_reached';
  end if;
  select coalesce(nullif(btrim(display_name),''),email_normalized) into actor_label
    from public.app_users where id=actor_id;
  insert into public.commercial_order_exports(
    tenant_id,format,granularity,filters,requested_by,requested_by_label,layout_version
  ) values(requested_tenant_id,requested_format,requested_granularity,
    coalesce(requested_filters,'{}'::jsonb),actor_id,actor_label,2) returning id into export_id;
  return export_id;
end $$;



create view magrit.unified_order_export_headers as
select o.tenant_id,o.id order_id,coalesce(o.number,o.id::text) order_number,
  o.order_origin,o.shop_id,shop.name shop_name,o.customer_id,o.quote_id,o.current_production_step_id,
  q.number quote_number,o.created_at order_created_at,c.type customer_type,
  case when o.customer_id is not null then
    case when c.type='company' then c.company_name else nullif(concat_ws(' ',c.first_name,c.last_name),'') end
    else coalesce(account.full_name,creator.display_name) end customer_name,
  case when o.customer_id is not null then null else coalesce(account.email,creator.email_normalized) end customer_email,
  c.siret customer_siret,c.vat_number customer_vat_number,
  case when cc.id is null then null else btrim(coalesce(cc.first_name,'')||' '||coalesce(cc.last_name,'')) end customer_contact_name,
  cc.email customer_contact_email,o.status::text order_status,step.label production_step_label,
  case when o.order_origin='quote' then o.lines_subtotal else o.total_ht end lines_subtotal,
  o.global_discount,o.effective_discount_rate,
  case when o.order_origin='quote' then o.net_total else o.total_ht end net_total,
  case when o.order_origin='quote' then o.vat_rate else tax.rate end::numeric(6,4) vat_rate,
  case when o.order_origin='quote' then o.vat_regime else tenant.tax_regime end vat_regime,
  case when o.order_origin='quote' then o.vat_amount else round(o.total_ht*tax.rate,2) end vat_amount,
  case when o.order_origin='quote' then o.total_incl_tax else round(o.total_ht*(1+tax.rate),2) end total_incl_tax
from public.tenant_orders o
join public.tenants tenant on tenant.id=o.tenant_id
left join public.shops shop on shop.id=o.shop_id and shop.tenant_id=o.tenant_id
left join public.customers c on c.id=o.customer_id and c.tenant_id=o.tenant_id
left join public.commercial_quotes q on q.id=o.quote_id and q.tenant_id=o.tenant_id
left join public.shop_customer_accounts account on account.id=o.shop_customer_account_id and account.tenant_id=o.tenant_id
left join public.app_users creator on creator.id=o.created_by
left join public.customer_contacts cc on cc.id=o.customer_contact_id
left join public.production_steps step on step.id=o.current_production_step_id and step.tenant_id=o.tenant_id
cross join lateral (select case tenant.tax_regime when 'metropole_fr' then .2000 when 'dom_tom' then .0850 else 0 end rate) tax;

create view magrit.unified_order_export_lines as
select h.*,item.id line_id,
  coalesce(item.position,(row_number() over(partition by item.order_id order by item.created_at,item.id)-1)::integer) line_position,
  item.product_label line_label,item.quantity,
  item.customer_price bracket_amount_excl_tax,item.discount_rate,
  case when h.order_origin='quote' then round(item.sale_price/item.quantity,4)
    else item.unit_price_ht::numeric(16,4) end unit_price_indicative,
  case when h.order_origin='quote' then item.sale_price else item.line_total_ht end sale_price
from magrit.unified_order_export_headers h join public.tenant_order_items item on item.order_id=h.order_id;
revoke all on magrit.unified_order_export_headers,magrit.unified_order_export_lines from public;

-- Layout is present even for an export without rows.
create function magrit.claim_order_exports_with_layout(requested_limit integer,requested_max_attempts integer,requested_max_age_seconds integer)
returns table(id uuid,tenant_id uuid,format text,granularity text,filters jsonb,layout_version integer)
language sql security definer set search_path=pg_catalog,public,magrit as $$
  select claimed.*,entry.layout_version
    from magrit.claim_order_exports(requested_limit,requested_max_attempts,requested_max_age_seconds) claimed
    join public.commercial_order_exports entry on entry.id=claimed.id
$$;

-- Keep the historical reader verbatim; the worker entry chooses the layout.
alter function magrit.read_order_export_rows(uuid,jsonb,integer) rename to read_legacy_order_export_rows;
revoke all on function magrit.read_legacy_order_export_rows(uuid,jsonb,integer) from public,magrit_worker;
create function magrit.read_order_export_rows(requested_export_id uuid,requested_after jsonb,requested_limit integer)
returns table(cursor jsonb,payload jsonb)
language plpgsql security definer set search_path=pg_catalog,public,magrit as $$
declare entry public.commercial_order_exports;after_created timestamptz;after_order uuid;after_position integer;after_line uuid;
  source_view text;cursor_expression text;payload_expression text;after_expression text;ordering text;
begin
  select * into entry from public.commercial_order_exports where id=requested_export_id and status='running';
  if not found then return; end if;
  if entry.layout_version=1 then
    return query select * from magrit.read_legacy_order_export_rows(requested_export_id,requested_after,requested_limit);
    return;
  end if;
  if requested_after is not null then
    after_created:=(requested_after->>'order_created_at')::timestamptz;
    after_order:=(requested_after->>'order_id')::uuid;
    after_position:=(requested_after->>'line_position')::integer;
    after_line:=(requested_after->>'line_id')::uuid;
  end if;
  if entry.granularity='order' then
    source_view:='magrit.unified_order_export_headers';
    cursor_expression:='jsonb_build_object(''order_created_at'',h.order_created_at,''order_id'',h.order_id)';
    after_expression:='(h.order_created_at,h.order_id)>($4,$5)';
    ordering:='h.order_created_at,h.order_id';
    payload_expression:='to_jsonb(h)||jsonb_build_object(''lines_subtotal'',h.lines_subtotal::text,
      ''global_discount'',h.global_discount::text,''effective_discount_rate'',h.effective_discount_rate::text,
      ''net_total'',h.net_total::text,''vat_rate'',h.vat_rate::text,''vat_amount'',h.vat_amount::text,
      ''total_incl_tax'',h.total_incl_tax::text)';
  else
    source_view:='magrit.unified_order_export_lines';
    cursor_expression:='jsonb_build_object(''order_created_at'',h.order_created_at,''order_id'',h.order_id,
      ''line_position'',h.line_position,''line_id'',h.line_id)';
    after_expression:='(h.order_created_at,h.order_id,h.line_position,h.line_id)>($4,$5,$6,$7)';
    ordering:='h.order_created_at,h.order_id,h.line_position,h.line_id';
    payload_expression:='to_jsonb(h)||jsonb_build_object(''bracket_amount_excl_tax'',h.bracket_amount_excl_tax::text,
      ''discount_rate'',h.discount_rate::text,''unit_price_indicative'',h.unit_price_indicative::text,''sale_price'',h.sale_price::text)';
  end if;
  return query execute format('select %s,%s from %s h
    where h.tenant_id=$1
      and ($2->>''origin'' is null or h.order_origin=$2->>''origin'')
      and ($2->>''status'' is null or h.order_status=$2->>''status'')
      and ($2->>''customer_id'' is null or h.customer_id=($2->>''customer_id'')::uuid)
      and ($2->>''shop_id'' is null or h.shop_id=($2->>''shop_id'')::uuid)
      and ($2->>''current_production_step_id'' is null or h.current_production_step_id=($2->>''current_production_step_id'')::uuid)
      and ($2->>''customer_search'' is null or strpos(lower(coalesce(h.customer_name,'''')),lower($2->>''customer_search''))>0
        or strpos(lower(coalesce(h.customer_email,'''')),lower($2->>''customer_search''))>0)
      and ($2->>''created_from'' is null or h.order_created_at>=($2->>''created_from'')::date::timestamp at time zone ''Europe/Paris'')
      and ($2->>''created_to'' is null or h.order_created_at<(($2->>''created_to'')::date+1)::timestamp at time zone ''Europe/Paris'')
      and ($3 is null or %s) order by %s limit $8',
    cursor_expression,payload_expression,source_view,after_expression,ordering)
    using entry.tenant_id,entry.filters,requested_after,after_created,after_order,after_position,after_line,greatest(requested_limit,0);
end $$;
revoke all on function magrit.request_unified_order_export(uuid,text,text,jsonb),
  magrit.claim_order_exports_with_layout(integer,integer,integer),magrit.read_order_export_rows(uuid,jsonb,integer) from public;
grant execute on function magrit.request_unified_order_export(uuid,text,text,jsonb) to magrit_api;
grant execute on function magrit.claim_order_exports_with_layout(integer,integer,integer),
  magrit.read_order_export_rows(uuid,jsonb,integer) to magrit_worker;
