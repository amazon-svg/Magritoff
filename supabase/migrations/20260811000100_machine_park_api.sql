-- ============================================================================
-- 20260811000100 — Module PARC MACHINE : passage en base, API-first
-- ----------------------------------------------------------------------------
-- Le module livre le 2026-08-08 etait une MAQUETTE : bibliotheque de machines
-- figee dans le code du navigateur, parcs enregistres en `localStorage`. Cette
-- migration lui donne son modele de donnees reel.
--
-- Regles opposables appliquees (docs/REGLES_ARCHITECTURE.md, seance RP#070826) :
--   R1 API-first — ces tables ne sont JAMAIS lues par le navigateur. Le seul
--     appelant est l edge function `park-api`, qui expose le contrat documente
--     dans docs/API_PARC_MACHINE.md. La RLS ci-dessous n est donc pas la
--     frontiere principale : c est la SECONDE ligne, celle qui tient meme si la
--     premiere cede.
--   R2 Modularite — un domaine, ses tables, son API, ses tests.
--   R4 Noyau minimal — aucune de ces tables n est un service de noyau.
--
-- Deux natures de tables, a ne pas confondre :
--
--   1. REFERENTIELS PARTAGES, sans `tenant_id` : `machine_library` (les
--      modeles de machines du marche) et la part commune de
--      `supplier_directory` (BK-07, referentiel Fournisseur UNIFIE : papier,
--      transport et sous-traitance dans une seule table — un sous-traitant qui
--      devient fournisseur de papier est la meme entite, pas deux fiches a
--      tenir en coherence). Lecture ouverte a tout utilisateur authentifie,
--      ecriture reservee a l administration de la plateforme. Vocation a
--      rejoindre Clariprint Data cote Expert Solutions : c est deja la
--      frontiere, il n y aura qu a deplacer la source.
--
--   2. DONNEES DE L IMPRIMEUR, `tenant_id` obligatoire : `machine_parks` et
--      `machine_park_machines`. Isolees par RLS sur le meme motif que le reste
--      du schema (`current_user_tenant_ids()`).
--
-- ⚠️ AUCUNE DEVISE dans ces tables. Les montants sont des `numeric` nus,
--    libelles a l affichage par `tenants.currency` (tranche 1 multi-devise).
--    Le referentiel de machines est partage entre imprimeurs : y ecrire un
--    symbole monetaire le rendrait non partageable. Le passage en `Money`
--    (entier en unites mineures + code devise) est le perimetre de la
--    TRANCHE 2, qui porte precisement sur les couts de production.
--
-- Idempotente : rejouable sans effet de bord.
-- ============================================================================

-- ─── 1. Referentiel de machines (partage, lecture seule cote imprimeur) ──────

create table if not exists public.machine_library (
  id             text primary key,
  type           text not null check (type in (
                   'offset','numerique','grand_format','roto',
                   'decoupe','pliage','massicot','finition')),
  -- Sous-famille de tri du selecteur du wizard (« Demi-format (52x74) »).
  family         text not null,
  -- Rang de popularite DANS sa famille — 1 = la plus vendue. Le selecteur
  -- trie dessus : les best-sellers en tete (demande Arnaud du 2026-08-08).
  rank           integer not null default 100,
  brand          text not null,
  model          text not null,
  format         text not null default '',
  colors         integer,
  varnish        boolean not null default false,
  -- Valeurs par defaut du MODELE pour les parametres de prix. Nombres nus,
  -- sans devise (cf. en-tete). Surchargent les defauts du type, et sont
  -- surchargees par les saisies de l imprimeur.
  price_defaults jsonb,
  -- Retrait d un modele du catalogue sans casser les parcs qui le referencent.
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);

create index if not exists machine_library_type_idx on public.machine_library (type, family, rank);

-- ─── 2. Referentiel Fournisseur unifie — BK-07 ───────────────────────────────
-- `tenant_id` null = entree du referentiel COMMUN, visible de tous.
-- `tenant_id` renseigne = fournisseur propre a un imprimeur.

create table if not exists public.supplier_directory (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('paper','transport','subcontractor')),
  name        text not null,
  tenant_id   uuid references public.tenants(id) on delete cascade,
  created_at  timestamptz not null default now()
);

-- Unicite par nature : une seule fois dans le referentiel commun, une seule
-- fois chez un imprimeur donne. Deux index partiels — `unique(kind, name,
-- tenant_id)` ne suffirait pas, NULL n etant jamais egal a NULL en SQL, ce qui
-- autoriserait autant de doublons que d insertions dans le referentiel commun.
create unique index if not exists supplier_directory_shared_uniq
  on public.supplier_directory (kind, name) where tenant_id is null;
create unique index if not exists supplier_directory_tenant_uniq
  on public.supplier_directory (kind, name, tenant_id) where tenant_id is not null;

create index if not exists supplier_directory_kind_idx on public.supplier_directory (kind);

-- ─── 3. Parcs de l imprimeur ─────────────────────────────────────────────────
-- Un imprimeur a potentiellement PLUSIEURS parcs (sites, ateliers, lignes).

create table if not exists public.machine_parks (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null references public.tenants(id) on delete cascade,
  name                 text not null,
  -- BK-18 : fournisseurs papier et transport, renseignes sur deux ecrans
  -- separes. Noms retenus, pas de cle etrangere : l imprimeur peut saisir un
  -- fournisseur absent du referentiel, et le referentiel ne doit pas pouvoir
  -- faire disparaitre une donnee de son parc.
  paper_suppliers      text[] not null default '{}',
  transport_suppliers  text[] not null default '{}',
  -- BK-19 : [{ type, costPerKg }]
  inks                 jsonb not null default '[]'::jsonb,
  -- BK-22 : modele de cout. Montants nus, cf. en-tete.
  labor_rate           numeric(12,4) not null default 45,
  energy_rate          numeric(12,4) not null default 0.18,
  -- BK-15 : parcours du wizard et nombre de clics — DONNEE D ARBITRAGE
  -- ergonomique arretee en seance, conservee telle quelle pour l analyse.
  wizard_variant       char(1) check (wizard_variant in ('A','B')),
  wizard_clicks        integer check (wizard_clicks >= 0),
  completed_at         timestamptz,
  created_by           uuid references auth.users(id),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists machine_parks_tenant_idx on public.machine_parks (tenant_id, created_at);

-- ─── 4. Machines installees dans un parc ─────────────────────────────────────

create table if not exists public.machine_park_machines (
  id             uuid primary key default gen_random_uuid(),
  park_id        uuid not null references public.machine_parks(id) on delete cascade,
  -- Denormalise depuis le parc : permet une policy RLS directe, sans
  -- jointure, sur la table la plus lue du module.
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  -- `on delete set null` et non `cascade` : retirer un modele du referentiel
  -- ne doit pas faire disparaitre la machine de l atelier d un imprimeur.
  library_id     text references public.machine_library(id) on delete set null,
  -- Caracteristiques RECOPIEES du referentiel a l ajout, volontairement figees.
  -- Le parc decrit un atelier REEL a une date donnee : si le referentiel
  -- corrige la laize d un modele dans deux ans, le parc de l imprimeur ne doit
  -- pas se mettre a decrire une autre machine que la sienne.
  type           text not null check (type in (
                   'offset','numerique','grand_format','roto',
                   'decoupe','pliage','massicot','finition')),
  brand          text not null,
  model          text not null,
  format         text not null default '',
  colors         integer,
  varnish        boolean not null default false,
  -- BK-09 : qualification DISPONIBLE mais NON obligatoire. `null` est une
  -- valeur de premier rang — l arbitrage de seance a donne la priorite au
  -- setup rapide, la qualification vient ensuite.
  location       text check (location in ('interne','externe')),
  -- BK-10 : saisie libre alimentee par autocompletion sur supplier_directory.
  subcontractor  text,
  -- BK-13 : zero est une valeur legitime, pas une absence.
  transport_cost numeric(12,4),
  fixed_cost     numeric(12,4),
  -- BK-22 : null = taux du parc.
  hourly_rate    numeric(12,4),
  -- BK-27 : false = exclue des calculs servis.
  active         boolean not null default true,
  -- Saisies utilisateur des parametres de prix (cf. PRICE_PARAMS cote front).
  params         jsonb,
  -- Ordre d affichage dans le parc, tel que constitue au wizard.
  position       integer not null default 0,
  created_at     timestamptz not null default now()
);

create index if not exists mpm_park_idx   on public.machine_park_machines (park_id, position);
create index if not exists mpm_tenant_idx on public.machine_park_machines (tenant_id);
-- BK-17 : la question « ce parc a-t-il un massicot actif ? » est posee a
-- chaque lecture de la liste des parcs.
create index if not exists mpm_type_idx   on public.machine_park_machines (park_id, type) where active;

-- ─── 5. RLS ──────────────────────────────────────────────────────────────────
-- Motif identique au reste du schema tenant-scoped (cf. client_price_rules).
-- Rappel : le navigateur n atteint PAS ces tables (R1). Ces policies protegent
-- le cas ou quelque chose d autre les atteindrait — y compris un defaut de
-- l edge function elle-meme, qui repasse le jeton de l appelant et se trouve
-- donc soumise a ces memes regles.

alter table public.machine_library        enable row level security;
alter table public.supplier_directory     enable row level security;
alter table public.machine_parks          enable row level security;
alter table public.machine_park_machines  enable row level security;

-- Referentiel machines : lecture pour tout utilisateur authentifie (il alimente
-- le selecteur du wizard) ; ecriture reservee a l administration plateforme.
drop policy if exists "machine_library_select" on public.machine_library;
create policy "machine_library_select" on public.machine_library
  for select to authenticated using (true);

drop policy if exists "machine_library_write" on public.machine_library;
create policy "machine_library_write" on public.machine_library
  for all to authenticated using (is_super_admin()) with check (is_super_admin());

-- Referentiel fournisseurs : le commun pour tous, le propre a chaque imprimeur
-- pour ses seuls membres.
drop policy if exists "supplier_directory_select" on public.supplier_directory;
create policy "supplier_directory_select" on public.supplier_directory
  for select to authenticated using (
    tenant_id is null
    or is_super_admin()
    or tenant_id in (select public.current_user_tenant_ids())
  );

-- Ecriture : un imprimeur enrichit SON referentiel ; le commun reste a
-- l administration plateforme. La clause `with check` empeche de creer une
-- entree commune (`tenant_id is null`) en se faisant passer pour un ajout local.
drop policy if exists "supplier_directory_write" on public.supplier_directory;
create policy "supplier_directory_write" on public.supplier_directory
  for all to authenticated using (
    is_super_admin()
    or (tenant_id is not null and tenant_id in (select public.current_user_tenant_ids()))
  ) with check (
    is_super_admin()
    or (tenant_id is not null and tenant_id in (select public.current_user_tenant_ids()))
  );

-- Parcs : lecture pour tout membre de l espace, ecriture aussi. Le parc decrit
-- l outil de production ; le restreindre aux owner/admin empecherait un
-- responsable d atelier de tenir son propre parc a jour.
drop policy if exists "machine_parks_select" on public.machine_parks;
create policy "machine_parks_select" on public.machine_parks
  for select to authenticated using (
    is_super_admin() or tenant_id in (select public.current_user_tenant_ids())
  );

drop policy if exists "machine_parks_write" on public.machine_parks;
create policy "machine_parks_write" on public.machine_parks
  for all to authenticated using (
    is_super_admin() or tenant_id in (select public.current_user_tenant_ids())
  ) with check (
    is_super_admin() or tenant_id in (select public.current_user_tenant_ids())
  );

drop policy if exists "mpm_select" on public.machine_park_machines;
create policy "mpm_select" on public.machine_park_machines
  for select to authenticated using (
    is_super_admin() or tenant_id in (select public.current_user_tenant_ids())
  );

drop policy if exists "mpm_write" on public.machine_park_machines;
create policy "mpm_write" on public.machine_park_machines
  for all to authenticated using (
    is_super_admin() or tenant_id in (select public.current_user_tenant_ids())
  ) with check (
    is_super_admin() or tenant_id in (select public.current_user_tenant_ids())
  );

-- Garde-fou : une machine ne peut pas etre rattachee a un parc d un AUTRE
-- espace. La RLS seule ne l interdit pas — un membre de deux espaces passerait
-- les deux clauses avec un `tenant_id` incoherent avec `park_id`.
create or replace function public.machine_park_machine_tenant_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_tenant uuid;
begin
  select tenant_id into v_tenant from public.machine_parks where id = new.park_id;
  if v_tenant is null then
    raise exception 'Parc introuvable : %', new.park_id;
  end if;
  if new.tenant_id is distinct from v_tenant then
    raise exception 'Incoherence : la machine porte l espace % alors que son parc appartient a %',
      new.tenant_id, v_tenant;
  end if;
  return new;
end;
$$;

drop trigger if exists mpm_tenant_guard on public.machine_park_machines;
create trigger mpm_tenant_guard
  before insert or update on public.machine_park_machines
  for each row execute function public.machine_park_machine_tenant_guard();

-- `updated_at` du parc, tenu par la base plutot que par l appelant.
create or replace function public.machine_parks_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists machine_parks_touch on public.machine_parks;
create trigger machine_parks_touch
  before update on public.machine_parks
  for each row execute function public.machine_parks_touch();

-- ─── 6. Seed du referentiel de machines ──────────────────────────────────────
-- Reprise a l identique de la bibliotheque qui vivait dans le code du
-- navigateur (commit b93d741 du 2026-08-08). `on conflict do update` : le seed
-- rafraichit le referentiel commun sans jamais toucher aux parcs.

insert into public.machine_library
  (id, type, family, rank, brand, model, format, colors, varnish, price_defaults)
values
  ('off-hd-sm52-4', 'offset', 'Petit format (35×52)', 1, 'Heidelberg', 'Speedmaster SM 52-4', '37×52', 4, false, '{"speed": 15000, "makeReadyMin": 15, "makeReadyWaste": 150, "plateCost": 6}'::jsonb),
  ('off-hd-sm52-5l', 'offset', 'Petit format (35×52)', 2, 'Heidelberg', 'Speedmaster SM 52-5+L', '37×52', 5, true, '{"speed": 15000, "makeReadyMin": 18, "makeReadyWaste": 150, "plateCost": 6}'::jsonb),
  ('off-rmgt-525', 'offset', 'Petit format (35×52)', 3, 'RMGT (Ryobi)', '525 GX', '37×52', 5, false, '{"speed": 13000, "makeReadyMin": 18, "makeReadyWaste": 150, "plateCost": 6}'::jsonb),
  ('off-hd-xl75-5l', 'offset', 'Demi-format (52×74)', 1, 'Heidelberg', 'Speedmaster XL 75-5+L', '53×75', 5, true, '{"speed": 16500, "makeReadyMin": 20, "makeReadyWaste": 200, "plateCost": 8}'::jsonb),
  ('off-hd-sx74-4', 'offset', 'Demi-format (52×74)', 2, 'Heidelberg', 'Speedmaster SX 74-4', '53×74', 4, false, '{"speed": 15000, "makeReadyMin": 20, "makeReadyWaste": 200, "plateCost": 8}'::jsonb),
  ('off-km-g529', 'offset', 'Demi-format (52×74)', 3, 'Komori', 'Lithrone G529+C', '53×75', 5, true, '{"speed": 16500, "makeReadyMin": 20, "makeReadyWaste": 200, "plateCost": 8}'::jsonb),
  ('off-kba-76', 'offset', 'Demi-format (52×74)', 4, 'Koenig & Bauer', 'Rapida 76-5+L', '53×76', 5, true, '{"speed": 16000, "makeReadyMin": 20, "makeReadyWaste": 200, "plateCost": 8}'::jsonb),
  ('off-hd-xl106-8p', 'offset', 'Grand format feuilles (70×102+)', 1, 'Heidelberg', 'Speedmaster XL 106-8-P', '75×106', 8, false, '{"speed": 18000, "makeReadyMin": 25, "makeReadyWaste": 300, "plateCost": 12}'::jsonb),
  ('off-hd-cx102-6l', 'offset', 'Grand format feuilles (70×102+)', 2, 'Heidelberg', 'Speedmaster CX 102-6+L', '72×102', 6, true, '{"speed": 16500, "makeReadyMin": 25, "makeReadyWaste": 300, "plateCost": 12}'::jsonb),
  ('off-km-gl840', 'offset', 'Grand format feuilles (70×102+)', 3, 'Komori', 'Lithrone GL840+C', '75×102', 8, true, '{"speed": 16500, "makeReadyMin": 25, "makeReadyWaste": 300, "plateCost": 12}'::jsonb),
  ('off-kba-106-6l', 'offset', 'Grand format feuilles (70×102+)', 4, 'Koenig & Bauer', 'Rapida 106-6+L', '74×106', 6, true, '{"speed": 18000, "makeReadyMin": 25, "makeReadyWaste": 300, "plateCost": 12}'::jsonb),
  ('off-mr-706', 'offset', 'Grand format feuilles (70×102+)', 5, 'manroland', 'Roland 706 LV', '74×104', 6, true, '{"speed": 16000, "makeReadyMin": 28, "makeReadyWaste": 300, "plateCost": 12}'::jsonb),
  ('off-rmgt-920', 'offset', 'Grand format feuilles (70×102+)', 6, 'RMGT (Ryobi)', '920 ST-4', '65×92', 4, false, '{"speed": 15000, "makeReadyMin": 22, "makeReadyWaste": 250, "plateCost": 10}'::jsonb),
  ('num-xe-v4100', 'numerique', 'Toner sec', 1, 'Xerox', 'Versant 4100', '33×66', 4, false, '{"clickColor": 0.04, "clickBW": 0.01, "speedPpm": 100}'::jsonb),
  ('num-km-c14000', 'numerique', 'Toner sec', 2, 'Konica Minolta', 'AccurioPress C14000', '33×90', 4, false, '{"clickColor": 0.038, "clickBW": 0.01, "speedPpm": 140}'::jsonb),
  ('num-ca-v1350', 'numerique', 'Toner sec', 3, 'Canon', 'imagePRESS V1350', '33×74', 4, false, '{"clickColor": 0.038, "clickBW": 0.01, "speedPpm": 135}'::jsonb),
  ('num-ric-9500', 'numerique', 'Toner sec', 4, 'Ricoh', 'Pro C9500', '33×70', 4, false, '{"clickColor": 0.04, "clickBW": 0.01, "speedPpm": 135}'::jsonb),
  ('num-xe-iri', 'numerique', 'Toner sec', 5, 'Xerox', 'Iridesse (5e/6e couleur)', '33×66', 6, true, '{"clickColor": 0.055, "clickBW": 0.012, "speedPpm": 120}'::jsonb),
  ('num-km-c7100', 'numerique', 'Toner sec', 6, 'Konica Minolta', 'AccurioPress C7100', '33×49', 4, false, '{"clickColor": 0.042, "clickBW": 0.011, "speedPpm": 71}'::jsonb),
  ('num-hp-7k', 'numerique', 'ElectroInk & jet d''encre', 1, 'HP Indigo', '7K Digital Press', '33×48', 7, false, '{"clickColor": 0.06, "clickBW": 0.015, "speedPpm": 120}'::jsonb),
  ('num-hp-100k', 'numerique', 'ElectroInk & jet d''encre', 2, 'HP Indigo', '100K Digital Press', '35×51', 7, false, '{"clickColor": 0.05, "clickBW": 0.013, "speedPpm": 200}'::jsonb),
  ('num-hp-15k', 'numerique', 'ElectroInk & jet d''encre', 3, 'HP Indigo', '15K Digital Press (B2)', '53×75', 7, false, '{"clickColor": 0.09, "clickBW": 0.022, "speedPpm": 115}'::jsonb),
  ('num-fu-jp750', 'numerique', 'ElectroInk & jet d''encre', 4, 'Fujifilm', 'Jet Press 750S (B2 jet d’encre)', '53×75', 4, false, '{"clickColor": 0.1, "clickBW": 0.025, "speedPpm": 120}'::jsonb),
  ('num-ca-ix3200', 'numerique', 'ElectroInk & jet d''encre', 5, 'Canon', 'varioPRINT iX3200', '32×48', 4, false, '{"clickColor": 0.035, "clickBW": 0.009, "speedPpm": 320}'::jsonb),
  ('gf-hp-l800w', 'grand_format', 'Rouleau (roll-to-roll)', 1, 'HP', 'Latex 800 W', 'laize 162 cm', 7, false, '{"inkCostM2": 1.9, "speedM2h": 36}'::jsonb),
  ('gf-ro-vg3', 'grand_format', 'Rouleau (roll-to-roll)', 2, 'Roland DG', 'TrueVIS VG3-640', 'laize 160 cm', 8, false, '{"inkCostM2": 1.6, "speedM2h": 12}'::jsonb),
  ('gf-ep-s80600', 'grand_format', 'Rouleau (roll-to-roll)', 3, 'Epson', 'SureColor S80600', 'laize 162 cm', 9, false, '{"inkCostM2": 1.5, "speedM2h": 12}'::jsonb),
  ('gf-mi-jv330', 'grand_format', 'Rouleau (roll-to-roll)', 4, 'Mimaki', 'JV330-160', 'laize 161 cm', 8, false, '{"inkCostM2": 1.5, "speedM2h": 21}'::jsonb),
  ('gf-ca-colorado', 'grand_format', 'Rouleau (roll-to-roll)', 5, 'Canon', 'Colorado 1650 (UVgel)', 'laize 163 cm', 4, false, '{"inkCostM2": 1.2, "speedM2h": 55}'::jsonb),
  ('gf-hp-l2700', 'grand_format', 'Rouleau (roll-to-roll)', 6, 'HP', 'Latex 2700', 'laize 320 cm', 7, false, '{"inkCostM2": 1.9, "speedM2h": 77}'::jsonb),
  ('gf-sq-nyala', 'grand_format', 'À plat (flatbed) & hybrides', 1, 'swissQprint', 'Nyala 4', 'plateau 320×205 cm', 6, true, '{"inkCostM2": 2.2, "speedM2h": 90}'::jsonb),
  ('gf-du-p5350', 'grand_format', 'À plat (flatbed) & hybrides', 2, 'Durst', 'P5 350', 'laize 350 cm', 6, false, '{"inkCostM2": 2.2, "speedM2h": 150}'::jsonb),
  ('gf-ag-jeti', 'grand_format', 'À plat (flatbed) & hybrides', 3, 'Agfa', 'Jeti Tauro H3300', 'laize 330 cm', 6, false, '{"inkCostM2": 2, "speedM2h": 230}'::jsonb),
  ('ro-mr-rotoman', 'roto', 'Offset bobine', 1, 'manroland', 'Rotoman N', 'laize 96,5 cm', 4, false, '{"speed": 65000, "makeReadyMin": 45, "makeReadyWaste": 800, "plateCost": 10}'::jsonb),
  ('ro-goss-m600', 'roto', 'Offset bobine', 2, 'Goss', 'M600 Folia', 'laize 96 cm', 4, false, '{"speed": 50000, "makeReadyMin": 45, "makeReadyWaste": 800, "plateCost": 10}'::jsonb),
  ('ro-km-38', 'roto', 'Offset bobine', 3, 'Komori', 'System 38S', 'laize 96,5 cm', 4, false, '{"speed": 50000, "makeReadyMin": 45, "makeReadyWaste": 800, "plateCost": 10}'::jsonb),
  ('ro-hp-t250', 'roto', 'Jet d''encre bobine', 1, 'HP', 'PageWide T250 HD', 'laize 56 cm', 4, false, '{"speed": 30000, "makeReadyMin": 15, "makeReadyWaste": 100, "plateCost": 0}'::jsonb),
  ('ro-sc-jet520', 'roto', 'Jet d''encre bobine', 2, 'Screen', 'Truepress Jet 520HD', 'laize 52 cm', 4, false, '{"speed": 25000, "makeReadyMin": 15, "makeReadyWaste": 100, "plateCost": 0}'::jsonb),
  ('ro-ric-vc70000', 'roto', 'Jet d''encre bobine', 3, 'Ricoh', 'Pro VC70000', 'laize 52 cm', 4, false, '{"speed": 28000, "makeReadyMin": 15, "makeReadyWaste": 100, "plateCost": 0}'::jsonb),
  ('de-bobst-nova106', 'decoupe', 'Platines (formes de découpe)', 1, 'Bobst', 'Novacut 106 E', '76×106', null, false, '{"dieCost": 400, "makeReadyMin": 25, "speed": 6500}'::jsonb),
  ('de-hd-pro106', 'decoupe', 'Platines (formes de découpe)', 2, 'Heidelberg', 'Promatrix 106 CS', '76×106', null, false, '{"dieCost": 400, "makeReadyMin": 25, "speed": 7700}'::jsonb),
  ('de-bobst-sp102', 'decoupe', 'Platines (formes de découpe)', 3, 'Bobst', 'SP 102-E (historique)', '72×102', null, false, '{"dieCost": 350, "makeReadyMin": 35, "speed": 5000}'::jsonb),
  ('de-zund-g3', 'decoupe', 'Tables numériques (sans forme)', 1, 'Zünd', 'G3 L-2500', 'table 180×250 cm', null, false, '{"dieCost": 0, "makeReadyMin": 5, "speed": 300}'::jsonb),
  ('de-esko-c66', 'decoupe', 'Tables numériques (sans forme)', 2, 'Esko Kongsberg', 'C66', 'table 320×220 cm', null, false, '{"dieCost": 0, "makeReadyMin": 5, "speed": 300}'::jsonb),
  ('de-highcon-b2', 'decoupe', 'Tables numériques (sans forme)', 3, 'Highcon', 'Beam 2 (laser)', '76×106', null, false, '{"dieCost": 0, "makeReadyMin": 10, "speed": 5000}'::jsonb),
  ('pl-stahl-th82', 'pliage', 'Plieuses', 1, 'Heidelberg Stahlfolder', 'TH 82-P', '82 cm', null, false, '{"speed": 14000, "makeReadyMin": 15}'::jsonb),
  ('pl-stahl-kh82', 'pliage', 'Plieuses', 2, 'Heidelberg Stahlfolder', 'KH 82', '82 cm', null, false, '{"speed": 10000, "makeReadyMin": 15}'::jsonb),
  ('pl-mbo-k80', 'pliage', 'Plieuses', 3, 'MBO', 'K80', '78 cm', null, false, '{"speed": 10000, "makeReadyMin": 15}'::jsonb),
  ('pl-mbo-k8rs', 'pliage', 'Plieuses', 4, 'MBO', 'K8 RS', '78 cm', null, false, '{"speed": 12000, "makeReadyMin": 15}'::jsonb),
  ('pl-horizon-afc746', 'pliage', 'Plieuses', 5, 'Horizon', 'AFC-746F', '74 cm', null, false, '{"speed": 9000, "makeReadyMin": 10}'::jsonb),
  ('pl-horizon-af406', 'pliage', 'Plieuses', 6, 'Horizon', 'AF-406 (petit format)', '40 cm', null, false, '{"speed": 7000, "makeReadyMin": 8}'::jsonb),
  ('ma-polar-115', 'massicot', 'Massicots', 1, 'Polar', 'N 115 PLUS', '115 cm', null, false, '{"liftsPerHour": 350}'::jsonb),
  ('ma-polar-137', 'massicot', 'Massicots', 2, 'Polar', 'N 137 PLUS', '137 cm', null, false, '{"liftsPerHour": 350}'::jsonb),
  ('ma-polar-80', 'massicot', 'Massicots', 3, 'Polar', 'D 80 PRO', '80 cm', null, false, '{"liftsPerHour": 300}'::jsonb),
  ('ma-wohl-115', 'massicot', 'Massicots', 4, 'Wohlenberg', 'WB 115 / Cut-tec', '115 cm', null, false, '{"liftsPerHour": 330}'::jsonb),
  ('ma-perfecta-92', 'massicot', 'Massicots', 5, 'Perfecta', '92 TVC', '92 cm', null, false, '{"liftsPerHour": 300}'::jsonb),
  ('ma-ideal-7228', 'massicot', 'Massicots', 6, 'Ideal', '7228-06 LT (petit atelier)', '72 cm', null, false, '{"liftsPerHour": 200}'::jsonb),
  ('fi-mm-presto', 'finition', 'Piqûre à cheval', 1, 'Müller Martini', 'Presto II Digital', '—', null, false, '{"speed": 9000, "makeReadyMin": 20, "consumableCost": 0.02}'::jsonb),
  ('fi-horizon-stitch', 'finition', 'Piqûre à cheval', 2, 'Horizon', 'StitchLiner Mark V', '—', null, false, '{"speed": 6000, "makeReadyMin": 15, "consumableCost": 0.02}'::jsonb),
  ('fi-duplo-600i', 'finition', 'Piqûre à cheval', 3, 'Duplo', 'DBM-600i', '—', null, false, '{"speed": 5000, "makeReadyMin": 15, "consumableCost": 0.02}'::jsonb),
  ('fi-horizon-bq500', 'finition', 'Dos carré collé', 1, 'Horizon', 'BQ-500', '—', null, false, '{"speed": 800, "makeReadyMin": 20, "consumableCost": 0.12}'::jsonb),
  ('fi-mm-vareo', 'finition', 'Dos carré collé', 2, 'Müller Martini', 'Vareo PRO', '—', null, false, '{"speed": 1300, "makeReadyMin": 20, "consumableCost": 0.12}'::jsonb),
  ('fi-duplo-dpb500', 'finition', 'Dos carré collé', 3, 'Duplo', 'DPB-500', '—', null, false, '{"speed": 500, "makeReadyMin": 15, "consumableCost": 0.12}'::jsonb),
  ('fi-komfi-delta52', 'finition', 'Pelliculage', 1, 'Komfi', 'Delta 52', '52 cm', null, false, '{"speed": 2000, "makeReadyMin": 15, "consumableCost": 0.08}'::jsonb),
  ('fi-autobond-76', 'finition', 'Pelliculage', 2, 'Autobond', 'Micro 76 TH', '76 cm', null, false, '{"speed": 3000, "makeReadyMin": 15, "consumableCost": 0.1}'::jsonb),
  ('fi-foliant-530', 'finition', 'Pelliculage', 3, 'Foliant', 'Mercury 530 SF', '53 cm', null, false, '{"speed": 2500, "makeReadyMin": 12, "consumableCost": 0.08}'::jsonb),
  ('fi-duplo-dusense', 'finition', 'Vernis sélectif & dorure', 1, 'Duplo', 'DuSense DDC-810', '36×102', null, false, '{"speed": 2200, "makeReadyMin": 10, "consumableCost": 0.15}'::jsonb),
  ('fi-mgi-jv3d', 'finition', 'Vernis sélectif & dorure', 2, 'MGI', 'JetVarnish 3D Evo', '36×102', null, false, '{"speed": 2000, "makeReadyMin": 10, "consumableCost": 0.2}'::jsonb),
  ('fi-duplo-dc646', 'finition', 'Raineuses-plieuses', 1, 'Duplo', 'DC-646 PRO', '33×65', null, false, '{"speed": 1500, "makeReadyMin": 5, "consumableCost": 0}'::jsonb),
  ('fi-morgana-pro50', 'finition', 'Raineuses-plieuses', 2, 'Morgana', 'AutoCreaser Pro 50', '50 cm', null, false, '{"speed": 5000, "makeReadyMin": 5, "consumableCost": 0}'::jsonb)
on conflict (id) do update set
  type = excluded.type, family = excluded.family, rank = excluded.rank,
  brand = excluded.brand, model = excluded.model, format = excluded.format,
  colors = excluded.colors, varnish = excluded.varnish,
  price_defaults = excluded.price_defaults;

-- ─── 7. Seed du referentiel Fournisseur unifie (part commune) ────────────────
-- Les entrees a `tenant_id` null sont le socle partage. Les deux premieres de
-- chaque nature disent quelque chose de metier : l imprimeur est lui-meme
-- fournisseur de papier (BK-08, prix a la feuille) et transporteur (vehicule
-- interne). Ce ne sont pas des cas particuliers, c est le cas courant.

insert into public.supplier_directory (kind, name)
values
  ('paper', 'Mon stock papier (prix à la feuille)'),
  ('paper', 'Antalis'),
  ('paper', 'Inapa'),
  ('paper', 'Papyrus'),
  ('paper', 'Torraspapel'),
  ('paper', 'Fedrigoni'),
  ('transport', 'Mes livraisons (véhicule interne)'),
  ('transport', 'Chronopost'),
  ('transport', 'Colissimo'),
  ('transport', 'DPD'),
  ('transport', 'GLS'),
  ('transport', 'Transporteur régional (grille négociée)'),
  ('subcontractor', 'Imprimerie Laville (Bordeaux)'),
  ('subcontractor', 'Reliure Occitane (Toulouse)'),
  ('subcontractor', 'Façonnage Atlantique (Nantes)'),
  ('subcontractor', 'Brochage Express (Lyon)'),
  ('subcontractor', 'Découpe Précision (Lille)')
on conflict do nothing;
