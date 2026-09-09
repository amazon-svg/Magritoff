-- ============================================================================
-- Sprint 5 Gestion commerciale — story E10.10b-4a : import et stockage du
-- gabarit PDF par tenant. Contrat : openapi/magrit-core.v1.yaml,
-- docs/api/CONVENTIONS.md §8.18 (revision du 2026-09-09, remplace §8.13septies
-- — Gotenberg abandonne, pdf-lib + gabarit PDF par tenant + editeur de
-- coordonnees).
-- ----------------------------------------------------------------------------
-- Perimetre STRICT de ce lot (4a uniquement, PAS 4b l editeur de coordonnees,
-- PAS 4c le moteur de generation) :
--
--   1. Table NEUVE `public.document_pdf_templates` — le gabarit et son fond
--      (§8.18 §2). Porte DEJA la colonne `lines_block` (jsonb, nullable) :
--      elle appartient au SCHEMA de cette table depuis l origine (§8.18 §2,
--      tableau des colonnes), meme si seule 4b (PUT .../fields) saura
--      l ecrire. Ne porte PAS `document_pdf_template_fields` (table de 4b) ni
--      `quote_documents` (table de 4c) : ces deux-la restent hors de ce
--      fichier, chacune dans SA propre migration (regle db.md : une migration
--      = une story).
--
--   2. Bucket Storage PRIVE `document_pdf_templates`, 10 Mo,
--      `application/pdf` seul. AUCUNE policy `storage.objects` : seul le
--      `service_role` de la facade y ecrit et y lit (§8.18 §2, "Aucune policy
--      storage.objects sur ni l un ni l autre"). Le bucket `shop_backgrounds`
--      (`20260601000700`) n est PAS reproductible tel quel : il est PUBLIC
--      (CDN, navigateurs anonymes) ; ici ni un papier a en-tete ni un devis
--      chiffre ne se servent en public (§8.18 §0, decouverte 6). Repris de ce
--      precedent : le SCOPING PAR CHEMIN (`<tenant_id>/<template_id>.pdf`),
--      rien d autre.
--
--   3. Quatre fonctions `api_*` (`security definer`), meme discipline que
--      `20260908020000` (E10.13) : chacune reimplemente EXPLICITEMENT le
--      controle `can_manage_document_templates` (RLS bypassee a l interieur
--      d une fonction `security definer`), verrou par advisory lock la ou une
--      invariante de comptage/unicite est en jeu.
--        - `api_create_document_pdf_template` — plafond 20 SOUS VERROU,
--          unicite du nom normalise, `is_default` demande MEMORISE
--          (`requested_default`, colonne interne non exposee au contrat) et
--          non applique tant que le gabarit n est pas `ready` (contrat :
--          "le drapeau n est pose qu a la validation de l import").
--        - `api_update_document_pdf_template` — renommage/activation/defaut
--          partiels (drapeaux `p_has_*` explicites, la seule facon d exprimer
--          un PATCH partiel en PL/pgSQL), 409 `name_conflict`/
--          `default_requires_ready`.
--        - `api_confirm_document_pdf_template_upload` — LE SEUL endroit qui
--          fait passer un gabarit a `ready` : recoit une geometrie DEJA
--          EXTRAITE par la facade (pdf-lib tourne cote TypeScript/Deno, pas
--          en PL/pgSQL — aucune bibliotheque PDF n existe cote base), 409
--          `geometry_changed` si la carte n est pas vide et que la geometrie
--          change sans `reset_fields`, application DIFFEREE de
--          `requested_default`. Le CHEMIN de stockage n est PAS recu en
--          parametre : il est RECALCULE `p_tenant_id::text || '/' ||
--          p_template_id::text || '.pdf'`, jamais fourni par l appelant
--          (qa-review B1 — un parametre de chemin, meme sur une fonction
--          `security definer`, reste une DONNEE que l appelant choisit).
--        - `api_delete_document_pdf_template` — 409 `in_use` tenu par la cle
--          etrangere `on delete restrict` de `quote_documents.template_id`,
--          qui N EXISTE PAS ENCORE dans ce lot (table de 4c) : cette branche
--          est donc structurellement INATTEIGNABLE tant que 4c n a pas
--          livre sa migration — attendu, pas un defaut de ce lot (voir le
--          rapport de fin de story).
--
--   4. RLS — `document_pdf_templates_select` (lecture ouverte a tout membre
--      du tenant, contrat : "Ne conditionne PAS la LECTURE des gabarits") ;
--      `document_pdf_templates_write` PORTE DIRECTEMENT
--      `public.user_has_capability(tenant_id, 'can_manage_document_templates')`
--      (regle 4 du §3.5 : la garde doit exister EN BASE) — DEFENSE EN
--      PROFONDEUR seulement : le chemin nominal passe TOUJOURS par les
--      fonctions `security definer` ci-dessus, qui reimplementent le meme
--      controle explicitement.
--
--   5. `can_manage_document_templates` n exige AUCUNE migration de cablage :
--      `public.user_has_capability()` (`20260814000200_admin_unique.sql`)
--      rend `true` pour tout `admin` de tenant PAR DERIVATION D APPARTENANCE,
--      quel que soit le nom de la capability demandee — meme mecanisme,
--      verifie sans modification, que `can_manage_pricing`/
--      `can_manage_production_steps`.
-- ============================================================================

-- ── 1. Table `document_pdf_templates` ───────────────────────────────────────
create table if not exists public.document_pdf_templates (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  document_type    text not null default 'quote' check (document_type in ('quote')),
  name             text not null check (btrim(name) <> '' and char_length(name) <= 120),
  status           text not null default 'awaiting_upload' check (status in ('awaiting_upload', 'ready')),
  storage_path     text,
  byte_size        bigint check (byte_size is null or byte_size >= 1),
  sha256           text check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$'),
  page_count       integer check (page_count is null or (page_count between 1 and 10)),
  -- Referentiel des coordonnees, relu par le SERVEUR dans le fichier accepte
  -- (§8.18 §4, `getDocumentPdfTemplate`) : jamais estime par le navigateur.
  pages            jsonb not null default '[]'::jsonb,
  -- Bloc de lignes (colonnes du tableau de devis) : objet UNIQUE, jamais
  -- interroge independamment, toujours reecrit en entier par 4b
  -- (`replaceDocumentPdfTemplateFields`). Base ne contrôle QUE la forme
  -- generale (§8.18 §2, "contrepartie assumee") : le detail est tenu par le
  -- schema OpenAPI et son miroir Zod, pas ici.
  lines_block      jsonb check (lines_block is null or jsonb_typeof(lines_block) = 'object'),
  is_default       boolean not null default false,
  is_active        boolean not null default true,
  -- Intention MEMORISEE a la creation (`CreateDocumentPdfTemplateCommand.is_default`),
  -- appliquee UNE SEULE FOIS par `api_confirm_document_pdf_template_upload`
  -- quand le gabarit passe a `ready` (contrat : "le drapeau n est pose qu a
  -- la validation de l import"). Colonne INTERNE, jamais exposee par le
  -- contrat (ni `DocumentPdfTemplate`, ni `DocumentPdfTemplateDetail` ne la
  -- portent).
  requested_default boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  created_by       uuid references auth.users(id) on delete set null,

  -- Un gabarit PAR DEFAUT est forcement pret et actif (§2, "check : un
  -- defaut est ready et actif") : jamais choisi par la generation dans un
  -- etat ou il n aurait rien a dessiner.
  constraint document_pdf_templates_default_requires_ready
    check (not is_default or (status = 'ready' and is_active)),

  -- SECONDE barriere, independante des fonctions `api_*` (qa-review B1) :
  -- meme si une future ecriture directe (ou un bug applicatif) posait
  -- `storage_path` a une valeur arbitraire, cette contrainte EN BASE
  -- interdit tout chemin qui ne soit pas exactement celui que le serveur
  -- impose (`<tenant_id>/<id>.pdf`, contrat §8.18 §2). Aucun chemin d un
  -- AUTRE tenant, aucune traversee de repertoire, ne peut jamais etre
  -- persiste dans cette colonne.
  constraint document_pdf_templates_storage_path_canonical
    check (storage_path is null or storage_path = tenant_id::text || '/' || id::text || '.pdf')
);

comment on table public.document_pdf_templates is
  'E10.10b-4a — gabarit PDF de tenant (fond apporte par l imprimeur) sur lequel Magrit ecrit les valeurs d un devis. NE PAS CONFONDRE avec quote_templates (facade historique, gabarit HTML par UTILISATEUR) : §8.18 §2 dit explicitement en quoi les deux notions ne se recouvrent pas.';
comment on column public.document_pdf_templates.pages is
  'Geometrie page par page (index, width_pt, height_pt), relue par le SERVEUR dans le fichier accepte. Referentiel des coordonnees de la carte de champs (4b) — jamais celui estime par le navigateur.';
comment on column public.document_pdf_templates.lines_block is
  'Bloc de lignes du tableau de devis (ancre, hauteur de ligne, colonnes). Colonne posee des ce lot (schema, §8.18 §2) ; seule 4b (PUT .../fields) sait l ecrire. Toujours NULL a l issue de 4a seul.';
comment on column public.document_pdf_templates.requested_default is
  'Intention "devenir le defaut" posee a la creation, appliquee UNE SEULE FOIS a la confirmation d import (transition awaiting_upload -> ready). Jamais exposee au contrat.';

-- Nom UNIQUE dans le tenant, PAR TYPE DE DOCUMENT, sur sa forme normalisee
-- (trim, casse insensible) — meme discipline que `production_steps_tenant_label_uidx`.
create unique index if not exists document_pdf_templates_tenant_type_name_uidx
  on public.document_pdf_templates (tenant_id, document_type, lower(btrim(name)));

-- Au plus UN gabarit par defaut, PAR TENANT ET PAR TYPE DE DOCUMENT (§2).
create unique index if not exists document_pdf_templates_default_uidx
  on public.document_pdf_templates (tenant_id, document_type)
  where is_default;

create index if not exists document_pdf_templates_tenant_type_idx
  on public.document_pdf_templates (tenant_id, document_type);

drop trigger if exists document_pdf_templates_set_updated_at on public.document_pdf_templates;
create or replace function public.document_pdf_templates_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger document_pdf_templates_set_updated_at
  before update on public.document_pdf_templates
  for each row execute function public.document_pdf_templates_set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────
-- Le grant applicatif de base (`20260811000100_api_role_table_grants.sql`)
-- rend la table ecrivable par defaut a `anon`/`authenticated` : la RLS est la
-- SEULE barriere. Lecture OUVERTE a tout membre du tenant (contrat : "Ne
-- conditionne PAS la LECTURE des gabarits, ouverte a tout membre"). Ecriture
-- gardee par `can_manage_document_templates` EN DEFENSE EN PROFONDEUR
-- seulement : le chemin nominal passe par les quatre fonctions `security
-- definer` ci-dessous, qui reimplementent le meme controle explicitement
-- (regle 4 du §3.5 — la garde doit exister EN BASE, pas seulement dans la
-- facade).
alter table public.document_pdf_templates enable row level security;

drop policy if exists "document_pdf_templates_select" on public.document_pdf_templates;
create policy "document_pdf_templates_select" on public.document_pdf_templates for select using (
  is_super_admin()
  or tenant_id in (select public.current_user_tenant_ids())
);

drop policy if exists "document_pdf_templates_write" on public.document_pdf_templates;
create policy "document_pdf_templates_write" on public.document_pdf_templates for all using (
  is_super_admin()
  or public.user_has_capability(tenant_id, 'can_manage_document_templates')
) with check (
  is_super_admin()
  or public.user_has_capability(tenant_id, 'can_manage_document_templates')
);

-- ── 2. Bucket Storage PRIVE, aucune policy `storage.objects` ────────────────
-- Meme patron que `20260510000100_e4_storage_product_mockups.sql` (bucket
-- present, RLS de storage.objects active par defaut chez Supabase, AUCUNE
-- policy ecrite -> rejet implicite pour `anon`/`authenticated`, le
-- `service_role` bypass toujours RLS) — a la difference que CE bucket est
-- `public = false` : un devis chiffre ne se sert jamais en lecture anonyme.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'document_pdf_templates',
  'document_pdf_templates',
  false,
  10485760, -- 10 Mo (contrat §8.18 §2)
  array['application/pdf']::text[]
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ── 3. Fonctions `api_*` (`security definer`) ───────────────────────────────

create or replace function public.api_create_document_pdf_template(
  p_tenant_id uuid,
  p_document_type text,
  p_name text,
  p_requested_default boolean
)
returns public.document_pdf_templates
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_document_type text := coalesce(p_document_type, 'quote');
  v_count integer;
  v_row public.document_pdf_templates;
begin
  if v_actor is null then
    raise exception 'authentication_required';
  end if;
  if not (
    public.is_super_admin()
    or public.user_has_capability(p_tenant_id, 'can_manage_document_templates')
  ) then
    raise exception 'permission_denied: can_manage_document_templates required';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('document_pdf_templates:' || p_tenant_id::text || ':' || v_document_type, 0)
  );

  select count(*) into v_count
    from public.document_pdf_templates
   where tenant_id = p_tenant_id and document_type = v_document_type;
  if v_count >= 20 then
    raise exception 'document_pdf_template.limit_reached: tenant % a deja 20 gabarits pour %', p_tenant_id, v_document_type;
  end if;

  if exists (
    select 1 from public.document_pdf_templates
     where tenant_id = p_tenant_id
       and document_type = v_document_type
       and lower(btrim(name)) = lower(btrim(p_name))
  ) then
    raise exception 'document_pdf_template.name_conflict: % existe deja pour %', p_name, v_document_type;
  end if;

  insert into public.document_pdf_templates
    (tenant_id, document_type, name, status, is_default, is_active, requested_default, created_by)
  values
    (p_tenant_id, v_document_type, p_name, 'awaiting_upload', false, true, coalesce(p_requested_default, false), v_actor)
  returning * into v_row;

  return v_row;
end;
$$;

comment on function public.api_create_document_pdf_template(uuid, text, text, boolean) is
  'E10.10b-4a — POST /document-pdf-templates. Cree un gabarit awaiting_upload, plafond de 20 par tenant/type verifie SOUS VERROU, 409 name_conflict sur le nom normalise. is_default demande est MEMORISE (requested_default), applique seulement a la confirmation d import.';

revoke all on function public.api_create_document_pdf_template(uuid, text, text, boolean) from public, anon;
grant execute on function public.api_create_document_pdf_template(uuid, text, text, boolean) to authenticated;

create or replace function public.api_update_document_pdf_template(
  p_tenant_id uuid,
  p_template_id uuid,
  p_has_name boolean,
  p_name text,
  p_has_is_default boolean,
  p_is_default boolean,
  p_has_is_active boolean,
  p_is_active boolean
)
returns public.document_pdf_templates
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_current public.document_pdf_templates;
  v_next_is_active boolean;
  v_next_is_default boolean;
begin
  if v_actor is null then
    raise exception 'authentication_required';
  end if;
  if not (
    public.is_super_admin()
    or public.user_has_capability(p_tenant_id, 'can_manage_document_templates')
  ) then
    raise exception 'permission_denied: can_manage_document_templates required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('document_pdf_templates:' || p_tenant_id::text, 0));

  select * into v_current
    from public.document_pdf_templates
   where tenant_id = p_tenant_id and id = p_template_id
   for update;
  if not found then
    raise exception 'document_pdf_template.not_found: gabarit % introuvable dans le tenant %', p_template_id, p_tenant_id;
  end if;

  if p_has_name
     and lower(btrim(p_name)) <> lower(btrim(v_current.name))
     and exists (
       select 1 from public.document_pdf_templates
        where tenant_id = p_tenant_id
          and document_type = v_current.document_type
          and id <> p_template_id
          and lower(btrim(name)) = lower(btrim(p_name))
     )
  then
    raise exception 'document_pdf_template.name_conflict: % existe deja pour %', p_name, v_current.document_type;
  end if;

  v_next_is_active := case when p_has_is_active then p_is_active else v_current.is_active end;
  v_next_is_default := case when p_has_is_default then p_is_default else v_current.is_default end;

  -- Passage a is_default = true : exige ready ET actif APRES cette meme mise
  -- a jour (pas seulement l etat courant), pour accepter {is_active: true,
  -- is_default: true} pose dans le meme appel.
  if p_has_is_default and p_is_default and not (v_current.status = 'ready' and v_next_is_active) then
    raise exception 'document_pdf_template.default_requires_ready: gabarit % non pret ou inactif', p_template_id;
  end if;

  -- Desactivation d un gabarit qui reste (ou deviendrait) le defaut :
  -- l invariant EN BASE (document_pdf_templates_default_requires_ready)
  -- interdit la combinaison is_active=false + is_default=true. Choix
  -- explicite ici, NON dicte a la lettre par le contrat (signale au rapport
  -- de fin de story pour confirmation) : desactiver efface aussi le drapeau
  -- par defaut plutot que de faire echouer la requete sur un CHECK generique
  -- illisible pour l appelant.
  if not v_next_is_active and v_next_is_default then
    v_next_is_default := false;
  end if;

  if p_has_is_default and p_is_default then
    update public.document_pdf_templates
       set is_default = false
     where tenant_id = p_tenant_id
       and document_type = v_current.document_type
       and id <> p_template_id
       and is_default = true;
  end if;

  update public.document_pdf_templates
     set name = case when p_has_name then p_name else name end,
         is_default = v_next_is_default,
         is_active = v_next_is_active,
         updated_at = now()
   where tenant_id = p_tenant_id and id = p_template_id
  returning * into v_current;

  return v_current;
end;
$$;

comment on function public.api_update_document_pdf_template(uuid, uuid, boolean, text, boolean, boolean, boolean, boolean) is
  'E10.10b-4a — PATCH /document-pdf-templates/{templateId}. PATCH partiel via drapeaux p_has_*. 409 name_conflict / default_requires_ready. Le passage a is_default=true retire le drapeau au gabarit precedent DANS LA MEME TRANSACTION.';

revoke all on function public.api_update_document_pdf_template(uuid, uuid, boolean, text, boolean, boolean, boolean, boolean) from public, anon;
grant execute on function public.api_update_document_pdf_template(uuid, uuid, boolean, text, boolean, boolean, boolean, boolean) to authenticated;

create or replace function public.api_confirm_document_pdf_template_upload(
  p_tenant_id uuid,
  p_template_id uuid,
  p_page_count integer,
  p_pages jsonb,
  p_byte_size bigint,
  p_sha256 text,
  p_reset_fields boolean
)
returns public.document_pdf_templates
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_current public.document_pdf_templates;
  v_has_field_map boolean;
  v_geometry_changed boolean;
  v_reset boolean := coalesce(p_reset_fields, false);
  -- Chemin CANONIQUE, calcule ICI depuis les deux identifiants du jeton/de la
  -- route, JAMAIS recu en parametre (qa-review B1, faille confirmee par
  -- exploitation reelle sur Postgres local) : un parametre `p_storage_path`
  -- est une DONNEE fournie par l appelant, quand bien meme la fonction est
  -- `security definer` — rien n empechait un appel RPC forge (ou une simple
  -- ecriture directe de la colonne, cote defense en profondeur RLS) de faire
  -- signer/supprimer le fichier d un AUTRE tenant. La contrainte CHECK posee
  -- sur la table (`document_pdf_templates_storage_path_canonical`) est la
  -- SECONDE barriere, independante de cette fonction.
  v_storage_path text := p_tenant_id::text || '/' || p_template_id::text || '.pdf';
begin
  if v_actor is null then
    raise exception 'authentication_required';
  end if;
  if not (
    public.is_super_admin()
    or public.user_has_capability(p_tenant_id, 'can_manage_document_templates')
  ) then
    raise exception 'permission_denied: can_manage_document_templates required';
  end if;

  -- Meme verrou que `api_update_document_pdf_template` (qa-review N3) :
  -- cette fonction bascule aussi `is_default` de facon transactionnelle
  -- (`requested_default`), sur le MEME index partiel `(tenant_id,
  -- document_type) where is_default`. Sans ce verrou, deux confirmations
  -- concurrentes portant chacune `requested_default = true` (deux imports
  -- differents, memes secondes) pourraient toutes deux se lire l une l autre
  -- avant d ecrire, et produire soit deux defauts simultanes (rattrapes par
  -- l index unique, mais alors remontes comme un 23505 mal traduit en
  -- `name_conflict` par `mapDocumentTemplateError` cote application plutot
  -- qu un conflit de concurrence), soit un ordre non deterministe.
  perform pg_advisory_xact_lock(hashtextextended('document_pdf_templates:' || p_tenant_id::text, 0));

  select * into v_current
    from public.document_pdf_templates
   where tenant_id = p_tenant_id and id = p_template_id
   for update;
  if not found then
    raise exception 'document_pdf_template.not_found: gabarit % introuvable dans le tenant %', p_template_id, p_tenant_id;
  end if;

  -- has_field_map : `lines_block` SEUL aujourd hui (E10.10b-4a). E10.10b-4b
  -- DEVRA completer cette condition d un `or exists (select 1 from
  -- public.document_pdf_template_fields where template_id = v_current.id)`
  -- des que cette table existera. Aucune ligne de placement ne peut exister
  -- avant elle : le calcul ci-dessous est donc EXACT pour ce lot, pas
  -- seulement provisoire par convenance (signale au rapport de fin de story).
  v_has_field_map := v_current.lines_block is not null;

  v_geometry_changed := v_current.status = 'ready' and (
    v_current.page_count is distinct from p_page_count
    or v_current.pages is distinct from p_pages
  );

  if v_geometry_changed and v_has_field_map and not v_reset then
    raise exception 'document_pdf_template.geometry_changed: geometrie modifiee, carte non vide, reset_fields requis';
  end if;

  update public.document_pdf_templates
     set storage_path = v_storage_path,
         status = 'ready',
         page_count = p_page_count,
         pages = p_pages,
         byte_size = p_byte_size,
         sha256 = p_sha256,
         lines_block = case when v_geometry_changed and v_reset then null else lines_block end,
         updated_at = now()
   where tenant_id = p_tenant_id and id = p_template_id
  returning * into v_current;

  -- Application DIFFEREE de `requested_default` (contrat : "le drapeau n est
  -- pose qu a la validation de l import"). Consommee UNE SEULE FOIS : remise
  -- a false qu elle ait ete appliquee ou non, pour qu une confirmation
  -- ULTERIEURE du meme gabarit (remplacement de fond) ne reapplique pas une
  -- intention perimee depuis longtemps.
  if v_current.requested_default then
    update public.document_pdf_templates
       set is_default = false
     where tenant_id = p_tenant_id
       and document_type = v_current.document_type
       and id <> p_template_id
       and is_default = true;

    update public.document_pdf_templates
       set is_default = true, requested_default = false, updated_at = now()
     where tenant_id = p_tenant_id and id = p_template_id
    returning * into v_current;
  end if;

  return v_current;
end;
$$;

comment on function public.api_confirm_document_pdf_template_upload(uuid, uuid, integer, jsonb, bigint, text, boolean) is
  'E10.10b-4a — POST /document-pdf-templates/{templateId}/uploads. SEUL endroit qui fait passer un gabarit a ready. La geometrie est EXTRAITE par la facade (pdf-lib, cote TypeScript) avant l appel, jamais en PL/pgSQL. Le CHEMIN de stockage est RECALCULE ici (p_tenant_id/p_template_id), jamais recu en parametre (qa-review B1). 409 geometry_changed si la carte n est pas vide et que la geometrie change sans reset_fields. Applique requested_default en differe.';

revoke all on function public.api_confirm_document_pdf_template_upload(uuid, uuid, integer, jsonb, bigint, text, boolean) from public, anon;
grant execute on function public.api_confirm_document_pdf_template_upload(uuid, uuid, integer, jsonb, bigint, text, boolean) to authenticated;

create or replace function public.api_delete_document_pdf_template(
  p_tenant_id uuid,
  p_template_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_deleted uuid;
begin
  if v_actor is null then
    raise exception 'authentication_required';
  end if;
  if not (
    public.is_super_admin()
    or public.user_has_capability(p_tenant_id, 'can_manage_document_templates')
  ) then
    raise exception 'permission_denied: can_manage_document_templates required';
  end if;

  begin
    delete from public.document_pdf_templates
     where tenant_id = p_tenant_id and id = p_template_id
    returning id into v_deleted;
  exception
    when foreign_key_violation then
      -- INATTEIGNABLE tant que `quote_documents` (4c) n existe pas : cette
      -- branche est ecrite maintenant pour que 4c n ait RIEN a modifier ici
      -- le jour ou sa cle etrangere `on delete restrict` existera.
      raise exception 'document_pdf_template.in_use: gabarit % encore porte par au moins un document', p_template_id;
  end;

  if v_deleted is null then
    raise exception 'document_pdf_template.not_found: gabarit % introuvable dans le tenant %', p_template_id, p_tenant_id;
  end if;
end;
$$;

comment on function public.api_delete_document_pdf_template(uuid, uuid) is
  'E10.10b-4a — DELETE /document-pdf-templates/{templateId}. 404 si absent du tenant. 409 in_use INATTEIGNABLE tant que 4c (quote_documents, on delete restrict) n a pas livre sa migration — attendu, pas un defaut de ce lot. La suppression de l objet de stockage est faite par la FACADE (service_role), pas par cette fonction.';

revoke all on function public.api_delete_document_pdf_template(uuid, uuid) from public, anon;
grant execute on function public.api_delete_document_pdf_template(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';

-- ============================================================================
-- REVERSIBILITE — le CLI Supabase ne gere pas de bloc `down`. SQL de retrait,
-- a jouer tel quel dans une migration inverse si la story est annulee :
--
--   revoke execute on function public.api_delete_document_pdf_template(uuid, uuid) from authenticated;
--   drop function if exists public.api_delete_document_pdf_template(uuid, uuid);
--   revoke execute on function public.api_confirm_document_pdf_template_upload(uuid, uuid, integer, jsonb, bigint, text, boolean) from authenticated;
--   drop function if exists public.api_confirm_document_pdf_template_upload(uuid, uuid, integer, jsonb, bigint, text, boolean);
--   revoke execute on function public.api_update_document_pdf_template(uuid, uuid, boolean, text, boolean, boolean, boolean, boolean) from authenticated;
--   drop function if exists public.api_update_document_pdf_template(uuid, uuid, boolean, text, boolean, boolean, boolean, boolean);
--   revoke execute on function public.api_create_document_pdf_template(uuid, text, text, boolean) from authenticated;
--   drop function if exists public.api_create_document_pdf_template(uuid, text, text, boolean);
--   delete from storage.objects where bucket_id = 'document_pdf_templates';
--   delete from storage.buckets where id = 'document_pdf_templates';
--   drop policy if exists "document_pdf_templates_write" on public.document_pdf_templates;
--   drop policy if exists "document_pdf_templates_select" on public.document_pdf_templates;
--   drop trigger if exists document_pdf_templates_set_updated_at on public.document_pdf_templates;
--   drop function if exists public.document_pdf_templates_set_updated_at();
--   drop table if exists public.document_pdf_templates;
--   notify pgrst, 'reload schema';
-- ============================================================================
