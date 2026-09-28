-- Description commerciale riche, distincte du payload technique.
-- L'API n'accepte qu'un sous-ensemble HTML sans attribut ; la base limite la
-- taille et assure la propagation project_item -> quote_line -> order_line.

alter table public.project_items
  add column if not exists description_html text;

alter table public.commercial_quote_lines
  add column if not exists description_html text;

alter table public.commercial_order_lines
  add column if not exists description_html text;

alter table public.project_items
  add constraint project_items_description_html_length
  check (description_html is null or char_length(description_html) <= 20000);

alter table public.commercial_quote_lines
  add constraint commercial_quote_lines_description_html_length
  check (description_html is null or char_length(description_html) <= 20000);

alter table public.commercial_order_lines
  add constraint commercial_order_lines_description_html_length
  check (description_html is null or char_length(description_html) <= 20000);

create or replace function public.commercial_escape_html(p_value text)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select replace(replace(replace(replace(replace(
    p_value, '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;'), '''', '&#39;')
$$;

create or replace function public.commercial_description_html_is_safe(p_value text)
returns boolean
language sql
immutable
strict
set search_path = ''
as $$
  select position('<' in regexp_replace(
      p_value,
      '</?(p|strong|em|ul|ol|li)>|<br[[:space:]]*/?>',
      '',
      'gi'
    )) = 0
    and position('>' in regexp_replace(
      p_value,
      '</?(p|strong|em|ul|ol|li)>|<br[[:space:]]*/?>',
      '',
      'gi'
    )) = 0
$$;

update public.project_items
set description_html = '<p>' || public.commercial_escape_html(label) || '</p>'
where description_html is null;

update public.commercial_quote_lines ql
set description_html = coalesce(
  (select pi.description_html from public.project_items pi where pi.id = ql.project_item_id),
  '<p>' || public.commercial_escape_html(ql.label) || '</p>'
)
where ql.description_html is null;

update public.commercial_order_lines ol
set description_html = coalesce(
  (select ql.description_html from public.commercial_quote_lines ql where ql.id = ol.source_quote_line_id),
  '<p>' || public.commercial_escape_html(ol.label) || '</p>'
)
where ol.description_html is null;

alter table public.project_items
  add constraint project_items_description_html_safe
  check (description_html is null or public.commercial_description_html_is_safe(description_html));

alter table public.commercial_quote_lines
  add constraint commercial_quote_lines_description_html_safe
  check (description_html is null or public.commercial_description_html_is_safe(description_html));

alter table public.commercial_order_lines
  add constraint commercial_order_lines_description_html_safe
  check (description_html is null or public.commercial_description_html_is_safe(description_html));

create or replace function public.commercial_quote_line_inherit_description()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.description_html is null then
    select source.description_html into new.description_html
    from public.commercial_quotes target_quote
    join public.commercial_quote_lines source
      on source.quote_id = target_quote.source_quote_id
     and source.position = new.position
    where target_quote.id = new.quote_id;

    if new.description_html is null and new.project_item_id is not null then
      select pi.description_html into new.description_html
      from public.project_items pi
      where pi.id = new.project_item_id;
    end if;

    new.description_html := coalesce(
      new.description_html,
      '<p>' || public.commercial_escape_html(new.label) || '</p>'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists commercial_quote_line_inherit_description_before_insert
  on public.commercial_quote_lines;
create trigger commercial_quote_line_inherit_description_before_insert
before insert on public.commercial_quote_lines
for each row execute function public.commercial_quote_line_inherit_description();

create or replace function public.commercial_order_line_inherit_description()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.description_html is null then
    select ql.description_html into new.description_html
    from public.commercial_quote_lines ql
    where ql.id = new.source_quote_line_id;
    new.description_html := coalesce(
      new.description_html,
      '<p>' || public.commercial_escape_html(new.label) || '</p>'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists commercial_order_line_inherit_description_before_insert
  on public.commercial_order_lines;
create trigger commercial_order_line_inherit_description_before_insert
before insert on public.commercial_order_lines
for each row execute function public.commercial_order_line_inherit_description();

comment on column public.project_items.description_html is
  'Description commerciale HTML sûre de la ligne projet, distincte du payload technique.';
comment on column public.commercial_quote_lines.description_html is
  'Description commerciale HTML sûre et modifiable tant que le devis est draft.';
comment on column public.commercial_order_lines.description_html is
  'Copie figée de la description HTML de la ligne de devis source.';

-- La vue portail est une fonction JSON en liste blanche : le nouveau champ
-- doit y être ajouté explicitement, sans exposer les données atelier.
create or replace function public.api_get_storefront_quote(
  p_opaque_token text,
  p_quote_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare
  v_session record;
  v_customer_id uuid;
  v_tenant_id uuid;
  v_quote_id uuid;
  v_number text;
  v_status text;
  v_sent_at timestamptz;
  v_valid_until date;
  v_show_discounts boolean;
  v_expired boolean;
  v_totals record;
  v_lines jsonb;
begin
  if p_opaque_token is null
     or length(p_opaque_token) not between 32 and 512
     or p_opaque_token !~ '^[A-Za-z0-9_-]+$'
     or p_quote_id is null then
    return null;
  end if;

  select * into v_session from public.api_resolve_shop_customer_session(p_opaque_token);
  if v_session.account_id is null then return null; end if;

  select s.tenant_id into v_tenant_id from public.shops s where s.id = v_session.shop_id;
  if v_tenant_id is null then return null; end if;

  select cc.customer_id into v_customer_id
  from public.shop_customer_accounts sca
  join public.customer_contacts cc on cc.id = sca.customer_contact_id
  where sca.id = v_session.account_id;
  if v_customer_id is null then return null; end if;

  select q.id, q.number, q.status, q.sent_at, q.valid_until, q.show_discounts
    into v_quote_id, v_number, v_status, v_sent_at, v_valid_until, v_show_discounts
  from public.commercial_quotes q
  join public.customers c on c.id = q.customer_id
  where q.id = p_quote_id
    and q.customer_id = v_customer_id
    and c.tenant_id = v_tenant_id
    and q.status in ('sent', 'accepted', 'rejected', 'converted');
  if not found then return null; end if;

  select * into v_totals from private.commercial_quote_totals(v_quote_id);
  v_expired := v_valid_until is not null
    and (now() at time zone 'utc') >= ((v_valid_until + 1)::timestamp);

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', l.id,
      'label', l.label,
      'description_html', l.description_html,
      'product_config', l.product_config,
      'quantity', l.quantity,
      'position', l.position,
      'price_before_discount', case when v_show_discounts then l.customer_price else null end,
      'discount_rate', case when v_show_discounts then l.discount_rate else null end,
      'price', l.sale_price
    ) order by l.position), '[]'::jsonb)
    into v_lines
  from public.commercial_quote_lines l
  where l.quote_id = v_quote_id;

  return jsonb_build_object(
    'id', v_quote_id,
    'number', v_number,
    'status', v_status,
    'issued_at', v_sent_at,
    'valid_until', v_valid_until,
    'expired', v_expired,
    'totals', jsonb_build_object(
      'lines_subtotal', v_totals.lines_subtotal,
      'global_discount', v_totals.global_discount,
      'effective_discount_rate', v_totals.effective_discount_rate,
      'net_total', v_totals.net_total,
      'vat_rate', v_totals.vat_rate,
      'vat_regime', v_totals.vat_regime,
      'vat_amount', v_totals.vat_amount,
      'total_incl_tax', v_totals.total_incl_tax
    ),
    'lines', v_lines
  );
end;
$$;

revoke all on function public.api_get_storefront_quote(text, uuid) from public, authenticated;
grant execute on function public.api_get_storefront_quote(text, uuid) to anon;
