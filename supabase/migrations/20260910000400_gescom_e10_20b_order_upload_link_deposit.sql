-- ============================================================================
-- Sprint 5 Gestion commerciale — story E10.20b : le depot par le lien public
-- (deuxieme et dernier lot du couple E10.20a/E10.20b). Contrat :
-- openapi/magrit-core.v1.yaml, docs/api/CONVENTIONS.md §8.21/§8bis.
-- ----------------------------------------------------------------------------
-- Perimetre STRICT de ce lot :
--
--   1. `commercial_order_files.deposited_via` — colonne NEUVE, ADDITIVE, DEJA
--      PROMISE au contrat (§8bis, "20b le sert sur TOUS les fichiers, y
--      compris workspace, et le promeut alors required"). Defaut 'workspace' :
--      toute ligne posee par `api_confirm_order_file_upload` (E10.17a, jamais
--      modifiee ici) continue de recevoir cette valeur SANS reecrire cette
--      fonction — un fichier ne pouvait entrer que par l atelier avant ce
--      lot. Check ferme `workspace`/`upload_link` (liste ADDITIVE au sens du
--      contrat, jamais retirable).
--
--   2. Fonction NEUVE `api_confirm_order_file_upload_by_link` — SECONDE
--      fonction de confirmation, DELIBEREMENT DISTINCTE d
--      `api_confirm_order_file_upload` (decision du cadrage §8.21 §0 :
--      "E10.20 a besoin d une SECONDE fonction, qui prend son libelle du LIEN
--      et non de l utilisateur. Ne pas rouvrir la premiere : sa garde est
--      correcte pour son appelant."). RE-VERIFIE le jeton elle-meme (jamais
--      un `link_id` recu en parametre comme un identifiant deja
--      authentifie — meme discipline qu `api_get_order_upload_link_context`),
--      SOUS LE MEME VERROU CONSULTATIF que la fonction d atelier
--      (`hashtextextended('commercial_order_files:' || order_id, 0)`) : les
--      deux voies d entree d un fichier sur une commande se SERIALISENT l une
--      contre l autre pour le plafond COMMUN de 30 fichiers vivants, jamais
--      chacune sous son propre verrou. Verifie EN PLUS, sous ce meme verrou,
--      le plafond PROPRE au lien (`max_files`/`deposited_count`) — deux
--      budgets qui se CUMULENT (decision (D) du contrat), un SEUL code
--      d erreur pour les deux causes (`upload_link.file_limit_reached`).
--      Incremente `deposited_count` ATOMIQUEMENT (promesse ecrite au
--      commentaire de colonne pose par 20a). `deposited_by` reste NUL
--      (le deposant n est pas un `auth.users`), `deposited_by_label` est
--      COMPOSE depuis le `label` du lien ("Depot client — <label>" ou
--      "Depot client par lien"), `deposited_via` vaut `upload_link`,
--      `visibility` vaut TOUJOURS `internal` (le porteur du lien ne choisit
--      ni la visibilite ni la ligne — contrat, `ConfirmOrderUploadLinkFileCommand`
--      ne porte que `file_id`/`filename`). Chemin de stockage RECALCULE
--      depuis le TENANT DE LA COMMANDE (jamais recu en parametre, jamais lu
--      d une colonne fournie par l appelant), meme discipline que 17a/20a.
--
--      CORRECTIF SECURITE (qa-review round 1, B1, BLOQUANT — faille prouvee
--      par exploitation reelle) : la version initiale de cette fonction
--      acceptait `p_content_type`/`p_byte_size` en PARAMETRES et les ecrivait
--      tels quels en base, ET etait GRANT EXECUTE a `anon` — c est-a-dire
--      joignable directement par n importe qui muni de la cle anon PUBLIQUE
--      (celle du bundle front) et d un jeton de lien legitime, en contournant
--      entierement l adaptateur Supabase (et donc son `info()` sur le
--      stockage). Consequence prouvee : creation de lignes fantomes
--      (`content_type`/`byte_size` mensongers, AUCUN octet reellement
--      depose) faisant planter `getOrderFile` (atelier) et saturant le
--      plafond de 30 fichiers vivants — un deni de service metier a la
--      portee de quiconque connait un jeton de lien.
--
--      DEUX CORRECTIFS, CUMULATIFS (aucun ne suffit seul) :
--        (i) GRANT EXECUTE `service_role` UNIQUEMENT (plus `anon`) — la
--            fonction n est plus atteignable par la cle publique. Seul
--            l adaptateur Supabase (`storageClient`, cle service_role,
--            jamais exposee au navigateur) l appelle desormais, meme patron
--            que `api_confirm_order_file_upload` (17a) qui n est joignable
--            que par un role de confiance (`authenticated`, la ou 20b exige
--            `service_role` puisque l acteur n a AUCUN JWT Magrit).
--        (ii) DEFENSE EN PROFONDEUR REELLE, meme si (i) suffisait a lui
--            seul a fermer l exploitation prouvee : la fonction ne recoit
--            PLUS `p_content_type`/`p_byte_size` en parametres (signature
--            reduite a `p_token`/`p_file_id`/`p_filename`) et RELIT ces deux
--            valeurs depuis `storage.objects` (l objet REEL, la ou
--            `api_confirm_order_file_upload` ne le fait pas non plus — mais
--            son appelant est un jeton utilisateur nomme, pas un acteur
--            anonyme). Refuse si l objet est ABSENT
--            (`order_file.upload_missing`, code REUTILISE d E10.17a), si son
--            type n est pas dans `storage.buckets.allowed_mime_types` du
--            bucket, ou si sa taille depasse `storage.buckets.file_size_limit`
--            (`order_file.rejected`, code REUTILISE) — les limites sont LUES
--            DYNAMIQUEMENT depuis la configuration REELLE du bucket, jamais
--            un second jeu de litteraux qui pourrait diverger silencieusement
--            de celle-ci.
--
--   3. AUCUNE colonne neuve sur `commercial_order_upload_links` : la colonne
--      `deposited_count` existe deja (posee par 20a, TOUJOURS 0 jusqu ici).
--      AUCUN bucket neuf : `commercial_order_files` (E10.17a) est reutilise
--      tel quel, ce lot n y ajoute qu un CHEMIN D ENTREE supplementaire, pas
--      un second canal de stockage.
--
--   4. AUCUNE modification d `api_confirm_order_file_upload`,
--      `api_get_order_upload_link_context` ni `api_resolve_order_upload_link_
--      principal` (E10.17a/20a) : leurs gardes restent EXACTEMENT celles de
--      leur propre lot. `api_resolve_order_upload_link_principal` est
--      REUTILISEE telle quelle par la facade pour l emission du billet
--      (`issueOrderUploadLinkFileUrl`), sans effet de bord — meme fonction
--      que celle deja consommee par `SupabaseApiPrincipalVerifier` (20a).
-- ============================================================================

-- ── 1. `commercial_order_files.deposited_via` ───────────────────────────────
alter table public.commercial_order_files
  add column if not exists deposited_via text not null default 'workspace'
    check (deposited_via in ('workspace', 'upload_link'));

comment on column public.commercial_order_files.deposited_via is
  'E10.20b — PAR OU le fichier est entre. workspace (defaut) : depose par un membre de l atelier (api_confirm_order_file_upload, E10.17a, INCHANGEE). upload_link : depose par un client via un lien public (api_confirm_order_file_upload_by_link, ce lot). Liste ADDITIVE (contrat, OrderFileDepositChannel) : jamais retirable, seulement etendue.';

-- ── 1bis. `commercial_order_files.filename` — refus des caracteres de
--         controle (qa-review round 1, M2). Un `filename` ne pouvait
--         auparavant etre refuse que pour vide/trop long ; ce texte est
--         desormais fourni aussi par un tiers NON AUTHENTIFIE (ce lot), et
--         alimente `Content-Disposition` en aval (`createSignedUrl`,
--         `getOrderFile`). Le chemin de stockage reste RECALCULE (jamais ce
--         nom) : aucune traversee de chemin n est possible, ce refus est une
--         hygiene de la valeur affichee/servie. MEME regle cote Zod
--         (`confirmOrderUploadLinkFileCommandSchema`) : deux barrieres,
--         jamais une seule. `drop`/`add` (Postgres ne permet pas de modifier
--         l expression d une contrainte CHECK existante).
alter table public.commercial_order_files
  drop constraint if exists commercial_order_files_filename_check;
alter table public.commercial_order_files
  add constraint commercial_order_files_filename_check
    check (btrim(filename) <> '' and char_length(filename) <= 255 and filename !~ '[[:cntrl:]]');

-- ── 2. `api_confirm_order_file_upload_by_link` ──────────────────────────────
-- Retrait prealable de l ANCIENNE signature (5 parametres, GRANT anon) :
-- `create or replace` ne change PAS la liste de parametres d une fonction
-- existante, il en creerait une SECONDE par surcharge — la version
-- vulnerable resterait joignable. DROP explicite, obligatoire ici.
drop function if exists public.api_confirm_order_file_upload_by_link(text, uuid, text, text, bigint);

create or replace function public.api_confirm_order_file_upload_by_link(
  p_token text,
  p_file_id uuid,
  p_filename text
)
returns table (
  file_id uuid,
  filename text,
  content_type text,
  byte_size bigint,
  deposited_at timestamptz,
  deposited_count integer,
  max_files integer,
  upload_link_id uuid,
  order_id uuid,
  order_number text,
  customer_id uuid,
  tenant_id uuid
)
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_hash text := encode(extensions.digest(convert_to(p_token, 'UTF8'), 'sha256'), 'hex');
  v_link public.commercial_order_upload_links;
  v_tenant_id uuid;
  v_order_number text;
  v_customer_id uuid;
  v_label text;
  v_storage_path text;
  v_live_count integer;
  v_row public.commercial_order_files;
  -- qa-review round 1, B1 (BLOQUANT SECURITE) — plus jamais de confiance
  -- dans des parametres pour ce qui est ECRIT en base : ces trois variables
  -- sont RELUES depuis l objet REEL (`storage.objects`) et la configuration
  -- REELLE du bucket (`storage.buckets`), jamais depuis un appelant.
  v_bucket_size_limit bigint;
  v_bucket_mime_types text[];
  v_real_byte_size bigint;
  v_real_content_type text;
begin
  -- RE-VERIFIE le jeton lui-meme (jamais un identifiant deja authentifie
  -- transmis en clair) : meme discipline qu `api_get_order_upload_link_
  -- context`. `FOR UPDATE` : deux confirmations concurrentes PAR LE MEME LIEN
  -- ne peuvent pas toutes deux lire le meme `deposited_count` avant que l une
  -- n ait ecrit.
  select l.* into v_link
    from public.commercial_order_upload_links l
   where l.token_hash = v_hash
     and l.revoked_at is null
     and l.expires_at > now()
     for update of l;

  if not found then
    raise exception 'upload_link.invalid: lien de depot introuvable, expire ou revoque';
  end if;

  -- Verrou CONSULTATIF PARTAGE avec api_confirm_order_file_upload (meme cle,
  -- meme commande) : les deux voies d entree d un fichier (atelier, lien) se
  -- SERIALISENT l une contre l autre pour le plafond COMMUN de 30 fichiers
  -- vivants, jamais chacune sous un verrou distinct qui laisserait passer un
  -- 31e fichier par la course entre les deux chemins.
  perform pg_advisory_xact_lock(hashtextextended('commercial_order_files:' || v_link.order_id::text, 0));

  select o.tenant_id, o.number, o.customer_id
    into v_tenant_id, v_order_number, v_customer_id
    from public.commercial_orders o
   where o.id = v_link.order_id;

  if v_tenant_id is null then
    raise exception 'order.not_found: commande % introuvable pour le lien %', v_link.order_id, v_link.id;
  end if;

  if exists (select 1 from public.commercial_order_files where id = p_file_id) then
    raise exception 'order_file.already_confirmed: le fichier % porte deja une ligne', p_file_id;
  end if;

  -- Plafond PROPRE au lien (arbitrage (D), defaut 10), verifie SOUS LE VERROU
  -- pris ci-dessus (qui couvre aussi ce lien, puisqu il est deja verrouille
  -- par le SELECT ... FOR UPDATE plus haut).
  if v_link.deposited_count >= v_link.max_files then
    raise exception 'upload_link.file_limit_reached: lien % a atteint son plafond de % fichiers', v_link.id, v_link.max_files;
  end if;

  -- Plafond de la COMMANDE (30 fichiers vivants, INCHANGE depuis E10.17a),
  -- SOUS LE MEME VERROU que la voie d atelier : deux budgets qui se
  -- CUMULENT, un SEUL code d erreur pour les deux causes — le porteur du
  -- lien ne peut agir sur ni l une ni l autre.
  -- `commercial_order_files.order_id` QUALIFIE, PAS `order_id` seul : cette
  -- fonction declare `RETURNS TABLE (..., order_id uuid, ...)`, qui cree une
  -- variable PL/pgSQL implicite `order_id` — un `order_id` non qualifie
  -- serait AMBIGU entre elle et la colonne (meme piege deja documente pour
  -- `api_create_order_upload_link`, E10.20a, trouve ICI a l execution
  -- reelle de ce cas SQL).
  select count(*) into v_live_count
    from public.commercial_order_files f
   where f.order_id = v_link.order_id and f.deleted_at is null;
  if v_live_count >= 30 then
    raise exception 'upload_link.file_limit_reached: commande % porte deja 30 fichiers vivants', v_link.order_id;
  end if;

  -- Chemin RECALCULE depuis le tenant DE LA COMMANDE (jamais recu en
  -- parametre) — meme discipline que api_confirm_order_file_upload.
  v_storage_path := v_tenant_id::text || '/' || v_link.order_id::text || '/' || p_file_id::text;

  -- qa-review round 1, B1 (BLOQUANT SECURITE) — DEFENSE EN PROFONDEUR REELLE.
  -- L objet est relu DIRECTEMENT dans `storage.objects` (jamais un parametre
  -- d appelant) : c est la SEULE preuve qu un depot a reellement eu lieu, et
  -- la SEULE source fiable de son type et de son poids reels. Les limites
  -- (types acceptes, poids maximal) sont LUES DYNAMIQUEMENT depuis la
  -- configuration REELLE du bucket (`storage.buckets`), jamais un second jeu
  -- de litteraux qui pourrait diverger silencieusement de celle-ci — la MEME
  -- discipline qui a deja fait exporter `MAX_UPLOAD_BYTE_SIZE`/`ACCEPTED_
  -- CONTENT_TYPES` cote TypeScript plutot que de les dupliquer.
  select b.file_size_limit, b.allowed_mime_types
    into v_bucket_size_limit, v_bucket_mime_types
    from storage.buckets b
   where b.id = 'commercial_order_files';

  select (o.metadata->>'size')::bigint, o.metadata->>'mimetype'
    into v_real_byte_size, v_real_content_type
    from storage.objects o
   where o.bucket_id = 'commercial_order_files' and o.name = v_storage_path;

  if not found then
    raise exception 'order_file.upload_missing: aucun fichier depose au chemin attendu pour %', p_file_id;
  end if;

  if v_real_content_type is null or not (v_real_content_type = any(v_bucket_mime_types)) then
    -- REFUS DE LA LIGNE (pas de suppression de l objet ICI : `storage.
    -- delete_object` n existe pas comme fonction SQL appelable — l extension
    -- Storage ne l expose pas ; le retrait best-effort d un objet refuse
    -- reste du ressort du `storageClient` cote adaptateur, comme pour
    -- `api_confirm_order_file_upload`, E10.17a). L objet illegitime reste
    -- inerte dans un bucket PRIVE, jamais lu par aucune ligne metier : aucun
    -- risque au-dela de l espace de stockage consomme.
    raise exception 'order_file.rejected: type de fichier non accepte (%)', coalesce(v_real_content_type, 'inconnu');
  end if;

  if v_real_byte_size is null or v_real_byte_size < 1 or v_real_byte_size > v_bucket_size_limit then
    raise exception 'order_file.rejected: poids de fichier hors bornes (% octets)', coalesce(v_real_byte_size, -1);
  end if;

  -- Libelle FIGE, COMPOSE depuis le LIEN (jamais d auth.users — le deposant
  -- n en est pas un). Contrat §3 : deux formes, selon que le lien porte un
  -- label ou non.
  v_label := case
    when v_link.label is not null then 'Dépôt client — ' || v_link.label
    else 'Dépôt client par lien'
  end;

  -- `content_type`/`byte_size` ECRITS EN BASE VIENNENT DE L OBJET REEL
  -- (v_real_content_type/v_real_byte_size), JAMAIS des parametres d appel
  -- (qui n existent d ailleurs plus dans la signature de cette fonction).
  insert into public.commercial_order_files
    (id, order_id, order_line_id, filename, content_type, byte_size, visibility,
     storage_path, deposited_by, deposited_by_label, deposited_via)
  values
    (p_file_id, v_link.order_id, null, p_filename, v_real_content_type, v_real_byte_size, 'internal',
     v_storage_path, null, v_label, 'upload_link')
  returning * into v_row;

  -- Meme discipline de qualification a droite du `=` : `deposited_count`
  -- seul serait AMBIGU entre la variable de sortie et la colonne.
  update public.commercial_order_upload_links
     set deposited_count = commercial_order_upload_links.deposited_count + 1
   where id = v_link.id;

  return query select
    v_row.id, v_row.filename, v_row.content_type, v_row.byte_size, v_row.deposited_at,
    v_link.deposited_count + 1, v_link.max_files, v_link.id, v_link.order_id, v_order_number, v_customer_id,
    v_tenant_id;
end;
$$;

comment on function public.api_confirm_order_file_upload_by_link(text, uuid, text) is
  'E10.20b — POST /order-upload-links/current/files. SECONDE fonction de confirmation, DISTINCTE d api_confirm_order_file_upload (E10.17a, INCHANGEE) : garde opposee (jeton de lien re-verifie, jamais auth.uid()), libelle COMPOSE depuis le lien. Verrou CONSULTATIF PARTAGE avec la voie d atelier (meme cle) : les deux chemins d entree se serialisent sur le MEME plafond de 30 fichiers vivants. Plafond propre au lien verifie SOUS CE VERROU. visibility TOUJOURS internal, order_line_id TOUJOURS null (le porteur du lien ne choisit ni l un ni l autre). CORRECTIF SECURITE qa-review round 1 (B1, BLOQUANT, faille exploitee reellement) : ne recoit PLUS content_type/byte_size en parametres, les RELIT depuis storage.objects/storage.buckets (jamais confiance dans un appelant) ; GRANT EXECUTE service_role UNIQUEMENT (retire d anon).';

revoke all on function public.api_confirm_order_file_upload_by_link(text, uuid, text) from public, anon, authenticated;
grant execute on function public.api_confirm_order_file_upload_by_link(text, uuid, text) to service_role;

notify pgrst, 'reload schema';

-- ============================================================================
-- REVERSIBILITE — le CLI Supabase ne gere pas de bloc `down`. SQL de retrait,
-- a jouer tel quel dans une migration inverse si la story est annulee :
--
--   revoke execute on function public.api_confirm_order_file_upload_by_link(text, uuid, text) from service_role;
--   drop function if exists public.api_confirm_order_file_upload_by_link(text, uuid, text);
--   alter table public.commercial_order_files drop constraint if exists commercial_order_files_filename_check;
--   alter table public.commercial_order_files add constraint commercial_order_files_filename_check
--     check (btrim(filename) <> '' and char_length(filename) <= 255);
--   alter table public.commercial_order_files drop column if exists deposited_via;
--   notify pgrst, 'reload schema';
--
-- Le retrait de deposited_via perd la distinction workspace/upload_link sur
-- les fichiers deja deposes par un lien : sans consequence fonctionnelle tant
-- que la colonne n est lue par aucune autre table (aucune n existe).
--
-- NOTE (qa-review round 1, B1) : si cette migration a deja ete deployee AVEC
-- l ancienne signature (5 parametres, GRANT anon) avant ce correctif, la
-- migration inverse ci-dessus ne retire QUE la version corrigee (3
-- parametres) — verifier qu aucune version vulnerable ne survit avec
-- `\df api_confirm_order_file_upload_by_link` avant de considerer le retrait
-- complet.
-- ============================================================================
