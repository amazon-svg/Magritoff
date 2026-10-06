-- Le lien devis -> commande utilise désormais la projection commune. Le même
-- filtre est appliqué par le lecteur d'export afin que la sélection demeure
-- identique à celle de la liste.

create or replace function magrit.read_order_export_rows(
  requested_export_id uuid,requested_after jsonb,requested_limit integer
) returns table(cursor jsonb,payload jsonb)
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
      and ($2->>''quote_id'' is null or h.quote_id=($2->>''quote_id'')::uuid)
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

revoke all on function magrit.read_order_export_rows(uuid,jsonb,integer) from public;
grant execute on function magrit.read_order_export_rows(uuid,jsonb,integer) to magrit_worker;
