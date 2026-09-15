-- ============================================================================
-- BCP-0b — le limiteur de debit sur la route de chiffrage Clariprint
-- ACTUELLE (`POST /api/v1/clariprint/quote`, edge function `magrit-api`).
-- Contrat : docs/api/CONVENTIONS.md §8.25 point 2.3bis (decisions Q9, Q10,
-- Q11 du 2026-09-15). N ENTRE PAS dans `openapi/magrit-core.v1.yaml` : la
-- route elle-meme n y figure pas (point 2.1, tranche par l architecte).
-- ----------------------------------------------------------------------------
-- PERIMETRE : DEUX etages sur la route actuelle, plus un etage atelier —
-- L2 (par boutique) n existe pas ici, cette route ne porte aucun `{shopSlug}`
-- (point (1)).
--   - L1, PAR VISITEUR (compte boutique si le cookie est valide, sinon
--     l empreinte HMAC de son IP, sinon une cle PARTAGEE) : 30 / 10 min.
--   - MEMBRE (jeton resolu en acteur `user` ET appartenance a au moins un
--     espace, `current_user_tenant_ids()`) : 120 / 10 min, PAS de plafond
--     quotidien propre (Q11 : "non pour l instant").
--   - L3, GLOBAL, tous visiteurs anonymes confondus : 500 / jour civil
--     Europe/Paris (Q9), configurable SANS redeploiement (table
--     `api_rate_limits`). Un membre n y entre JAMAIS (point (4)).
--
-- CE QUE CE LOT NE FAIT PAS :
--   - aucun L2 (BCP-1b, quand `{shopSlug}` existera) ;
--   - aucun plafond quotidien membre (L3a, Q11 rouverte plus tard) ;
--   - aucune ligne d OpenAPI, aucun changement de forme de la route.
-- ============================================================================

-- ── 1. Configuration — une ligne par portee, modifiable SANS redeploiement ──
-- Nom GENERIQUE (`api_rate_limits`) : BCP-1b y ajoute la portee de L2 par une
-- valeur de `check` de plus, en migration additive (point (2)).
create table if not exists public.api_rate_limits (
  scope               text primary key check (scope in (
                         'clariprint_quote_visitor',
                         'clariprint_quote_member',
                         'clariprint_quote_public_daily'
                       )),
  max_hits            integer not null check (max_hits > 0),
  -- 'fixed_seconds' : fenetre glissante alignee sur les multiples de sa
  -- duree (epoch // window_seconds). 'civil_day' : jour civil du fuseau
  -- `civil_day_timezone` (constante de produit Europe/Paris, §8.24).
  window_kind         text not null check (window_kind in ('fixed_seconds', 'civil_day')),
  window_seconds      integer check (window_seconds > 0),
  civil_day_timezone  text,
  updated_at          timestamptz not null default now(),
  constraint api_rate_limits_window_shape check (
    (window_kind = 'fixed_seconds' and window_seconds is not null and civil_day_timezone is null)
    or
    (window_kind = 'civil_day' and window_seconds is null and civil_day_timezone is not null)
  )
);

comment on table public.api_rate_limits is
  'BCP-0b — reglage des plafonds de debit (une ligne par portee). Changer une valeur (ex. L3 quand le prix Clariprint sera connu) est un UPDATE, sans redeploiement (Q9). Aucune table d audit : trois lignes de reglage, consignees a la main dans SPRINT_HANDOFF.md (point 2).';

-- ── 2. Compteurs — une ligne par (portee, cle, fenetre) ─────────────────────
create table if not exists public.api_rate_limit_counters (
  scope        text not null check (scope in (
                 'clariprint_quote_visitor',
                 'clariprint_quote_member',
                 'clariprint_quote_public_daily'
               )),
  -- Jamais une IP en clair : un identifiant de compte/utilisateur en clair,
  -- ou le HMAC-SHA256 de l IP (secret d Edge Function, cote applicatif —
  -- point (3)). Prefixe applicatif (`user:`, `account:`, `ip:`, `shared`)
  -- pour eviter toute collision entre espaces de cle au sein d une meme
  -- portee visiteur.
  key_hash     text not null check (length(key_hash) > 0),
  window_start timestamptz not null,
  hits         integer not null default 0 check (hits >= 0),
  primary key (scope, key_hash, window_start),
  -- Defense en profondeur : AUCUNE IP en clair, meme si un futur appelant
  -- oubliait de hacher (point (2), (3), et (9) "aucune colonne ne contient
  -- une IP en clair"). Rejette une forme IPv4 (`a.b.c.d`) ou IPv6 (deux
  -- groupes hexadecimaux ou plus separes par `:`) ecrite telle quelle. Les
  -- valeurs legitimes (`shared`, `global`, `user:<uuid>`, `account:<uuid>`,
  -- `ip:<hmac hex>`) ne matchent aucune des deux formes (lettres hors
  -- [0-9a-f], ou prefixe non hexadecimal).
  constraint api_rate_limit_counters_key_hash_not_raw_ip check (
    key_hash !~ '^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$'
    and key_hash !~ '^[0-9a-fA-F]{0,4}(:[0-9a-fA-F]{0,4}){2,7}$'
  )
);

comment on table public.api_rate_limit_counters is
  'BCP-0b — compteurs de debit. AUCUNE IP en clair (colonne key_hash : identifiant applicatif ou HMAC). Purgee au-dela de 24h par pg_cron (purge_expired_rate_limit_counters).';

create index if not exists api_rate_limit_counters_purge_idx
  on public.api_rate_limit_counters (window_start);

-- ── 3. RLS activee SANS policy, ET revoke — deux barrieres independantes ──
-- Mecanisme INTERNE au serveur (jamais une ressource metier lue par un
-- client) : RLS sans policy est un deny-all structurel, independant du
-- revoke — meme un futur GRANT accorde par erreur resterait sans effet
-- (point (2)). JAMAIS de grant a `anon` ni `authenticated`, ni sur les
-- tables, ni sur les fonctions.
alter table public.api_rate_limits enable row level security;
alter table public.api_rate_limit_counters enable row level security;

revoke all on table public.api_rate_limits from public, anon, authenticated;
revoke all on table public.api_rate_limit_counters from public, anon, authenticated;

grant select, update on table public.api_rate_limits to service_role;
grant select, insert, update, delete on table public.api_rate_limit_counters to service_role;

-- ── 4. Fonction atomique — reservee au service_role ─────────────────────────
-- Patron des fonctions `api_claim_*` du sprint (ex. `api_claim_outbox_events`,
-- migration 20260908000000) : `security definer`, `revoke all` puis `grant
-- execute` au SEUL `service_role`. `set search_path = ''` (au lieu de
-- `pg_catalog, public` ailleurs dans ce depot) : verrouillage maximal
-- explicitement demande par le cadrage (point (2)) — toute reference a un
-- objet applicatif est qualifiee `public.` ; `pg_catalog` reste toujours
-- implicitement cherche par Postgres, meme avec un search_path vide (`now()`,
-- `date_trunc`, `extract`, `to_timestamp`, `unnest` restent resolus).
--
-- Tout se joue dans UNE SEULE transaction (l appel RPC est un unique
-- statement top-level), TOUT OU RIEN : verrouillage (`for update`) de chaque
-- ligne de compteur concernee dans un ORDRE FIXE (alphabetique sur le nom de
-- portee), verification de TOUS les plafonds AVANT tout increment, puis
-- increment de TOUS les compteurs verrouilles UNIQUEMENT si aucun n a refuse.
-- Un appel refuse par L3 ne consomme donc PAS le quota L1 du visiteur.
--
-- Priorite de signalement quand deux etages seraient simultanement epuises :
-- l etage PROPRE a l appelant (visitor/member) avant le plafond public (L3),
-- pour un refus 429 plus specifique qu un 503 generique. Le cadrage ne fixe
-- pas cette priorite explicitement (aucun scenario ne la requiert) — choix
-- du dev-story, documente au rapport de fin de story.
create or replace function public.api_consume_clariprint_quote_budget(
  p_caller_kind text,
  p_key_hash text,
  p_now timestamptz default now()
)
returns table(allowed boolean, refused_scope text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_scopes text[];
  v_keys text[] := array[]::text[];
  v_window_starts timestamptz[] := array[]::timestamptz[];
  v_hits int[] := array[]::int[];
  v_max_hits int[] := array[]::int[];
  v_scope text;
  v_key text;
  v_window_start timestamptz;
  v_max integer;
  v_window_kind text;
  v_window_seconds integer;
  v_civil_tz text;
  v_current_hits integer;
  v_refused_scope text := null;
  i integer;
begin
  if p_caller_kind not in ('member', 'visitor') then
    raise exception 'api_consume_clariprint_quote_budget: p_caller_kind invalide (%)', p_caller_kind;
  end if;
  if p_key_hash is null or length(p_key_hash) = 0 then
    raise exception 'api_consume_clariprint_quote_budget: p_key_hash vide';
  end if;

  -- Etages qui s appliquent (point (2)) : un visiteur porte L1 visiteur ET
  -- L3 ; un membre ne porte QUE son propre etage, jamais L3 (point (4)).
  if p_caller_kind = 'member' then
    v_scopes := array['clariprint_quote_member'];
  else
    v_scopes := array['clariprint_quote_visitor', 'clariprint_quote_public_daily'];
  end if;

  -- ORDRE FIXE de verrouillage (alphabetique) : deux appels concurrents qui
  -- verrouillent chacun un sous-ensemble des MEMES lignes possibles ne
  -- peuvent jamais former de cycle. Le seul point de contention reel est la
  -- ligne partagee `clariprint_quote_public_daily`, verrouillee AVANT la
  -- ligne propre au visiteur — c est la serialisation VOULUE de L3.
  v_scopes := array(select unnest(v_scopes) order by 1);

  -- ── Phase 1 : verrouille chaque compteur concerne (le cree a zero s il
  -- manque), calcule sa fenetre, lit `hits` SANS l incrementer encore.
  for i in 1 .. array_length(v_scopes, 1) loop
    v_scope := v_scopes[i];
    -- L3 (`clariprint_quote_public_daily`) est un plafond GLOBAL, une seule
    -- ligne pour toute la plateforme — jamais une ligne par visiteur, sinon
    -- il ne bornerait rien (chaque visiteur aurait son propre compteur "L3").
    -- Les etages par appelant (visitor/member) gardent la cle de l appelant.
    v_key := case when v_scope = 'clariprint_quote_public_daily' then 'global' else p_key_hash end;

    select l.max_hits, l.window_kind, l.window_seconds, l.civil_day_timezone
      into v_max, v_window_kind, v_window_seconds, v_civil_tz
      from public.api_rate_limits l
     where l.scope = v_scope;

    if v_max is null then
      raise exception 'api_consume_clariprint_quote_budget: aucune configuration pour la portee %', v_scope;
    end if;

    if v_window_kind = 'civil_day' then
      -- Jour civil du fuseau configure — formule opposable du cadrage
      -- (point (2)) : `date_trunc('day', p_now at time zone <tz>)`.
      v_window_start := date_trunc('day', p_now at time zone v_civil_tz);
    else
      -- Fenetre fixe, alignee sur les multiples de sa duree (epoch), DST-safe
      -- par construction (arithmetique UTC pure).
      v_window_start := to_timestamp(floor(extract(epoch from p_now) / v_window_seconds) * v_window_seconds);
    end if;

    insert into public.api_rate_limit_counters (scope, key_hash, window_start, hits)
    values (v_scope, v_key, v_window_start, 0)
    on conflict (scope, key_hash, window_start) do nothing;

    select c.hits into v_current_hits
      from public.api_rate_limit_counters c
     where c.scope = v_scope and c.key_hash = v_key and c.window_start = v_window_start
     for update;

    v_keys := v_keys || v_key;
    v_window_starts := v_window_starts || v_window_start;
    v_hits := v_hits || v_current_hits;
    v_max_hits := v_max_hits || v_max;
  end loop;

  -- ── Phase 2 : decide. L etage propre a l appelant avant le plafond public.
  for i in 1 .. array_length(v_scopes, 1) loop
    if v_scopes[i] <> 'clariprint_quote_public_daily' and v_hits[i] >= v_max_hits[i] then
      v_refused_scope := v_scopes[i];
    end if;
  end loop;
  if v_refused_scope is null then
    for i in 1 .. array_length(v_scopes, 1) loop
      if v_scopes[i] = 'clariprint_quote_public_daily' and v_hits[i] >= v_max_hits[i] then
        v_refused_scope := v_scopes[i];
      end if;
    end loop;
  end if;

  if v_refused_scope is not null then
    -- TOUT OU RIEN : aucune ligne verrouillee n est modifiee sur un refus,
    -- meme celles dont le plafond n est pas atteint.
    return query select false, v_refused_scope;
    return;
  end if;

  for i in 1 .. array_length(v_scopes, 1) loop
    update public.api_rate_limit_counters
       set hits = hits + 1
     where scope = v_scopes[i] and key_hash = v_keys[i] and window_start = v_window_starts[i];
  end loop;

  return query select true, null::text;
end;
$$;

comment on function public.api_consume_clariprint_quote_budget(text, text, timestamptz) is
  'BCP-0b — verifie PUIS incremente, tout ou rien, tous les etages qui s appliquent a l appelant (visiteur : L1 + L3 ; membre : son etage seul). p_now n existe que pour les tests (la composition ne le passe jamais). security definer, service_role SEUL.';

revoke all on function public.api_consume_clariprint_quote_budget(text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.api_consume_clariprint_quote_budget(text, text, timestamptz) to service_role;

-- ── 5. Purge — SQL directe, sur le modele de magrit-notification-log-purge ──
create or replace function public.purge_expired_rate_limit_counters()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  delete from public.api_rate_limit_counters
   where window_start < now() - interval '24 hours';
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

comment on function public.purge_expired_rate_limit_counters() is
  'BCP-0b — purge des compteurs de plus de 24h. La fenetre du jour civil en cours a TOUJOURS moins de 24h au moment de la purge (point (2)). security definer, service_role SEUL : aucun appel applicatif, uniquement le pg_cron ci-dessous.';

revoke all on function public.purge_expired_rate_limit_counters() from public, anon, authenticated;
grant execute on function public.purge_expired_rate_limit_counters() to service_role;

-- pg_cron est DEJA active par 20260908000000 : cette migration ne l active
-- pas une seconde fois. AUCUN secret, AUCUNE Edge Function : appel SQL
-- DIRECT, meme patron que `magrit-notification-log-purge` (migration
-- 20260912000100). Cadence quotidienne, 03:40 UTC — creux d exploitation,
-- distinct de 03:10 (purge des journaux de notification) et 05:00 (rappel de
-- purge de fichiers), sans dependance entre eux.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'magrit-rate-limit-purge') then
    perform cron.unschedule('magrit-rate-limit-purge');
  end if;

  perform cron.schedule(
    'magrit-rate-limit-purge',
    '40 3 * * *',
    $sql$select public.purge_expired_rate_limit_counters();$sql$
  );
end;
$$;

-- ── 6. Valeurs initiales (point (2)) ────────────────────────────────────────
insert into public.api_rate_limits (scope, max_hits, window_kind, window_seconds, civil_day_timezone) values
  ('clariprint_quote_visitor', 30, 'fixed_seconds', 600, null),
  ('clariprint_quote_member', 120, 'fixed_seconds', 600, null),
  ('clariprint_quote_public_daily', 500, 'civil_day', null, 'Europe/Paris')
on conflict (scope) do nothing;

notify pgrst, 'reload schema';

-- ============================================================================
-- REVERSIBILITE — le CLI Supabase ne gere pas de bloc `down`. SQL de retrait,
-- a jouer tel quel dans une migration inverse si la story est annulee :
--
--   select cron.unschedule('magrit-rate-limit-purge')
--     where exists (select 1 from cron.job where jobname = 'magrit-rate-limit-purge');
--
--   revoke execute on function public.purge_expired_rate_limit_counters() from service_role;
--   drop function if exists public.purge_expired_rate_limit_counters();
--
--   revoke execute on function public.api_consume_clariprint_quote_budget(text, text, timestamptz) from service_role;
--   drop function if exists public.api_consume_clariprint_quote_budget(text, text, timestamptz);
--
--   drop table if exists public.api_rate_limit_counters;
--   drop table if exists public.api_rate_limits;
-- ============================================================================
