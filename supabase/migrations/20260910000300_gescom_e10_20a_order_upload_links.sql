-- ============================================================================
-- Sprint 5 Gestion commerciale — story E10.20a : le lien public de depot et
-- le QUATRIEME mode d authentification (SOCLE uniquement). Contrat :
-- openapi/magrit-core.v1.yaml, docs/api/CONVENTIONS.md §8.21.
-- ----------------------------------------------------------------------------
-- Perimetre STRICT de ce lot (20a uniquement, PAS 20b le depot lui-meme) :
--
--   1. Table NEUVE `public.commercial_order_upload_links` — un lien public
--      de depot, borne a UNE commande. Ressource a part entiere (listable,
--      revocable, auditable), pas un jeton derive d un secret. PAS de
--      colonne `tenant_id` : le tenant se lit par jointure sur
--      `commercial_orders`, meme patron qu `commercial_order_files`
--      (E10.17a) et `commercial_order_step_changes` (E10.14).
--
--      ECART DOCUMENTE avec le tableau de colonnes du cadrage (contrat
--      §8.21 §3, ecrit AVANT le contrat OpenAPI final) : une colonne
--      `deposited_count integer not null default 0` est ajoutee, ABSENTE de
--      ce tableau mais EXIGEE par le schema `OrderUploadLink` du contrat
--      ECRIT (champ `required`). Elle reste a 0 dans ce lot (aucun depot
--      n existe encore) ; E10.20b l incrementera ATOMIQUEMENT dans
--      `api_confirm_order_file_upload_by_link`, sans avoir besoin d une
--      jointure vers `commercial_order_files` (qui n a — et n aura pas dans
--      ce lot — de colonne reliant un fichier a SON lien).
--
--   2. `token_hash` : `sha256` du jeton en HEXADECIMAL (text, 64 caracteres),
--      JAMAIS le jeton en clair — ecart DELIBERE avec `tenant_invitations`
--      (contrat §8.21 §3). Le jeton est genere ICI (32 octets aleatoires,
--      base64url), rendu UNE SEULE FOIS par `api_create_order_upload_link`,
--      et n est plus jamais relisible — y compris par l atelier.
--
--   3. Bucket de stockage : AUCUN cree par ce lot. `commercial_order_files`
--      (E10.17a) est REUTILISE tel quel par E10.20b — ce lot ne depose rien.
--
--   4. QUATRE fonctions `api_*` (`security definer`) :
--        - `api_create_order_upload_link` — reservee `authenticated`,
--          verifie l appartenance au tenant, SOUS `pg_advisory_xact_lock`
--          sur la commande : plafond de 10 liens VIVANTS (ni expires, ni
--          revoques) verifie SOUS CE VERROU (`upload_link.limit_reached`).
--          Genere le jeton, insere, rend la ligne PLUS le jeton en clair.
--        - `api_revoke_order_upload_link` — reservee `authenticated`, meme
--          garde d appartenance, `upload_link.not_found` si aucun lien
--          VIVANT de cet identifiant n existe sur cette commande dans ce
--          tenant (un lien deja revoque est INDISCERNABLE d un lien inconnu
--          — contrat, rejouer une revocation echoue au meme titre).
--        - `api_resolve_order_upload_link_principal` — `stable`, GRANT
--          EXECUTE `anon` (le porteur du lien n a AUCUN JWT Magrit). Rend
--          link_id/order_id/tenant_id si le jeton designe un lien VIVANT,
--          rien sinon. Patron `api_resolve_shop_customer_session` : c est la
--          SEULE primitive qui verifie le jeton pour la resolution du
--          PRINCIPAL (SupabaseApiPrincipalVerifier), SANS effet de bord.
--        - `api_get_order_upload_link_context` — SECURITY DEFINER, GRANT
--          EXECUTE `anon`, RE-VERIFIE le jeton elle-meme (jamais un
--          `link_id` recu en parametre comme un identifiant deja
--          authentifie — meme discipline que `api_get_storefront_quote`).
--          Verrouille la ligne (`FOR UPDATE`), incremente `use_count`, pose
--          `first_used_at` (si absent) et `last_used_at`, rend le contexte
--          (nom du tenant, numero de commande, label, echeance, plafond,
--          compteur). Rien si le lien n est plus valide.
--
--   5. RLS — lecture ouverte a tout membre du tenant (jointure sur
--      `commercial_orders`, meme pattern qu `commercial_order_files`),
--      AUCUNE policy d ecriture : la seule voie d ecriture est les quatre
--      fonctions `security definer` ci-dessus (`revoke insert, update,
--      delete ... from authenticated, anon`). Le motif N EST PAS
--      l append-only (cette table EST mutable : revocation, compteurs
--      d usage) — c est de fermer le chemin PostgREST DIRECT, meme
--      raisonnement qu E10.17a.
--
--      Cette lecture RLS ne cache PAS `token_hash` (Postgres RLS filtre des
--      LIGNES, pas des colonnes) : la protection reelle est que ce module
--      ne SELECTIONNE jamais cette colonne dans son adaptateur
--      (`src/adapters/supabase/order-upload-links-repository.ts`,
--      `LINK_COLUMNS`), meme discipline que `storage_path` sur
--      `commercial_order_files`.
-- ============================================================================

-- ── 1. Table `commercial_order_upload_links` ────────────────────────────────
create table if not exists public.commercial_order_upload_links (
  id                 uuid primary key default gen_random_uuid(),
  order_id           uuid not null references public.commercial_orders(id) on delete cascade,
  token_hash         text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at         timestamptz not null,
  max_files          integer not null default 10 check (max_files between 1 and 30),
  deposited_count    integer not null default 0 check (deposited_count >= 0),
  label              text check (label is null
                       or (btrim(label) <> '' and char_length(label) <= 200)),
  created_by         uuid references auth.users(id) on delete set null,
  created_by_label   text check (created_by_label is null
                       or (btrim(created_by_label) <> '' and char_length(created_by_label) <= 320)),
  created_at         timestamptz not null default now(),
  revoked_at         timestamptz,
  revoked_by         uuid references auth.users(id) on delete set null,
  revoked_by_label   text check (revoked_by_label is null
                       or (btrim(revoked_by_label) <> '' and char_length(revoked_by_label) <= 320)),
  first_used_at      timestamptz,
  last_used_at       timestamptz,
  use_count          integer not null default 0 check (use_count >= 0),

  -- Pas de contrainte de coherence revoked_at/revoked_by : revoked_by
  -- (`on delete set null`) peut redevenir null apres suppression du compte,
  -- alors que revoked_at et revoked_by_label (texte FIGE) restent poses —
  -- meme modele qu OrderStepChange (E10.14) et OrderFile.deleted_by
  -- (E10.17a), qui ne portent pas non plus une telle contrainte.
  constraint commercial_order_upload_links_expiry_after_creation check (expires_at > created_at)
);

comment on table public.commercial_order_upload_links is
  'E10.20a — lien public de depot borne a UNE commande. Quatrieme mode d authentification (orderUploadLink, X-Magrit-Upload-Link). Ressource a part entiere : listable, revocable, auditable. Aucune colonne tenant_id : le tenant se lit par jointure sur commercial_orders (meme patron que commercial_order_files, E10.17a).';
comment on column public.commercial_order_upload_links.token_hash is
  'sha256 HEXADECIMAL du jeton (64 caracteres), JAMAIS le jeton en clair — ecart DELIBERE avec tenant_invitations (stockage en clair). Le jeton n est rendu QU UNE FOIS, par api_create_order_upload_link.';
comment on column public.commercial_order_upload_links.deposited_count is
  'Fichiers deposes PAR CE LIEN et toujours vivants. TOUJOURS 0 dans ce lot (E10.20a ne depose rien) — incrementee ATOMIQUEMENT par E10.20b (api_confirm_order_file_upload_by_link), qui n a pas besoin d une jointure vers commercial_order_files pour la tenir a jour.';
comment on column public.commercial_order_upload_links.max_files is
  'Plafond PROPRE a ce lien (defaut 10, arbitrage (D)). S IMPUTE sur le plafond de 30 fichiers vivants de la commande (commercial_order_files) : deux budgets independants qui se CUMULENT, ne s additionnent pas.';
comment on column public.commercial_order_upload_links.revoked_at is
  'Revocation (arbitrage (C)) : la ligne SURVIT comme trace d audit, elle quitte simplement la liste des liens VIVANTS (listOrderUploadLinks, getOrderUploadLinkContext). Un lien revoque est INDISCERNABLE d un lien inconnu pour son porteur (contrat, arbitrage (F)).';

create index if not exists commercial_order_upload_links_order_idx
  on public.commercial_order_upload_links (order_id, created_at desc);
-- Recherche du jeton par empreinte : chemin chaud de TROIS des quatre
-- operations (resolution du principal, contexte). `unique` pose deja un
-- index, cet index est donc redondant et volontairement OMIS.

-- ── RLS ──────────────────────────────────────────────────────────────────
-- Meme raisonnement qu E10.17a §5 : le motif du revoke n est PAS l
-- append-only (cette table EST mutable), c est de fermer le chemin PostgREST
-- DIRECT. La seule voie d ecriture reste les quatre fonctions security
-- definer ci-dessous.
alter table public.commercial_order_upload_links enable row level security;

drop policy if exists "commercial_order_upload_links_select" on public.commercial_order_upload_links;
create policy "commercial_order_upload_links_select" on public.commercial_order_upload_links for select using (
  is_super_admin()
  or exists (
    select 1 from public.commercial_orders o
    where o.id = commercial_order_upload_links.order_id
      and o.tenant_id in (select public.current_user_tenant_ids())
  )
);

revoke insert, update, delete on public.commercial_order_upload_links from authenticated, anon;

-- ── Fonctions `api_*` (`security definer`) ──────────────────────────────────

create or replace function public.api_create_order_upload_link(
  p_tenant_id uuid,
  p_order_id uuid,
  p_label text,
  p_expires_in_days integer,
  p_max_files integer
)
returns table (
  id uuid,
  order_id uuid,
  label text,
  expires_at timestamptz,
  max_files integer,
  deposited_count integer,
  use_count integer,
  first_used_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz,
  created_by uuid,
  created_by_label text,
  token text
)
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_label text;
  v_count integer;
  v_token text;
  v_token_hash text;
  v_row public.commercial_order_upload_links;
begin
  if v_actor is null then
    raise exception 'authentication_required';
  end if;

  -- Decision #4 du contrat E10.17a, reprise ICI a l identique (E10.20a
  -- §"AUCUN DROIT METIER EXIGE") : AUCUNE garde de capability, seule
  -- verification l appartenance au tenant.
  if not (
    public.is_super_admin()
    or exists (
      select 1 from public.tenant_members tm
      where tm.tenant_id = p_tenant_id and tm.user_id = v_actor
    )
  ) then
    raise exception 'permission_denied: order upload link creation forbidden';
  end if;

  -- Defense en profondeur : la Zod du contrat restreint deja expires_in_days
  -- a {7,30,90} et max_files a [1,30], mais cette fonction reste joignable
  -- directement en RPC (GRANT EXECUTE authenticated) par un appelant qui
  -- contournerait la facade.
  if p_expires_in_days not in (7, 30, 90) then
    raise exception 'api.validation_failed: expires_in_days doit valoir 7, 30 ou 90';
  end if;
  if p_max_files < 1 or p_max_files > 30 then
    raise exception 'api.validation_failed: max_files doit etre compris entre 1 et 30';
  end if;

  -- `u.id` QUALIFIE, PAS `id` seul : cette fonction declare `RETURNS TABLE
  -- (id uuid, ...)`, qui cree une variable PL/pgSQL implicite `id` —
  -- `where id = v_actor` non qualifie serait AMBIGU entre elle et la
  -- colonne `auth.users.id` (erreur `column reference "id" is ambiguous`,
  -- trouvee a l execution reelle de ce cas SQL, absente d une simple
  -- lecture du texte de la fonction).
  select u.email into v_actor_label from auth.users u where u.id = v_actor;

  -- Verrou sur la COMMANDE (pas sur le lien, qui n existe pas encore) :
  -- deux creations concurrentes sur la MEME commande ne peuvent pas toutes
  -- deux compter les liens vivants avant que l une n ait insere.
  perform pg_advisory_xact_lock(hashtextextended('commercial_order_upload_links:' || p_order_id::text, 0));

  if not exists (
    select 1 from public.commercial_orders o
    where o.id = p_order_id and o.tenant_id = p_tenant_id
  ) then
    raise exception 'order.not_found: commande % introuvable dans le tenant %', p_order_id, p_tenant_id;
  end if;

  -- Plafond de 10 liens VIVANTS par commande (contrat), verifie SOUS LE
  -- VERROU : un lien revoque ou expire ne compte plus. Alias `l` QUALIFIE
  -- (meme motif que la selection du libelle ci-dessus) : `order_id` est
  -- AUSSI un nom de colonne de sortie de cette fonction.
  select count(*) into v_count
    from public.commercial_order_upload_links l
   where l.order_id = p_order_id
     and l.revoked_at is null
     and l.expires_at > now();
  if v_count >= 10 then
    raise exception 'upload_link.limit_reached: commande % porte deja 10 liens vivants', p_order_id;
  end if;

  -- Jeton opaque au porteur, 32 octets aleatoires en base64url — meme
  -- patron que `api_authenticate_shop_customer` (storefront). Seule
  -- l EMPREINTE sha256, en hexadecimal, est persistee.
  v_token := translate(
    rtrim(encode(extensions.gen_random_bytes(32), 'base64'), '='),
    '+/',
    '-_'
  );
  v_token_hash := encode(extensions.digest(convert_to(v_token, 'UTF8'), 'sha256'), 'hex');

  insert into public.commercial_order_upload_links
    (order_id, token_hash, expires_at, max_files, label, created_by, created_by_label)
  values
    (p_order_id, v_token_hash, now() + make_interval(days => p_expires_in_days), p_max_files,
     nullif(btrim(coalesce(p_label, '')), ''), v_actor, v_actor_label)
  returning * into v_row;

  return query select
    v_row.id, v_row.order_id, v_row.label, v_row.expires_at, v_row.max_files,
    v_row.deposited_count, v_row.use_count, v_row.first_used_at, v_row.last_used_at,
    v_row.created_at, v_row.created_by, v_row.created_by_label, v_token;
end;
$$;

comment on function public.api_create_order_upload_link(uuid, uuid, text, integer, integer) is
  'E10.20a — POST /commercial-orders/{orderId}/upload-links. SEUL endroit ou le jeton en clair existe. Verrou sur la commande, plafond de 10 liens VIVANTS SOUS CE VERROU. AUCUNE garde de capability (decision #4, reprise d E10.17a).';

revoke all on function public.api_create_order_upload_link(uuid, uuid, text, integer, integer) from public, anon;
grant execute on function public.api_create_order_upload_link(uuid, uuid, text, integer, integer) to authenticated;

create or replace function public.api_revoke_order_upload_link(
  p_tenant_id uuid,
  p_order_id uuid,
  p_link_id uuid
)
returns public.commercial_order_upload_links
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_label text;
  v_row public.commercial_order_upload_links;
begin
  if v_actor is null then
    raise exception 'authentication_required';
  end if;

  if not (
    public.is_super_admin()
    or exists (
      select 1 from public.tenant_members tm
      where tm.tenant_id = p_tenant_id and tm.user_id = v_actor
    )
  ) then
    raise exception 'permission_denied: order upload link revocation forbidden';
  end if;

  select email into v_actor_label from auth.users where id = v_actor;

  select l.* into v_row
    from public.commercial_order_upload_links l
    join public.commercial_orders o on o.id = l.order_id
   where o.id = p_order_id
     and o.tenant_id = p_tenant_id
     and l.id = p_link_id
     and l.revoked_at is null
     and l.expires_at > now()
     for update of l;

  if not found then
    raise exception 'upload_link.not_found: lien % introuvable ou deja revoque sur la commande %', p_link_id, p_order_id;
  end if;

  update public.commercial_order_upload_links
     set revoked_at = now(),
         revoked_by = v_actor,
         revoked_by_label = v_actor_label
   where id = p_link_id
  returning * into v_row;

  return v_row;
end;
$$;

comment on function public.api_revoke_order_upload_link(uuid, uuid, uuid) is
  'E10.20a — DELETE /commercial-orders/{orderId}/upload-links/{linkId}. upload_link.not_found si aucun lien VIVANT de cet identifiant n existe sur cette commande dans ce tenant — rejouer une revocation deja faite echoue au meme titre (contrat : indiscernable d un lien inconnu). AUCUNE garde de capability.';

revoke all on function public.api_revoke_order_upload_link(uuid, uuid, uuid) from public, anon;
grant execute on function public.api_revoke_order_upload_link(uuid, uuid, uuid) to authenticated;

create or replace function public.api_resolve_order_upload_link_principal(p_token text)
returns table (
  link_id uuid,
  order_id uuid,
  tenant_id uuid
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_hash text := encode(extensions.digest(convert_to(p_token, 'UTF8'), 'sha256'), 'hex');
begin
  return query
  select l.id, l.order_id, o.tenant_id
  from public.commercial_order_upload_links l
  join public.commercial_orders o on o.id = l.order_id
  where l.token_hash = v_hash
    and l.revoked_at is null
    and l.expires_at > now();
end;
$$;

comment on function public.api_resolve_order_upload_link_principal(text) is
  'E10.20a — resolution du QUATRIEME mode d authentification (SupabaseApiPrincipalVerifier). STABLE, SANS EFFET DE BORD (ne touche pas use_count/first_used_at/last_used_at — voir api_get_order_upload_link_context). Rend une ligne UNIQUEMENT si le jeton designe un lien VIVANT (ni expire, ni revoque). GRANT EXECUTE anon : le porteur du lien n a AUCUN JWT Magrit.';

revoke all on function public.api_resolve_order_upload_link_principal(text) from public, authenticated;
grant execute on function public.api_resolve_order_upload_link_principal(text) to anon;

create or replace function public.api_get_order_upload_link_context(p_token text)
returns table (
  printer_name text,
  order_number text,
  label text,
  expires_at timestamptz,
  max_files integer,
  deposited_count integer
)
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_hash text := encode(extensions.digest(convert_to(p_token, 'UTF8'), 'sha256'), 'hex');
  v_link public.commercial_order_upload_links;
  v_tenant_name text;
  v_order_number text;
begin
  -- RE-VERIFIE le jeton lui-meme (jamais un link_id recu en parametre comme
  -- un identifiant deja authentifie) : meme discipline que les fonctions
  -- storefront qui re-verifient sessionToken plutot que de faire confiance
  -- a un accountId transmis en clair.
  select l.* into v_link
    from public.commercial_order_upload_links l
   where l.token_hash = v_hash
     and l.revoked_at is null
     and l.expires_at > now()
     for update of l;

  if not found then
    return;
  end if;

  select o.number, t.name into v_order_number, v_tenant_name
    from public.commercial_orders o
    join public.tenants t on t.id = o.tenant_id
   where o.id = v_link.order_id;

  -- Trace d usage (contrat : "un lien jamais ouvert et un lien ouvert dix
  -- fois n appellent pas la meme relance"). `first_used_at` ne bouge
  -- qu UNE fois, `last_used_at`/`use_count` a CHAQUE lecture du contexte.
  update public.commercial_order_upload_links
     set use_count = use_count + 1,
         first_used_at = coalesce(first_used_at, now()),
         last_used_at = now()
   where id = v_link.id;

  return query select
    v_tenant_name, v_order_number, v_link.label, v_link.expires_at,
    v_link.max_files, v_link.deposited_count;
end;
$$;

comment on function public.api_get_order_upload_link_context(text) is
  'E10.20a — GET /order-upload-links/current. RE-VERIFIE le jeton (TOCTOU possible entre la resolution du principal et cet appel, traite par la route en 401 upload_link.invalid). Incremente use_count/first_used_at/last_used_at (trace d usage). Rend le CONTEXTE minimal (arbitrage (E), depot seul) : aucun prix, aucune ligne, aucune liste de fichiers. GRANT EXECUTE anon.';

revoke all on function public.api_get_order_upload_link_context(text) from public, authenticated;
grant execute on function public.api_get_order_upload_link_context(text) to anon;

notify pgrst, 'reload schema';

-- ============================================================================
-- REVERSIBILITE — le CLI Supabase ne gere pas de bloc `down`. SQL de retrait,
-- a jouer tel quel dans une migration inverse si la story est annulee :
--
--   revoke execute on function public.api_get_order_upload_link_context(text) from anon;
--   drop function if exists public.api_get_order_upload_link_context(text);
--   revoke execute on function public.api_resolve_order_upload_link_principal(text) from anon;
--   drop function if exists public.api_resolve_order_upload_link_principal(text);
--   revoke execute on function public.api_revoke_order_upload_link(uuid, uuid, uuid) from authenticated;
--   drop function if exists public.api_revoke_order_upload_link(uuid, uuid, uuid);
--   revoke execute on function public.api_create_order_upload_link(uuid, uuid, text, integer, integer) from authenticated;
--   drop function if exists public.api_create_order_upload_link(uuid, uuid, text, integer, integer);
--   drop policy if exists "commercial_order_upload_links_select" on public.commercial_order_upload_links;
--   drop table if exists public.commercial_order_upload_links;
--   notify pgrst, 'reload schema';
--
-- Aucune autre table ne reference commercial_order_upload_links : le retrait
-- est sans effet de bord au-dela de la perte des liens eux-memes.
-- ============================================================================
