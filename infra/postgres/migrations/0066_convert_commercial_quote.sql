create function magrit.convert_commercial_quote(requested_tenant_id uuid,requested_quote_id uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog,public,magrit as $$
declare actor uuid:=magrit.current_user_id(); quote_row public.commercial_quotes%rowtype;
  subtotal numeric(12,2); net numeric(12,2); discount numeric(12,2); effective numeric(6,4);
  resolved_vat_rate numeric(6,4); resolved_vat_regime text; vat numeric(12,2);
  sequence_year integer; sequence_value integer; order_id uuid; change_id uuid:=gen_random_uuid();
begin
  if actor is null then raise exception using errcode='28000',message='authentication_required'; end if;
  if requested_tenant_id is distinct from magrit.current_tenant_id()
    or not magrit.current_user_can_access_tenant(requested_tenant_id) then
    raise exception using errcode='42501',message='permission_denied: quote conversion forbidden';
  end if;
  select * into quote_row from public.commercial_quotes quote
    where quote.id=requested_quote_id and quote.tenant_id=requested_tenant_id for update;
  if not found then raise exception using errcode='P0002',message='quote.not_found'; end if;
  if quote_row.status not in('sent','accepted') then
    raise exception using errcode='23514',message='quote.conversion_forbidden_status';
  end if;
  select coalesce(sum(line.sale_price),0)::numeric(12,2) into subtotal
    from public.commercial_quote_lines line where line.quote_id=requested_quote_id;
  net:=case when quote_row.target_net_total is not null then quote_row.target_net_total
    when quote_row.global_discount_rate is not null then round(subtotal*(1-quote_row.global_discount_rate),2)
    else subtotal end;
  discount:=subtotal-net;
  effective:=case when subtotal=0 then null else round(discount/subtotal,4) end;
  if quote_row.vat_rate is not null then resolved_vat_rate:=quote_row.vat_rate;resolved_vat_regime:=null;
  else
    select case tenant.tax_regime when 'metropole_fr' then .2000 when 'dom_tom' then .0850 else 0 end,
      tenant.tax_regime into resolved_vat_rate,resolved_vat_regime
      from public.tenants tenant where tenant.id=requested_tenant_id;
  end if;
  vat:=round(net*resolved_vat_rate,2);
  update public.commercial_quotes set status='converted',converted_at=clock_timestamp()
    where id=requested_quote_id;
  insert into public.commercial_quote_header_audit(quote_id,change_set_id,action,previous_value,new_value,actor_id,actor_label)
    select requested_quote_id,change_id,'converted',quote_row.status,'converted',actor,
      coalesce(nullif(btrim(user_row.display_name),''),user_row.email_normalized)
      from public.app_users user_row where user_row.id=actor;
  sequence_year:=extract(year from clock_timestamp() at time zone 'utc')::integer;
  insert into public.commercial_order_number_counters(tenant_id,year,last_value)
    values(requested_tenant_id,sequence_year,1)
    on conflict(tenant_id,year) do update set last_value=public.commercial_order_number_counters.last_value+1
    returning last_value into sequence_value;
  insert into public.commercial_orders(tenant_id,customer_id,customer_contact_id,quote_id,number,status,
    source_quote_status,current_production_step_id,show_discounts,lines_subtotal,global_discount,
    effective_discount_rate,net_total,vat_rate,vat_regime,vat_amount,total_incl_tax,created_by)
  values(requested_tenant_id,quote_row.customer_id,
    (select account.customer_contact_id from public.shop_customer_accounts account where account.id=quote_row.decided_by_account_id),
    requested_quote_id,'CDE-'||sequence_year||'-'||lpad(sequence_value::text,5,'0'),'validated',quote_row.status,
    (select step.id from public.production_steps step where step.tenant_id=requested_tenant_id and step.is_active order by step.position limit 1),
    quote_row.show_discounts,subtotal,discount,effective,net,resolved_vat_rate,resolved_vat_regime,vat,net+vat,actor)
  returning id into order_id;
  insert into public.commercial_order_lines(order_id,source_quote_line_id,origin,label,description_html,product_config,
    quantity,position,production_price,public_price,customer_price,applied_margin_rate,applied_rule_id,
    sale_price,sale_margin_rate,discount_rate,margin_variation,breakdown)
  select order_id,line.id,line.origin,line.label,line.description_html,line.product_config,line.quantity,line.position,
    line.production_price,line.public_price,line.customer_price,line.applied_margin_rate,line.applied_rule_id,
    line.sale_price,line.sale_margin_rate,line.discount_rate,line.margin_variation,line.breakdown
    from public.commercial_quote_lines line where line.quote_id=requested_quote_id order by line.position;
  return order_id;
end $$;
revoke all on function magrit.convert_commercial_quote(uuid,uuid) from public,magrit_worker,magrit_readonly;
grant execute on function magrit.convert_commercial_quote(uuid,uuid) to magrit_api;
comment on function magrit.convert_commercial_quote(uuid,uuid) is
  'Conversion atomique portable devis vers commande : verrou, totaux figés, séquence, lignes, audit et étape initiale.';
