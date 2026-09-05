-- ============================================================================
-- Sprint 5 Gestion commerciale — story E10.6 : referentiel des regles de prix
-- (marge publique standard et regles ciblees)
-- ----------------------------------------------------------------------------
-- Decision RP du 28/08/2026 : le prix Clariprint est un cout de production ;
-- Magrit y applique ses propres regles commerciales. Amendements WM du
-- 01/09/2026 (font foi, remplacent la version du 28/08) :
--   - `name` obligatoire et non vide ;
--   - `is_active` est l etat COURANT de la regle (pas un soft-delete), bascule
--     depuis la liste ;
--   - AUCUNE contrainte d exclusion sur les periodes : le chevauchement de
--     dates est un etat NORMAL, arbitre a la LECTURE par E10.7 (regle la plus
--     specifique, puis la plus recente). Un index B-tree de selection suffit,
--     pas de GiST. Pas de colonne `split_from_rule_id` : une regle n est
--     jamais decoupee ni dupliquee a la creation d une autre.
--
-- ── Frontiere avec l existant — a lire AVANT toute modification ────────────
-- `public.client_price_rules` / `public.client_groups`
-- (20260808000100_gescom_price_rules.sql) decrivent une AUTRE notion, pas une
-- version anterieure de celle-ci :
--  - leur cible client est `auth.users` (un compte), celle d E10.6 est
--    `customers` (personne morale ou physique, E10.4) ;
--  - elles se departagent par une colonne `priority` saisie a la main ; E10.7
--    departage par la specificite de portee puis par la RECENCE ;
--  - elles portent un mode `fixed_price` et une cible `product`, hors
--    perimetre d E10.6 ;
--  - leur resolution vit dans le navigateur (`applyCommercialRules()`,
--    src/app/components/dashboard/commercial/commercial.helpers.ts), ce que
--    le sprint interdit desormais pour tout nouveau code.
-- Les deux referentiels coexistent donc durablement, exactement comme
-- `quotes` et `commercial_quotes` en E10.3 (docs/api/CONVENTIONS.md §8.6).
-- Aucune convergence n est faite en silence.
--
-- ── Modele ──────────────────────────────────────────────────────────────────
--   - `price_rules.scope` : 'global' (tout, tous clients) | 'range' (une
--     gamme, tous clients) | 'customer' (un client, toutes gammes) |
--     'customer_range' (un client ET une gamme). Specificite croissante dans
--     cet ordre — c est ce qui fonde l arbitrage d E10.7.
--   - `product_range_id` reference `public.product_gammes` (catalogue PIM
--     PARTAGE, sans tenant) ; `customer_id` reference `public.customers`
--     (E10.4, propre au tenant). Coherence scope <-> cibles imposee par CHECK,
--     dans LES DEUX SENS (requise ET interdite hors de sa portee).
--   - `value_type` : 'margin_rate' (ajoute) | 'discount_rate' (retranche).
--     Le SIGNE n est jamais dans `value` (toujours positif ou nul), le sens
--     est porte par `value_type` seul.
--   - Une regle n est JAMAIS supprimee physiquement : `is_active = false` +
--     conservation dans `price_rules_audit` (append-only, CA6).
--   - Marge publique standard par gamme (CA4) : `product_range_default_
--     margins`, PAS une ligne de `price_rules` — elle ne participe jamais a
--     l arbitrage d E10.7, c est le defaut sur lequel le PricingEngine
--     (E10.21) retombe. Identite = (tenant_id, product_range_id).
-- ============================================================================

-- ── Regles de prix ──────────────────────────────────────────────────────────
create table if not exists public.price_rules (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  name                text not null check (btrim(name) <> ''),
  scope               text not null check (scope in ('global', 'range', 'customer', 'customer_range')),
  product_range_id    uuid references public.product_gammes(id),
  customer_id         uuid references public.customers(id),
  value_type          text not null check (value_type in ('margin_rate', 'discount_rate')),
  value               numeric(6,4) not null check (value >= 0),
  valid_from          date not null,
  valid_to            date,
  is_active           boolean not null default true,
  created_by          uuid references auth.users(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  -- Coherence scope <-> cibles, dans LES DEUX SENS : une cible ignoree en
  -- silence donnerait une regle qui ne s applique pas la ou son auteur croit
  -- l avoir posee (CA2). L equivalence booleenne capture requis ET interdit
  -- en une seule contrainte.
  constraint price_rules_scope_customer_coherence check (
    (scope in ('customer', 'customer_range')) = (customer_id is not null)
  ),
  constraint price_rules_scope_range_coherence check (
    (scope in ('range', 'customer_range')) = (product_range_id is not null)
  ),
  -- `valid_to` INCLUS ; `null` = sans terme. `valid_to = valid_from` est donc
  -- une regle d un seul jour, valide (contrat, plusieurs occurrences :
  -- openapi/magrit-core.v1.yaml). Seul un `valid_to` STRICTEMENT anterieur a
  -- `valid_from` est rejete. Pas de contrainte d exclusion (amendement WM du
  -- 01/09) : le chevauchement entre deux regles est normal.
  constraint price_rules_period_order check (valid_to is null or valid_to >= valid_from)
);

comment on table public.price_rules is
  'E10.6 — referentiel des regles de marge/remise du tenant, portee croissante en specificite (global < range < customer < customer_range). Arbitrage des regles concurrentes (specificite puis recence) livre par E10.7.';
comment on column public.price_rules.is_active is
  'Etat de PREMIER PLAN (E10.6, amendement WM 01/09) : pas un effacement logique. Une regle desactivee reste listee et reactivable.';

-- Prepare le terrain pour la resolution d E10.7 (portee, cibles, etat, puis
-- date de debut et de creation decroissantes — l ordre exact qui depsartage
-- specificite puis recence).
create index if not exists price_rules_selection_idx
  on public.price_rules (tenant_id, scope, customer_id, product_range_id, is_active, valid_from desc, created_at desc);

-- Recherche par nom (CA5, `?q=`), insensible a la casse.
create index if not exists price_rules_tenant_name_idx
  on public.price_rules (tenant_id, lower(name));

drop trigger if exists price_rules_set_updated_at on public.price_rules;
create or replace function public.price_rules_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger price_rules_set_updated_at
  before update on public.price_rules
  for each row execute function public.price_rules_set_updated_at();

-- ── Audit append-only (CA6) ─────────────────────────────────────────────────
-- Meme pattern que `outbox_events` (20260901000100) : garde structurelle par
-- trigger, pas une convention d equipe. Auteur = `auth.uid()` (l acteur
-- REELLEMENT a l origine de l ecriture courante, distinct de
-- `price_rules.created_by` qui ne bouge jamais apres la creation).
create table if not exists public.price_rules_audit (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  price_rule_id  uuid not null references public.price_rules(id) on delete cascade,
  action         text not null check (action in ('created', 'updated', 'activated', 'deactivated')),
  actor_id       uuid references auth.users(id),
  occurred_at    timestamptz not null default now(),
  before_state   jsonb,
  after_state    jsonb not null
);

comment on table public.price_rules_audit is
  'E10.6 CA6 — journal append-only de toute creation/modification d une regle de prix (auteur, horodatage, valeurs avant/apres). Jamais edite ni supprime par l application.';

create index if not exists price_rules_audit_rule_idx
  on public.price_rules_audit (tenant_id, price_rule_id, occurred_at desc);

create or replace function public.price_rules_write_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action text;
  v_only_is_active_changed boolean;
begin
  if tg_op = 'INSERT' then
    insert into public.price_rules_audit (tenant_id, price_rule_id, action, actor_id, before_state, after_state)
    values (new.tenant_id, new.id, 'created', auth.uid(), null, to_jsonb(new));
    return new;
  end if;

  -- CA — un UPDATE qui ne bascule QUE `is_active` (tout le reste identique)
  -- est journalise `activated`/`deactivated` ; toute autre modification est
  -- journalisee `updated`, meme si `is_active` change aussi dans le meme
  -- UPDATE. Meme regle que celle appliquee cote API pour l evenement sortant
  -- `price_rule.changed` (contrat, `UpdatePriceRuleCommand`).
  v_only_is_active_changed :=
    old.is_active is distinct from new.is_active
    and old.name is not distinct from new.name
    and old.value is not distinct from new.value
    and old.valid_from is not distinct from new.valid_from
    and old.valid_to is not distinct from new.valid_to;

  v_action := case
    when v_only_is_active_changed then (case when new.is_active then 'activated' else 'deactivated' end)
    else 'updated'
  end;

  insert into public.price_rules_audit (tenant_id, price_rule_id, action, actor_id, before_state, after_state)
  values (new.tenant_id, new.id, v_action, auth.uid(), to_jsonb(old), to_jsonb(new));
  return new;
end;
$$;

drop trigger if exists price_rules_audit_insert on public.price_rules;
create trigger price_rules_audit_insert
  after insert on public.price_rules
  for each row execute function public.price_rules_write_audit();

drop trigger if exists price_rules_audit_update on public.price_rules;
create trigger price_rules_audit_update
  after update on public.price_rules
  for each row
  -- Ecarte les UPDATE no-op (aucune colonne reellement changee) : sans ce
  -- WHEN, un UPDATE qui ne change rien produirait quand meme une ligne d
  -- audit "updated" fantome.
  when (old.* is distinct from new.*)
  execute function public.price_rules_write_audit();

-- Append-only : ni le contenu ni les colonnes de tracabilite d une ligne
-- d audit ne sont jamais modifies ou supprimes par l application. Ecriture
-- reservee au trigger SECURITY DEFINER ci-dessus (proprietaire de la
-- fonction), aucun grant d ecriture direct n est accorde a `authenticated`/
-- `anon` (contrairement au grant par defaut herite de
-- 20260811000100_api_role_table_grants.sql, explicitement retire ici).
revoke insert, update, delete on table public.price_rules_audit from authenticated, anon;

-- ── Marge publique standard par gamme (CA4) ─────────────────────────────────
create table if not exists public.product_range_default_margins (
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  product_range_id  uuid not null references public.product_gammes(id),
  margin_rate       numeric(6,4) not null check (margin_rate >= 0),
  updated_by        uuid references auth.users(id),
  updated_at        timestamptz not null default now(),
  primary key (tenant_id, product_range_id)
);

comment on table public.product_range_default_margins is
  'E10.6 CA4 — marge publique standard du TENANT sur une gamme de produits partagee. Sert de defaut au PricingEngine (E10.21) quand aucune regle de public.price_rules ne s applique ; n entre jamais dans l arbitrage d E10.7.';

drop trigger if exists product_range_default_margins_set_updated_at on public.product_range_default_margins;
create or replace function public.product_range_default_margins_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger product_range_default_margins_set_updated_at
  before update on public.product_range_default_margins
  for each row execute function public.product_range_default_margins_set_updated_at();

-- ── RLS — meme pattern que customers/projects (E10.4/E10.1) ─────────────────
-- Le grant applicatif de base (select/insert/update/delete a `anon` et
-- `authenticated`) est herite par defaut de
-- 20260811000100_api_role_table_grants.sql pour `price_rules` et
-- `product_range_default_margins` : la RLS est la seule barriere
-- d autorisation pour ces deux tables, pas un `revoke` supplementaire.
alter table public.price_rules                     enable row level security;
alter table public.price_rules_audit                enable row level security;
alter table public.product_range_default_margins    enable row level security;

drop policy if exists "price_rules_select" on public.price_rules;
create policy "price_rules_select" on public.price_rules for select using (
  is_super_admin()
  or tenant_id in (select public.current_user_tenant_ids())
);

drop policy if exists "price_rules_write" on public.price_rules;
create policy "price_rules_write" on public.price_rules for all using (
  is_super_admin()
  or exists (
    select 1 from public.tenant_members tm
    where tm.tenant_id = price_rules.tenant_id
      and tm.user_id = auth.uid()
      and tm.role in ('admin', 'member')
  )
) with check (
  is_super_admin()
  or exists (
    select 1 from public.tenant_members tm
    where tm.tenant_id = price_rules.tenant_id
      and tm.user_id = auth.uid()
      and tm.role in ('admin', 'member')
  )
);

-- Defense en profondeur (meme raisonnement que `outbox_events`) : aucun grant
-- direct n est accorde a `authenticated`/`anon` sur `price_rules_audit`
-- (ci-dessus), mais la policy couvre le cas ou un grant serait ajoute plus
-- tard par erreur.
drop policy if exists "price_rules_audit_select" on public.price_rules_audit;
create policy "price_rules_audit_select" on public.price_rules_audit for select using (
  is_super_admin()
  or tenant_id in (select public.current_user_tenant_ids())
);

drop policy if exists "product_range_default_margins_select" on public.product_range_default_margins;
create policy "product_range_default_margins_select" on public.product_range_default_margins for select using (
  is_super_admin()
  or tenant_id in (select public.current_user_tenant_ids())
);

drop policy if exists "product_range_default_margins_write" on public.product_range_default_margins;
create policy "product_range_default_margins_write" on public.product_range_default_margins for all using (
  is_super_admin()
  or exists (
    select 1 from public.tenant_members tm
    where tm.tenant_id = product_range_default_margins.tenant_id
      and tm.user_id = auth.uid()
      and tm.role in ('admin', 'member')
  )
) with check (
  is_super_admin()
  or exists (
    select 1 from public.tenant_members tm
    where tm.tenant_id = product_range_default_margins.tenant_id
      and tm.user_id = auth.uid()
      and tm.role in ('admin', 'member')
  )
);

notify pgrst, 'reload schema';

-- ============================================================================
-- REVERSIBILITE — le CLI Supabase ne gere pas de bloc `down`. SQL de retrait,
-- a jouer tel quel dans une migration inverse si la story est annulee :
--
--   drop policy if exists "product_range_default_margins_write" on public.product_range_default_margins;
--   drop policy if exists "product_range_default_margins_select" on public.product_range_default_margins;
--   drop policy if exists "price_rules_audit_select" on public.price_rules_audit;
--   drop policy if exists "price_rules_write" on public.price_rules;
--   drop policy if exists "price_rules_select" on public.price_rules;
--   drop trigger if exists product_range_default_margins_set_updated_at on public.product_range_default_margins;
--   drop function if exists public.product_range_default_margins_set_updated_at();
--   drop trigger if exists price_rules_audit_update on public.price_rules;
--   drop trigger if exists price_rules_audit_insert on public.price_rules;
--   drop function if exists public.price_rules_write_audit();
--   drop trigger if exists price_rules_set_updated_at on public.price_rules;
--   drop function if exists public.price_rules_set_updated_at();
--   drop table if exists public.product_range_default_margins;
--   drop table if exists public.price_rules_audit;
--   drop table if exists public.price_rules;
--   notify pgrst, 'reload schema';
--
-- Aucune autre table ne reference `price_rules`/`price_rules_audit`/
-- `product_range_default_margins` : le retrait est sans effet de bord tant
-- que E10.7/E10.21 ne les referencent pas.
-- ============================================================================
