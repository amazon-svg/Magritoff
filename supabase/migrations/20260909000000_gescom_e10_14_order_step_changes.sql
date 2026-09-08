-- ============================================================================
-- Sprint 5 Gestion commerciale — story E10.14 : modale unifiee de changement
-- de statut et historique horodate. Contrat : openapi/magrit-core.v1.yaml,
-- docs/api/CONVENTIONS.md §8.16.
-- ----------------------------------------------------------------------------
-- Ce que cette migration fait :
--
--   1. Table NEUVE `public.commercial_order_step_changes` — journal APPEND-ONLY
--      des passages d une commande d une etape de production a une autre.
--      Patron `commercial_quote_header_audit` (E10.10a), sans invention.
--      `on delete cascade` sur `order_id` (le journal disparait avec la
--      commande, meme motif que le devis) ; `on delete restrict` sur les DEUX
--      etapes (`from_step_id`/`to_step_id`) : citer une etape dans ce journal
--      la rend definitivement indelebile, c est ce qui rend le CA6 tenable
--      (decision #13 du contrat).
--
--   2. RLS — lecture par tenant (jointure sur `commercial_orders.tenant_id`,
--      AUCUNE clause `user_has_capability` : ce journal n est pas tarifaire,
--      decision #10). AUCUNE policy d ecriture : la seule voie est la fonction
--      ci-dessous. `revoke insert, update, delete ... from authenticated,
--      anon` — la garantie append-only est TENUE EN BASE, pas seulement par
--      l absence d un endpoint (meme piege deja documente pour
--      `commercial_quote_header_audit`, migration `20260811000100`).
--
--   3. `public.api_change_commercial_order_production_step(p_tenant_id,
--      p_order_id, p_step_id, p_note, p_actor_label)` — `security definer`,
--      UNE SEULE TRANSACTION : verrouille la commande (`SELECT ... FOR
--      UPDATE`, MEME patron deja eprouve en concurrence reelle sur ce sprint,
--      E10.10b-2/E10.12), valide l etape cible APRES le verrou (existence
--      dans le tenant -> `production_step.not_found`, active ->
--      `production_step.inactive`, differente de l etape courante ->
--      `order.step_unchanged`), puis met a jour
--      `commercial_orders.current_production_step_id` ET insere l entree de
--      journal, DANS LA MEME TRANSACTION (contrat, decision #4 : la colonne
--      est la PROJECTION du journal, jamais un cache a resynchroniser).
--      AUCUN `If-Match` : dernier ecrivain gagnant, arbitre par Arnaud le
--      2026-09-09 (decision #6, reserve (a) close).
--
--      `v_actor is null` N EST PAS une erreur ici (a la difference de
--      `api_convert_commercial_quote`) : une cle de service est un acteur
--      LEGITIME (decision #10, reserve (b) close — premiere operation
--      d ECRITURE du contrat E10 joignable autrement que par un jeton
--      utilisateur). Dans ce cas, `p_actor_label` (fourni par la FACADE,
--      jamais par le corps de la requete) porte le libelle a inscrire
--      (`module:studio`).
--
--   4. Aucune emission d evenement DANS cette fonction : `order.step_changed`
--      est publie par la couche applicative APRES le retour (meme limite deja
--      acceptee pour les quatre evenements de devis/conversion — dette M2,
--      §8.2, constatee et non aggravee par ce lot, §5 reserve (c) du cadrage).
--
--   5. GRANTS — `authenticated` (jeton utilisateur) et `service_role`
--      (fonctions internes tenant deja la cle de role de service — meme
--      grant que `list_commercial_orders_by_production_step`, E10.13). PAS
--      `anon` : contrairement aux fonctions storefront (`api_get_storefront_
--      quote`, ...), cette fonction ne RE-VERIFIE aucun secret elle-meme —
--      elle fait confiance a `auth.uid()`/`p_actor_label` FOURNI PAR LA
--      FACADE, apres verification du scope `orders:write` par
--      `assertScopes()`. Ouvrir l execution a `anon` permettrait a un appel
--      PostgREST direct, sans aucune credential, de deplacer la commande de
--      N IMPORTE QUEL tenant (la fonction est `security definer`, elle
--      bypasse la RLS par construction — seul le GRANT protege). La
--      reconciliation reelle d une cle de service (client Supabase
--      authentifie en `service_role` APRES verification du secret
--      `X-Magrit-Service-Key`, jamais expose a l appelant) reste HORS
--      PERIMETRE de ce lot, meme limite deja acceptee pour la lecture
--      `orders:read` (aucun registre de cles de service n est encore
--      exploite en production, decision #10 / reserve (b),
--      docs/api/CONVENTIONS.md §8.14/§8.16).
-- ============================================================================

-- ── 1. Table `commercial_order_step_changes` ────────────────────────────────
create table if not exists public.commercial_order_step_changes (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references public.commercial_orders(id) on delete cascade,
  from_step_id   uuid references public.production_steps(id) on delete restrict,
  to_step_id     uuid not null references public.production_steps(id) on delete restrict,
  note           text check (note is null or (btrim(note) <> '' and char_length(note) <= 1000)),
  actor_id       uuid references auth.users(id),
  actor_label    text check (actor_label is null or (btrim(actor_label) <> '' and char_length(actor_label) <= 320)),
  occurred_at    timestamptz not null default now()
);

comment on table public.commercial_order_step_changes is
  'E10.14 — journal APPEND-ONLY des changements d etape de production d une commande. Patron commercial_quote_header_audit (E10.10a). DIT LE MOUVEMENT (from_step_id -> to_step_id), jamais une progression : le saut est autorise et assume (CA4). Aucune contrainte from_step_id <> to_step_id EN BASE : la garde du no-op (order.step_unchanged) vit dans api_change_commercial_order_production_step, sous verrou, ou elle peut produire le bon code d erreur et current_state.';
comment on column public.commercial_order_step_changes.from_step_id is
  'Etape QUITTEE, NULLABLE : une commande nee sans etape (tenant sans etape active a la conversion) porte NULL au premier passage. on delete restrict (comme to_step_id) : une etape citee ici devient indelebile (decision #13).';
comment on column public.commercial_order_step_changes.to_step_id is
  'Etape ATTEINTE, toujours renseignee : il n existe pas de transition "vers rien". Valeur desormais portee par commercial_orders.current_production_step_id.';
comment on column public.commercial_order_step_changes.actor_label is
  'Libelle FIGE de l auteur : nom/courriel du membre pour un jeton utilisateur, libelle prefixe module: pour une cle de service (ex. module:studio). Point d extension pour un futur auteur systeme (E10.20, non cadre ici, decision #12) — jamais analyse pour en deduire le type d auteur.';

create index if not exists commercial_order_step_changes_order_idx
  on public.commercial_order_step_changes (order_id, occurred_at desc);
-- Sert la garde de suppression d une etape citee (decision #13) — le
-- `restrict` s en passe fonctionnellement mais pas en performance.
create index if not exists commercial_order_step_changes_to_step_idx
  on public.commercial_order_step_changes (to_step_id);
create index if not exists commercial_order_step_changes_from_step_idx
  on public.commercial_order_step_changes (from_step_id) where from_step_id is not null;

-- ── RLS — lecture par tenant, AUCUNE policy d ecriture ─────────────────────
alter table public.commercial_order_step_changes enable row level security;

drop policy if exists "commercial_order_step_changes_select" on public.commercial_order_step_changes;
create policy "commercial_order_step_changes_select" on public.commercial_order_step_changes for select using (
  is_super_admin()
  or exists (
    select 1 from public.commercial_orders o
    where o.id = commercial_order_step_changes.order_id
      and o.tenant_id in (select public.current_user_tenant_ids())
  )
);

comment on policy "commercial_order_step_changes_select" on public.commercial_order_step_changes is
  'Isolation TENANT seule (jointure sur commercial_orders), SANS user_has_capability : ce journal n est pas tarifaire (decision #10 du contrat E10.14) — savoir qu une commande est passee en expedition est le travail ordinaire de l atelier, pas une position de supervision.';

-- Append-only, TENU EN BASE : l insertion passe exclusivement par la fonction
-- security definer ci-dessous (elle s execute avec les privileges du
-- proprietaire, ce revoke ne l affecte pas). Rappel du piege de
-- `20260811000100_api_role_table_grants.sql` : une table neuve est
-- ecrivable par defaut au niveau des grants ; sans ce revoke ET sans RLS
-- d ecriture, un POST PostgREST direct ecrirait dans le journal.
revoke insert, update, delete on table public.commercial_order_step_changes from authenticated, anon;

-- ── 2. Transition — api_change_commercial_order_production_step ────────────
create or replace function public.api_change_commercial_order_production_step(
  p_tenant_id uuid,
  p_order_id uuid,
  p_step_id uuid,
  p_note text,
  p_actor_label text default null
)
returns public.commercial_order_step_changes
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_label text;
  v_from uuid;
  v_step_tenant uuid;
  v_step_active boolean;
  v_row public.commercial_order_step_changes;
begin
  if v_actor is not null then
    -- Jeton UTILISATEUR : verification de l appartenance au tenant, meme
    -- discipline defensive que api_convert_commercial_quote (garde que la
    -- RLS ne peut pas appliquer a une fonction security definer). AUCUN
    -- droit metier exige au-dela de l appartenance (decision #10 : tout
    -- membre de l espace peut deplacer une commande, geste ordinaire
    -- d atelier — symetrique inverse de can_manage_production_steps, qui
    -- gouverne la DEFINITION du referentiel, pas son usage).
    if not (
      public.is_super_admin()
      or exists (
        select 1 from public.tenant_members tm
        where tm.tenant_id = p_tenant_id
          and tm.user_id = v_actor
          and tm.role in ('admin', 'member')
      )
    ) then
      raise exception 'permission_denied: order production step change forbidden';
    end if;
    select email into v_actor_label from auth.users where id = v_actor;
  else
    -- CLE DE SERVICE (decision #10/#12) : l habilitation (scope orders:write)
    -- a deja ete verifiee par la FACADE (assertScopes) avant cet appel ;
    -- cette fonction n a donc rien a reverifier sur l acteur lui-meme, mais
    -- exige que la facade lui ait fourni un libelle — un journal dont on ne
    -- sait pas qui a agi n est pas un journal.
    if p_actor_label is null or btrim(p_actor_label) = '' then
      raise exception 'authentication_required: p_actor_label requis pour un acteur sans jeton utilisateur';
    end if;
    v_actor_label := p_actor_label;
  end if;

  -- Verrou et lecture, dans le meme geste (patron deux fois eprouve en
  -- concurrence reelle ce sprint, E10.10b-2/E10.12). Tenu jusqu a la fin de
  -- la transaction : aucun autre acteur ne peut deplacer cette commande
  -- entre cette lecture et l UPDATE qui suit, et la valeur lue est TOUJOURS
  -- la derniere version COMMITEE — c est ce verrou, et lui seul, qui rend
  -- order.step_unchanged fiable sous course reelle.
  select current_production_step_id into v_from
    from public.commercial_orders
   where id = p_order_id and tenant_id = p_tenant_id
   for update;

  if not found then
    raise exception 'order.not_found: commande % introuvable', p_order_id;
  end if;

  -- Validation de l etape cible, APRES le verrou, jamais avant : existence
  -- ET appartenance au tenant, puis is_active, puis distincte de l etape
  -- courante. Trois exceptions distinctes (decision #8/#7 du contrat).
  select tenant_id, is_active into v_step_tenant, v_step_active
    from public.production_steps
   where id = p_step_id;

  if not found or v_step_tenant is distinct from p_tenant_id then
    raise exception 'production_step.not_found: etape % introuvable dans le tenant %', p_step_id, p_tenant_id;
  end if;

  if not v_step_active then
    raise exception 'production_step.inactive: etape % desactivee, elle ne peut plus recevoir de commande', p_step_id;
  end if;

  if v_from is not distinct from p_step_id then
    raise exception 'order.step_unchanged: commande % deja sur l etape %', p_order_id, p_step_id;
  end if;

  -- UPDATE — passe le trigger d immuabilite SANS le toucher (current_
  -- production_step_id n est pas une colonne gelee, E10.13 l a laissee
  -- dehors expres) ; commercial_orders_set_updated_at avance updated_at,
  -- ce qui est voulu — c est ce qui fait bouger l ETag de la commande.
  update public.commercial_orders
     set current_production_step_id = p_step_id
   where id = p_order_id and tenant_id = p_tenant_id;

  -- INSERT de l entree, MEME transaction.
  insert into public.commercial_order_step_changes
    (order_id, from_step_id, to_step_id, note, actor_id, actor_label)
  values
    (p_order_id, v_from, p_step_id, p_note, v_actor, v_actor_label)
  returning * into v_row;

  -- Aucune emission d evenement ICI : order.step_changed est publie par la
  -- couche applicative apres le retour (meme patron que les quatre
  -- evenements de devis, dette M2 §8.2, constatee et non aggravee).

  return v_row;
end;
$$;

comment on function public.api_change_commercial_order_production_step(uuid, uuid, uuid, text, text) is
  'E10.14 — POST /commercial-orders/{orderId}/step-changes. Verrouille la commande (FOR UPDATE), valide l etape cible (not_found/inactive/step_unchanged), met a jour current_production_step_id ET insere l entree de journal, DANS LA MEME TRANSACTION. AUCUN If-Match (decision #6, dernier ecrivain gagnant). Ouverte a tout membre du tenant ET aux cles de service orders:write (decision #10, arbitrage Arnaud 2026-09-09) — v_actor null n est PAS une erreur, p_actor_label porte alors le libelle (fourni par la facade, jamais par le corps).';

revoke all on function public.api_change_commercial_order_production_step(uuid, uuid, uuid, text, text) from public, anon;
-- `service_role`, PAS `anon` : voir le commentaire de tete de ce fichier.
grant execute on function public.api_change_commercial_order_production_step(uuid, uuid, uuid, text, text) to authenticated, service_role;

notify pgrst, 'reload schema';

-- ============================================================================
-- REVERSIBILITE — le CLI Supabase ne gere pas de bloc `down`. SQL de retrait,
-- a jouer tel quel dans une migration inverse si la story est annulee :
--
--   revoke execute on function public.api_change_commercial_order_production_step(uuid, uuid, uuid, text, text) from authenticated, service_role;
--   drop function if exists public.api_change_commercial_order_production_step(uuid, uuid, uuid, text, text);
--   drop policy if exists "commercial_order_step_changes_select" on public.commercial_order_step_changes;
--   drop table if exists public.commercial_order_step_changes;
--   notify pgrst, 'reload schema';
--
-- Aucune autre table n est modifiee par ce lot : `commercial_orders`,
-- `production_steps`, `commercial_orders_immutable()` sont INTOUCHEES (§0
-- vérification n° 2 du cadrage — current_production_step_id n a jamais
-- figure dans la liste des colonnes gelees, ce lot n a donc rien a demonter).
-- ============================================================================
