\set ON_ERROR_STOP on

begin;

do $$
declare
  v_project_item_id uuid;
  v_quote_line_id uuid;
  v_quote_id uuid;
  v_tenant_id uuid;
  v_customer_id uuid;
  v_file_id uuid := gen_random_uuid();
  v_order_id uuid := gen_random_uuid();
  v_order_line_id uuid := gen_random_uuid();
  v_count integer;
begin
  select ql.project_item_id, ql.id, q.id, q.tenant_id, q.customer_id
    into v_project_item_id, v_quote_line_id, v_quote_id, v_tenant_id, v_customer_id
  from public.commercial_quote_lines ql
  join public.commercial_quotes q on q.id = ql.quote_id
  where ql.project_item_id is not null
    and not exists (select 1 from public.commercial_orders o where o.quote_id = q.id)
  limit 1;

  if v_quote_line_id is null then
    raise exception 'fixture manquante : une ligne de devis liée à un project_item est requise';
  end if;

  insert into public.commercial_files (
    id, tenant_id, kind, filename, content_type, byte_size, storage_path
  ) values (
    v_file_id, v_tenant_id, 'supplier_quote', 'devis-fournisseur.pdf',
    'application/pdf', 4, v_tenant_id::text || '/' || v_file_id::text
  );
  insert into public.project_item_files (project_item_id, file_id)
  values (v_project_item_id, v_file_id);

  if (select visibility from public.commercial_files where id = v_file_id) <> 'internal' then
    raise exception 'un fichier sans visibilité explicite doit rester interne';
  end if;

  select count(*) into v_count from public.commercial_quote_line_files
  where quote_line_id = v_quote_line_id and file_id = v_file_id;
  if v_count <> 1 then
    raise exception 'le fichier de ligne projet n a pas été propagé à la ligne de devis';
  end if;

  insert into public.commercial_orders (
    id, tenant_id, customer_id, quote_id, number, status, source_quote_status,
    lines_subtotal, global_discount, effective_discount_rate, net_total,
    vat_rate, vat_amount, total_incl_tax
  ) values (
    v_order_id, v_tenant_id, v_customer_id, v_quote_id,
    'TEST-FILE-' || left(v_order_id::text, 8), 'validated', 'sent',
    0, 0, 0, 0, 0, 0, 0
  );
  insert into public.commercial_order_lines (
    id, order_id, source_quote_line_id, origin, label, product_config,
    quantity, position, production_price, public_price, customer_price,
    applied_margin_rate, sale_price, breakdown
  ) values (
    v_order_line_id, v_order_id, v_quote_line_id, 'project_item', 'Test fichier', '{}',
    1, 0, 0, 0, 0, 0, 0, '[{}]'
  );

  select count(*) into v_count from public.commercial_order_line_files
  where order_line_id = v_order_line_id and file_id = v_file_id;
  if v_count <> 1 then
    raise exception 'le fichier de ligne de devis n a pas été propagé à la ligne de commande';
  end if;
end;
$$;

rollback;
