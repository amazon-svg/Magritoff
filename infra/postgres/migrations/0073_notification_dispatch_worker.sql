create function magrit.notification_active_templates(
  requested_tenant_id uuid,
  requested_event_name text,
  requested_to_step_id uuid default null
)
returns table(
  id uuid,channel text,audience text,recipients text[],subject text,body text
)
language sql stable security definer
set search_path=pg_catalog,public,magrit
as $$
  select template.id,template.channel,template.audience,template.recipients,template.subject,template.body
    from public.notification_templates template
   where template.tenant_id=requested_tenant_id
     and template.event_name=requested_event_name
     and template.is_active
     and (
       requested_to_step_id is null
       or template.production_step_id is null
       or template.production_step_id=requested_to_step_id
     )
   order by template.created_at,template.id
$$;

create function magrit.notification_customer_context(requested_tenant_id uuid,requested_customer_id uuid)
returns table(tenant_name text,customer_company_name text,customer_default_contact_name text)
language sql stable security definer
set search_path=pg_catalog,public,magrit
as $$
  select tenant.name,customer.company_name,
         coalesce(
           nullif(btrim(concat_ws(' ',contact.first_name,contact.last_name)),''),
           case when customer.type='individual'
             then btrim(concat_ws(' ',customer.first_name,customer.last_name))
             else coalesce(customer.company_name,'') end
         )
    from public.tenants tenant
    join public.customers customer on customer.tenant_id=tenant.id
    left join lateral (
      select candidate.first_name,candidate.last_name
        from public.customer_contacts candidate
       where candidate.customer_id=customer.id and candidate.is_primary
       order by candidate.id limit 1
    ) contact on true
   where tenant.id=requested_tenant_id and customer.id=requested_customer_id
$$;

create function magrit.notification_order_step_context(
  requested_tenant_id uuid,requested_order_id uuid,requested_customer_id uuid,
  requested_to_step_id uuid,requested_from_step_id uuid default null
)
returns table(
  tenant_name text,customer_company_name text,customer_default_contact_name text,
  order_customer_reference text,order_expected_delivery_date date,
  step_label text,step_previous_label text
)
language sql stable security definer
set search_path=pg_catalog,public,magrit
as $$
  select context.tenant_name,context.customer_company_name,context.customer_default_contact_name,
         orders.customer_reference,orders.expected_delivery_date,to_step.label,from_step.label
    from magrit.notification_customer_context(requested_tenant_id,requested_customer_id) context
    join public.commercial_orders orders
      on orders.id=requested_order_id and orders.tenant_id=requested_tenant_id
     and orders.customer_id=requested_customer_id
    join public.production_steps to_step
      on to_step.id=requested_to_step_id and to_step.tenant_id=requested_tenant_id
    left join public.production_steps from_step
      on from_step.id=requested_from_step_id and from_step.tenant_id=requested_tenant_id
$$;

create function magrit.notification_quote_sent_context(
  requested_tenant_id uuid,requested_quote_id uuid,requested_customer_id uuid
)
returns table(
  tenant_name text,customer_company_name text,customer_default_contact_name text,quote_valid_until date
)
language sql stable security definer
set search_path=pg_catalog,public,magrit
as $$
  select context.tenant_name,context.customer_company_name,context.customer_default_contact_name,quote.valid_until
    from magrit.notification_customer_context(requested_tenant_id,requested_customer_id) context
    join public.commercial_quotes quote
      on quote.id=requested_quote_id and quote.tenant_id=requested_tenant_id
     and quote.customer_id=requested_customer_id
$$;

create function magrit.notification_order_files_context(
  requested_tenant_id uuid,requested_order_id uuid,requested_customer_id uuid
)
returns table(
  tenant_name text,customer_company_name text,customer_default_contact_name text,order_customer_reference text
)
language sql stable security definer
set search_path=pg_catalog,public,magrit
as $$
  select context.tenant_name,context.customer_company_name,context.customer_default_contact_name,
         orders.customer_reference
    from magrit.notification_customer_context(requested_tenant_id,requested_customer_id) context
    join public.commercial_orders orders
      on orders.id=requested_order_id and orders.tenant_id=requested_tenant_id
     and orders.customer_id=requested_customer_id
$$;

create function magrit.notification_customer_recipients(requested_tenant_id uuid,requested_customer_id uuid)
returns table(email text,contact_name text,shop_slug text,shop_name text)
language sql stable security definer
set search_path=pg_catalog,public,magrit
as $$
  select account.email,coalesce(nullif(btrim(account.full_name),''),account.email),
         shop.slug,coalesce(nullif(btrim(shop.name),''),shop.slug)
    from public.shop_customer_accounts account
    join public.customer_contacts contact on contact.id=account.customer_contact_id
    join public.customers customer on customer.id=contact.customer_id
    join public.shops shop on shop.id=account.shop_id
   where customer.id=requested_customer_id and customer.tenant_id=requested_tenant_id
     and account.tenant_id=requested_tenant_id and shop.tenant_id=requested_tenant_id
     and account.status in('active','invited')
   order by account.email,account.id
$$;

create function magrit.notification_default_shop(requested_tenant_id uuid)
returns table(slug text,name text)
language sql stable security definer
set search_path=pg_catalog,public,magrit
as $$
  select shop.slug,coalesce(nullif(btrim(shop.name),''),shop.slug)
    from public.shops shop
   where shop.tenant_id=requested_tenant_id and shop.active and shop.deleted_at is null
   order by shop.created_at,shop.id limit 1
$$;

revoke all on function magrit.notification_active_templates(uuid,text,uuid),
  magrit.notification_customer_context(uuid,uuid),
  magrit.notification_order_step_context(uuid,uuid,uuid,uuid,uuid),
  magrit.notification_quote_sent_context(uuid,uuid,uuid),
  magrit.notification_order_files_context(uuid,uuid,uuid),
  magrit.notification_customer_recipients(uuid,uuid),
  magrit.notification_default_shop(uuid)
  from public,magrit_api,magrit_readonly;
grant execute on function magrit.notification_active_templates(uuid,text,uuid),
  magrit.notification_customer_context(uuid,uuid),
  magrit.notification_order_step_context(uuid,uuid,uuid,uuid,uuid),
  magrit.notification_quote_sent_context(uuid,uuid,uuid),
  magrit.notification_order_files_context(uuid,uuid,uuid),
  magrit.notification_customer_recipients(uuid,uuid),
  magrit.notification_default_shop(uuid)
  to magrit_worker;
