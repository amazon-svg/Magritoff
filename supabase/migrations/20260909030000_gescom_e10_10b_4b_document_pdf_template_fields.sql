-- ============================================================================
-- Sprint 5 Gestion commerciale — story E10.10b-4b : editeur visuel de
-- correspondance coordonnees des gabarits PDF de devis. Contrat :
-- openapi/magrit-core.v1.yaml (DocumentFieldPlacement, DocumentLinesBlock,
-- DocumentPdfTemplateFieldMap, GET/PUT /document-pdf-templates/{id}/fields),
-- docs/api/CONVENTIONS.md §8.18. Suite de la migration 20260909020000 (E10.10b-4a,
-- table document_pdf_templates / bucket document_pdf_templates).
-- ----------------------------------------------------------------------------
-- Perimetre STRICT de ce lot (4b uniquement, une migration = une story) :
--
--   1. Table NEUVE public.document_pdf_template_fields — UN PLACEMENT
--      (`DocumentFieldPlacement`) par ligne. Le bloc de lignes
--      (`DocumentLinesBlock`) reste sur document_pdf_templates.lines_block
--      (jsonb, colonne posee par 4a) : c est un objet UNIQUE par gabarit,
--      imbrique, jamais interroge independamment (§8.18 §2, "pourquoi le
--      bloc de lignes est en jsonb sur le gabarit et non dans une table").
--
--   2. RLS — meme discipline que document_pdf_templates (20260909020000) :
--      lecture OUVERTE a tout membre du tenant, ecriture gardee par
--      can_manage_document_templates EN DEFENSE EN PROFONDEUR seulement — le
--      chemin nominal passe par `api_replace_document_pdf_template_fields`
--      (security definer), qui reimplemente le controle explicitement.
--
--   3. Fonction `api_replace_document_pdf_template_fields` (security
--      definer) — REMPLACEMENT INTEGRAL (delete puis insert), jamais un CRUD
--      par champ (contrat PUT .../fields : "meme parti que
--      replaceProjectTags et reorderProductionSteps"). 409
--      `document_pdf_template.upload_required` si le gabarit n est pas
--      `ready` : placer des champs sur un fond dont on ignore la geometrie
--      reviendrait a valider des coordonnees contre rien.
--
--      VALIDATION SEMANTIQUE (page existante dans `pages`, coordonnee dans
--      les bornes de la page, alignement centre/droit exigeant une largeur,
--      `rows_per_page` compatible avec la hauteur de page, colonnes de
--      lignes non dupliquees) : tenue en TypeScript
--      (`src/modules/document-templates/application/document-field-map-validator.ts`,
--      fonction PURE, testee unitairement), PAS en PL/pgSQL — meme parti que
--      pour `lines_block` en 4a (§8.18 §2 : "c est le schema OpenAPI et son
--      miroir Zod qui la tiennent, pas la base"). Cette fonction SQL ne
--      revalide QUE ce qu une CONTRAINTE EN BASE exprime simplement (bornes,
--      enums, unicite du champ) : DECISION SIGNALEE au rapport de fin de
--      story, pas dissimulee — le chemin nominal (le SERVICE applicatif)
--      valide toujours avant d appeler cette fonction, mais un appel RPC
--      direct qui la contournerait pourrait persister une carte
--      geometriquement incoherente (page existante mais coordonnee hors
--      cadre, par exemple) sans que la base ne le refuse. Le risque est le
--      meme, par construction, que celui deja assume sur `lines_block` en 4a.
--
--   4. D1 — has_field_map COMPLETE (§8.18 §9, dette signalee explicitement
--      par 4a et son chemin de completion documente d avance) :
--      `api_confirm_document_pdf_template_upload` est RECREEE (MEME
--      SIGNATURE, `create or replace`, PL/pgSQL n offre pas d autre
--      mecanisme de "override partiel") pour que `has_field_map` vaille
--      `true` des que `lines_block is not null` OU qu au moins un placement
--      existe pour CE gabarit DANS CE tenant — un OU, pas un ET, les deux
--      etant independants (un accuse de reception peut n avoir que des
--      placements, sans tableau de lignes). Reprend cette fonction, MEME
--      SIGNATURE, MEME comportement sur toutes les autres regles (rien
--      d autre n est touche) — MISE EN CONFORMITE AU CONTRAT que 4a n avait
--      pas pu tenir faute de cette table (pas une extension du cru de 4b) :
--      `reset_fields` (sur un changement de geometrie) efface l objet
--      `DocumentPdfTemplateFieldMap` EN ENTIER, `placements` inclus —
--      openapi/magrit-core.v1.yaml decrit deja ce comportement en deux
--      endroits (`ConfirmDocumentPdfTemplateUploadCommand.reset_fields` et
--      `confirmDocumentPdfTemplateUpload`, 2026-09-09) ; 4a ne pouvait
--      qu effacer `lines_block`, seule partie de la carte qui existait alors.
--
--   5. qa-review B1 (faille de securite CONFIRMEE par test empirique) —
--      CORRIGEE dans cette meme migration (jamais deployee, pas de migration
--      corrective separee) :
--        a. `document_pdf_template_fields.tenant_id` et `.template_id`
--           etaient DEUX COLONNES INDEPENDANTES, sans lien de coherence : un
--           admin du tenant B connaissant l UUID d un gabarit du tenant A
--           pouvait inserer `template_id` = gabarit de A + `tenant_id` = B,
--           la policy `with check` ne verifiant que SON PROPRE tenant_id.
--           Consequences prouvees par execution reelle : (i) deni de
--           service durable sur A via `unique(template_id, field)` ; (ii) un
--           residu que A ne peut ni voir ni effacer
--           (`api_replace_document_pdf_template_fields` filtre `and
--           tenant_id = p_tenant_id`) ; (iii) `has_field_map` calcule SANS
--           filtre tenant (point b ci-dessous) aurait pu etre influence par
--           une ligne d un AUTRE tenant. CORRIGE par un trigger `before
--           insert or update`, meme patron que
--           `project_tag_links_assert_same_tenant`
--           (`20260902000100_gescom_e10_2_project_tags.sql`) : refuse toute
--           ligne dont le `tenant_id` ne correspond pas au `tenant_id` REEL
--           du gabarit designe par `template_id`.
--        b. `has_field_map` (point 4 ci-dessus) filtrait `document_pdf_template_fields`
--           par `template_id` SEUL, sans `tenant_id` — incoherent avec
--           l adaptateur TypeScript (`templateHasFieldMap()`), qui filtre
--           bien par les deux. CORRIGE : `and tenant_id = v_current.tenant_id`
--           ajoute au `exists(...)`. Avec le trigger du point a, cette
--           incoherence etait deja rendue inoffensive (aucune ligne ne peut
--           plus porter un tenant_id different de celui de son gabarit) ;
--           corrigee quand meme pour que les deux couches disent
--           EXACTEMENT la meme chose, sans dependre l une de l autre pour
--           rester sures.
-- ============================================================================

-- ── 1. Table `document_pdf_template_fields` ─────────────────────────────────
create table if not exists public.document_pdf_template_fields (
  id           uuid primary key default gen_random_uuid(),
  template_id  uuid not null references public.document_pdf_templates(id) on delete cascade,
  -- Denormalise pour la RLS (patron du depot : evite une jointure sur
  -- document_pdf_templates a chaque evaluation de policy).
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  -- Enumeration FERMEE, reprise EXACTEMENT du contrat (`DocumentFieldId`,
  -- 25 valeurs, openapi/magrit-core.v1.yaml). Defense en profondeur : le
  -- schema Zod du module la tient deja cote applicatif.
  field        text not null check (field in (
    'quote.number', 'quote.issued_at', 'quote.valid_until', 'quote.customer_reference',
    'customer.company_name', 'customer.contact_name', 'customer.billing_address_block',
    'customer.billing_line1', 'customer.billing_line2', 'customer.billing_postal_code',
    'customer.billing_city', 'customer.billing_country', 'customer.email', 'customer.phone',
    'customer.siret', 'customer.vat_number',
    'totals.lines_subtotal', 'totals.global_discount', 'totals.net_total', 'totals.vat_rate',
    'totals.vat_amount', 'totals.total_incl_tax',
    'page.number', 'page.count', 'page.number_of_count'
  )),
  page_index   integer not null check (page_index between 0 and 9),
  x            numeric(8,2) not null check (x >= 0 and x <= 20000),
  -- Ligne de base du texte (contrat : "pas du haut de la boite").
  y            numeric(8,2) not null check (y >= 0 and y <= 20000),
  width        numeric(8,2) check (width is null or (width >= 0 and width <= 20000)),
  max_lines    integer not null default 1 check (max_lines between 1 and 10),
  align        text not null check (align in ('left', 'center', 'right')),
  font         text not null check (font in (
    'helvetica', 'helvetica-bold', 'helvetica-oblique',
    'times-roman', 'times-bold', 'times-italic',
    'courier', 'courier-bold'
  )),
  font_size    numeric(5,2) not null check (font_size between 4 and 72),
  color        text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- Un champ ne se place qu UNE FOIS sur un gabarit (contrat PUT .../fields,
  -- 422 "un champ place deux fois") — SECONDE barriere, en base,
  -- independante de la validation applicative.
  constraint document_pdf_template_fields_unique_field unique (template_id, field)
);

comment on table public.document_pdf_template_fields is
  'E10.10b-4b — un PLACEMENT (DocumentFieldPlacement) par ligne, sur un gabarit PDF de document. Le bloc de lignes (DocumentLinesBlock) reste sur document_pdf_templates.lines_block, colonne jsonb posee par 4a (20260909020000).';
comment on column public.document_pdf_template_fields.y is
  'Ordonnee de la LIGNE DE BASE du texte (le bas des lettres sans jambage), pas du haut de la boite (contrat DocumentFieldPlacement.y).';

create index if not exists document_pdf_template_fields_tenant_idx
  on public.document_pdf_template_fields (tenant_id);
create index if not exists document_pdf_template_fields_template_idx
  on public.document_pdf_template_fields (template_id);

-- ── qa-review B1 — Defense en profondeur : un placement ne peut appartenir ──
-- qu au MEME tenant que le gabarit qu il designe, meme si un jour un acces
-- direct (RPC forge, ou un bug applicatif) contournait
-- `api_replace_document_pdf_template_fields`. Meme patron EXACT que
-- `project_tag_links_assert_same_tenant`
-- (`20260902000100_gescom_e10_2_project_tags.sql:76-100`) : sans ce trigger,
-- la policy `with check` de `document_pdf_template_fields_write` ne verifie
-- QUE le tenant_id porte par la ligne elle-meme, jamais celui du gabarit
-- REELLEMENT designe par template_id — un admin du tenant B pouvait donc
-- inserer une ligne avec `template_id` = un gabarit du tenant A et
-- `tenant_id` = B, la policy passant sans rien detecter (prouve par
-- execution reelle, scenario 6 de
-- tests/sql/gescom-e10-10b-4b-document-pdf-template-fields.sql).
create or replace function public.document_pdf_template_fields_assert_same_tenant()
returns trigger
language plpgsql
as $$
declare
  v_template_tenant uuid;
begin
  select tenant_id into v_template_tenant
    from public.document_pdf_templates
   where id = new.template_id;

  if v_template_tenant is null or v_template_tenant <> new.tenant_id then
    raise exception
      'document_pdf_template_fields : le gabarit (%) n appartient pas au tenant declare (%)',
      new.template_id, new.tenant_id;
  end if;

  return new;
end;
$$;

drop trigger if exists document_pdf_template_fields_same_tenant on public.document_pdf_template_fields;
create trigger document_pdf_template_fields_same_tenant
  before insert or update on public.document_pdf_template_fields
  for each row execute function public.document_pdf_template_fields_assert_same_tenant();

drop trigger if exists document_pdf_template_fields_set_updated_at on public.document_pdf_template_fields;
create or replace function public.document_pdf_template_fields_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger document_pdf_template_fields_set_updated_at
  before update on public.document_pdf_template_fields
  for each row execute function public.document_pdf_template_fields_set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────
alter table public.document_pdf_template_fields enable row level security;

drop policy if exists "document_pdf_template_fields_select" on public.document_pdf_template_fields;
create policy "document_pdf_template_fields_select" on public.document_pdf_template_fields for select using (
  is_super_admin()
  or tenant_id in (select public.current_user_tenant_ids())
);

drop policy if exists "document_pdf_template_fields_write" on public.document_pdf_template_fields;
create policy "document_pdf_template_fields_write" on public.document_pdf_template_fields for all using (
  is_super_admin()
  or public.user_has_capability(tenant_id, 'can_manage_document_templates')
) with check (
  is_super_admin()
  or public.user_has_capability(tenant_id, 'can_manage_document_templates')
);

-- ── 2. `api_replace_document_pdf_template_fields` ───────────────────────────
create or replace function public.api_replace_document_pdf_template_fields(
  p_tenant_id uuid,
  p_template_id uuid,
  p_placements jsonb,
  p_lines_block jsonb
)
returns public.document_pdf_templates
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_current public.document_pdf_templates;
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

  perform pg_advisory_xact_lock(hashtextextended('document_pdf_template_fields:' || p_template_id::text, 0));

  select * into v_current
    from public.document_pdf_templates
   where tenant_id = p_tenant_id and id = p_template_id
   for update;
  if not found then
    raise exception 'document_pdf_template.not_found: gabarit % introuvable dans le tenant %', p_template_id, p_tenant_id;
  end if;

  if v_current.status <> 'ready' then
    raise exception 'document_pdf_template.upload_required: gabarit % non pret (status %)', p_template_id, v_current.status;
  end if;

  delete from public.document_pdf_template_fields
   where template_id = p_template_id and tenant_id = p_tenant_id;

  insert into public.document_pdf_template_fields (
    template_id, tenant_id, field, page_index, x, y, width, max_lines, align, font, font_size, color
  )
  select
    p_template_id,
    p_tenant_id,
    elem ->> 'field',
    (elem ->> 'page_index')::integer,
    (elem ->> 'x')::numeric,
    (elem ->> 'y')::numeric,
    case
      when elem ? 'width' and elem -> 'width' is not null and elem -> 'width' <> 'null'::jsonb
        then (elem ->> 'width')::numeric
      else null
    end,
    coalesce((elem ->> 'max_lines')::integer, 1),
    elem ->> 'align',
    elem ->> 'font',
    (elem ->> 'font_size')::numeric,
    elem ->> 'color'
  from jsonb_array_elements(coalesce(p_placements, '[]'::jsonb)) as elem;

  update public.document_pdf_templates
     set lines_block = p_lines_block,
         updated_at = now()
   where tenant_id = p_tenant_id and id = p_template_id
  returning * into v_current;

  return v_current;
end;
$$;

comment on function public.api_replace_document_pdf_template_fields(uuid, uuid, jsonb, jsonb) is
  'E10.10b-4b — PUT /document-pdf-templates/{templateId}/fields. REMPLACEMENT INTEGRAL (delete puis insert des placements, reecriture de lines_block), jamais un CRUD par champ. 409 upload_required si le gabarit n est pas ready. La validation SEMANTIQUE (geometrie) est tenue en TypeScript (document-field-map-validator.ts), AVANT l appel ; cette fonction ne revalide que ce qu une contrainte EN BASE exprime (bornes, enums, unicite du champ).';

revoke all on function public.api_replace_document_pdf_template_fields(uuid, uuid, jsonb, jsonb) from public, anon;
grant execute on function public.api_replace_document_pdf_template_fields(uuid, uuid, jsonb, jsonb) to authenticated;

-- ── 3. D1 — has_field_map COMPLETE ───────────────────────────────────────────
-- Recreation de la fonction de 4a (20260909020000), MEME SIGNATURE. Seul le
-- calcul de v_has_field_map change (OR exists sur document_pdf_template_fields,
-- au lieu de lines_block seul) ; DECISION AJOUTEE PAR 4b, signalee au rapport
-- de fin de story : reset_fields vide desormais aussi les placements, pas
-- seulement lines_block (voir en-tete de fichier, point 4).
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

  perform pg_advisory_xact_lock(hashtextextended('document_pdf_templates:' || p_tenant_id::text, 0));

  select * into v_current
    from public.document_pdf_templates
   where tenant_id = p_tenant_id and id = p_template_id
   for update;
  if not found then
    raise exception 'document_pdf_template.not_found: gabarit % introuvable dans le tenant %', p_template_id, p_tenant_id;
  end if;

  -- COMPLETION D1 (E10.10b-4b, §8.18 §9) : lines_block OU au moins un
  -- placement. Un gabarit qui ne porte QUE des placements (accuse de
  -- reception sans tableau) doit rendre has_field_map=true — un OU, pas un
  -- ET, les deux etant independants.
  --
  -- qa-review B1 (point b) : `and tenant_id = v_current.tenant_id` AJOUTE —
  -- sans ce filtre, cette requete aurait pu compter une ligne d un AUTRE
  -- tenant (avant que le trigger `document_pdf_template_fields_same_tenant`
  -- ne rende ce cas structurellement impossible), et divergeait de
  -- l adaptateur TypeScript (`templateHasFieldMap()`), qui filtre bien par
  -- les deux colonnes. Les deux couches disent maintenant EXACTEMENT la
  -- meme chose, sans dependre l une de l autre pour rester sures.
  v_has_field_map := v_current.lines_block is not null
    or exists (
      select 1 from public.document_pdf_template_fields
       where template_id = v_current.id
         and tenant_id = v_current.tenant_id
    );

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

  -- DECISION 4b, A CONFIRMER (voir en-tete de fichier) : reset_fields vide
  -- aussi les PLACEMENTS. Sans cela, une geometrie remplacee laisserait des
  -- placements pointer sur des pages/coordonnees qui n existent plus, ce qui
  -- est exactement "une carte a moitie fausse" (§8.18).
  if v_geometry_changed and v_reset then
    delete from public.document_pdf_template_fields where template_id = v_current.id;
  end if;

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
  'E10.10b-4a/4b — POST /document-pdf-templates/{templateId}/uploads. has_field_map COMPLETE par 4b (OR exists sur document_pdf_template_fields, pas seulement lines_block). reset_fields vide aussi les placements depuis 4b.';

revoke all on function public.api_confirm_document_pdf_template_upload(uuid, uuid, integer, jsonb, bigint, text, boolean) from public, anon;
grant execute on function public.api_confirm_document_pdf_template_upload(uuid, uuid, integer, jsonb, bigint, text, boolean) to authenticated;

notify pgrst, 'reload schema';

-- ============================================================================
-- REVERSIBILITE — le CLI Supabase ne gere pas de bloc `down`. SQL de retrait,
-- a jouer tel quel dans une migration inverse si la story est annulee :
--
--   revoke execute on function public.api_replace_document_pdf_template_fields(uuid, uuid, jsonb, jsonb) from authenticated;
--   drop function if exists public.api_replace_document_pdf_template_fields(uuid, uuid, jsonb, jsonb);
--   drop policy if exists "document_pdf_template_fields_write" on public.document_pdf_template_fields;
--   drop policy if exists "document_pdf_template_fields_select" on public.document_pdf_template_fields;
--   drop trigger if exists document_pdf_template_fields_set_updated_at on public.document_pdf_template_fields;
--   drop function if exists public.document_pdf_template_fields_set_updated_at();
--   drop trigger if exists document_pdf_template_fields_same_tenant on public.document_pdf_template_fields;
--   drop function if exists public.document_pdf_template_fields_assert_same_tenant();
--   drop table if exists public.document_pdf_template_fields;
--   -- api_confirm_document_pdf_template_upload : rejouer la version PORTEE PAR
--   -- 20260909020000_gescom_e10_10b_4a_document_pdf_templates.sql (has_field_map
--   -- sur lines_block seul, reset_fields ne videant pas les placements) pour
--   -- revenir exactement a l etat de 4a.
--   notify pgrst, 'reload schema';
-- ============================================================================
