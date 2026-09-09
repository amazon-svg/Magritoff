-- ============================================================================
-- Sprint 5 Gestion commerciale — story E10.17a : depot de fichiers par
-- commande (base + API). Contrat : openapi/magrit-core.v1.yaml,
-- docs/api/CONVENTIONS.md §8.19.
-- ----------------------------------------------------------------------------
-- Perimetre STRICT de ce lot (17a uniquement, PAS 17b le panneau UI) :
--
--   1. Prerequis a la cle etrangere composite (decision #11) : index UNIQUE
--      `(order_id, id)` sur `commercial_order_lines` — additif, aucune donnee
--      touchee (`id` est deja la cle primaire, ce couple est deja unique).
--
--   2. Table NEUVE `public.commercial_order_files` — un fichier rattache a
--      une COMMANDE, avec un pointeur FACULTATIF vers une LIGNE (decision #1).
--      PAS de colonne `tenant_id` (ecart assumé avec `document_pdf_templates`,
--      §3 du contrat) : le tenant se lit par jointure sur `commercial_orders`,
--      exactement comme `commercial_order_step_changes` (E10.14) et
--      `commercial_order_lines` (E10.12).
--
--   3. Bucket Storage PRIVE `commercial_order_files`, 50 Mo (plafond du
--      PROJET, `supabase/config.toml` — PAS une limite subie, le PERIMETRE du
--      lot, arbitrage Arnaud du 2026-09-09, decision #a). SEPT types MIME :
--      cinq formats image/PDF plus DEUX types d archive ZIP
--      (`application/zip` et `application/x-zip-compressed` — le type qu un
--      navigateur pose sur un `.zip` depend du systeme d exploitation du
--      deposant, arbitrage Arnaud du 2026-09-09, reserve (c)). AUCUNE policy
--      `storage.objects` : seul le `service_role` de la facade y ecrit et y
--      lit, meme patron que `document_pdf_templates` (20260909020000).
--
--   4. TROIS fonctions `api_*` (`security definer`), meme discipline que
--      20260909020000/20260909000000 :
--        - `api_confirm_order_file_upload` — SOUS `pg_advisory_xact_lock` sur
--          la commande : verifie l appartenance au tenant (`order.not_found`,
--          code REUTILISE, jamais redouble), compte les fichiers VIVANTS SOUS
--          LE VERROU (`order_file.limit_reached`, plafond 30 — decision (b),
--          different du plafond de 20 des gabarits PDF : une commande
--          ACCUMULE des pieces sur toute sa vie et sur tous ses postes),
--          verifie que la ligne citee appartient a CETTE commande
--          (`order_file.line_not_found`), **RECALCULE le chemin de stockage**
--          `p_tenant_id::text || '/' || p_order_id::text || '/' ||
--          p_file_id::text` — JAMAIS RECU EN PARAMETRE (lecon qa-review B1
--          d E10.10b-4a, appliquee ici AVANT d etre reapprise) — et insere.
--          Un `file_id` deja porteur d une ligne leve `order_file.already_
--          confirmed`.
--        - `api_update_order_file_visibility` — `SELECT ... FOR UPDATE`,
--          refuse une ligne supprimee ou hors tenant (`order_file.not_found`),
--          met a jour, rend la ligne.
--        - `api_delete_order_file` — pose `deleted_at`/`deleted_by`/
--          `deleted_by_label`, et REND `storage_path` pour que la FACADE
--          retire ensuite l objet (ordre PRESCRIT par le contrat : ligne
--          PUIS objet, jamais l inverse — echouer tant qu echouer est encore
--          gratuit, jamais apres le point de non-retour).
--      AUCUNE garde de capability : decision #4 du contrat, tout membre du
--      tenant peut deposer/visibiliser/supprimer (meme arbitrage que
--      `convertQuote`/`changeOrderProductionStep`) — le verrou UM1 rend de
--      toute facon tout droit metier E10 admin-only tant qu il tient, poser
--      une capability neuve serait cosmetique et fermerait un geste d atelier
--      ordinaire.
--
--   5. RLS — lecture OUVERTE a tout membre du tenant (jointure sur
--      `commercial_orders`, PAS de clause `user_has_capability` : decision
--      #4). AUCUNE policy d ECRITURE : la seule voie d ecriture est les trois
--      fonctions `security definer` ci-dessus. `revoke insert, update, delete
--      ... from authenticated, anon` — et le motif N EST PAS l append-only
--      (cette table EST mutable : visibilite, suppression douce) : ce que le
--      revoke ferme, c est le chemin PostgREST DIRECT (meme piege que
--      20260811000100_api_role_table_grants.sql, qui rend une table neuve
--      ecrivable par defaut au niveau des grants).
--
--   6. Defense en profondeur sur la cle etrangere composite (decision #11,
--      meme patron que `document_pdf_template_fields_assert_same_tenant`
--      d E10.10b-4b) : `commercial_order_files_line_fk` referme
--      `(order_id, order_line_id) -> commercial_order_lines (order_id, id)`,
--      rendant STRUCTURELLEMENT IMPOSSIBLE qu une ligne d une autre commande
--      soit citee, y compris devant une ecriture directe.
--
--   7. Contrainte CHECK sur la FORME du chemin de stockage
--      (`commercial_order_files_storage_path_shape`) : comme la table ne
--      porte pas `tenant_id`, cette contrainte ne peut verifier que la FORME
--      (`<uuid>/<order_id>/<id>`), pas la VALEUR du premier segment — la
--      VALEUR est imposee par la fonction `security definer`, qui la calcule
--      depuis `p_tenant_id`. Les deux barrieres restent donc bien deux, la
--      seconde est plus faible ici qu en E10.10b-4a (dit explicitement au
--      contrat, §3).
-- ============================================================================

-- ── 1. Prerequis de la cle etrangere composite (decision #11) ──────────────
create unique index if not exists commercial_order_lines_order_id_id_uidx
  on public.commercial_order_lines (order_id, id);

-- ── 2. Table `commercial_order_files` ───────────────────────────────────────
create table if not exists public.commercial_order_files (
  id                 uuid primary key default gen_random_uuid(),
  order_id           uuid not null references public.commercial_orders(id) on delete cascade,
  order_line_id      uuid,
  filename           text not null check (btrim(filename) <> '' and char_length(filename) <= 255),
  content_type       text not null check (btrim(content_type) <> '' and char_length(content_type) <= 255),
  byte_size          bigint not null check (byte_size >= 1),
  visibility         text not null default 'internal'
                       check (visibility in ('internal', 'customer')),
  storage_path       text not null,
  deposited_by       uuid references auth.users(id) on delete set null,
  deposited_by_label text check (deposited_by_label is null
                       or (btrim(deposited_by_label) <> '' and char_length(deposited_by_label) <= 320)),
  deposited_at       timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz,
  deleted_by         uuid references auth.users(id) on delete set null,
  deleted_by_label   text check (deleted_by_label is null
                       or (btrim(deleted_by_label) <> '' and char_length(deleted_by_label) <= 320)),

  -- La ligne citee appartient a CETTE commande, ou n existe pas (decision #11,
  -- meme patron de defense en profondeur que
  -- document_pdf_template_fields_assert_same_tenant, E10.10b-4b).
  constraint commercial_order_files_line_fk
    foreign key (order_id, order_line_id)
    references public.commercial_order_lines (order_id, id) on delete cascade,

  -- Seconde barriere sur la FORME du chemin (pas la VALEUR du premier
  -- segment — cette table ne porte pas tenant_id, voir note de fichier
  -- ci-dessus) : exactement `<uuid>/<order_id>/<id>`, sans extension, jamais
  -- un chemin choisi par l appelant. `order_id` et `id` sont CONNUS de cette
  -- ligne (ce sont ses propres colonnes) : seul le premier segment (le
  -- tenant) ne peut etre verifie qu en FORME ici, sa VALEUR l est par la
  -- fonction security definer qui la calcule depuis p_tenant_id.
  constraint commercial_order_files_storage_path_shape
    check (storage_path ~ ('^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'
                            || order_id::text || '/' || id::text || '$'))
);

comment on table public.commercial_order_files is
  'E10.17a — fichier depose et rattache a une commande de gestion commerciale (BAT, justificatif, echange). Pas un document PRODUIT par Magrit (voir quote_documents, decision #12) : opaque, jamais inspecte, destructible sur demande. Aucune colonne tenant_id : le tenant se lit par jointure sur commercial_orders, meme parti que commercial_order_step_changes (E10.14).';
comment on column public.commercial_order_files.order_line_id is
  'Rattachement d AFFICHAGE facultatif a une ligne de la commande (BAT d un poste). NULL = le fichier concerne la commande entiere (bon de livraison, echange). Garanti sur la MEME commande par la cle etrangere composite ci-dessus.';
comment on column public.commercial_order_files.visibility is
  'internal (defaut, ferme) ou customer. INTENTION ENREGISTREE, CAPACITE INEXISTANTE dans ce lot (decision #3, §8.19) : aucune surface boutique ne lit ce champ aujourd hui. Consommateur futur : E10.20 (lien public de depot), non cadree.';
comment on column public.commercial_order_files.storage_path is
  'Chemin RECALCULE par api_confirm_order_file_upload depuis p_tenant_id/p_order_id/id, JAMAIS recu en parametre (lecon qa-review B1, E10.10b-4a). Forme verifiee par la contrainte CHECK ci-dessus (le premier segment, tenant_id, n est pas verifiable EN VALEUR ici faute de colonne tenant_id sur cette table).';
comment on column public.commercial_order_files.deleted_at is
  'Suppression = OCTETS DETRUITS, LIGNE CONSERVEE comme trace (ni un soft delete classique, ni un hard delete). Non publiee par le contrat (aucune operation ne rend un fichier supprime) : sert l audit, pas un ecran.';

create index if not exists commercial_order_files_order_idx
  on public.commercial_order_files (order_id, deposited_at desc)
  where deleted_at is null;
create index if not exists commercial_order_files_line_idx
  on public.commercial_order_files (order_line_id)
  where order_line_id is not null and deleted_at is null;

drop trigger if exists commercial_order_files_set_updated_at on public.commercial_order_files;
create or replace function public.commercial_order_files_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger commercial_order_files_set_updated_at
  before update on public.commercial_order_files
  for each row execute function public.commercial_order_files_set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────
-- Le grant applicatif de base (20260811000100_api_role_table_grants.sql) rend
-- la table ecrivable par defaut a anon/authenticated : la RLS (lecture) et le
-- revoke explicite (ecriture) sont les SEULES barrieres. Cette table est
-- MUTABLE (visibilite, suppression douce) — le motif du revoke n est donc PAS
-- l append-only, c est de fermer le chemin PostgREST DIRECT : la seule voie
-- d ecriture reste les trois fonctions security definer ci-dessous.
alter table public.commercial_order_files enable row level security;

drop policy if exists "commercial_order_files_select" on public.commercial_order_files;
create policy "commercial_order_files_select" on public.commercial_order_files for select using (
  is_super_admin()
  or exists (
    select 1 from public.commercial_orders o
    where o.id = commercial_order_files.order_id
      and o.tenant_id in (select public.current_user_tenant_ids())
  )
);

revoke insert, update, delete on public.commercial_order_files from authenticated, anon;

-- ── Bucket Storage PRIVE, aucune policy `storage.objects` ───────────────────
-- Meme patron que `document_pdf_templates` (20260909020000) : bucket present,
-- RLS de storage.objects active par defaut chez Supabase, AUCUNE policy
-- ecrite -> rejet implicite pour anon/authenticated, le service_role bypass
-- toujours RLS. 50 Mo = plafond du PROJET (supabase/config.toml), PERIMETRE
-- du lot (decision (a), pas une limite subie) : echanges courants d une
-- commande, pas le fichier de production haute resolution (renvoye a
-- E10.20). Sept types : cinq formats usuels + DEUX types d archive ZIP (le
-- type qu un navigateur pose sur un .zip depend du systeme d exploitation du
-- deposant, decision (c)).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'commercial_order_files',
  'commercial_order_files',
  false,
  52428800,
  array['application/pdf','image/jpeg','image/png','image/webp','image/tiff',
        'application/zip','application/x-zip-compressed']::text[]
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ── Fonctions `api_*` (`security definer`) ──────────────────────────────────

create or replace function public.api_confirm_order_file_upload(
  p_tenant_id uuid,
  p_order_id uuid,
  p_file_id uuid,
  p_filename text,
  p_order_line_id uuid,
  p_visibility text,
  p_content_type text,
  p_byte_size bigint
)
returns public.commercial_order_files
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_label text;
  v_visibility text := coalesce(p_visibility, 'internal');
  v_count integer;
  -- Chemin CANONIQUE, RECALCULE ICI depuis les identifiants du jeton/de la
  -- route et le file_id ALLOUE par le billet, JAMAIS RECU EN PARAMETRE
  -- (lecon qa-review B1 d E10.10b-4a, appliquee AVANT d etre reapprise) :
  -- un parametre `p_storage_path` serait une DONNEE fournie par l appelant,
  -- meme sur une fonction security definer.
  v_storage_path text := p_tenant_id::text || '/' || p_order_id::text || '/' || p_file_id::text;
  v_row public.commercial_order_files;
begin
  if v_actor is null then
    raise exception 'authentication_required';
  end if;

  -- Decision #4 du contrat : AUCUNE garde de capability. Seule verification :
  -- l acteur appartient au tenant (defense en profondeur, la RLS de
  -- commercial_orders est bypassee a l interieur d une fonction security
  -- definer).
  if not (
    public.is_super_admin()
    or exists (
      select 1 from public.tenant_members tm
      where tm.tenant_id = p_tenant_id and tm.user_id = v_actor
    )
  ) then
    raise exception 'permission_denied: order file confirmation forbidden';
  end if;

  -- Libelle FIGE de l auteur, lu DIRECTEMENT depuis auth.users — AUCUN
  -- parametre d appelant ne peut plus l ecraser (qa-review B1 round 2,
  -- BLOQUANT, corrige). Contrairement a `api_change_commercial_order_
  -- production_step` (E10.14), v_actor n est JAMAIS nul dans ce lot :
  -- le depot est reserve au jeton utilisateur (decision #5 du contrat),
  -- aucun appelant legitime de ce lot n a besoin d un libelle de repli.
  select email into v_actor_label from auth.users where id = v_actor;

  -- Verrou sur la COMMANDE (pas sur le fichier, qui n existe pas encore) :
  -- deux confirmations concurrentes sur la MEME commande ne peuvent pas
  -- toutes deux compter les fichiers vivants avant que l une n ait insere.
  perform pg_advisory_xact_lock(hashtextextended('commercial_order_files:' || p_order_id::text, 0));

  if not exists (
    select 1 from public.commercial_orders o
    where o.id = p_order_id and o.tenant_id = p_tenant_id
  ) then
    raise exception 'order.not_found: commande % introuvable dans le tenant %', p_order_id, p_tenant_id;
  end if;

  if exists (select 1 from public.commercial_order_files where id = p_file_id) then
    raise exception 'order_file.already_confirmed: le fichier % porte deja une ligne', p_file_id;
  end if;

  -- Plafond verifie SOUS LE VERROU (30 fichiers VIVANTS par commande, decision
  -- (b) — different du plafond de 20 des gabarits PDF, une commande ACCUMULE
  -- des pieces sur toute sa vie et sur tous ses postes).
  select count(*) into v_count
    from public.commercial_order_files
   where order_id = p_order_id and deleted_at is null;
  if v_count >= 30 then
    raise exception 'order_file.limit_reached: commande % porte deja 30 fichiers vivants', p_order_id;
  end if;

  if p_order_line_id is not null and not exists (
    select 1 from public.commercial_order_lines l
    where l.order_id = p_order_id and l.id = p_order_line_id
  ) then
    raise exception 'order_file.line_not_found: ligne % introuvable sur la commande %', p_order_line_id, p_order_id;
  end if;

  insert into public.commercial_order_files
    (id, order_id, order_line_id, filename, content_type, byte_size, visibility, storage_path, deposited_by, deposited_by_label)
  values
    (p_file_id, p_order_id, p_order_line_id, p_filename, p_content_type, p_byte_size, v_visibility, v_storage_path, v_actor, v_actor_label)
  returning * into v_row;

  return v_row;
end;
$$;

comment on function public.api_confirm_order_file_upload(uuid, uuid, uuid, text, uuid, text, text, bigint) is
  'E10.17a — POST /commercial-orders/{orderId}/files. Seul endroit ou un fichier de commande existe. Verrou sur la commande, plafond de 30 fichiers vivants SOUS CE VERROU, ligne citee verifiee CONTRE CETTE commande, chemin de stockage RECALCULE (jamais recu en parametre). AUCUNE garde de capability (decision #4). AUCUN parametre de libelle d auteur (qa-review B1 round 2) : v_actor n est jamais nul dans ce lot, deposited_by_label est TOUJOURS lu depuis auth.users, jamais fourni par l appelant.';

revoke all on function public.api_confirm_order_file_upload(uuid, uuid, uuid, text, uuid, text, text, bigint) from public, anon;
grant execute on function public.api_confirm_order_file_upload(uuid, uuid, uuid, text, uuid, text, text, bigint) to authenticated;

create or replace function public.api_update_order_file_visibility(
  p_tenant_id uuid,
  p_order_id uuid,
  p_file_id uuid,
  p_visibility text
)
returns public.commercial_order_files
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_row public.commercial_order_files;
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
    raise exception 'permission_denied: order file update forbidden';
  end if;

  select f.* into v_row
    from public.commercial_order_files f
    join public.commercial_orders o on o.id = f.order_id
   where o.id = p_order_id
     and o.tenant_id = p_tenant_id
     and f.id = p_file_id
     and f.deleted_at is null
     for update of f;

  if not found then
    raise exception 'order_file.not_found: fichier % introuvable sur la commande %', p_file_id, p_order_id;
  end if;

  update public.commercial_order_files
     set visibility = p_visibility,
         updated_at = now()
   where id = p_file_id
  returning * into v_row;

  return v_row;
end;
$$;

comment on function public.api_update_order_file_visibility(uuid, uuid, uuid, text) is
  'E10.17a — PATCH /commercial-orders/{orderId}/files/{fileId}. Seul champ modifiable : visibility. Refuse une ligne supprimee ou hors tenant/commande (order_file.not_found). AUCUNE garde de capability (decision #4).';

revoke all on function public.api_update_order_file_visibility(uuid, uuid, uuid, text) from public, anon;
grant execute on function public.api_update_order_file_visibility(uuid, uuid, uuid, text) to authenticated;

create or replace function public.api_delete_order_file(
  p_tenant_id uuid,
  p_order_id uuid,
  p_file_id uuid
)
returns public.commercial_order_files
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_label text;
  v_row public.commercial_order_files;
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
    raise exception 'permission_denied: order file deletion forbidden';
  end if;

  -- Libelle FIGE de l auteur, lu DIRECTEMENT depuis auth.users — AUCUN
  -- parametre d appelant ne peut plus l ecraser (qa-review B1 round 2,
  -- BLOQUANT, corrige). Meme motif que `api_confirm_order_file_upload` :
  -- v_actor n est jamais nul dans ce lot, la suppression est reservee au
  -- jeton utilisateur (decision #5 du contrat).
  select email into v_actor_label from auth.users where id = v_actor;

  select f.* into v_row
    from public.commercial_order_files f
    join public.commercial_orders o on o.id = f.order_id
   where o.id = p_order_id
     and o.tenant_id = p_tenant_id
     and f.id = p_file_id
     and f.deleted_at is null
     for update of f;

  if not found then
    raise exception 'order_file.not_found: fichier % introuvable sur la commande %', p_file_id, p_order_id;
  end if;

  -- LIGNE d abord (transactionnel) : l objet de stockage est retire ENSUITE
  -- par la FACADE, jamais par cette fonction (ordre PRESCRIT par le contrat,
  -- §3 — echouer tant qu echouer est encore gratuit, jamais apres le point de
  -- non-retour). `storage_path` est REND pour que l appelant sache quel objet
  -- retirer, sans avoir a le recalculer une seconde fois.
  update public.commercial_order_files
     set deleted_at = now(),
         deleted_by = v_actor,
         deleted_by_label = v_actor_label,
         updated_at = now()
   where id = p_file_id
  returning * into v_row;

  return v_row;
end;
$$;

comment on function public.api_delete_order_file(uuid, uuid, uuid) is
  'E10.17a — DELETE /commercial-orders/{orderId}/files/{fileId}. Pose deleted_at/deleted_by/deleted_by_label (ligne CONSERVEE comme trace) et REND storage_path pour que la FACADE retire l objet ENSUITE (ordre prescrit : ligne puis objet, jamais l inverse). AUCUNE garde de capability (decision #4). AUCUN parametre de libelle d auteur (qa-review B1 round 2) : deposited_by_label est TOUJOURS lu depuis auth.users.';

revoke all on function public.api_delete_order_file(uuid, uuid, uuid) from public, anon;
grant execute on function public.api_delete_order_file(uuid, uuid, uuid) to authenticated;

notify pgrst, 'reload schema';

-- ============================================================================
-- REVERSIBILITE — le CLI Supabase ne gere pas de bloc `down`. SQL de retrait,
-- a jouer tel quel dans une migration inverse si la story est annulee :
--
--   revoke execute on function public.api_delete_order_file(uuid, uuid, uuid) from authenticated;
--   drop function if exists public.api_delete_order_file(uuid, uuid, uuid);
--   revoke execute on function public.api_update_order_file_visibility(uuid, uuid, uuid, text) from authenticated;
--   drop function if exists public.api_update_order_file_visibility(uuid, uuid, uuid, text);
--   revoke execute on function public.api_confirm_order_file_upload(uuid, uuid, uuid, text, uuid, text, text, bigint) from authenticated;
--   drop function if exists public.api_confirm_order_file_upload(uuid, uuid, uuid, text, uuid, text, text, bigint);
--   delete from storage.objects where bucket_id = 'commercial_order_files';
--   delete from storage.buckets where id = 'commercial_order_files';
--   drop policy if exists "commercial_order_files_select" on public.commercial_order_files;
--   drop trigger if exists commercial_order_files_set_updated_at on public.commercial_order_files;
--   drop function if exists public.commercial_order_files_set_updated_at();
--   drop table if exists public.commercial_order_files;
--   drop index if exists commercial_order_lines_order_id_id_uidx;
--   notify pgrst, 'reload schema';
--
-- Aucune autre table ne reference commercial_order_files : le retrait est
-- sans effet de bord au-dela de la perte des fichiers eux-memes.
-- commercial_order_lines n est pas touchee au-dela de l index unique ajoute.
-- ============================================================================
