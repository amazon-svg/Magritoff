-- ============================================================================
-- Sprint 5 Gestion commerciale — correctif qa-review round 1 (B2, BLOQUANT
-- GRAVE) sur E10.22c (objets orphelins). Contrat : docs/api/CONVENTIONS.md
-- §8.22 §6. Migration NEUVE (les deux fonctions retouchees ici,
-- `api_confirm_order_file_upload` et `api_confirm_order_file_upload_by_link`,
-- sont DEJA committees — E10.17a `20260909060000`, E10.20b `20260910000400`
-- — jamais editees directement, `create or replace function` UNIQUEMENT,
-- meme discipline que `commercial_order_files_set_updated_at()` en
-- `20260910000500`).
-- ----------------------------------------------------------------------------
-- LE TROU DE SURETE, PROUVE PAR EXECUTION REELLE PAR LA QA-REVIEW :
--
--   1. Un billet d upload est emis, le PUT reussit (octets ecrits en
--      storage), MAIS la confirmation echoue (reseau, onglet ferme, 500
--      transitoire) -- objet en storage, AUCUNE ligne `commercial_order_
--      files`.
--   2. A T+25h, `api_claim_orphan_order_file_objects` (E10.22c,
--      `20260910000600`) LISTE ce chemin comme candidat orphelin -- le
--      `not exists` + `created_at <= now() - 24h` matchent legitimement.
--   3. JUSTE APRES, l utilisateur reessaie (reprise, nouveau clic) : la
--      confirmation ABOUTIT enfin et cree une ligne VIVANTE au MEME chemin.
--   4. L Edge Function, qui a deja recu la liste de l etape 2, appelle
--      `storage.remove()` sur ce chemin -- DETRUISANT LES OCTETS D UNE LIGNE
--      VIVANTE. La ligne reste en base, `deleted_at` NULL : l atelier voit
--      le fichier dans la liste, le telechargement rend 404, et AUCUNE trace
--      (ni `purged_at`, ni `order_files.purged`, ni rien) n explique ce qui
--      s est passe.
--
-- RACINE DU PROBLEME : rien ne bornait l age de l objet storage AU MOMENT DE
-- LA CONFIRMATION. Ni `api_confirm_order_file_upload` (E10.17a, qui ne lit
-- meme pas `storage.objects`) ni `api_confirm_order_file_upload_by_link`
-- (E10.20b, qui exige seulement que l objet EXISTE, sans verifier son age).
-- L invariant « une ligne vivante a un objet de moins de 24h » n existait
-- NULLE PART dans le code -- la surete d E10.22c reposait sur une HYPOTHESE
-- DE TIMING non garantie, pas sur une construction.
--
-- CORRECTIF, DETERMINISTE ET SYMETRIQUE DE LA GARDE DU §5 (PAS une simple
-- re-verification cote adaptateur, qui ne ferait que RACCOURCIR la fenetre
-- sans la FERMER — un adaptateur ne peut pas empecher un appel direct a la
-- RPC) : LES DEUX fonctions de confirmation refusent desormais
-- explicitement toute confirmation dont l objet storage est DEJA plus vieux
-- que le delai des orphelins (24h, MEME VALEUR que le defaut de
-- `api_claim_orphan_order_file_objects` — litteral duplique, meme discipline
-- documentee que `ORDER_FILE_LIVE_LIMIT`/`MAX_UPLOAD_BYTE_SIZE`, aucune
-- primitive Postgres ne partage une constante entre fonctions aussi
-- simplement qu un module TypeScript). Nouveau code d erreur :
-- `order_file.upload_expired` (409, cote route — meme statut que
-- `quote.decision_expired`, precedent du depot).
--
-- AVEC CE REFUS EN PLACE, UNE LIGNE NE PEUT PLUS STRUCTURELLEMENT JAMAIS
-- DEVENIR VIVANTE SUR UN CHEMIN DEJA CANDIDAT AU NETTOYAGE ORPHELINS : soit
-- la confirmation arrive AVANT 24h (l objet n est alors PAS encore candidat,
-- `not exists` + `created_at` ne matchent pas au tour ou elle aboutit), soit
-- elle arrive APRES et elle est REFUSEE. Le scenario de course ci-dessus
-- devient IRREPRODUCTIBLE, par construction — pas par hypothese de timing.
-- ============================================================================

-- ── 1. api_confirm_order_file_upload (E10.17a) — refus si l objet est deja
-- expire au moment de la confirmation ────────────────────────────────────
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
  -- qa-review round 1 (B2, BLOQUANT GRAVE, E10.22c) : instant REEL de depot,
  -- lu depuis storage.objects, jamais suppose.
  v_object_created_at timestamptz;
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

  -- qa-review round 1 (B2, BLOQUANT GRAVE) — voir en-tete de fichier. Objet
  -- absent (v_object_created_at NULL) : comportement INCHANGE (cette
  -- fonction ne verifiait deja pas l existence de l objet avant ce
  -- correctif, l adaptateur TS le fait via `.info()` avant d appeler cette
  -- RPC — hors perimetre de ce correctif, qui ne traite QUE l expiration).
  select o.created_at into v_object_created_at
    from storage.objects o
   where o.bucket_id = 'commercial_order_files' and o.name = v_storage_path;

  if v_object_created_at is not null and v_object_created_at <= now() - interval '24 hours' then
    raise exception 'order_file.upload_expired: objet depose au chemin % il y a plus de 24 heures (fichier %), expire pour confirmation — redemander un billet de depot', v_storage_path, p_file_id;
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
  'E10.17a — POST /commercial-orders/{orderId}/files. Seul endroit ou un fichier de commande existe. Verrou sur la commande, plafond de 30 fichiers vivants SOUS CE VERROU, ligne citee verifiee CONTRE CETTE commande, chemin de stockage RECALCULE (jamais recu en parametre). AUCUNE garde de capability (decision #4). AUCUN parametre de libelle d auteur (qa-review B1 round 2) : v_actor n est jamais nul dans ce lot, deposited_by_label est TOUJOURS lu depuis auth.users, jamais fourni par l appelant. qa-review round 1 (B2, E10.22c, BLOQUANT GRAVE) : refuse order_file.upload_expired si l objet storage est deja plus vieux que le delai des orphelins (24h) — ferme par construction la course avec le nettoyage des objets orphelins.';

revoke all on function public.api_confirm_order_file_upload(uuid, uuid, uuid, text, uuid, text, text, bigint) from public, anon;
grant execute on function public.api_confirm_order_file_upload(uuid, uuid, uuid, text, uuid, text, text, bigint) to authenticated;

-- ── 2. api_confirm_order_file_upload_by_link (E10.20b) — meme refus,
-- reutilise LA MEME lecture de storage.objects deja presente pour
-- content_type/byte_size (aucun aller-retour storage supplementaire) ──────
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
  -- qa-review round 1, B2 (BLOQUANT GRAVE, E10.22c) — instant REEL de depot,
  -- lu DANS LA MEME requete que content_type/byte_size ci-dessous.
  v_object_created_at timestamptz;
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

  -- qa-review round 1, B2 (BLOQUANT GRAVE, E10.22c) — `o.created_at` ajoute
  -- a CETTE MEME lecture (aucun aller-retour storage supplementaire).
  select (o.metadata->>'size')::bigint, o.metadata->>'mimetype', o.created_at
    into v_real_byte_size, v_real_content_type, v_object_created_at
    from storage.objects o
   where o.bucket_id = 'commercial_order_files' and o.name = v_storage_path;

  if not found then
    raise exception 'order_file.upload_missing: aucun fichier depose au chemin attendu pour %', p_file_id;
  end if;

  -- qa-review round 1, B2 — voir en-tete de fichier : ferme par construction
  -- la course avec `api_claim_orphan_order_file_objects` (E10.22c). MEME
  -- delai (24h) que le defaut de cette fonction (`20260910000600`).
  if v_object_created_at <= now() - interval '24 hours' then
    raise exception 'order_file.upload_expired: objet depose au chemin % il y a plus de 24 heures (fichier %), expire pour confirmation — redemander un billet de depot', v_storage_path, p_file_id;
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
  'E10.20b — POST /order-upload-links/current/files. SECONDE fonction de confirmation, DISTINCTE d api_confirm_order_file_upload (E10.17a) : garde opposee (jeton de lien re-verifie, jamais auth.uid()), libelle COMPOSE depuis le lien. Verrou CONSULTATIF PARTAGE avec la voie d atelier (meme cle) : les deux chemins d entree se serialisent sur le MEME plafond de 30 fichiers vivants. Plafond propre au lien verifie SOUS CE VERROU. visibility TOUJOURS internal, order_line_id TOUJOURS null (le porteur du lien ne choisit ni l un ni l autre). CORRECTIF SECURITE qa-review round 1 E10.20b (B1, BLOQUANT, faille exploitee reellement) : ne recoit PLUS content_type/byte_size en parametres, les RELIT depuis storage.objects/storage.buckets (jamais confiance dans un appelant) ; GRANT EXECUTE service_role UNIQUEMENT (retire d anon). CORRECTIF qa-review round 1 E10.22b/c (B2, BLOQUANT GRAVE) : refuse order_file.upload_expired si l objet storage est deja plus vieux que le delai des orphelins (24h) — ferme par construction la course avec le nettoyage des objets orphelins (E10.22c).';

revoke all on function public.api_confirm_order_file_upload_by_link(text, uuid, text) from public, anon, authenticated;
grant execute on function public.api_confirm_order_file_upload_by_link(text, uuid, text) to service_role;

notify pgrst, 'reload schema';

-- ============================================================================
-- REVERSIBILITE — le CLI Supabase ne gere pas de bloc `down`. Ce correctif
-- REECRIT deux fonctions deja existantes (`create or replace`) : il n y a
-- rien a `drop`. Pour revenir a la forme d avant ce correctif (refus
-- `order_file.upload_expired` retire), rejouer le corps EXACT de la fonction
-- tel qu ecrit dans `20260909060000` (api_confirm_order_file_upload) et
-- `20260910000400` (api_confirm_order_file_upload_by_link) via un nouveau
-- `create or replace function` — jamais en editant ces fichiers.
--
--   notify pgrst, 'reload schema';
-- ============================================================================
