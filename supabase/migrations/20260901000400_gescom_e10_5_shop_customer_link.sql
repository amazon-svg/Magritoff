-- ============================================================================
-- Sprint 5 Gestion commerciale — story E10.5 : dissociation comptes Magrit /
-- comptes clients boutique.
-- ----------------------------------------------------------------------------
-- Deux axes preexistants, distincts, non touches ici :
--   - UM1 (`tenant_members.access_scope`) distingue deux types de MEMBRES
--     INTERNES du tenant ('magrit_full' vs 'shop_only', legacy gele).
--   - `shop_customer_accounts` (UM1.1, 20260816000100) porte les comptes
--     CLIENTS d une boutique, deja isoles de `tenant_members`.
-- E10.5 relie ce second axe au referentiel Client de gestion (E10.4,
-- `customer_contacts`, 20260901000300) : ouvrir un acces boutique a un
-- interlocuteur est desormais une action explicite qui cree/relie un
-- `shop_customer_accounts.customer_contact_id`, et porte EN BASE la garantie
-- qu un compte ne peut jamais etre a la fois membre interne et client
-- boutique (CA5).
-- ============================================================================

-- ── CA3 — lien optionnel interlocuteur -> compte boutique ───────────────────
-- Nullable : un compte boutique auto-inscrit ou legacy (storefront public)
-- n a aucun interlocuteur E10.4 associe et le conserve ainsi.
alter table public.shop_customer_accounts
  add column if not exists customer_contact_id uuid
    references public.customer_contacts(id) on delete set null;

comment on column public.shop_customer_accounts.customer_contact_id is
  'E10.5 CA3 — interlocuteur (customer_contacts) a l origine de l ouverture explicite de cet acces boutique. NULL pour un compte auto-inscrit ou legacy, sans lien de gestion.';

-- Un interlocuteur n a qu un seul compte boutique par boutique : la table est
-- deja scopee par `shop_id`, l unicite se pose donc sur (shop_id,
-- customer_contact_id), partielle car NULL est autorise et repete.
create unique index if not exists shop_customer_accounts_shop_contact_uidx
  on public.shop_customer_accounts (shop_id, customer_contact_id)
  where customer_contact_id is not null;

create index if not exists shop_customer_accounts_customer_contact_idx
  on public.shop_customer_accounts (customer_contact_id)
  where customer_contact_id is not null;

-- Coherence inter-tenant : l interlocuteur et la boutique liee doivent
-- appartenir au MEME tenant. Aucune des deux tables n a de contrainte FK
-- directe l une vers l autre pour l exprimer nativement : un trigger porte
-- ici la garantie EN BASE plutot que de la laisser a la seule application.
create or replace function public.enforce_shop_customer_contact_tenant_match()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_match boolean;
begin
  if new.customer_contact_id is null then
    return new;
  end if;

  select exists (
    select 1
    from public.customer_contacts cc
    join public.customers c on c.id = cc.customer_id
    join public.shops s on s.id = new.shop_id
    where cc.id = new.customer_contact_id
      and c.tenant_id = s.tenant_id
  ) into v_match;

  if not v_match then
    raise exception 'shop_customer_contact_tenant_mismatch: l interlocuteur et la boutique doivent appartenir au meme tenant';
  end if;

  return new;
end;
$$;

drop trigger if exists shop_customer_accounts_enforce_contact_tenant_match
  on public.shop_customer_accounts;
create trigger shop_customer_accounts_enforce_contact_tenant_match
  before insert or update of customer_contact_id, shop_id
  on public.shop_customer_accounts
  for each row execute function public.enforce_shop_customer_contact_tenant_match();

-- Le flux applicatif (POST/DELETE .../shop-access) ecrit `customer_contact_id`
-- via le meme role `authenticated` que le reste de la table (20260816000200) :
-- les grants colonne sont additifs, ils s ajoutent a la liste deja accordee.
grant insert (customer_contact_id) on table public.shop_customer_accounts to authenticated;
grant update (customer_contact_id) on table public.shop_customer_accounts to authenticated;

-- ── CA5 — exclusivite : jamais a la fois membre interne et client boutique ──
-- Porte par DEUX triggers symetriques (l ecriture peut arriver par l une ou
-- l autre table) plutot qu une seule verification applicative, conformement
-- a la lecon du sprint : une regle de securite est prouvee en base, pas
-- seulement declaree cote service.
create or replace function public.enforce_shop_customer_not_tenant_member()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.auth_subject_id is not null and exists (
    select 1 from public.tenant_members tm where tm.user_id = new.auth_subject_id
  ) then
    raise exception 'identity_exclusivity_violation: ce compte auth est deja membre interne (tenant_members) d un espace Magrit';
  end if;
  return new;
end;
$$;

drop trigger if exists shop_customer_accounts_enforce_exclusivity
  on public.shop_customer_accounts;
create trigger shop_customer_accounts_enforce_exclusivity
  before insert or update of auth_subject_id
  on public.shop_customer_accounts
  for each row execute function public.enforce_shop_customer_not_tenant_member();

create or replace function public.enforce_tenant_member_not_shop_customer()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if exists (
    select 1 from public.shop_customer_accounts sca
    where sca.auth_subject_id = new.user_id
  ) then
    raise exception 'identity_exclusivity_violation: ce compte auth est deja un compte client boutique (shop_customer_accounts)';
  end if;
  return new;
end;
$$;

drop trigger if exists tenant_members_enforce_exclusivity
  on public.tenant_members;
create trigger tenant_members_enforce_exclusivity
  before insert or update of user_id
  on public.tenant_members
  for each row execute function public.enforce_tenant_member_not_shop_customer();

-- ── CA4 — reconnaitre un principal "client boutique" depuis la facade API ──
-- Meme principe que `current_user_tenant_ids()` (RLS et facade partagent la
-- MEME fonction) : la facade /api/v1 (SupabaseApiPrincipalVerifier) appelle
-- cette primitive pour refuser explicitement 403 `auth.scope_forbidden` a un
-- compte client boutique qui tenterait une route reservee au back-office,
-- plutot que de le laisser echouer plus tard sur une liste d espaces vide.
create or replace function public.current_user_is_shop_customer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.shop_customer_accounts where auth_subject_id = auth.uid()
  );
$$;

revoke all on function public.current_user_is_shop_customer() from public, anon;
grant execute on function public.current_user_is_shop_customer() to authenticated;

notify pgrst, 'reload schema';

-- ============================================================================
-- REVERSIBILITE — le CLI Supabase ne gere pas de bloc `down`. SQL de retrait,
-- a jouer tel quel dans une migration inverse si la story est annulee :
--
--   revoke execute on function public.current_user_is_shop_customer() from authenticated;
--   drop function if exists public.current_user_is_shop_customer();
--   drop trigger if exists tenant_members_enforce_exclusivity on public.tenant_members;
--   drop function if exists public.enforce_tenant_member_not_shop_customer();
--   drop trigger if exists shop_customer_accounts_enforce_exclusivity on public.shop_customer_accounts;
--   drop function if exists public.enforce_shop_customer_not_tenant_member();
--   revoke update (customer_contact_id) on table public.shop_customer_accounts from authenticated;
--   revoke insert (customer_contact_id) on table public.shop_customer_accounts from authenticated;
--   drop trigger if exists shop_customer_accounts_enforce_contact_tenant_match on public.shop_customer_accounts;
--   drop function if exists public.enforce_shop_customer_contact_tenant_match();
--   drop index if exists public.shop_customer_accounts_customer_contact_idx;
--   drop index if exists public.shop_customer_accounts_shop_contact_uidx;
--   alter table public.shop_customer_accounts drop column if exists customer_contact_id;
--   notify pgrst, 'reload schema';
-- ============================================================================
