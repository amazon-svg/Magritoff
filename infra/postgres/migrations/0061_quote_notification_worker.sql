create function magrit.outbox_quote_context(requested_tenant_id uuid,requested_quote_id uuid)
returns table(valid_until date)
language sql stable security definer
set search_path=pg_catalog,public,magrit
as $$
  select quote.valid_until
    from public.commercial_quotes quote
   where quote.id=requested_quote_id and quote.tenant_id=requested_tenant_id
$$;

create function magrit.outbox_quote_recipients(requested_tenant_id uuid,requested_customer_id uuid)
returns table(email text,customer_name text,shop_slug text,shop_name text)
language sql stable security definer
set search_path=pg_catalog,public,magrit
as $$
  select account.email,
         coalesce(nullif(btrim(account.full_name),''),account.email),
         shop.slug,
         coalesce(nullif(btrim(shop.name),''),shop.slug)
    from public.shop_customer_accounts account
    join public.customer_contacts contact on contact.id=account.customer_contact_id
    join public.customers customer
      on customer.id=contact.customer_id and customer.tenant_id=account.tenant_id
    join public.shops shop
      on shop.id=account.shop_id and shop.tenant_id=account.tenant_id
   where account.tenant_id=requested_tenant_id
     and contact.customer_id=requested_customer_id
     and account.status in ('active','invited')
     and shop.deleted_at is null
   order by account.id
$$;

create function magrit.outbox_quote_document_path(requested_tenant_id uuid,requested_quote_id uuid)
returns text
language sql stable security definer
set search_path=pg_catalog,public,magrit
as $$
  select document.storage_path
    from public.quote_documents document
   where document.tenant_id=requested_tenant_id and document.quote_id=requested_quote_id
$$;

revoke all on function magrit.outbox_quote_context(uuid,uuid),
  magrit.outbox_quote_recipients(uuid,uuid),
  magrit.outbox_quote_document_path(uuid,uuid)
  from public,magrit_api,magrit_readonly;
grant execute on function magrit.outbox_quote_context(uuid,uuid),
  magrit.outbox_quote_recipients(uuid,uuid),
  magrit.outbox_quote_document_path(uuid,uuid)
  to magrit_worker;

comment on function magrit.outbox_quote_recipients(uuid,uuid) is
  'Projection strictement bornée des destinataires quote.sent, réservée au worker.';
comment on function magrit.outbox_quote_document_path(uuid,uuid) is
  'Résout uniquement la clé S3 du PDF quote.sent dans le tenant explicite.';
