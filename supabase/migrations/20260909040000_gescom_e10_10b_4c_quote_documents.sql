-- ============================================================================
-- Sprint 5 Gestion commerciale — story E10.10b-4c : moteur de generation et
-- branchement. Contrat : openapi/magrit-core.v1.yaml (schema QuoteDocument,
-- operations getQuoteDocument/getStorefrontQuoteDocument), docs/api/
-- CONVENTIONS.md §8.18. Suite de 20260909020000 (4a, document_pdf_templates)
-- et 20260909030000 (4b, document_pdf_template_fields).
-- ----------------------------------------------------------------------------
-- Perimetre STRICT de ce lot (4c uniquement, une migration = une story) :
--
--   1. Table NEUVE public.quote_documents — la piece PRODUITE. `quote_id`
--      UNIQUE (`on delete cascade` — un devis a UN document) ; `template_id`
--      NOT NULL `on delete restrict` (arbitrage Arnaud du 2026-09-09,
--      reserve (a) : "un document n existe que produit sur un gabarit du
--      tenant" — QuoteDocument.template_id est OBLIGATOIRE et NON NUL au
--      contrat, donc en base aussi ; c est cette contrainte, et non une
--      verification prealable de la facade, qui tient le refus de
--      `api_delete_document_pdf_template` en 409 `document_pdf_template.in_use`
--      des qu au moins un document a ete produit sur ce gabarit — cf.
--      20260909020000, branche "INATTEIGNABLE tant que quote_documents n
--      existe pas", qui devient ATTEIGNABLE a partir d ICI).
--
--   2. Bucket Storage PRIVE `quote_documents` — MEME patron que
--      `document_pdf_templates` (20260909020000) : AUCUNE policy
--      `storage.objects`, seul le `service_role` l atteint. Chemin
--      `<tenant_id>/<quote_id>.pdf`.
--
--   3. APPEND-ONLY (contrat §8.18 §2, "une table d audit du sprint") :
--      AUCUNE policy d ecriture pour `anon`/`authenticated`, insertion
--      reservee au `service_role` (meme discipline EXACTE que
--      `outbox_events`, 20260901000100) — c est la FACADE, dans l operation
--      `sendQuote`, qui ecrit cette ligne, jamais un client. Aucune mise a
--      jour ni suppression n est jamais necessaire : un document produit ne
--      se corrige pas, il se remplace... jamais (contrat : "jamais
--      regenere").
--
--   4. RLS — lecture ATELIER (jeton utilisateur/cle de service) ouverte a
--      tout membre du tenant, MEME PATRON que `document_pdf_templates_select`
--      (policy standard `tenant_id in (select current_user_tenant_ids())`).
--      Lecture PORTAIL CLIENT (session boutique, role anon) : PAS de policy
--      ouverte a `anon` — le contrat l exige explicitement ("Lecture client
--      par une fonction api_* security definer (patron b-1), jamais par une
--      policy ouverte au role boutique"), c est
--      `api_get_storefront_quote_document` ci-dessous qui sert ce cas,
--      RE-VERIFIANT la session et l appartenance du devis a chaque appel,
--      exactement comme `api_get_storefront_quote` (20260906170000).
--
--   5. Trigger de coherence tenant, MEME PATRON QUE
--      `document_pdf_template_fields_assert_same_tenant` (20260909030000,
--      correctif qa-review B1 du lot precedent) : `quote_documents.tenant_id`
--      doit correspondre au tenant REEL du devis ET du gabarit designes,
--      jamais seulement a la valeur portee par la ligne elle-meme. Defense en
--      profondeur : le chemin nominal (le SERVICE, `sendQuote`) ne peut de
--      toute facon produire une ligne incoherente, mais la LECON du lot
--      precedent est justement qu une garde EN BASE ne coute rien et evite
--      qu un futur appel direct (RPC forge, migration de donnees maladroite)
--      ne fasse fuiter un document d un tenant vers un autre.
--
--   6. Fonction `api_get_storefront_quote_document` (`security definer`),
--      MEME PATRON que `api_get_storefront_quote` (20260906170000) :
--      `p_opaque_token` re-verifie la session a CHAQUE appel (jamais un
--      compte memorise), jointure EXPLICITE
--      `shop_customer_accounts -> customer_contacts -> customers ->
--      commercial_quotes` scopee au client de LA session, statut du devis
--      restreint a ('sent','accepted','rejected','converted') — memes
--      quatre statuts que `api_get_storefront_quote`, un devis `draft` n a de
--      toute facon jamais de document (genere uniquement a l envoi). Rend
--      `storage_path` en plus des colonnes publiques du contrat : ce champ
--      n est PAS expose au DTO `QuoteDocument`, il sert UNIQUEMENT a
--      l adaptateur TypeScript a signer l URL de telechargement — jamais
--      journalise, jamais renvoye au client tel quel.
--
--   7. `getQuoteDocument` (cote ATELIER) ne recoit PAS de fonction dediee :
--      une policy RLS standard suffit, exactement comme pour
--      `document_pdf_templates` — la reserve du contrat ("jamais par une
--      policy ouverte au role boutique") vise SPECIFIQUEMENT le role anon de
--      la boutique, pas un membre authentifie du tenant.
-- ============================================================================

-- ── 1. Table `quote_documents` ──────────────────────────────────────────────
create table if not exists public.quote_documents (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  quote_id        uuid not null unique references public.commercial_quotes(id) on delete cascade,
  -- OBLIGATOIRE ET NON NUL (arbitrage Arnaud du 2026-09-09, reserve (a)) :
  -- un document n existe que produit sur un gabarit du tenant, il n y a
  -- aucun gabarit de repli fourni par Magrit. `on delete restrict` : un
  -- gabarit deja porte par un document ne peut plus etre supprime
  -- (document_pdf_template.in_use, 20260909020000).
  template_id     uuid not null references public.document_pdf_templates(id) on delete restrict,
  storage_path    text not null,
  byte_size       bigint not null check (byte_size >= 1),
  sha256          text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  content_type    text not null default 'application/pdf' check (content_type = 'application/pdf'),
  page_count      integer not null check (page_count >= 1),
  -- COINCIDE par construction avec le premier `sent_at` du devis (contrat,
  -- `QuoteDocument.generated_at`) : la generation a lieu DANS l operation
  -- d envoi, nulle part ailleurs. Pas de `default now()` : la valeur est
  -- TOUJOURS fournie explicitement par la facade (`issuedAt`, jamais une
  -- horloge lue en base), meme discipline que le moteur de rendu lui-meme.
  generated_at    timestamptz not null,
  generated_by    uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),

  -- SECONDE barriere, independante de la facade (qa-review B1 du lot
  -- precedent, applique ici par anticipation) : un chemin de stockage qui ne
  -- serait pas EXACTEMENT celui que le serveur impose ne peut jamais etre
  -- persiste, quelle que soit la voie d ecriture.
  constraint quote_documents_storage_path_canonical
    check (storage_path = tenant_id::text || '/' || quote_id::text || '.pdf')
);

comment on table public.quote_documents is
  'E10.10b-4c — le PDF d un devis, produit UNE FOIS a l envoi (sendQuote), stocke, jamais regenere (contrat §8.18 §5). Append-only : aucune policy d ecriture pour anon/authenticated, insertion reservee au service_role (meme discipline que outbox_events, 20260901000100).';
comment on column public.quote_documents.template_id is
  'JAMAIS NULL : un document n existe que produit sur un gabarit du tenant (arbitrage Arnaud du 2026-09-09, aucun gabarit de repli Magrit). on delete restrict tient le refus de api_delete_document_pdf_template en 409 in_use.';
comment on column public.quote_documents.generated_at is
  'Coincide par construction avec sent_at du devis (generation faite DANS sendQuote, nulle part ailleurs). Fournie explicitement par la facade, jamais par un default now() : aucune horloge lue en base pour cette colonne.';

create index if not exists quote_documents_tenant_idx
  on public.quote_documents (tenant_id);
create index if not exists quote_documents_template_idx
  on public.quote_documents (template_id);

-- ── Trigger de coherence tenant (qa-review B1, applique par anticipation) ───
create or replace function public.quote_documents_assert_same_tenant()
returns trigger
language plpgsql
as $$
declare
  v_quote_tenant uuid;
  v_template_tenant uuid;
begin
  select tenant_id into v_quote_tenant
    from public.commercial_quotes
   where id = new.quote_id;

  if v_quote_tenant is null or v_quote_tenant <> new.tenant_id then
    raise exception
      'quote_documents : le devis (%) n appartient pas au tenant declare (%)',
      new.quote_id, new.tenant_id;
  end if;

  select tenant_id into v_template_tenant
    from public.document_pdf_templates
   where id = new.template_id;

  if v_template_tenant is null or v_template_tenant <> new.tenant_id then
    raise exception
      'quote_documents : le gabarit (%) n appartient pas au tenant declare (%)',
      new.template_id, new.tenant_id;
  end if;

  return new;
end;
$$;

drop trigger if exists quote_documents_same_tenant on public.quote_documents;
create trigger quote_documents_same_tenant
  before insert or update on public.quote_documents
  for each row execute function public.quote_documents_assert_same_tenant();

-- ── RLS ──────────────────────────────────────────────────────────────────
alter table public.quote_documents enable row level security;

-- Lecture ATELIER : ouverte a tout membre du tenant, MEME PATRON que
-- document_pdf_templates_select (20260909020000). Un jeton utilisateur ou
-- une cle de service `quotes:read` passe par le role `authenticated`, jamais
-- par `anon` — la reserve du contrat sur le role boutique ne s applique pas
-- ici.
drop policy if exists "quote_documents_select" on public.quote_documents;
create policy "quote_documents_select" on public.quote_documents for select using (
  is_super_admin()
  or tenant_id in (select public.current_user_tenant_ids())
);

-- APPEND-ONLY, insertion SERVICE_ROLE UNIQUEMENT (contrat §8.18 §2) : aucune
-- policy d ecriture pour anon/authenticated, meme discipline EXACTE que
-- outbox_events (20260901000100). `authenticated`/`anon` gardent SELECT
-- (deja accorde par le grant applicatif de base, 20260811000100), restreint
-- par la policy ci-dessus ; insert/update/delete leur sont explicitement
-- retires.
revoke insert, update, delete on table public.quote_documents from anon, authenticated;
grant select, insert on table public.quote_documents to service_role;

-- ── 2. Bucket Storage PRIVE, aucune policy `storage.objects` ────────────────
insert into storage.buckets (id, name, public, allowed_mime_types)
values (
  'quote_documents',
  'quote_documents',
  false,
  array['application/pdf']::text[]
)
on conflict (id) do update set
  public             = excluded.public,
  allowed_mime_types = excluded.allowed_mime_types;

-- ── 3. `api_get_storefront_quote_document` — MEME PATRON que
-- `api_get_storefront_quote` (20260906170000) ────────────────────────────────
create or replace function public.api_get_storefront_quote_document(
  p_opaque_token text,
  p_quote_id uuid
)
returns table (
  quote_id uuid,
  template_id uuid,
  generated_at timestamptz,
  byte_size bigint,
  sha256 text,
  content_type text,
  page_count integer,
  storage_path text
)
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare
  v_session record;
  v_customer_id uuid;
begin
  if p_opaque_token is null
     or length(p_opaque_token) not between 32 and 512
     or p_opaque_token !~ '^[A-Za-z0-9_-]+$'
     or p_quote_id is null then
    return;
  end if;

  select * into v_session from public.api_resolve_shop_customer_session(p_opaque_token);
  if v_session.account_id is null then
    return;
  end if;

  select cc.customer_id into v_customer_id
  from public.shop_customer_accounts sca
  join public.customer_contacts cc on cc.id = sca.customer_contact_id
  where sca.id = v_session.account_id;

  if v_customer_id is null then
    return;
  end if;

  -- 404 INDISCERNABLE (contrat) : identifiant inconnu, devis d un autre
  -- client, devis d un autre tenant (deja exclu par le join customer_id, qui
  -- est scope au tenant du client), devis encore draft, devis sans document
  -- — toutes ces causes rendent un jeu de lignes VIDE, jamais distinguees.
  return query
  select qd.quote_id, qd.template_id, qd.generated_at, qd.byte_size, qd.sha256,
         qd.content_type, qd.page_count, qd.storage_path
    from public.quote_documents qd
    join public.commercial_quotes q on q.id = qd.quote_id
   where q.id = p_quote_id
     and q.customer_id = v_customer_id
     and q.status in ('sent', 'accepted', 'rejected', 'converted');
end;
$$;

comment on function public.api_get_storefront_quote_document(text, uuid) is
  'E10.10b-4c — GET /storefront-quotes/{quoteId}/documents. Jeu de lignes VIDE (traduit en 404 quote.not_found INDISCERNABLE par la route) sur toutes les causes confondues : session invalide, compte sans interlocuteur, devis d un autre client/tenant, devis draft, devis sans document. storage_path est un champ INTERNE, jamais expose au DTO QuoteDocument : il sert uniquement a signer l URL de telechargement cote adaptateur.';

revoke all on function public.api_get_storefront_quote_document(text, uuid) from public, authenticated;
grant execute on function public.api_get_storefront_quote_document(text, uuid) to anon;

notify pgrst, 'reload schema';

-- ============================================================================
-- REVERSIBILITE — le CLI Supabase ne gere pas de bloc `down`. SQL de retrait,
-- a jouer tel quel dans une migration inverse si la story est annulee :
--
--   revoke execute on function public.api_get_storefront_quote_document(text, uuid) from anon;
--   drop function if exists public.api_get_storefront_quote_document(text, uuid);
--   delete from storage.objects where bucket_id = 'quote_documents';
--   delete from storage.buckets where id = 'quote_documents';
--   drop policy if exists "quote_documents_select" on public.quote_documents;
--   drop trigger if exists quote_documents_same_tenant on public.quote_documents;
--   drop function if exists public.quote_documents_assert_same_tenant();
--   drop table if exists public.quote_documents;
--   notify pgrst, 'reload schema';
--
-- Effet de bord a connaitre AVANT de rejouer ce retrait : la branche
-- `document_pdf_template.in_use` de `api_delete_document_pdf_template`
-- (20260909020000) redevient INATTEIGNABLE, exactement comme avant ce lot.
-- ============================================================================
