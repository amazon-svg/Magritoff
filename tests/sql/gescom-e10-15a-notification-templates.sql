-- ============================================================================
-- E10.15a — socle configurable des notifications multicanal (AUCUN ENVOI) :
-- table notification_templates (RLS, plafond de 100 sous verrou, immuabilite
-- de event_name/channel, coherences par CHECK, cascade sur production_steps),
-- et les trois reglages de notification sur commercial_settings (defauts,
-- bornes, garde AU CHAMP can_manage_notifications).
-- ----------------------------------------------------------------------------
-- Test COMPORTEMENTAL, execute par psql contre la base locale : le trigger
-- notification_templates_guard, la RLS et le trigger
-- commercial_settings_guard_notification_fields vivent ENTIEREMENT dans la
-- migration `20260911010000` — une lecture de son texte ne prouve pas qu ils
-- se comportent correctement sous appel reel (meme lecon que E10.9/E10.12/
-- E10.13).
--
-- ── Sur le choix d acteur du scenario 8 (garde AU CHAMP) ────────────────────
-- Le modele Magrit actuel (UM1, verrou « admin unique ») n autorise AUCUNE
-- affectation de role portant une capability metier a un membre
-- `access_scope = 'magrit_full'` (trigger `restrict_magrit_assignments_to_
-- options`, prouve par `gescom-e10-11-can-manage-pricing.sql` scenario 3) :
-- `can_manage_pricing` et `can_manage_notifications` sont donc, dans le
-- produit tel qu il existe AUJOURD HUI, detenus par EXACTEMENT la meme
-- population (les `admin` du tenant), et le contrat le dit lui-meme (§8.23
-- §2 : « aucun effet visible aujourd'hui »). Aucun chemin PRODUIT (ni
-- `magrit_full` avec role custom, verrouille par UM1 ; ni `shop_only`,
-- FIGE par `freeze_legacy_shop_only_write()`, `20260818000100` — constate a
-- l execution reelle de ce fichier) ne permet de construire un acteur
-- portant `can_manage_pricing` SANS `can_manage_notifications`.
--
-- Pour prouver reellement ce que LE TRIGGER fait quand les deux droits SONT
-- SEPARES — ce que le contrat appelle « le chemin de separation », additif
-- et deja pris — ce fichier construit la FIXTURE (l affectation de role) en
-- role `postgres`, le trigger UM1 `tenant_role_assignments_only_options`
-- DESACTIVE pour cette seule instruction (MEME PATRON que les fixtures
-- anterieures de `gescom-e10-22d-purge-activation.sql`, deja precedent dans
-- ce depot). C est un ARTIFICE DE TEST assume, pas un parcours produit :
-- l acteur `authenticated` ordinaire NE PEUT PAS desactiver ce trigger — la
-- garantie de securite reelle (verrou UM1) reste intacte. Il permet de
-- verifier le COMPORTEMENT REEL de
-- `commercial_settings_guard_notification_fields` et de
-- `user_has_capability`, qui eux ne savent rien de la provenance produit de
-- la capability.
--
-- Lancer : pnpm test:storefront:sql (necessite Supabase local demarre).
-- ============================================================================

begin;

create temporary table e10_15a_context (
  actor_admin   uuid not null,
  actor_member  uuid not null,
  actor_b       uuid not null,
  actor_pricing_only uuid not null,
  tenant_a      uuid not null,
  tenant_b      uuid not null,
  step_recu     uuid not null,
  step_pao      uuid not null,
  step_b_recu   uuid not null
);

grant select on e10_15a_context to authenticated;

-- ── Prealables, joues en tant que postgres ─────────────────────────────────
do $$
declare
  v_actor_admin uuid := gen_random_uuid();
  v_actor_member uuid := gen_random_uuid();
  v_actor_b uuid := gen_random_uuid();
  v_actor_pricing_only uuid := gen_random_uuid();
  v_tenant_a uuid;
  v_tenant_b uuid;
  v_step_recu uuid;
  v_step_pao uuid;
  v_step_b_recu uuid;
  v_role_def uuid;
  v_notification_count integer;
  v_sms_enabled boolean;
  v_retention integer;
  v_sms_cap integer;
begin
  insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
    values
      (v_actor_admin, 'e10-15a-admin@example.test', 'x', now(), now(), now(), 'authenticated', 'authenticated'),
      (v_actor_member, 'e10-15a-member@example.test', 'x', now(), now(), now(), 'authenticated', 'authenticated'),
      (v_actor_b, 'e10-15a-actor-b@example.test', 'x', now(), now(), now(), 'authenticated', 'authenticated'),
      (v_actor_pricing_only, 'e10-15a-pricing-only@example.test', 'x', now(), now(), now(), 'authenticated', 'authenticated');

  insert into public.tenants (slug, name) values ('e10-15a-tenant-a', 'E10.15a Tenant A') returning id into v_tenant_a;
  insert into public.tenants (slug, name) values ('e10-15a-tenant-b', 'E10.15a Tenant B') returning id into v_tenant_b;

  select id into v_step_recu from public.production_steps where tenant_id = v_tenant_a and position = 0;
  select id into v_step_pao  from public.production_steps where tenant_id = v_tenant_a and position = 1;
  select id into v_step_b_recu from public.production_steps where tenant_id = v_tenant_b and position = 0;

  insert into public.tenant_members (tenant_id, user_id, role, access_scope, allowed_shop_ids)
    values (v_tenant_a, v_actor_admin, 'admin', 'magrit_full', '{}');
  insert into public.tenant_members (tenant_id, user_id, role, access_scope, allowed_shop_ids)
    values (v_tenant_a, v_actor_member, 'member', 'magrit_full', '{}');
  insert into public.tenant_members (tenant_id, user_id, role, access_scope, allowed_shop_ids)
    values (v_tenant_b, v_actor_b, 'admin', 'magrit_full', '{}');
  -- Membre `magrit_full` ordinaire (role 'member', jamais 'admin'/'owner').
  insert into public.tenant_members (tenant_id, user_id, role, access_scope, allowed_shop_ids)
    values (v_tenant_a, v_actor_pricing_only, 'member', 'magrit_full', '{}');

  insert into public.tenant_role_definitions (tenant_id, name, capabilities, created_by)
  values (v_tenant_a, 'E10.15a Prix seul', '{"can_manage_pricing": true}'::jsonb, v_actor_admin)
  returning id into v_role_def;

  -- Artifice de test, DOCUMENTE EN TETE DE FICHIER : le trigger UM1
  -- `restrict_magrit_assignments_to_options` (20260824000200, verrou « admin
  -- unique ») refuse TOUTE affectation d un role portant une capability
  -- metier a un membre `magrit_full` — prouve par
  -- `gescom-e10-11-can-manage-pricing.sql` scenario 3, et c est exactement
  -- pourquoi les deux droits n ont AUCUN moyen d etre separes aujourd hui
  -- dans le produit (contrat §8.23 §2). Pour observer le COMPORTEMENT REEL
  -- du trigger `commercial_settings_guard_notification_fields` — qui, lui,
  -- ne connait que `user_has_capability`, pas la provenance de la capability
  -- — cette seule INSERTION de fixture est jouee trigger UM1 DESACTIVE, en
  -- role `postgres` (l acteur `authenticated` ne peut PAS le faire, la
  -- garantie de securite reste donc intacte) : MEME PATRON que les fixtures
  -- anterieures de `gescom-e10-22d-purge-activation.sql` (« alter table ...
  -- disable trigger », deja le patron employe pour desarmer une garde le
  -- temps de construire un etat de test impossible a atteindre par l API).
  alter table public.tenant_role_assignments disable trigger tenant_role_assignments_only_options;
  insert into public.tenant_role_assignments (role_definition_id, user_id, assigned_by)
  values (v_role_def, v_actor_pricing_only, v_actor_admin);
  alter table public.tenant_role_assignments enable trigger tenant_role_assignments_only_options;

  insert into e10_15a_context (
    actor_admin, actor_member, actor_b, actor_pricing_only, tenant_a, tenant_b, step_recu, step_pao, step_b_recu
  ) values (
    v_actor_admin, v_actor_member, v_actor_b, v_actor_pricing_only, v_tenant_a, v_tenant_b, v_step_recu, v_step_pao, v_step_b_recu
  );

  -- ── 0. commercial_settings — defauts (contrat §8.23 §2) et bornes ────────
  -- Creation directe de la ligne (role `postgres`, bypass RLS — MEME EFFET
  -- que l INSERT implicite d `api_get_commercial_settings`, qui exige lui un
  -- `auth.uid()` non nul et n est donc pas appelable depuis cette phase
  -- privilegiee).
  insert into public.commercial_settings (tenant_id) values (v_tenant_a) on conflict (tenant_id) do nothing;
  select notification_sms_enabled, notification_retention_days, notification_sms_daily_cap
    into v_sms_enabled, v_retention, v_sms_cap
    from public.commercial_settings where tenant_id = v_tenant_a;
  if v_retention <> 90 or v_sms_enabled is not false or v_sms_cap <> 200 then
    raise exception 'defauts inattendus : retention=%, sms_enabled=%, sms_cap=%', v_retention, v_sms_enabled, v_sms_cap;
  end if;
  -- Les deux tests de PLAGE (7..730, 0..10000) sont joues plus bas, SOUS UN
  -- ACTEUR AUTHENTIFIE portant can_manage_notifications (scenario 0bis) :
  -- en phase privilegiee, `auth.uid()` est NUL et le trigger
  -- `commercial_settings_guard_notification_fields` refuse TOUT changement de
  -- ces trois champs avant meme d atteindre le `check` de plage — constate a
  -- l execution reelle de ce fichier (un premier essai depuis cette phase
  -- levait `permission_denied`, jamais le `check_violation` attendu).
end;
$$;

-- ── 0bis. commercial_settings — bornes de plage (7..730, 0..10000), sous un
-- ACTEUR AUTHENTIFIE portant can_manage_notifications (admin, derivation) ──
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select actor_admin::text from e10_15a_context), 'role', 'authenticated')::text, true);

do $$
declare
  v_tenant_a uuid;
begin
  select tenant_a into v_tenant_a from e10_15a_context;

  begin
    update public.commercial_settings set notification_retention_days = 6 where tenant_id = v_tenant_a;
    raise exception 'notification_retention_days = 6 (hors 7..730) accepte — contrainte de plage rompue';
  exception
    when check_violation then null;
  end;

  begin
    update public.commercial_settings set notification_sms_daily_cap = 10001 where tenant_id = v_tenant_a;
    raise exception 'notification_sms_daily_cap = 10001 (hors 0..10000) accepte — contrainte de plage rompue';
  exception
    when check_violation then null;
  end;

  if (
    select (notification_retention_days, notification_sms_daily_cap) from public.commercial_settings where tenant_id = v_tenant_a
  ) is distinct from (90, 200) then
    raise exception 'les reglages ont change malgre les deux refus attendus';
  end if;
end;
$$;

reset role;

-- ── 1. RLS lecture — un membre du tenant B ne voit AUCUN modele du tenant A ─
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select actor_admin::text from e10_15a_context), 'role', 'authenticated')::text, true);

do $$
declare
  v_tenant_a uuid;
begin
  select tenant_a into v_tenant_a from e10_15a_context;
  insert into public.notification_templates (tenant_id, event_name, channel, audience, name, subject, body, is_active)
  values (v_tenant_a, 'customer.created', 'email', 'customer', 'Bienvenue', 'Bonjour {{customer.company_name}}', 'Merci.', false);
end;
$$;

reset role;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select actor_b::text from e10_15a_context), 'role', 'authenticated')::text, true);

do $$
declare
  v_tenant_a uuid;
  v_visible integer;
begin
  select tenant_a into v_tenant_a from e10_15a_context;
  select count(*) into v_visible from public.notification_templates where tenant_id = v_tenant_a;
  if v_visible <> 0 then
    raise exception 'le tenant B lit % modele(s) du tenant A — notification_templates_select rompue', v_visible;
  end if;
end;
$$;

reset role;

-- ── 2. RLS ecriture — membre SANS can_manage_notifications refuse (INSERT et
-- UPDATE), admin (derivation) reussit ────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select actor_member::text from e10_15a_context), 'role', 'authenticated')::text, true);

do $$
declare
  v_tenant_a uuid;
  v_before integer;
begin
  select tenant_a into v_tenant_a from e10_15a_context;
  select count(*) into v_before from public.notification_templates where tenant_id = v_tenant_a;

  begin
    insert into public.notification_templates (tenant_id, event_name, channel, audience, name, subject, body, is_active)
    values (v_tenant_a, 'customer.created', 'email', 'customer', 'Refuse', 'Sujet', 'Corps', false);
    raise exception 'un membre SANS can_manage_notifications a pu creer un modele (notification_templates_insert rompue)';
  exception
    when insufficient_privilege then null;
  end;

  if (select count(*) from public.notification_templates where tenant_id = v_tenant_a) <> v_before then
    raise exception 'le compte de modeles a change malgre le refus attendu';
  end if;
end;
$$;

do $$
declare
  v_tenant_a uuid;
  v_template_id uuid;
  v_updated integer;
begin
  select tenant_a into v_tenant_a from e10_15a_context;
  select id into v_template_id from public.notification_templates where tenant_id = v_tenant_a limit 1;

  update public.notification_templates set name = 'Modifie sans droit' where id = v_template_id;
  get diagnostics v_updated = row_count;
  if v_updated <> 0 then
    raise exception 'un membre SANS can_manage_notifications a pu modifier un modele (notification_templates_update rompue)';
  end if;
end;
$$;

reset role;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select actor_admin::text from e10_15a_context), 'role', 'authenticated')::text, true);

do $$
declare
  v_tenant_a uuid;
  v_template_id uuid;
begin
  select tenant_a into v_tenant_a from e10_15a_context;
  select id into v_template_id from public.notification_templates where tenant_id = v_tenant_a limit 1;

  update public.notification_templates set name = 'Renomme par admin' where id = v_template_id;
  if (select name from public.notification_templates where id = v_template_id) <> 'Renomme par admin' then
    raise exception 'admin (derivation can_manage_notifications) n a pas pu modifier son propre modele';
  end if;
end;
$$;

reset role;

-- ── 2bis. qa-review m2 — RLS ECRITURE INTER-TENANT : un ADMIN du tenant B
-- (capability COMPLETE dans SON tenant) ne peut ni MODIFIER ni CREER une
-- ligne QUI APPARTIENT AU TENANT A (.claude/rules/db.md : « un tenant A ne
-- lit/ecrit jamais les lignes d un tenant B » — teste jusqu ici seulement
-- pour la LECTURE, scenario 1, et pour un membre SANS capability, scenario
-- 2 ; il manquait le cas d un acteur QUI A la capability, mais dans le
-- MAUVAIS tenant). `user_has_capability(tenant_id, ...)` est parametre PAR
-- tenant_id : un admin du tenant B n a aucune appartenance au tenant A, donc
-- aucune capability qui y soit vraie, quelle que soit la capability qu il
-- porte chez lui.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select actor_b::text from e10_15a_context), 'role', 'authenticated')::text, true);

do $$
declare
  v_tenant_a uuid;
  v_template_id uuid;
  v_name_before text;
  v_updated integer;
begin
  select tenant_a into v_tenant_a from e10_15a_context;
  select id, name into v_template_id, v_name_before from public.notification_templates where tenant_id = v_tenant_a limit 1;

  -- UPDATE : admin du tenant B, cible une ligne du tenant A.
  update public.notification_templates set name = 'Vole par admin B' where id = v_template_id;
  get diagnostics v_updated = row_count;
  if v_updated <> 0 then
    raise exception 'un admin du tenant B a pu MODIFIER une ligne du tenant A (isolation RLS ecriture rompue)';
  end if;
  if (select name from public.notification_templates where id = v_template_id) <> v_name_before then
    raise exception 'le nom a change malgre le refus attendu (admin B, tenant A)';
  end if;

  -- INSERT : admin du tenant B, tente d ecrire EXPLICITEMENT sous tenant_id = tenant A.
  begin
    insert into public.notification_templates (tenant_id, event_name, channel, audience, name, subject, body, is_active)
    values (v_tenant_a, 'customer.created', 'email', 'customer', 'Injecte par admin B', 'Sujet', 'Corps', false);
    raise exception 'un admin du tenant B a pu CREER une ligne sous tenant_id = tenant A (isolation RLS ecriture rompue)';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

reset role;

-- Verification de la NON-CREATION depuis le tenant A lui-meme (verifier
-- l absence DEPUIS le tenant B serait tautologique : la RLS SELECT
-- d actor_b filtre deja tout ce qui n est pas tenant B, `exists(...)`
-- rendrait toujours faux, refus reel ou pas).
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select actor_admin::text from e10_15a_context), 'role', 'authenticated')::text, true);

do $$
declare
  v_tenant_a uuid;
begin
  select tenant_a into v_tenant_a from e10_15a_context;
  if exists (select 1 from public.notification_templates where tenant_id = v_tenant_a and name = 'Injecte par admin B') then
    raise exception 'une ligne injectee par admin B est neanmoins visible sous tenant_id = tenant A';
  end if;
end;
$$;

reset role;

-- ── 3. AUCUN DELETE (contrat : pas de suppression), MEME POUR UN ADMIN ─────
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select actor_admin::text from e10_15a_context), 'role', 'authenticated')::text, true);

do $$
declare
  v_tenant_a uuid;
  v_template_id uuid;
  v_deleted integer;
begin
  select tenant_a into v_tenant_a from e10_15a_context;
  select id into v_template_id from public.notification_templates where tenant_id = v_tenant_a limit 1;

  delete from public.notification_templates where id = v_template_id;
  get diagnostics v_deleted = row_count;
  if v_deleted <> 0 then
    raise exception 'un admin a pu SUPPRIMER un modele de notification — aucune policy DELETE ne devrait l autoriser';
  end if;

  if not exists (select 1 from public.notification_templates where id = v_template_id) then
    raise exception 'le modele a disparu malgre le refus attendu (delete silencieusement accepte ailleurs)';
  end if;
end;
$$;

reset role;

-- ── 4. Trigger notification_templates_guard — immuabilite event_name/channel
-- apres creation ─────────────────────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select actor_admin::text from e10_15a_context), 'role', 'authenticated')::text, true);

do $$
declare
  v_tenant_a uuid;
  v_template_id uuid;
  v_rejected boolean := false;
begin
  select tenant_a into v_tenant_a from e10_15a_context;
  select id into v_template_id from public.notification_templates where tenant_id = v_tenant_a limit 1;

  begin
    update public.notification_templates set event_name = 'quote.sent' where id = v_template_id;
  exception
    when others then
      if sqlerrm like 'notification_template.immutable_field%' then v_rejected := true; else raise; end if;
  end;
  if not v_rejected then
    raise exception 'event_name a pu etre modifie apres creation (notification_templates_guard rompue)';
  end if;

  v_rejected := false;
  begin
    update public.notification_templates set channel = 'sms' where id = v_template_id;
  exception
    when others then
      if sqlerrm like 'notification_template.immutable_field%' then v_rejected := true; else raise; end if;
  end;
  if not v_rejected then
    raise exception 'channel a pu etre modifie apres creation (notification_templates_guard rompue)';
  end if;
end;
$$;

reset role;

-- ── 5. Coherences CHECK — recipients, filtre d etape, sujet par canal, corps
-- sms ─────────────────────────────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select actor_admin::text from e10_15a_context), 'role', 'authenticated')::text, true);

do $$
declare
  v_tenant_a uuid;
  v_step_recu uuid;
begin
  select tenant_a, step_recu into v_tenant_a, v_step_recu from e10_15a_context;

  -- audience explicit SANS recipients -> refuse.
  begin
    insert into public.notification_templates (tenant_id, event_name, channel, audience, name, subject, body, is_active)
    values (v_tenant_a, 'order.files_submitted', 'email', 'explicit', 'Atelier', 'Sujet', 'Corps', false);
    raise exception 'audience explicit sans recipients accepte — notification_templates_recipients_coherence rompue';
  exception
    when check_violation then null;
  end;

  -- audience customer AVEC recipients -> refuse.
  begin
    insert into public.notification_templates (tenant_id, event_name, channel, audience, recipients, name, subject, body, is_active)
    values (v_tenant_a, 'order.files_submitted', 'email', 'customer', array['a@example.test'], 'Atelier', 'Sujet', 'Corps', false);
    raise exception 'audience customer AVEC recipients accepte — notification_templates_recipients_coherence rompue';
  exception
    when check_violation then null;
  end;

  -- production_step_id sur un evenement autre que order.step_changed -> refuse.
  begin
    insert into public.notification_templates (tenant_id, event_name, channel, audience, production_step_id, name, subject, body, is_active)
    values (v_tenant_a, 'customer.created', 'email', 'customer', v_step_recu, 'Bienvenue', 'Sujet', 'Corps', false);
    raise exception 'production_step_id hors order.step_changed accepte — notification_templates_step_filter_coherence rompue';
  exception
    when check_violation then null;
  end;

  -- canal email SANS sujet -> refuse.
  begin
    insert into public.notification_templates (tenant_id, event_name, channel, audience, name, subject, body, is_active)
    values (v_tenant_a, 'customer.created', 'email', 'customer', 'Sans sujet', null, 'Corps', false);
    raise exception 'canal email sans sujet accepte — notification_templates_subject_coherence rompue';
  exception
    when check_violation then null;
  end;

  -- canal sms AVEC sujet -> refuse.
  begin
    insert into public.notification_templates (tenant_id, event_name, channel, audience, name, subject, body, is_active)
    values (v_tenant_a, 'customer.created', 'sms', 'customer', 'Avec sujet', 'Sujet interdit', 'Corps', false);
    raise exception 'canal sms avec sujet accepte — notification_templates_subject_coherence rompue';
  exception
    when check_violation then null;
  end;

  -- corps > 480 caracteres sur sms -> refuse.
  begin
    insert into public.notification_templates (tenant_id, event_name, channel, audience, name, body, is_active)
    values (v_tenant_a, 'customer.created', 'sms', 'customer', 'Trop long', repeat('x', 481), false);
    raise exception 'corps sms de 481 caracteres accepte — notification_templates_sms_body_length rompue';
  exception
    when check_violation then null;
  end;

  -- corps de 480 caracteres sur sms -> ACCEPTE (borne inclusive).
  insert into public.notification_templates (tenant_id, event_name, channel, audience, name, body, is_active)
  values (v_tenant_a, 'customer.created', 'sms', 'customer', 'Exactement 480', repeat('x', 480), false);
end;
$$;

reset role;

-- ── 6. FK production_step_id ... on delete cascade ──────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select actor_admin::text from e10_15a_context), 'role', 'authenticated')::text, true);

do $$
declare
  v_tenant_a uuid;
  v_step_pao uuid;
  v_template_id uuid;
begin
  select tenant_a, step_pao into v_tenant_a, v_step_pao from e10_15a_context;

  insert into public.notification_templates (tenant_id, event_name, channel, audience, production_step_id, name, subject, body, is_active)
  values (v_tenant_a, 'order.step_changed', 'email', 'customer', v_step_pao, 'Etape PAO', 'Sujet', '{{step.label}}', false)
  returning id into v_template_id;

  delete from public.production_steps where id = v_step_pao;

  if exists (select 1 from public.notification_templates where id = v_template_id) then
    raise exception 'le modele rattache a une etape supprimee survit — cascade rompue';
  end if;
end;
$$;

reset role;

-- ── 6bis. qa-review B2 (MAJEUR) — production_step_id D UN AUTRE TENANT est
-- REFUSE EN BASE (trigger notification_templates_assert_same_tenant), tant a
-- l INSERT qu a l UPDATE. Scenario EXACT signale par la qa-review : sans ce
-- trigger, l admin du tenant A pouvait creer un modele order.step_changed
-- pointant vers une etape du tenant B ; l admin du tenant B supprimant SA
-- propre etape detruisait alors, PAR CASCADE, une ligne du tenant A — un
-- tenant tiers detruisant une ligne d un espace ou personne n a le droit de
-- DELETE. Verifie ici que l ecriture inter-tenant est refusee AVANT que ce
-- scenario ne puisse jamais se produire.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select actor_admin::text from e10_15a_context), 'role', 'authenticated')::text, true);

do $$
declare
  v_tenant_a uuid;
  v_step_b_recu uuid;
  v_rejected boolean := false;
  v_message text;
begin
  select tenant_a, step_b_recu into v_tenant_a, v_step_b_recu from e10_15a_context;

  -- INSERT : admin du tenant A, production_step_id appartenant au tenant B.
  begin
    insert into public.notification_templates (tenant_id, event_name, channel, audience, production_step_id, name, subject, body, is_active)
    values (v_tenant_a, 'order.step_changed', 'email', 'customer', v_step_b_recu, 'Etape volee', 'Sujet', '{{step.label}}', false);
  exception
    when others then
      if sqlerrm like 'notification_templates_assert_same_tenant%' then
        v_rejected := true;
        v_message := sqlerrm;
      else
        raise;
      end if;
  end;
  if not v_rejected then
    raise exception 'un modele du tenant A a pu etre cree avec un production_step_id du tenant B (cross-tenant NON bloque — B2)';
  end if;

  if exists (
    select 1 from public.notification_templates where tenant_id = v_tenant_a and production_step_id = v_step_b_recu
  ) then
    raise exception 'un modele porte neanmoins un production_step_id du tenant B malgre le refus attendu';
  end if;
end;
$$;

-- UPDATE : un modele EXISTANT et VALIDE du tenant A tente de pointer vers
-- l etape du tenant B (aucune etape au depart -> production_step_id null).
do $$
declare
  v_tenant_a uuid;
  v_step_b_recu uuid;
  v_template_id uuid;
  v_rejected boolean := false;
begin
  select tenant_a, step_b_recu into v_tenant_a, v_step_b_recu from e10_15a_context;

  insert into public.notification_templates (tenant_id, event_name, channel, audience, name, subject, body, is_active)
  values (v_tenant_a, 'order.step_changed', 'email', 'customer', 'Etape a voler', 'Sujet', '{{step.label}}', false)
  returning id into v_template_id;

  begin
    update public.notification_templates set production_step_id = v_step_b_recu where id = v_template_id;
  exception
    when others then
      if sqlerrm like 'notification_templates_assert_same_tenant%' then v_rejected := true; else raise; end if;
  end;
  if not v_rejected then
    raise exception 'un modele du tenant A a pu etre MODIFIE avec un production_step_id du tenant B (cross-tenant NON bloque — B2, UPDATE)';
  end if;

  if (select production_step_id from public.notification_templates where id = v_template_id) is not null then
    raise exception 'production_step_id a change malgre le refus attendu (UPDATE cross-tenant)';
  end if;
end;
$$;

reset role;

-- ── 7. Trigger notification_templates_guard — plafond de 100 SOUS VERROU ───
-- JOUE EN DERNIER parmi les scenarios notification_templates : les scenarios
-- 1, 5 et 6 ci-dessus ont deja ajoute quelques lignes au tenant A, et ce
-- scenario remplit DYNAMIQUEMENT jusqu a 100 (v_to_create = 100 - v_existing)
-- plutot que de supposer un compte fixe — le jouer plus tot ferait echouer
-- les INSERT valides des scenarios suivants sur le plafond, pas sur ce qu ils
-- verifient reellement.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select actor_admin::text from e10_15a_context), 'role', 'authenticated')::text, true);

do $$
declare
  v_tenant_a uuid;
  v_existing integer;
  v_to_create integer;
  v_rejected boolean := false;
begin
  select tenant_a into v_tenant_a from e10_15a_context;
  select count(*) into v_existing from public.notification_templates where tenant_id = v_tenant_a;
  v_to_create := 100 - v_existing;

  insert into public.notification_templates (tenant_id, event_name, channel, audience, name, subject, body, is_active)
  select v_tenant_a, 'customer.created', 'email', 'customer', 'Plafond ' || g, 'Sujet', 'Corps', false
    from generate_series(1, v_to_create) as g;

  if (select count(*) from public.notification_templates where tenant_id = v_tenant_a) <> 100 then
    raise exception 'le tenant ne porte pas exactement 100 modeles apres remplissage (% attendus)', v_existing + v_to_create;
  end if;

  begin
    insert into public.notification_templates (tenant_id, event_name, channel, audience, name, subject, body, is_active)
    values (v_tenant_a, 'customer.created', 'email', 'customer', 'Le 101e', 'Sujet', 'Corps', false);
  exception
    when others then
      if sqlerrm like 'notification_template.limit_reached%' then v_rejected := true; else raise; end if;
  end;
  if not v_rejected then
    raise exception 'un 101e modele a pu etre cree — plafond de 100 rompu';
  end if;
end;
$$;

reset role;

-- ── 8. commercial_settings — garde AU CHAMP can_manage_notifications
-- (contrat §8.23 §2), acteur can_manage_pricing SEUL ─────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select actor_pricing_only::text from e10_15a_context), 'role', 'authenticated')::text, true);

do $$
declare
  v_tenant_a uuid;
  v_rejected boolean := false;
begin
  select tenant_a into v_tenant_a from e10_15a_context;

  -- Precondition : cet acteur porte bien can_manage_pricing (sinon le
  -- scenario ne prouve rien) mais PAS can_manage_notifications.
  if not public.user_has_capability(v_tenant_a, 'can_manage_pricing') then
    raise exception 'precondition rompue : actor_pricing_only devrait porter can_manage_pricing';
  end if;
  if public.user_has_capability(v_tenant_a, 'can_manage_notifications') then
    raise exception 'precondition rompue : actor_pricing_only ne devrait PAS porter can_manage_notifications';
  end if;

  -- Champ de PRIX (can_manage_pricing) : reussit.
  update public.commercial_settings set default_validity_days = 45 where tenant_id = v_tenant_a;
  if (select default_validity_days from public.commercial_settings where tenant_id = v_tenant_a) <> 45 then
    raise exception 'un acteur can_manage_pricing n a pas pu modifier default_validity_days';
  end if;

  -- Champ de NOTIFICATION : refuse, MEME EN PORTANT can_manage_pricing —
  -- c est le coeur du CA de ce scenario (contrat §8.23 §2, « refus au champ
  -- pres »).
  begin
    update public.commercial_settings set notification_retention_days = 30 where tenant_id = v_tenant_a;
  exception
    when others then
      if sqlerrm like 'permission_denied%' then v_rejected := true; else raise; end if;
  end;
  if not v_rejected then
    raise exception 'un acteur SANS can_manage_notifications a pu modifier notification_retention_days (garde au champ rompue)';
  end if;
  if (select notification_retention_days from public.commercial_settings where tenant_id = v_tenant_a) <> 90 then
    raise exception 'notification_retention_days a change malgre le refus attendu';
  end if;
end;
$$;

reset role;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select actor_admin::text from e10_15a_context), 'role', 'authenticated')::text, true);

do $$
declare
  v_tenant_a uuid;
begin
  select tenant_a into v_tenant_a from e10_15a_context;

  -- L admin (derivation can_manage_notifications) reussit sur les TROIS
  -- champs de notification.
  update public.commercial_settings
     set notification_retention_days = 30,
         notification_sms_enabled = true,
         notification_sms_daily_cap = 50
   where tenant_id = v_tenant_a;

  if (
    select (notification_retention_days, notification_sms_enabled, notification_sms_daily_cap)
      from public.commercial_settings where tenant_id = v_tenant_a
  ) is distinct from (30, true, 50) then
    raise exception 'admin (derivation can_manage_notifications) n a pas pu modifier les trois reglages de notification';
  end if;
end;
$$;

reset role;

rollback;
