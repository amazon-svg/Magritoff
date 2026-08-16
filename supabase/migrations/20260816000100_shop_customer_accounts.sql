-- UM1.1 — Comptes clients strictement liés à une boutique.
-- Migration additive : aucun tenant_member/shop_only existant n'est modifié.

create table if not exists public.shop_customer_accounts (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  email text not null,
  normalized_email text generated always as (lower(btrim(email))) stored,
  full_name text not null,
  auth_subject_id uuid unique references auth.users(id) on delete set null,
  status text not null default 'delegated_only',
  created_by_magrit_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  suspended_at timestamptz,

  constraint shop_customer_accounts_email_shape_check
    check (length(btrim(email)) between 3 and 320 and position('@' in email) > 1),
  constraint shop_customer_accounts_full_name_check
    check (length(btrim(full_name)) between 1 and 200),
  constraint shop_customer_accounts_status_check
    check (status in ('delegated_only', 'invited', 'active', 'suspended')),
  constraint shop_customer_accounts_shop_email_unique
    unique (shop_id, normalized_email),
  constraint shop_customer_accounts_activation_check
    check (status <> 'active' or activated_at is not null),
  constraint shop_customer_accounts_suspension_check
    check (status <> 'suspended' or suspended_at is not null)
);

create index if not exists shop_customer_accounts_shop_status_idx
  on public.shop_customer_accounts (shop_id, status);

create index if not exists shop_customer_accounts_created_by_idx
  on public.shop_customer_accounts (created_by_magrit_user_id)
  where created_by_magrit_user_id is not null;

comment on table public.shop_customer_accounts is
  'Comptes clients isolés par boutique ; distincts des utilisateurs Magrit tenant_members.';
comment on column public.shop_customer_accounts.normalized_email is
  'Clé email canonique calculée par PostgreSQL ; unique uniquement dans une boutique.';
comment on column public.shop_customer_accounts.auth_subject_id is
  'Identifiant Auth technique non exposé au storefront.';

alter table public.shop_customer_accounts enable row level security;

-- Default deny intentionnel pour UM1.1 : aucune policy navigateur n'est créée.
-- Les accès workspace arriveront avec la capability dédiée ; les accès client
-- seront servis par le BFF storefront après stabilisation du contrat UM2.
revoke all on table public.shop_customer_accounts from anon, authenticated;

notify pgrst, 'reload schema';
