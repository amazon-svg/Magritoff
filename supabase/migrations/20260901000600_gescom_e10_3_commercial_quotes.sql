-- ============================================================================
-- Sprint 5 Gestion commerciale — story E10.3 : Creation d un devis depuis un
-- projet avec selection multi-produits.
-- ----------------------------------------------------------------------------
-- Decision RP du 28/08/2026 : un bouton « Creer un devis » dans l en-tete du
-- projet ouvre une selection des elements du projet, puis bascule vers l
-- edition du devis. Un projet peut donner lieu a plusieurs devis successifs
-- (CA7) : creer un devis ne consomme ni ne marque exclusivement un
-- `project_item`.
--
-- ── Pourquoi de NOUVELLES tables plutot que `quotes`/`quote_lines` ─────────
-- Une notion de "devis" existe deja en base depuis 20260418000003, etendue en
-- 20260702000100 (S-QUOTES-1, bibliotheque de devis editables) et exposee par
-- `src/modules/quotes/` (workflow storefront « demande de devis boutique »,
-- route legacy /api/v1/tenants/{tenantId}/quotes). C est un MODELE
-- INCOMPATIBLE avec celui exige par E10.3, pas une simple variante :
--   - `quotes.client_id` reference une table `clients` DROPPEE au Sprint 10
--     (20260602000100) ; le client y est un simple `client_name` texte, pas
--     `customers` (E10.4). E10.3 exige l heritage automatique du VRAI client
--     du projet (CA4), jamais une ressaisie texte.
--   - Aucune colonne `project_id` : rien ne relie un devis legacy a un
--     Espace Projets (E10.1), qui est le point d entree exige par cette story.
--   - Numerotation libre (`reference text`), jamais garantie unique ni
--     sequentielle par tenant : CA5 exige un numero `DEV-AAAA-NNNNN` unique et
--     sequentiel, porte en base, jamais calcule cote client.
--   - Le tenant y est adresse par le CHEMIN (`/tenants/{tenantId}/quotes`),
--     contraire au CA4 du socle E10.0 (tenant resolu depuis le jeton).
--   - Aucune colonne de prix au format `PricedLine` (E10.21) : `unit_cost_ht`/
--     `unit_price_ht`/`margin_pct` sont un modele de calcul de marge MAISON,
--     exactement ce que le sprint interdit de reproduire hors PricingEngine.
-- Le nom `quotes` etant deja pris par cette table incompatible, les nouvelles
-- tables portent un nom distinct : `commercial_quotes` / `commercial_quote_lines`
-- (domaine "Gestion commerciale", Epic E10). Aucune donnee ni logique n est
-- dupliquee : les deux systemes coexistent, la story ne touche a rien de
-- l existant `quotes`/`quote_lines`/`src/modules/quotes/`.
--
-- ── Modele ──────────────────────────────────────────────────────────────
--   - `commercial_quotes.customer_id` et `.project_id` sont NOT NULL,
--     heritees du projet source (CA4) : un devis n existe pas sans projet.
--   - `commercial_quotes.number` porte le numero metier CA5, unique par
--     tenant (contrainte `unique (tenant_id, number)`), attribue par la
--     fonction transactionnelle ci-dessous — jamais calcule cote client.
--   - `commercial_quotes.status` est 'draft' a la creation (CA6) ; les autres
--     valeurs ('sent','accepted','rejected','converted') existent au schema
--     pour les stories futures (E10.10, E10.12) et ne sont jamais produites
--     par cette story.
--   - `commercial_quotes.show_discounts` est un point d extension E10.10
--     (affichage des remises) : colonne presente, toujours `false` par
--     defaut tant que cette story n est pas livree.
--   - `commercial_quote_lines` porte les colonnes du format `PricedLine`
--     d E10.21 (interface PricingEngine) DES MAINTENANT, pour eviter une
--     migration cassante a l arrivee d E10.21 — E10.8 est gelee (WM du
--     01/09), aucun calcul de prix hors PricingEngine n est fait ici :
--       * `production_price` (cout de production, CA3) est LE SEUL prix
--         renseigne par cette story, repris tel quel du chiffrage source
--         (`project_items.quote_payload.amounts.clariprint_price_ht`, sinon
--         `.amounts.price`, sinon 0 — voir docs/api/CONVENTIONS.md) ;
--       * `public_price`, `customer_price`, `applied_margin_rate`,
--         `applied_rule_id` restent NULL, `breakdown` reste `'[]'` : une
--         story future (apres E10.21) les completera.
--   - `commercial_quote_lines.project_item_id` REFERENCE `project_items`
--     SANS `on delete cascade` implicite de suppression du lien : retirer un
--     devis ne touche jamais a l element de projet source (CA7), et un
--     element de projet reste disponible pour d autres devis.
--   - `commercial_quote_number_counters` porte l etat de la sequence
--     PAR TENANT ET PAR ANNEE (CA5). Elle n est accessible qu au travers de
--     la fonction `security definer` ci-dessous : la RLS n y declare AUCUNE
--     policy (deni par defaut), pour qu aucun appel direct ne puisse lire ou
--     avancer le compteur en dehors d une creation de devis reelle.
--   - `api_create_commercial_quote_from_project_items` est LA SEULE voie de
--     creation d un devis : numerotation, insertion du devis et de ses
--     lignes aboutissent ou echouent ENSEMBLE (une fonction plpgsql
--     s execute dans une seule transaction), condition posee explicitement
--     par la story pour eviter un trou de sequence ou un devis orphelin.
--     L incrementation du compteur utilise `insert ... on conflict do update
--     ... returning`, qui verrouille la ligne du compteur le temps de la
--     transaction : deux creations concurrentes sur le meme (tenant, annee)
--     se serialisent, jamais de numero duplique.
-- ============================================================================

create table if not exists public.commercial_quotes (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  customer_id     uuid not null references public.customers(id),
  project_id      uuid not null references public.projects(id),
  number          text not null check (btrim(number) <> ''),
  status          text not null default 'draft'
                    check (status in ('draft', 'sent', 'accepted', 'rejected', 'converted')),
  valid_until     date,
  show_discounts  boolean not null default false,
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint commercial_quotes_number_unique_per_tenant unique (tenant_id, number)
);

comment on table public.commercial_quotes is
  'E10.3 — devis cree depuis un projet (CA1-CA7). customer_id/project_id herites du projet source, jamais ressaisis. Nom distinct de la table legacy `quotes` (modele incompatible, cf. en-tete de migration).';
comment on column public.commercial_quotes.number is
  'CA5 — DEV-AAAA-NNNNN, unique et sequentiel par tenant et par annee. Attribue par api_create_commercial_quote_from_project_items, jamais calcule cote client.';
comment on column public.commercial_quotes.show_discounts is
  'Point d extension E10.10 (affichage des remises). Toujours false tant que cette story n est pas livree.';

create index if not exists commercial_quotes_tenant_created_idx
  on public.commercial_quotes (tenant_id, created_at desc);
create index if not exists commercial_quotes_tenant_customer_idx
  on public.commercial_quotes (tenant_id, customer_id);
create index if not exists commercial_quotes_tenant_project_idx
  on public.commercial_quotes (tenant_id, project_id);
create index if not exists commercial_quotes_tenant_status_idx
  on public.commercial_quotes (tenant_id, status);

drop trigger if exists commercial_quotes_set_updated_at on public.commercial_quotes;
create or replace function public.commercial_quotes_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger commercial_quotes_set_updated_at
  before update on public.commercial_quotes
  for each row execute function public.commercial_quotes_set_updated_at();

-- ── Lignes de devis, format PricedLine (E10.21) — CA3 ───────────────────────
create table if not exists public.commercial_quote_lines (
  id                   uuid primary key default gen_random_uuid(),
  quote_id             uuid not null references public.commercial_quotes(id) on delete cascade,
  -- Reference SANS cascade de suppression du lien projet -> element : retirer
  -- ce devis ne touche jamais l element de projet source (CA7).
  project_item_id      uuid not null references public.project_items(id),
  label                text not null check (btrim(label) <> ''),
  product_config       jsonb not null default '{}'::jsonb
                          check (jsonb_typeof(product_config) = 'object'),
  quantity             integer not null default 1 check (quantity > 0),
  position             integer not null default 0,

  -- Format PricedLine (E10.21) : seul production_price est renseigne par
  -- cette story (CA3). Les quatre colonnes suivantes restent NULL, breakdown
  -- reste vide, jusqu a la livraison d E10.21 (E10.8 gelee).
  production_price     numeric(12,2) not null default 0 check (production_price >= 0),
  public_price         numeric(12,2),
  customer_price       numeric(12,2),
  applied_margin_rate  numeric(6,4),
  applied_rule_id      uuid,
  breakdown            jsonb not null default '[]'::jsonb
                          check (jsonb_typeof(breakdown) = 'array'),

  created_at           timestamptz not null default now()
);

comment on table public.commercial_quote_lines is
  'E10.3 CA3 — lignes de devis au format PricedLine (E10.21, pas encore livree). production_price est le seul prix renseigne par cette story ; public_price/customer_price/applied_margin_rate/applied_rule_id/breakdown sont completes par une story future, apres E10.21.';
comment on column public.commercial_quote_lines.project_item_id is
  'CA7 — un meme element de projet peut alimenter plusieurs devis successifs : aucune contrainte d unicite ici, aucune suppression ni marquage exclusif de project_items.';
comment on column public.commercial_quote_lines.production_price is
  'CA3 — cout de production repris tel quel du chiffrage source (quote_payload.amounts.clariprint_price_ht, sinon .amounts.price, sinon 0). Jamais recalcule.';

create index if not exists commercial_quote_lines_quote_position_idx
  on public.commercial_quote_lines (quote_id, position);
create index if not exists commercial_quote_lines_project_item_idx
  on public.commercial_quote_lines (project_item_id);

-- ── Sequence de numerotation, par tenant et par annee (CA5) ─────────────────
create table if not exists public.commercial_quote_number_counters (
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  year        integer not null,
  last_value  integer not null default 0,

  primary key (tenant_id, year)
);

comment on table public.commercial_quote_number_counters is
  'E10.3 CA5 — etat de la sequence de numerotation des devis, par tenant et par annee. Accessible UNIQUEMENT via api_create_commercial_quote_from_project_items (aucune policy RLS declaree ci-dessous, deni par defaut) : un appel direct ne peut ni lire ni avancer le compteur.';

-- ── RLS — meme pattern que projects/project_items (20260901000500) ─────────
-- Le grant applicatif de base (select/insert/update/delete a `anon` et
-- `authenticated`) est herite par defaut de
-- 20260811000100_api_role_table_grants.sql : la RLS est ici la seule barriere
-- d autorisation sur commercial_quotes/commercial_quote_lines, pas un
-- `revoke` supplementaire. `commercial_quote_number_counters` n a AUCUNE
-- policy : ce grant par defaut reste sans effet, RLS activee + zero policy =
-- deni total pour anon/authenticated.
alter table public.commercial_quotes               enable row level security;
alter table public.commercial_quote_lines           enable row level security;
alter table public.commercial_quote_number_counters enable row level security;

drop policy if exists "commercial_quotes_select" on public.commercial_quotes;
create policy "commercial_quotes_select" on public.commercial_quotes for select using (
  is_super_admin()
  or tenant_id in (select public.current_user_tenant_ids())
);

drop policy if exists "commercial_quotes_write" on public.commercial_quotes;
create policy "commercial_quotes_write" on public.commercial_quotes for all using (
  is_super_admin()
  or exists (
    select 1 from public.tenant_members tm
    where tm.tenant_id = commercial_quotes.tenant_id
      and tm.user_id = auth.uid()
      and tm.role in ('admin', 'member')
  )
) with check (
  is_super_admin()
  or exists (
    select 1 from public.tenant_members tm
    where tm.tenant_id = commercial_quotes.tenant_id
      and tm.user_id = auth.uid()
      and tm.role in ('admin', 'member')
  )
);

drop policy if exists "commercial_quote_lines_select" on public.commercial_quote_lines;
create policy "commercial_quote_lines_select" on public.commercial_quote_lines for select using (
  is_super_admin()
  or exists (
    select 1 from public.commercial_quotes q
    where q.id = commercial_quote_lines.quote_id
      and q.tenant_id in (select public.current_user_tenant_ids())
  )
);

drop policy if exists "commercial_quote_lines_write" on public.commercial_quote_lines;
create policy "commercial_quote_lines_write" on public.commercial_quote_lines for all using (
  is_super_admin()
  or exists (
    select 1 from public.commercial_quotes q
    join public.tenant_members tm on tm.tenant_id = q.tenant_id
    where q.id = commercial_quote_lines.quote_id
      and tm.user_id = auth.uid()
      and tm.role in ('admin', 'member')
  )
) with check (
  is_super_admin()
  or exists (
    select 1 from public.commercial_quotes q
    join public.tenant_members tm on tm.tenant_id = q.tenant_id
    where q.id = commercial_quote_lines.quote_id
      and tm.user_id = auth.uid()
      and tm.role in ('admin', 'member')
  )
);

-- ── Creation transactionnelle (CA2, CA3, CA5, CA8) ──────────────────────────
-- Numerotation, creation du devis et de ses lignes dans LA MEME TRANSACTION :
-- une fonction plpgsql s execute atomiquement, donc aucun trou de sequence ni
-- devis orphelin n est possible meme si une etape echoue en cours de route.
-- `security definer` : seule voie d ecriture de commercial_quote_number_counters,
-- fermee au reste par la RLS sans policy ci-dessus.
create or replace function public.api_create_commercial_quote_from_project_items(
  p_tenant_id uuid,
  p_project_id uuid,
  p_item_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_customer_id uuid;
  v_item_count integer;
  v_requested_count integer;
  v_year integer;
  v_next integer;
  v_number text;
  v_quote_id uuid;
begin
  if v_actor is null then
    raise exception 'authentication_required';
  end if;

  v_requested_count := coalesce(array_length(p_item_ids, 1), 0);
  if v_requested_count = 0 then
    raise exception 'invalid_item_ids: at least one project item is required';
  end if;

  if not (
    public.is_super_admin()
    or exists (
      select 1 from public.tenant_members tm
      where tm.tenant_id = p_tenant_id
        and tm.user_id = v_actor
        and tm.role in ('admin', 'member')
    )
  ) then
    raise exception 'permission_denied: quote creation forbidden';
  end if;

  select customer_id into v_customer_id
    from public.projects
   where id = p_project_id
     and tenant_id = p_tenant_id;
  if v_customer_id is null then
    raise exception 'project_not_found';
  end if;

  select count(*) into v_item_count
    from public.project_items
   where project_id = p_project_id
     and id = any(p_item_ids);
  if v_item_count <> v_requested_count then
    raise exception 'invalid_item_ids: one or more items do not belong to this project';
  end if;

  v_year := extract(year from (now() at time zone 'utc'))::integer;

  -- Verrouille la ligne du compteur (tenant_id, annee) le temps de la
  -- transaction : deux creations concurrentes sur le meme couple se
  -- serialisent, jamais de numero duplique.
  insert into public.commercial_quote_number_counters (tenant_id, year, last_value)
  values (p_tenant_id, v_year, 1)
  on conflict (tenant_id, year)
  do update set last_value = public.commercial_quote_number_counters.last_value + 1
  returning last_value into v_next;

  v_number := 'DEV-' || v_year::text || '-' || lpad(v_next::text, 5, '0');

  insert into public.commercial_quotes (tenant_id, customer_id, project_id, number, status, created_by)
  values (p_tenant_id, v_customer_id, p_project_id, v_number, 'draft', v_actor)
  returning id into v_quote_id;

  -- CA3 — chaque ligne reprend la configuration produit, la quantite et le
  -- prix de production issus du chiffrage source. Aucun calcul de prix de
  -- vente ici (E10.21 non livree) : production_price est repris tel quel.
  insert into public.commercial_quote_lines
    (quote_id, project_item_id, label, product_config, quantity, position, production_price)
  select
    v_quote_id,
    pi.id,
    pi.label,
    pi.quote_payload,
    greatest(coalesce((pi.quote_payload->>'quantity')::numeric, 1), 1)::integer,
    row_number() over (order by pi.position) - 1,
    coalesce(
      (pi.quote_payload#>>'{amounts,clariprint_price_ht}')::numeric,
      (pi.quote_payload#>>'{amounts,price}')::numeric,
      0
    )
  from public.project_items pi
  where pi.project_id = p_project_id
    and pi.id = any(p_item_ids);

  return v_quote_id;
exception
  when invalid_text_representation then
    raise exception 'invalid_item_ids: malformed uuid';
end;
$$;

grant execute on function public.api_create_commercial_quote_from_project_items(uuid, uuid, uuid[]) to authenticated;

notify pgrst, 'reload schema';

-- ============================================================================
-- REVERSIBILITE — le CLI Supabase ne gere pas de bloc `down`. SQL de retrait,
-- a jouer tel quel dans une migration inverse si la story est annulee :
--
--   revoke execute on function public.api_create_commercial_quote_from_project_items(uuid, uuid, uuid[]) from authenticated;
--   drop function if exists public.api_create_commercial_quote_from_project_items(uuid, uuid, uuid[]);
--   drop policy if exists "commercial_quote_lines_write" on public.commercial_quote_lines;
--   drop policy if exists "commercial_quote_lines_select" on public.commercial_quote_lines;
--   drop policy if exists "commercial_quotes_write" on public.commercial_quotes;
--   drop policy if exists "commercial_quotes_select" on public.commercial_quotes;
--   drop trigger if exists commercial_quotes_set_updated_at on public.commercial_quotes;
--   drop function if exists public.commercial_quotes_set_updated_at();
--   drop table if exists public.commercial_quote_number_counters;
--   drop table if exists public.commercial_quote_lines;
--   drop table if exists public.commercial_quotes;
--   notify pgrst, 'reload schema';
--
-- Aucune autre table ne reference commercial_quotes/commercial_quote_lines :
-- le retrait est sans effet de bord. La table legacy `quotes`/`quote_lines`
-- n est touchee ni par cette migration ni par son retrait.
-- ============================================================================
