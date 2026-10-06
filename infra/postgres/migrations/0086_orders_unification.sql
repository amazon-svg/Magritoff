-- Une commande est un objet unique. Les commandes issues d'une boutique et
-- celles issues d'un devis partagent désormais les mêmes tables canoniques.

alter table public.tenant_orders
  alter column shop_id drop not null,
  add column order_origin text not null default 'storefront'
    check(order_origin in ('storefront','quote')),
  add column customer_id uuid references public.customers(id),
  add column customer_contact_id uuid references public.customer_contacts(id) on delete set null,
  add column quote_id uuid references public.commercial_quotes(id),
  add column number text check(number is null or number~'^CDE-[0-9]{4}-[0-9]{5}$'),
  add column source_quote_status text check(source_quote_status is null or source_quote_status in('sent','accepted')),
  add column current_production_step_id uuid references public.production_steps(id) on delete restrict deferrable initially deferred,
  add column expected_delivery_date date,
  add column show_discounts boolean not null default false,
  add column customer_reference text check(customer_reference is null or btrim(customer_reference)<>''),
  add column lines_subtotal numeric(12,2) check(lines_subtotal is null or lines_subtotal>=0),
  add column global_discount numeric(12,2),
  add column effective_discount_rate numeric(6,4),
  add column net_total numeric(12,2) check(net_total is null or net_total>=0),
  add column vat_rate numeric(6,4) check(vat_rate is null or vat_rate>=0),
  add column vat_regime text,
  add column vat_amount numeric(12,2) check(vat_amount is null or vat_amount>=0),
  add column total_incl_tax numeric(12,2) check(total_incl_tax is null or total_incl_tax>=0),
  add constraint tenant_orders_origin_shape_check check(
    (order_origin='storefront' and shop_id is not null and quote_id is null)
    or
    (order_origin='quote' and shop_id is null and customer_id is not null and quote_id is not null
      and number is not null and source_quote_status is not null and lines_subtotal is not null
      and global_discount is not null and net_total is not null and vat_rate is not null
      and vat_amount is not null and total_incl_tax is not null)
  );

create unique index tenant_orders_quote_id_uidx on public.tenant_orders(quote_id)
  where quote_id is not null;
create unique index tenant_orders_tenant_number_uidx on public.tenant_orders(tenant_id,number)
  where number is not null;
create index tenant_orders_tenant_customer_idx on public.tenant_orders(tenant_id,customer_id)
  where customer_id is not null;
create index tenant_orders_tenant_step_idx
  on public.tenant_orders(tenant_id,current_production_step_id,created_at desc)
  where current_production_step_id is not null;

-- Les projections historiques de gestion commerciale ne transportent que le
-- tenant dans leur contexte de lecture. Cette policy conserve ce contrat pour
-- les commandes issues d'un devis ; les commandes boutique gardent leur
-- contrôle d'appartenance existant.
create policy tenant_orders_quote_read on public.tenant_orders for select to magrit_api
  using(order_origin='quote' and tenant_id=magrit.current_tenant_id());

alter table public.tenant_order_items
  add column source_quote_line_id uuid references public.commercial_quote_lines(id),
  add column line_origin text check(line_origin is null or line_origin in('project_item','free')),
  add column description_html text check(description_html is null or char_length(description_html)<=20000),
  add column position integer check(position is null or position>=0),
  add column production_price numeric(12,2) check(production_price is null or production_price>=0),
  add column public_price numeric(12,2) check(public_price is null or public_price>=0),
  add column customer_price numeric(12,2) check(customer_price is null or customer_price>=0),
  add column applied_margin_rate numeric(6,4),
  add column applied_rule_id uuid,
  add column sale_price numeric(12,2) check(sale_price is null or sale_price>=0),
  add column sale_margin_rate numeric(6,4),
  add column discount_rate numeric(6,4),
  add column margin_variation numeric(6,4),
  add column breakdown jsonb check(
    breakdown is null or (jsonb_typeof(breakdown)='array' and jsonb_array_length(breakdown)>=1)
  );

create unique index tenant_order_items_order_position_uidx
  on public.tenant_order_items(order_id,position) where position is not null;
create unique index tenant_order_items_order_id_id_uidx on public.tenant_order_items(order_id,id);
create index tenant_order_items_source_quote_line_idx on public.tenant_order_items(source_quote_line_id)
  where source_quote_line_id is not null;

alter table public.tenant_order_items disable trigger tenant_order_items_require_draft;
alter table public.tenant_order_items disable trigger tenant_order_items_enqueue_pim;

insert into public.tenant_orders(
  id,tenant_id,shop_id,created_by,status,total_ht,currency,notes,has_unverified_prices,
  created_at,updated_at,order_origin,customer_id,customer_contact_id,quote_id,number,
  source_quote_status,current_production_step_id,expected_delivery_date,show_discounts,
  customer_reference,lines_subtotal,global_discount,effective_discount_rate,net_total,
  vat_rate,vat_regime,vat_amount,total_incl_tax
)
select id,tenant_id,null,created_by,status::public.tenant_order_status,net_total,'EUR','',false,
  created_at,updated_at,'quote',customer_id,customer_contact_id,quote_id,number,
  source_quote_status,current_production_step_id,expected_delivery_date,show_discounts,
  customer_reference,lines_subtotal,global_discount,effective_discount_rate,net_total,
  vat_rate,vat_regime,vat_amount,total_incl_tax
from public.commercial_orders;

insert into public.tenant_order_items(
  id,order_id,product_label,clariprint_options,quantity,unit_price_ht,line_total_ht,
  price_origin,created_at,source_quote_line_id,line_origin,description_html,position,
  production_price,public_price,customer_price,applied_margin_rate,applied_rule_id,
  sale_price,sale_margin_rate,discount_rate,margin_variation,breakdown
)
select id,order_id,label,product_config,quantity,round(sale_price/quantity,2),sale_price,
  'quoted',created_at,source_quote_line_id,origin,description_html,position,
  production_price,public_price,customer_price,applied_margin_rate,applied_rule_id,
  sale_price,sale_margin_rate,discount_rate,margin_variation,breakdown
from public.commercial_order_lines;

alter table public.tenant_order_items enable trigger tenant_order_items_enqueue_pim;
alter table public.tenant_order_items enable trigger tenant_order_items_require_draft;

-- Les objets annexes gardent leur nom public pour préserver le contrat API,
-- mais leurs clés étrangères pointent vers l'unique agrégat de commande.
alter table public.order_documents drop constraint order_documents_order_id_fkey;
alter table public.order_documents add constraint order_documents_order_id_fkey
  foreign key(order_id) references public.tenant_orders(id) on delete cascade;
alter table public.commercial_order_files
  drop constraint commercial_order_files_line_fk,
  drop constraint commercial_order_files_order_id_fkey,
  add constraint commercial_order_files_order_id_fkey
    foreign key(order_id) references public.tenant_orders(id) on delete cascade,
  add constraint commercial_order_files_line_fk
    foreign key(order_id,order_line_id) references public.tenant_order_items(order_id,id) on delete cascade;
alter table public.commercial_order_step_changes
  drop constraint commercial_order_step_changes_order_id_fkey,
  add constraint commercial_order_step_changes_order_id_fkey
    foreign key(order_id) references public.tenant_orders(id) on delete cascade;
alter table public.commercial_order_upload_links
  drop constraint commercial_order_upload_links_order_id_fkey,
  add constraint commercial_order_upload_links_order_id_fkey
    foreign key(order_id) references public.tenant_orders(id) on delete cascade;

drop policy commercial_order_files_select on public.commercial_order_files;
drop policy commercial_order_files_insert on public.commercial_order_files;
drop policy commercial_order_files_update on public.commercial_order_files;
drop policy commercial_order_steps_select on public.commercial_order_step_changes;
drop policy commercial_order_upload_links_select on public.commercial_order_upload_links;
drop policy commercial_order_upload_links_insert on public.commercial_order_upload_links;
drop policy commercial_order_upload_links_update on public.commercial_order_upload_links;

create policy commercial_order_files_select on public.commercial_order_files for select to magrit_api
  using(exists(select 1 from public.tenant_orders orders where orders.id=order_id and orders.tenant_id=magrit.current_tenant_id()));
create policy commercial_order_files_insert on public.commercial_order_files for insert to magrit_api
  with check(deposited_by=magrit.current_user_id() and exists(
    select 1 from public.tenant_orders orders where orders.id=order_id and orders.tenant_id=magrit.current_tenant_id()));
create policy commercial_order_files_update on public.commercial_order_files for update to magrit_api
  using(magrit.current_user_id() is not null and exists(
    select 1 from public.tenant_orders orders where orders.id=order_id and orders.tenant_id=magrit.current_tenant_id()))
  with check(exists(select 1 from public.tenant_orders orders where orders.id=order_id and orders.tenant_id=magrit.current_tenant_id()));
create policy commercial_order_steps_select on public.commercial_order_step_changes for select to magrit_api
  using(exists(select 1 from public.tenant_orders orders where orders.id=order_id and orders.tenant_id=magrit.current_tenant_id()));
create policy commercial_order_upload_links_select on public.commercial_order_upload_links for select to magrit_api
  using(exists(select 1 from public.tenant_orders orders where orders.id=order_id and orders.tenant_id=magrit.current_tenant_id()));
create policy commercial_order_upload_links_insert on public.commercial_order_upload_links for insert to magrit_api
  with check(created_by=magrit.current_user_id() and exists(
    select 1 from public.tenant_orders orders where orders.id=order_id and orders.tenant_id=magrit.current_tenant_id()));
create policy commercial_order_upload_links_update on public.commercial_order_upload_links for update to magrit_api
  using(magrit.current_user_id() is not null and exists(
    select 1 from public.tenant_orders orders where orders.id=order_id and orders.tenant_id=magrit.current_tenant_id()))
  with check(exists(select 1 from public.tenant_orders orders where orders.id=order_id and orders.tenant_id=magrit.current_tenant_id()));

drop view magrit.commercial_order_export_lines;
drop view magrit.commercial_order_export_headers;

-- Réécrit les fonctions SQL/PLpgSQL annexes (notifications, purge, dépôt,
-- exports) qui ne changent pas de contrat et ne font que suivre la table mère.
do $$
declare function_definition text;
begin
  for function_definition in
    select pg_get_functiondef(procedure.oid)
      from pg_proc procedure
     where procedure.pronamespace in ('magrit'::regnamespace,'public'::regnamespace)
       and pg_get_functiondef(procedure.oid) like '%public.commercial_orders%'
       and procedure.proname not in ('convert_commercial_quote','commercial_orders_guard',
         'commercial_order_lines_immutable','enqueue_commercial_pim_candidate')
  loop
    execute replace(function_definition,'public.commercial_orders','public.tenant_orders');
  end loop;
end $$;

create view magrit.commercial_order_export_headers as
select o.tenant_id,o.id order_id,o.number order_number,q.number quote_number,o.created_at order_created_at,
  c.type customer_type,case when c.type='company' then c.company_name
    else btrim(coalesce(c.first_name,'')||' '||coalesce(c.last_name,'')) end customer_name,
  c.siret customer_siret,c.vat_number customer_vat_number,
  case when cc.id is null then null else btrim(coalesce(cc.first_name,'')||' '||coalesce(cc.last_name,'')) end customer_contact_name,
  cc.email customer_contact_email,o.status::text order_status,ps.label production_step_label,
  o.lines_subtotal,o.global_discount,o.effective_discount_rate,o.net_total,o.vat_rate,o.vat_regime,
  o.vat_amount,o.total_incl_tax
from public.tenant_orders o
join public.customers c on c.id=o.customer_id
join public.commercial_quotes q on q.id=o.quote_id
left join public.customer_contacts cc on cc.id=o.customer_contact_id
left join public.production_steps ps on ps.id=o.current_production_step_id
where o.order_origin='quote';

create view magrit.commercial_order_export_lines as
select o.tenant_id,o.id order_id,l.id line_id,o.number order_number,q.number quote_number,
  o.created_at order_created_at,c.type customer_type,
  case when c.type='company' then c.company_name
    else btrim(coalesce(c.first_name,'')||' '||coalesce(c.last_name,'')) end customer_name,
  c.siret customer_siret,c.vat_number customer_vat_number,
  case when cc.id is null then null else btrim(coalesce(cc.first_name,'')||' '||coalesce(cc.last_name,'')) end customer_contact_name,
  cc.email customer_contact_email,o.status::text order_status,ps.label production_step_label,
  l.position line_position,l.product_label line_label,l.quantity,l.customer_price bracket_amount_excl_tax,
  l.discount_rate,round(l.sale_price/l.quantity,4) unit_price_indicative,l.sale_price
from public.tenant_order_items l
join public.tenant_orders o on o.id=l.order_id and o.order_origin='quote'
join public.customers c on c.id=o.customer_id
join public.commercial_quotes q on q.id=o.quote_id
left join public.customer_contacts cc on cc.id=o.customer_contact_id
left join public.production_steps ps on ps.id=o.current_production_step_id;
revoke all on magrit.commercial_order_export_headers,magrit.commercial_order_export_lines from public;

create or replace function magrit.convert_commercial_quote(requested_tenant_id uuid,requested_quote_id uuid)
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
  discount:=subtotal-net; effective:=case when subtotal=0 then null else round(discount/subtotal,4) end;
  if quote_row.vat_rate is not null then resolved_vat_rate:=quote_row.vat_rate;resolved_vat_regime:=null;
  else select case tenant.tax_regime when 'metropole_fr' then .2000 when 'dom_tom' then .0850 else 0 end,
    tenant.tax_regime into resolved_vat_rate,resolved_vat_regime from public.tenants tenant where tenant.id=requested_tenant_id;
  end if;
  vat:=round(net*resolved_vat_rate,2);
  update public.commercial_quotes set status='converted',converted_at=clock_timestamp() where id=requested_quote_id;
  insert into public.commercial_quote_header_audit(quote_id,change_set_id,action,previous_value,new_value,actor_id,actor_label)
    select requested_quote_id,change_id,'converted',quote_row.status,'converted',actor,
      coalesce(nullif(btrim(user_row.display_name),''),user_row.email_normalized)
      from public.app_users user_row where user_row.id=actor;
  sequence_year:=extract(year from clock_timestamp() at time zone 'utc')::integer;
  insert into public.commercial_order_number_counters(tenant_id,year,last_value)
    values(requested_tenant_id,sequence_year,1)
    on conflict(tenant_id,year) do update set last_value=public.commercial_order_number_counters.last_value+1
    returning last_value into sequence_value;
  insert into public.tenant_orders(tenant_id,shop_id,created_by,status,total_ht,currency,notes,
    order_origin,customer_id,customer_contact_id,quote_id,number,source_quote_status,
    current_production_step_id,show_discounts,lines_subtotal,global_discount,
    effective_discount_rate,net_total,vat_rate,vat_regime,vat_amount,total_incl_tax)
  values(requested_tenant_id,null,actor,'validated',net,'EUR','','quote',quote_row.customer_id,
    (select account.customer_contact_id from public.shop_customer_accounts account where account.id=quote_row.decided_by_account_id),
    requested_quote_id,'CDE-'||sequence_year||'-'||lpad(sequence_value::text,5,'0'),quote_row.status,
    (select step.id from public.production_steps step where step.tenant_id=requested_tenant_id and step.is_active order by step.position limit 1),
    quote_row.show_discounts,subtotal,discount,effective,net,resolved_vat_rate,resolved_vat_regime,vat,net+vat)
  returning id into order_id;
  perform set_config('magrit.quote_conversion','on',true);
  insert into public.tenant_order_items(order_id,source_quote_line_id,line_origin,product_label,
    description_html,clariprint_options,quantity,position,unit_price_ht,line_total_ht,price_origin,
    production_price,public_price,customer_price,applied_margin_rate,applied_rule_id,
    sale_price,sale_margin_rate,discount_rate,margin_variation,breakdown)
  select order_id,line.id,line.origin,line.label,line.description_html,line.product_config,line.quantity,line.position,
    round(line.sale_price/line.quantity,2),line.sale_price,'quoted',line.production_price,line.public_price,
    line.customer_price,line.applied_margin_rate,line.applied_rule_id,line.sale_price,line.sale_margin_rate,
    line.discount_rate,line.margin_variation,line.breakdown
    from public.commercial_quote_lines line where line.quote_id=requested_quote_id order by line.position;
  perform set_config('magrit.quote_conversion','off',true);
  return order_id;
end $$;

create or replace function magrit.tenant_order_items_require_draft()
returns trigger language plpgsql as $$
declare current_status public.tenant_order_status; current_origin text;
begin
  select status,order_origin into current_status,current_origin from public.tenant_orders
    where id=coalesce(old.order_id,new.order_id);
  if current_status is null and tg_op='DELETE' then return old; end if;
  if current_origin='quote' then
    if tg_op='INSERT' and coalesce(current_setting('magrit.quote_conversion',true),'off')='on' then return new; end if;
    raise exception using errcode='42501',message='order_item.immutable';
  end if;
  if current_status is distinct from 'draft'::public.tenant_order_status then
    raise exception using errcode='23514',message='order_item_immutable_after_draft';
  end if;
  if tg_op='DELETE' then return old; end if; return new;
end $$;

create or replace function magrit.enqueue_storefront_pim_candidate()
returns trigger language plpgsql security definer set search_path=pg_catalog,public,magrit as $$
declare source_tenant uuid; source_actor uuid;
begin
  select orders.tenant_id,coalesce(orders.created_by,shops.owner_user_id)
    into source_tenant,source_actor from public.tenant_orders orders
    left join public.shops shops on shops.id=orders.shop_id where orders.id=new.order_id;
  if source_tenant is not null then
    insert into public.pim_candidates(source_tenant_id,source_user_id,raw_config,suggested_kind,suggested_gamme)
    values(source_tenant,source_actor,
      jsonb_build_object('name',new.product_label,'quantity',new.quantity)||coalesce(new.clariprint_options,'{}'::jsonb),
      new.clariprint_options->>'kind',new.clariprint_options->>'gamme_slug');
  end if;
  return new;
end $$;

drop table public.commercial_order_lines;
drop table public.commercial_orders;
drop function magrit.commercial_order_lines_immutable();
drop function magrit.commercial_orders_guard();
drop function magrit.enqueue_commercial_pim_candidate();

comment on column public.tenant_orders.order_origin is
  'Workflow ayant créé la commande : storefront ou quote. Il ne définit pas un second objet métier.';
comment on table public.tenant_orders is
  'Table canonique de toutes les commandes, quelle que soit leur origine.';
comment on table public.tenant_order_items is
  'Table canonique de toutes les lignes de commande, quelle que soit leur origine.';
