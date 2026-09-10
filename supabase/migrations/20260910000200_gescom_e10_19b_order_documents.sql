-- ============================================================================
-- Sprint 5 Gestion commerciale — story E10.19b : la production et la remise
-- du bon de commande PDF. Contrat : openapi/magrit-core.v1.yaml (schema
-- `OrderDocument`, operations `getOrderDocument`/`generateOrderDocument`),
-- docs/api/CONVENTIONS.md §8.20 (E10.19), notamment §6 ("ce que le contrat
-- porte") et §10 decision (C) : action EXPLICITE et REJOUABLE, jamais un
-- effet de bord de la conversion. Suite de 20260910000100 (19a, gabarit +
-- colonnes gelees `show_discounts`/`customer_reference`).
-- ----------------------------------------------------------------------------
-- Perimetre STRICT de ce lot (19b uniquement) :
--
--   1. Table NEUVE public.order_documents — la piece PRODUITE. `order_id`
--      UNIQUE (`on delete cascade` — une commande a UN document, jamais
--      reproduit, contrat §8.20 §9 "Aucune regeneration, jamais"). Meme
--      patron QUE `quote_documents` (20260909040000), PAS une colonne
--      `document_type` ajoutee a cette derniere : deux tables jumelles pour
--      le meme motif deja retenu entre `commercial_quote_lines`/
--      `commercial_order_lines` (contrat §8.20 §3) — un devis n est pas une
--      commande, fondre les deux imposerait une exclusion mutuelle fragile.
--      `template_id` NOT NULL `on delete restrict` (meme discipline que
--      `quote_documents.template_id`, contrat `OrderDocument.template_id` :
--      "JAMAIS NULL... AUCUN repli sur un gabarit quote n est tente") — cette
--      contrainte EN BASE est ce qui etend la branche 409 `in_use` de
--      `api_delete_document_pdf_template` (20260909020000) aux gabarits
--      `order`, SANS toucher a cette fonction (elle attrape deja
--      `foreign_key_violation` generiquement, ecrit pour "le jour ou sa cle
--      etrangere on delete restrict existera").
--
--   2. Bucket Storage PRIVE `order_documents` — MEME patron que
--      `quote_documents`/`document_pdf_templates` : AUCUNE policy
--      `storage.objects`, seul le `service_role` l atteint. Chemin
--      `<tenant_id>/<order_id>.pdf`.
--
--   3. APPEND-ONLY, mais ECRITURE PAR RPC `security definer`
--      (`api_register_order_document`), PAS par le `service_role` en
--      insertion DIRECTE comme `quote_documents.store()` — ECART DELIBERE,
--      motive au rapport de fin de story : `OrderDocument` porte
--      `generated_by_label` (FIGE au moment de la production, "produire est
--      desormais le geste d une personne", contrat), et CE libelle est
--      resolu par lecture de `auth.users` — geste que seule une fonction
--      `security definer` invoquee AVEC LE JETON DE L ACTEUR (`auth.uid()`
--      non nul) peut faire fidelement, exactement comme
--      `api_change_commercial_order_production_step` (20260909000000)
--      resout deja `actor_label` de la meme facon pour le journal d etape.
--      Le SERVICE_ROLE (utilise pour le SEUL depot des octets dans le
--      bucket, avant cet appel) n a PAS de session `auth.uid()` — router
--      l ecriture de la ligne par lui aurait force `generated_by`/
--      `generated_by_label` a etre PASSES en parametres non verifies plutot
--      que RESOLUS cote base, un ecart de fiabilite face au patron deja en
--      place pour `OrderStepChange`.
--
--   4. RLS — lecture ATELIER (jeton utilisateur ou cle de service
--      `orders:read`) ouverte a tout membre du tenant, MEME PATRON que
--      `quote_documents_select`/`document_pdf_templates_select`. AUCUNE
--      lecture PORTAIL CLIENT : contrairement au devis, `generateOrderDocument`
--      est reserve a `bearerAuth` SEUL (contrat, aucune `serviceKey`) et il n
--      existe TOUJOURS pas de `/storefront-orders` (contrat §8.20 §9, "Aucune
--      surface client").
--
--   5. Trigger de coherence tenant, MEME PATRON QUE
--      `quote_documents_assert_same_tenant` : `order_documents.tenant_id`
--      doit correspondre au tenant REEL de la commande ET du gabarit
--      designes, jamais seulement a la valeur portee par la ligne — defense
--      en profondeur, meme motif que 4c (qa-review B1 du lot precedent,
--      applique ici par anticipation plutot que decouvert en revue).
--
--   6. Fonction `api_register_order_document` (`security definer`) : verifie
--      l appartenance au tenant (meme garde que `api_convert_commercial_quote`/
--      `api_change_commercial_order_production_step` — tout membre
--      admin/member, AUCUNE capability neuve, contrat §6 "produire est un
--      geste commercial ordinaire"), resout `generated_by_label` (email de
--      `auth.uid()`), VERIFIE l existence de la commande et du gabarit dans
--      CE tenant (404 `order.not_found` / 409 `order.document_template_missing`),
--      puis INSERE — l unique_violation sur `order_id` (course entre deux
--      productions concurrentes de la MEME commande) est traduite en 409
--      `order.document_already_generated`, MEME code que la garde applicative
--      qui verifie l existence AVANT tout rendu (double barriere, la garde
--      SQL n est atteinte QUE par une course reelle).
--
--   7. AUCUNE table `commercial_order_files` (E10.17) touchee — decision #12
--      de §8.19, close : une piece produite et remise ne se supprime jamais,
--      un fichier depose si. Deux cycles de vie, deux tables, INCHANGE.
-- ============================================================================

-- ── 1. Table `order_documents` ──────────────────────────────────────────────
create table if not exists public.order_documents (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  order_id            uuid not null unique references public.commercial_orders(id) on delete cascade,
  -- OBLIGATOIRE ET NON NUL (contrat, `OrderDocument.template_id`) : un
  -- document n existe que produit sur un gabarit `order` du tenant, aucun
  -- gabarit de repli Magrit, jamais un repli sur le gabarit `quote`.
  -- `on delete restrict` : un gabarit deja porte par un document ne peut
  -- plus etre supprime (409 `document_pdf_template.in_use`, etend la branche
  -- deja ecrite par 20260909020000 sans y toucher).
  template_id         uuid not null references public.document_pdf_templates(id) on delete restrict,
  storage_path        text not null,
  byte_size           bigint not null check (byte_size >= 1),
  sha256              text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  content_type        text not null default 'application/pdf' check (content_type = 'application/pdf'),
  page_count          integer not null check (page_count >= 1),
  -- Instant de PRODUCTION reel (contrat : "ne coincide avec AUCUNE
  -- transmission" — a la difference de quote_documents.generated_at, qui
  -- coincide par construction avec l envoi). Fourni explicitement par la
  -- facade (jamais un `default now()`), meme discipline que quote_documents.
  generated_at        timestamptz not null,
  generated_by        uuid references auth.users(id) on delete set null,
  -- FIGE au moment de la production (contrat : "produire est desormais le
  -- geste d une personne, la trace le dit") — resolu par la fonction
  -- ci-dessous, JAMAIS ecrit par un client. `null` uniquement si le compte a
  -- ete supprime depuis (meme regle que `generated_by`, OrderStepChange).
  generated_by_label  text,
  created_at          timestamptz not null default now(),

  -- SECONDE barriere, independante de la facade (meme discipline que
  -- quote_documents_storage_path_canonical, qa-review B1 du lot 4c) : un
  -- chemin de stockage qui ne serait pas EXACTEMENT celui que le serveur
  -- impose ne peut jamais etre persiste, quelle que soit la voie d ecriture.
  constraint order_documents_storage_path_canonical
    check (storage_path = tenant_id::text || '/' || order_id::text || '.pdf')
);

comment on table public.order_documents is
  'E10.19b — le PDF (accuse de commande) d une commande, produit UNE FOIS sur ACTION EXPLICITE (POST .../documents), rejouable tant qu elle n a pas reussi, jamais reproduit ensuite (contrat §8.20 §9). Append-only : aucune policy d ecriture pour anon/authenticated, insertion reservee a la fonction security definer api_register_order_document (PAS au service_role en direct, contrairement a quote_documents — voir en-tete de fichier).';
comment on column public.order_documents.template_id is
  'JAMAIS NULL : un document n existe que produit sur un gabarit order du tenant (aucun gabarit de repli Magrit, AUCUN repli sur un gabarit quote). on delete restrict etend la branche 409 in_use de api_delete_document_pdf_template (20260909020000) sans y toucher (foreign_key_violation generique).';
comment on column public.order_documents.generated_at is
  'Instant de PRODUCTION reel, ne coincide avec AUCUNE transmission (contrat, a la difference de quote_documents.generated_at). Fourni explicitement par la facade, jamais un default now().';
comment on column public.order_documents.generated_by_label is
  'Libelle FIGE de l auteur au moment de la production (email resolu par api_register_order_document). Survit a la suppression du compte. NE JAMAIS L ANALYSER.';

create index if not exists order_documents_tenant_idx
  on public.order_documents (tenant_id);
create index if not exists order_documents_template_idx
  on public.order_documents (template_id);

-- ── Trigger de coherence tenant (meme patron que quote_documents, 4c) ──────
create or replace function public.order_documents_assert_same_tenant()
returns trigger
language plpgsql
as $$
declare
  v_order_tenant uuid;
  v_template_tenant uuid;
begin
  select tenant_id into v_order_tenant
    from public.commercial_orders
   where id = new.order_id;

  if v_order_tenant is null or v_order_tenant <> new.tenant_id then
    raise exception
      'order_documents : la commande (%) n appartient pas au tenant declare (%)',
      new.order_id, new.tenant_id;
  end if;

  select tenant_id into v_template_tenant
    from public.document_pdf_templates
   where id = new.template_id;

  if v_template_tenant is null or v_template_tenant <> new.tenant_id then
    raise exception
      'order_documents : le gabarit (%) n appartient pas au tenant declare (%)',
      new.template_id, new.tenant_id;
  end if;

  return new;
end;
$$;

drop trigger if exists order_documents_same_tenant on public.order_documents;
create trigger order_documents_same_tenant
  before insert or update on public.order_documents
  for each row execute function public.order_documents_assert_same_tenant();

-- ── RLS ──────────────────────────────────────────────────────────────────
alter table public.order_documents enable row level security;

-- Lecture ATELIER : ouverte a tout membre du tenant, MEME PATRON que
-- quote_documents_select. AUCUNE lecture portail client (contrat : pas de
-- /storefront-orders, aucune fonction api_get_storefront_order_document).
drop policy if exists "order_documents_select" on public.order_documents;
create policy "order_documents_select" on public.order_documents for select using (
  is_super_admin()
  or tenant_id in (select public.current_user_tenant_ids())
);

-- APPEND-ONLY : aucune policy d ecriture pour anon/authenticated. L insertion
-- passe EXCLUSIVEMENT par api_register_order_document (security definer,
-- proprietaire de la fonction = proprietaire de la table, donc non soumis a
-- ce revoke). Le service_role garde neanmoins insert/select pour le depot
-- eventuel de secours et la coherence avec le patron quote_documents (jamais
-- utilise par le chemin nominal de ce lot, qui passe par la RPC ci-dessous).
revoke insert, update, delete on table public.order_documents from anon, authenticated;
grant select, insert on table public.order_documents to service_role;

-- ── 2. Bucket Storage PRIVE, aucune policy `storage.objects` ────────────────
insert into storage.buckets (id, name, public, allowed_mime_types)
values (
  'order_documents',
  'order_documents',
  false,
  array['application/pdf']::text[]
)
on conflict (id) do update set
  public             = excluded.public,
  allowed_mime_types = excluded.allowed_mime_types;

-- ── 3. `api_register_order_document` — MEME PATRON que
-- `api_change_commercial_order_production_step` (20260909000000) pour la
-- resolution de l acteur/libelle ────────────────────────────────────────────
create or replace function public.api_register_order_document(
  p_tenant_id uuid,
  p_order_id uuid,
  p_template_id uuid,
  p_storage_path text,
  p_byte_size bigint,
  p_sha256 text,
  p_page_count integer,
  p_generated_at timestamptz
)
returns public.order_documents
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_label text;
  v_row public.order_documents;
begin
  -- Contrat : `generateOrderDocument` ne declare QUE `bearerAuth` (aucune
  -- `serviceKey`) — "produire" est le geste d une PERSONNE, jamais d un
  -- module tiers. `auth.uid()` null signifie donc TOUJOURS un appel
  -- illegitime de cette fonction (jamais un mode d acteur legitime a gerer,
  -- a la difference de api_change_commercial_order_production_step qui, lui,
  -- accepte les deux).
  if v_actor is null then
    raise exception 'authentication_required: generateOrderDocument exige un jeton utilisateur';
  end if;

  -- Meme garde que api_convert_commercial_quote/
  -- api_change_commercial_order_production_step (contrat §6 : "Aucune
  -- capability neuve... produire est un geste commercial ordinaire") : tout
  -- membre admin/member du tenant, aucun droit metier supplementaire exige.
  if not (
    public.is_super_admin()
    or exists (
      select 1 from public.tenant_members tm
      where tm.tenant_id = p_tenant_id
        and tm.user_id = v_actor
        and tm.role in ('admin', 'member')
    )
  ) then
    raise exception 'permission_denied: order document generation forbidden';
  end if;

  select email into v_actor_label from auth.users where id = v_actor;

  if not exists (
    select 1 from public.commercial_orders where id = p_order_id and tenant_id = p_tenant_id
  ) then
    raise exception 'order.not_found: commande % introuvable', p_order_id;
  end if;

  -- `document_type = 'order'` EXPLICITE : un gabarit `quote` du meme tenant
  -- ne doit JAMAIS satisfaire cette verification (contrat (A) : "AUCUN repli
  -- sur un gabarit quote n est tente, jamais"). La resolution du gabarit
  -- ELIGIBLE (ready/actif/par defaut/carte non vide) a deja ete faite en
  -- amont par la FACADE (`findEligibleTemplateForGeneration`) ; cette
  -- verification-ci ne rejoue que l appartenance tenant+type, defense en
  -- profondeur contre une course (gabarit supprime entre la resolution et
  -- cet appel).
  if not exists (
    select 1 from public.document_pdf_templates
     where id = p_template_id and tenant_id = p_tenant_id and document_type = 'order'
  ) then
    raise exception 'order.document_template_missing: gabarit % introuvable pour ce tenant', p_template_id;
  end if;

  begin
    insert into public.order_documents
      (tenant_id, order_id, template_id, storage_path, byte_size, sha256, page_count, generated_at, generated_by, generated_by_label)
    values
      (p_tenant_id, p_order_id, p_template_id, p_storage_path, p_byte_size, p_sha256, p_page_count, p_generated_at, v_actor, v_actor_label)
    returning * into v_row;
  exception
    when unique_violation then
      -- Course entre deux productions CONCURRENTES de la MEME commande : la
      -- garde applicative (findByOrderId AVANT tout rendu) couvre le cas
      -- nominal, cette branche n est atteinte QUE par la course elle-meme.
      raise exception 'order.document_already_generated: commande % porte deja son bon de commande', p_order_id;
  end;

  return v_row;
end;
$$;

comment on function public.api_register_order_document(uuid, uuid, uuid, text, bigint, text, integer, timestamptz) is
  'E10.19b — POST /commercial-orders/{orderId}/documents (partie ENREGISTREMENT, APRES upload des octets par le service_role). Resout generated_by/generated_by_label depuis auth.uid() (bearerAuth SEUL, aucune cle de service). 404 order.not_found, 409 order.document_template_missing / order.document_already_generated (unique_violation).';

revoke all on function public.api_register_order_document(uuid, uuid, uuid, text, bigint, text, integer, timestamptz) from public, anon;
grant execute on function public.api_register_order_document(uuid, uuid, uuid, text, bigint, text, integer, timestamptz) to authenticated;

notify pgrst, 'reload schema';

-- ============================================================================
-- REVERSIBILITE — le CLI Supabase ne gere pas de bloc `down`. SQL de retrait,
-- a jouer tel quel dans une migration inverse si la story est annulee :
--
--   revoke execute on function public.api_register_order_document(uuid, uuid, uuid, text, bigint, text, integer, timestamptz) from authenticated;
--   drop function if exists public.api_register_order_document(uuid, uuid, uuid, text, bigint, text, integer, timestamptz);
--   delete from storage.objects where bucket_id = 'order_documents';
--   delete from storage.buckets where id = 'order_documents';
--   drop policy if exists "order_documents_select" on public.order_documents;
--   drop trigger if exists order_documents_same_tenant on public.order_documents;
--   drop function if exists public.order_documents_assert_same_tenant();
--   drop table if exists public.order_documents;
--   notify pgrst, 'reload schema';
--
-- Effet de bord a connaitre AVANT de rejouer ce retrait : la branche 409
-- `document_pdf_template.in_use` de `api_delete_document_pdf_template`
-- redevient INATTEIGNABLE pour un gabarit `order`, exactement comme avant ce
-- lot (elle reste atteignable pour un gabarit `quote` via quote_documents).
-- ============================================================================
