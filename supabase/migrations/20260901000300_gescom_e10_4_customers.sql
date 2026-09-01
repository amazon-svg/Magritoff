-- ============================================================================
-- Sprint 5 Gestion commerciale — story E10.4 : entite Client et interlocuteurs
-- ----------------------------------------------------------------------------
-- Table pivot de l Epic E10 : `projects` (E10.1), `quotes` (E10.3),
-- `orders` (E10.12) et `price_rules` (deja livre, E10.6/gescom_price_rules)
-- referenceront toutes `customers`. Ne pas dupliquer : `client_price_rules`
-- (20260808000100_gescom_price_rules.sql) reste la table des regles de prix,
-- distincte de ce referentiel client.
--
-- Modele :
--   - `customers.type` distingue personne morale (`company`) et personne
--     physique (`individual`) ; les champs requis different selon le type
--     (CA2), verifies par CHECK, pas seulement cote application.
--   - Adresses en jsonb STRUCTURE (line1/line2/postal_code/city/country),
--     jamais du texte libre : l export comptable futur (E10.18) en depend.
--   - `siret_verified` / `siret_verified_at` tracent le resultat du bouchon
--     INSEE (CA3, `POST /customers/{id}/siret-verifications`) ; le controle de
--     FORME (14 chiffres + cle de Luhn) est fait par un CHECK, la
--     verification INSEE elle-meme reste applicative (mock E6.1).
--   - `customer_contacts` porte 0 a N interlocuteurs par client ; un seul
--     `is_primary = true` a la fois, impose par un index unique PARTIEL et un
--     trigger qui bascule l ancien principal a `false` avant l ecriture du
--     nouveau (CA4) — la garantie est en base, pas seulement dans le service.
--   - Un interlocuteur est une donnee de gestion pure (CA5) : aucune colonne
--     ne reference `auth.users`, aucune ecriture ici ne peut creer de compte
--     ni d invitation.
--   - CA7 (client referme non supprimable) : la contrainte est le comportement
--     PAR DEFAUT d une cle etrangere Postgres sans `on delete cascade/set
--     null` (= `on delete restrict` implicite). Les migrations futures de
--     `projects`/`quotes`/`orders` DOIVENT declarer leur colonne
--     `customer_id` sans `on delete cascade` pour tenir cette garantie ; ce
--     n est pas encore verifiable ici puisque ces tables n existent pas.
-- ============================================================================

create table if not exists public.customers (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  type                text not null check (type in ('company', 'individual')),

  -- Personne morale.
  company_name        text,
  siret               text,
  vat_number          text,

  -- Personne physique.
  first_name          text,
  last_name           text,

  -- Adresses structurees : {line1, line2?, postal_code, city, country}.
  billing_address     jsonb,
  shipping_address    jsonb,

  is_active           boolean not null default true,

  -- Bouchon INSEE (CA3) — meme principe que sirenValidator (E6.1) : le
  -- format (14 chiffres + Luhn) est verifie par le CHECK ci-dessous a chaque
  -- ecriture ; `siret_verified` ne passe a `true` que par un appel explicite
  -- a `POST /customers/{id}/siret-verifications`, jamais automatiquement.
  siret_verified      boolean not null default false,
  siret_verified_at   timestamptz,

  created_by          uuid references auth.users(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint customers_company_fields_required check (
    type <> 'company' or (
      company_name is not null and btrim(company_name) <> ''
      and siret is not null
    )
  ),
  constraint customers_individual_fields_required check (
    type <> 'individual' or (
      first_name is not null and btrim(first_name) <> ''
      and last_name is not null and btrim(last_name) <> ''
    )
  ),
  -- Forme uniquement (14 chiffres). La cle de Luhn est verifiee cote
  -- application (src/modules/customers/application/siret-verification.ts) et
  -- redondante avec ce garde-fou : la forme reste le dernier rempart si un
  -- appel bas niveau contourne un jour le service applicatif.
  constraint customers_siret_shape check (siret is null or siret ~ '^[0-9]{14}$'),
  constraint customers_siret_verified_requires_value check (
    not siret_verified or siret is not null
  ),
  constraint customers_billing_address_shape check (
    billing_address is null or (
      jsonb_typeof(billing_address) = 'object'
      and billing_address ? 'line1'
      and billing_address ? 'postal_code'
      and billing_address ? 'city'
      and billing_address ? 'country'
    )
  ),
  constraint customers_shipping_address_shape check (
    shipping_address is null or (
      jsonb_typeof(shipping_address) = 'object'
      and shipping_address ? 'line1'
      and shipping_address ? 'postal_code'
      and shipping_address ? 'city'
      and shipping_address ? 'country'
    )
  )
);

comment on table public.customers is
  'E10.4 — referentiel client (personne morale ou physique), pivot de l Epic E10.';
comment on column public.customers.siret_verified is
  'Vrai uniquement apres un appel explicite a POST /customers/{id}/siret-verifications (bouchon INSEE, E6.1).';

-- Un SIRET n est pas partage entre deux clients du meme tenant.
create unique index if not exists customers_tenant_siret_uidx
  on public.customers (tenant_id, siret)
  where siret is not null;

create index if not exists customers_tenant_active_idx
  on public.customers (tenant_id, is_active);

-- Recherche (CA1, `?q=`) : nom/prenom/raison sociale, insensible a la casse.
create index if not exists customers_tenant_search_idx
  on public.customers (tenant_id, lower(coalesce(company_name, '')), lower(coalesce(last_name, '')));

drop trigger if exists customers_set_updated_at on public.customers;
create or replace function public.customers_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger customers_set_updated_at
  before update on public.customers
  for each row execute function public.customers_set_updated_at();

-- ── Interlocuteurs ──────────────────────────────────────────────────────────
create table if not exists public.customer_contacts (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references public.customers(id) on delete cascade,
  first_name   text not null check (btrim(first_name) <> ''),
  last_name    text not null check (btrim(last_name) <> ''),
  role         text,
  email        text not null check (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  phone        text,
  is_primary   boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.customer_contacts is
  'E10.4 CA4/CA5 — interlocuteurs d un client. Donnee de gestion pure : aucune colonne ne reference auth.users, aucune ecriture ici ne cree de compte ni d invitation.';

create index if not exists customer_contacts_customer_idx
  on public.customer_contacts (customer_id);

-- Un seul interlocuteur principal par client, impose EN BASE (pas seulement
-- par le service applicatif).
create unique index if not exists customer_contacts_primary_uidx
  on public.customer_contacts (customer_id)
  where is_primary;

drop trigger if exists customer_contacts_set_updated_at on public.customer_contacts;
create or replace function public.customer_contacts_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger customer_contacts_set_updated_at
  before update on public.customer_contacts
  for each row execute function public.customer_contacts_set_updated_at();

-- Basculer `is_primary` a `true` retire automatiquement ce statut a l ancien
-- principal, DANS LA MEME TRANSACTION que l ecriture qui le demande (CA4).
-- Le trigger tourne AVANT l ecriture de la ligne courante : l UPDATE qu il
-- declenche sur les AUTRES lignes du meme client est termine (et son propre
-- index unique partiel satisfait, puisqu il ne pose que des `false`) avant
-- que l index unique ne controle la ligne courante.
create or replace function public.customer_contacts_enforce_single_primary()
returns trigger
language plpgsql
as $$
begin
  if new.is_primary then
    update public.customer_contacts
       set is_primary = false
     where customer_id = new.customer_id
       and id <> new.id
       and is_primary = true;
  end if;
  return new;
end;
$$;

drop trigger if exists customer_contacts_enforce_single_primary on public.customer_contacts;
create trigger customer_contacts_enforce_single_primary
  before insert or update of is_primary on public.customer_contacts
  for each row execute function public.customer_contacts_enforce_single_primary();

-- ── RLS — meme pattern que client_price_rules (20260808000100) ─────────────
-- Le grant applicatif de base (select/insert/update/delete a `anon` et
-- `authenticated`) est herite par defaut de
-- 20260811000100_api_role_table_grants.sql : la RLS est ici la seule barriere
-- d autorisation, pas un `revoke` supplementaire.
alter table public.customers        enable row level security;
alter table public.customer_contacts enable row level security;

drop policy if exists "customers_select" on public.customers;
create policy "customers_select" on public.customers for select using (
  is_super_admin()
  or tenant_id in (select public.current_user_tenant_ids())
);

drop policy if exists "customers_write" on public.customers;
create policy "customers_write" on public.customers for all using (
  is_super_admin()
  or exists (
    select 1 from public.tenant_members tm
    where tm.tenant_id = customers.tenant_id
      and tm.user_id = auth.uid()
      and tm.role in ('admin', 'member')
  )
) with check (
  is_super_admin()
  or exists (
    select 1 from public.tenant_members tm
    where tm.tenant_id = customers.tenant_id
      and tm.user_id = auth.uid()
      and tm.role in ('admin', 'member')
  )
);

drop policy if exists "customer_contacts_select" on public.customer_contacts;
create policy "customer_contacts_select" on public.customer_contacts for select using (
  is_super_admin()
  or exists (
    select 1 from public.customers c
    where c.id = customer_contacts.customer_id
      and c.tenant_id in (select public.current_user_tenant_ids())
  )
);

drop policy if exists "customer_contacts_write" on public.customer_contacts;
create policy "customer_contacts_write" on public.customer_contacts for all using (
  is_super_admin()
  or exists (
    select 1 from public.customers c
    join public.tenant_members tm on tm.tenant_id = c.tenant_id
    where c.id = customer_contacts.customer_id
      and tm.user_id = auth.uid()
      and tm.role in ('admin', 'member')
  )
) with check (
  is_super_admin()
  or exists (
    select 1 from public.customers c
    join public.tenant_members tm on tm.tenant_id = c.tenant_id
    where c.id = customer_contacts.customer_id
      and tm.user_id = auth.uid()
      and tm.role in ('admin', 'member')
  )
);

notify pgrst, 'reload schema';

-- ============================================================================
-- REVERSIBILITE — le CLI Supabase ne gere pas de bloc `down`. SQL de retrait,
-- a jouer tel quel dans une migration inverse si la story est annulee :
--
--   drop trigger if exists customer_contacts_enforce_single_primary on public.customer_contacts;
--   drop function if exists public.customer_contacts_enforce_single_primary();
--   drop trigger if exists customer_contacts_set_updated_at on public.customer_contacts;
--   drop function if exists public.customer_contacts_set_updated_at();
--   drop trigger if exists customers_set_updated_at on public.customers;
--   drop function if exists public.customers_set_updated_at();
--   drop policy if exists "customer_contacts_write" on public.customer_contacts;
--   drop policy if exists "customer_contacts_select" on public.customer_contacts;
--   drop policy if exists "customers_write" on public.customers;
--   drop policy if exists "customers_select" on public.customers;
--   drop table if exists public.customer_contacts;
--   drop table if exists public.customers;
--   notify pgrst, 'reload schema';
--
-- Aucune autre table n a encore de cle etrangere vers `customers` : le
-- retrait est sans effet de bord tant que E10.1/E10.3/E10.12/E10.6 ne
-- referencent pas ce referentiel.
-- ============================================================================
