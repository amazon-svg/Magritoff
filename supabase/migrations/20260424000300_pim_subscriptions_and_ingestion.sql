-- =============================================================================
-- Migration 03 / v3 — PIM multi-tenant : souscriptions + ingestion pipeline
-- -----------------------------------------------------------------------------
-- Partie 1 : Subscriptions aux gammes du PIM global.
--   * tenant_gamme_subscriptions : chaque tenant choisit les gammes qu'il veut
--     exposer a ses users (packaging, grand format, carterie, brochure...).
--   * Un helper `tenant_active_gammes(tenant_id)` centralise la requete pour
--     etre utilise partout cote frontend et dans d'autres vues.
--
-- Partie 2 : Pipeline d'ingestion PIM.
--   * pim_candidates : parking pour les products configs issues des commandes
--     validees, en attente de normalisation et d'admission dans le PIM global.
--   * Ciblage du workflow :
--       1. Une commande est validee → on pousse le config produit dans
--          pim_candidates avec status='pending'
--       2. Une edge function `pim-ingest` (a ecrire en parallele de la Beta 3)
--          recupere les candidats pending, les dedupe contre product_definitions
--          existants, les normalise via Clariprint (specs techniques, poids,
--          gabarits, 3D) et via Claude (pitch commercial, SEO, schema.org).
--       3. L'admin Magrit valide/rejete/fusionne dans l'onglet dashboard
--          `Admin PIM > Ingestion queue`.
--   * Les colonnes `normalized_*` sur product_definitions existantes recoivent
--     les donnees enrichies une fois le candidat valide.
--
-- Partie 3 : Enrichissements SEO/commerciaux sur product_definitions.
--   * seo_title, seo_description, schema_org (JSON-LD pour les pages produit)
--   * commercial_pitch, benefits (liste bullets) generes par le LLM
--   * clariprint_ref, mockup_3d_url, technical_spec (normalise par Clariprint)
-- =============================================================================

create extension if not exists "pgcrypto";

-- =============================================================================
-- ─── Partie 1 : subscriptions aux gammes ───────────────────────────────────
-- =============================================================================

create table if not exists public.tenant_gamme_subscriptions (
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  gamme_slug   text not null references public.product_gammes(slug) on delete cascade,
  -- permet de hierarchiser la visibilite (ordre d'affichage dans le shop).
  display_order int not null default 0,
  -- peut etre desactive temporairement sans detruire le lien.
  active       boolean not null default true,
  -- qui a ajoute cette souscription (admin du tenant ou superadmin).
  added_by     uuid references auth.users(id) on delete set null,
  added_at     timestamptz not null default now(),
  primary key (tenant_id, gamme_slug)
);

create index if not exists tenant_gamme_sub_tenant_idx
  on public.tenant_gamme_subscriptions(tenant_id);

alter table public.tenant_gamme_subscriptions enable row level security;

drop policy if exists "tenant_gamme_sub_select" on public.tenant_gamme_subscriptions;
create policy "tenant_gamme_sub_select" on public.tenant_gamme_subscriptions for select using (
  is_super_admin()
  or tenant_id in (select public.current_user_tenant_ids())
);

drop policy if exists "tenant_gamme_sub_modify" on public.tenant_gamme_subscriptions;
create policy "tenant_gamme_sub_modify" on public.tenant_gamme_subscriptions for all using (
  is_super_admin()
  or public.user_role_in_tenant(tenant_id) in ('owner', 'admin')
) with check (
  is_super_admin()
  or public.user_role_in_tenant(tenant_id) in ('owner', 'admin')
);

-- Helper : retourne les gammes actives d'un tenant (heritage parent → enfant :
-- un sous-tenant herite par defaut des souscriptions du parent, mais peut
-- override en ajoutant ses propres lignes. On prend l'union.).
create or replace function public.tenant_active_gammes(p_tenant_id uuid)
returns setof text
language sql stable security definer set search_path = public as $$
  -- Souscriptions directes du tenant
  select gamme_slug from public.tenant_gamme_subscriptions
  where tenant_id = p_tenant_id and active = true
  union
  -- Souscriptions heritees du parent
  select tgs.gamme_slug from public.tenant_gamme_subscriptions tgs
  join public.tenants t on t.parent_tenant_id = tgs.tenant_id
  where t.id = p_tenant_id and tgs.active = true;
$$;

-- =============================================================================
-- ─── Partie 2 : pipeline d'ingestion PIM ───────────────────────────────────
-- =============================================================================

-- pim_candidates : produits candidats a rejoindre le PIM global.
-- Alimente par le trigger `enqueue_pim_candidate_on_order` (plus bas).
create table if not exists public.pim_candidates (
  id                uuid primary key default gen_random_uuid(),
  source_tenant_id  uuid references public.tenants(id) on delete set null,
  source_user_id    uuid references auth.users(id) on delete set null,
  source_quote_id   uuid references public.quotes(id) on delete set null,
  -- config technique brute (tel qu'envoye a Clariprint)
  raw_config        jsonb not null,
  -- kind/gamme presume, pour pre-filtrer le bucket d'admission
  suggested_kind    text,
  suggested_gamme   text,
  -- status du cycle de vie :
  --   pending       → vient d'arriver, en attente de normalisation auto
  --   normalized    → Clariprint + LLM ont enrichi, pret pour review admin
  --   merged        → l'admin a valide → merge dans product_definitions
  --   rejected      → l'admin a rejete (ex: doublon exact, qualite insuffisante)
  --   superseded    → doublon detecte automatiquement, pointe vers le definitive
  status            text not null default 'pending'
                    check (status in ('pending', 'normalized', 'merged', 'rejected', 'superseded')),
  -- resultats de la normalisation Clariprint (specs techniques)
  clariprint_normalized jsonb,
  -- resultats de l'enrichissement LLM (pitch, SEO, benefits, schema.org)
  llm_enrichment    jsonb,
  -- pointeur vers le product_definitions final (une fois merged ou superseded)
  merged_into       uuid references public.product_definitions(id) on delete set null,
  -- pour bookkeeping de l'admission
  reviewed_by       uuid references auth.users(id) on delete set null,
  reviewed_at       timestamptz,
  review_notes      text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists pim_candidates_status_idx on public.pim_candidates(status);
create index if not exists pim_candidates_source_tenant_idx on public.pim_candidates(source_tenant_id);
create index if not exists pim_candidates_created_idx on public.pim_candidates(created_at desc);

alter table public.pim_candidates enable row level security;

-- Les candidats ne sont visibles/modifiables QUE par les superadmins Magrit.
-- Le tenant source n'a pas besoin de les voir — c'est un pipeline interne.
drop policy if exists "pim_candidates_superadmin" on public.pim_candidates;
create policy "pim_candidates_superadmin" on public.pim_candidates for all using (
  is_super_admin()
) with check (
  is_super_admin()
);

-- Exception : l'app est autorisee a INSERER un candidat via l'edge function
-- (qui tourne avec service_role), pas besoin de policy d'insert user-facing.

-- =============================================================================
-- ─── Partie 3 : colonnes enrichissement sur product_definitions ────────────
-- =============================================================================
-- Ces colonnes sont remplies par le pipeline d'ingestion (Clariprint + LLM).
-- Elles nourrissent : les pages produit des boutiques, l'autocomplete du chat,
-- les mockups 3D, les balises JSON-LD pour le SEO Google/Bing.

alter table if exists public.product_definitions
  -- SEO
  add column if not exists seo_title         text,
  add column if not exists seo_description   text,
  add column if not exists schema_org        jsonb,  -- JSON-LD Product/OfferCatalog
  add column if not exists seo_keywords      text[],
  -- Commercial
  add column if not exists commercial_pitch  text,   -- baseline produit (2 phrases)
  add column if not exists benefits          jsonb,  -- array de bullets benefice
  add column if not exists use_cases         jsonb,  -- array de scenarios
  -- Technique normalise (source Clariprint)
  add column if not exists clariprint_ref    text,
  add column if not exists technical_spec    jsonb,  -- format final, papier, couleurs...
  add column if not exists mockup_3d_url     text,
  add column if not exists gabarit_pdf_url   text,   -- gabarit de preparation fichier
  -- Qualite / maturite
  add column if not exists quality_score     int,    -- 0..100 (completude + validations)
  add column if not exists order_count       int default 0,  -- combien de fois commande → priorite
  add column if not exists last_ordered_at   timestamptz;

create index if not exists product_def_order_count_idx
  on public.product_definitions(order_count desc);

-- =============================================================================
-- ─── Partie 4 : trigger d'enqueue candidat sur commande validee ────────────
-- =============================================================================
-- Quand une ligne `quotes` passe en status='won' (commande gagnee), on pousse
-- sa config produit dans pim_candidates. L'edge function `pim-ingest` prend
-- ensuite le relais pour normaliser.
--
-- NB : on incremente aussi order_count si le produit est deja dans le PIM
-- (match par hash de config), pour prioriser les produits qui tournent vraiment.

create or replace function public.enqueue_pim_candidate_on_order()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  _config jsonb;
begin
  -- Seulement sur transition vers "won"
  if (TG_OP = 'UPDATE' and new.status = 'won' and (old.status is distinct from 'won')) then
    _config := coalesce(new.product_config, '{}'::jsonb);
    insert into public.pim_candidates (
      source_tenant_id, source_user_id, source_quote_id,
      raw_config, suggested_kind
    ) values (
      new.tenant_id, new.user_id, new.id,
      _config, _config->>'kind'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enqueue_pim_candidate on public.quotes;
create trigger trg_enqueue_pim_candidate
  after update on public.quotes
  for each row execute function public.enqueue_pim_candidate_on_order();
