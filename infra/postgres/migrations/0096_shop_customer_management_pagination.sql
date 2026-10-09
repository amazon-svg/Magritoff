-- Gestion back-office : pagination par curseur et historique d’un compte boutique.
create index shop_customer_accounts_page_idx
  on public.shop_customer_accounts(tenant_id,shop_id,created_at desc,id desc);
create index tenant_orders_shop_customer_page_idx
  on public.tenant_orders(tenant_id,shop_id,shop_customer_account_id,created_at desc,id desc)
  where shop_customer_account_id is not null;
