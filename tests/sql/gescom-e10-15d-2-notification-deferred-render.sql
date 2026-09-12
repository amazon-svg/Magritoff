-- ============================================================================
-- E10.15d-2 — rendu DIFFERE de `{{files.count}}`, scelle a la remise
-- (arbitrage architecte du 2026-09-12, §8.23 point 11 ; migration
-- `20260912000200_gescom_e10_15d_notification_deferred_render.sql`).
-- ----------------------------------------------------------------------------
-- Test COMPORTEMENTAL, execute par psql contre la base locale (meme lecon que
-- E10.15c : ces mecanismes vivent DANS la migration, une lecture de son texte
-- ne prouve pas qu ils se comportent correctement sous appel reel).
--
-- Scenarios EXIGES par §8.23 point 11.4 :
--   (a) le sceau passe sur pending -> sent, et ECHOUE sur sent -> sent.
--   (b) sent -> pending est REFUSE.
--   (c) une ligne RECLAMEE (attempts = 1) N ABSORBE PAS une occurrence — un
--       second message est cree.
--   (d) la tolerance template_id non nul -> null d E10.15c FONCTIONNE
--       TOUJOURS (supprimer une etape de production portant un modele
--       journalise) — NON-REGRESSION explicite apres la reecriture du
--       trigger par cette migration.
--   (e) le regroupement NOMINAL — cinq depots en dix minutes, UN message,
--       occurrence_count = 5.
--
-- Lancer : pnpm test:storefront:sql (necessite Supabase local demarre).
-- ============================================================================

begin;

create temporary table e10_15d2_context (
  tenant_a          uuid not null,
  actor_a           uuid not null,
  step_a_to         uuid not null,
  step_a_alt        uuid not null,
  template_files    uuid not null
);

grant select on e10_15d2_context to authenticated;

do $$
declare
  v_tenant_a uuid;
  v_actor_a uuid := gen_random_uuid();
  v_step_a_to uuid;
  v_step_a_alt uuid;
  v_template_files uuid;
begin
  insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
    values (v_actor_a, 'e10-15d2-actor-a@example.test', 'x', now(), now(), now(), 'authenticated', 'authenticated');

  insert into public.tenants (slug, name) values ('e10-15d2-tenant-a', 'E10.15d-2 Tenant A') returning id into v_tenant_a;

  insert into public.tenant_members (tenant_id, user_id, role, access_scope, allowed_shop_ids)
    values (v_tenant_a, v_actor_a, 'admin', 'magrit_full', '{}');

  select id into v_step_a_to from public.production_steps where tenant_id = v_tenant_a and position = 0;
  select id into v_step_a_alt from public.production_steps where tenant_id = v_tenant_a and position = 1;

  insert into public.notification_templates (
    tenant_id, event_name, channel, audience, name, subject, body, is_active
  ) values (
    v_tenant_a, 'order.files_submitted', 'email', 'customer', 'E10.15d-2 modele',
    'Fichiers reçus', 'Vous avez déposé {{files.count}} fichier(s) sur la commande {{order.number}}.', true
  ) returning id into v_template_files;

  insert into e10_15d2_context (tenant_a, actor_a, step_a_to, step_a_alt, template_files)
  values (v_tenant_a, v_actor_a, v_step_a_to, v_step_a_alt, v_template_files);
end;
$$;

-- ── (a) le sceau passe sur pending -> sent, ECHOUE sur sent -> sent ─────────
do $$
declare
  v_tenant_a uuid;
  v_template_files uuid;
  v_order_id uuid := gen_random_uuid();
  v_row public.notification_logs;
  v_rejected boolean := false;
begin
  select tenant_a, template_files into v_tenant_a, v_template_files from e10_15d2_context;

  set local role service_role;
  select * into v_row from public.api_enqueue_notification_message(
    v_tenant_a, gen_random_uuid(), 'order.files_submitted', 'order', v_order_id, v_template_files,
    'email', 'pending', 'sceau-ok@example.test', 'Fichiers reçus',
    'Vous avez déposé {{files.count}} fichier(s) sur la commande CDE-2026-00042.',
    null, 10,
    '{"subject": null, "body": [
        {"kind": "literal", "text": "Vous avez déposé "},
        {"kind": "tag", "id": "files.count"},
        {"kind": "literal", "text": " fichier(s) sur la commande CDE-2026-00042."}
      ]}'::jsonb
  );

  if v_row.deferred_render is null then
    raise exception 'scenario a (setup) : deferred_render aurait du etre non nul a l insertion';
  end if;
  if v_row.body not like '%{{files.count}}%' then
    raise exception 'scenario a (setup) : le corps provisoire aurait du laisser {{files.count}} EN CLAIR, obtenu %', v_row.body;
  end if;

  -- LE SCEAU : la MEME UPDATE qui pose status='sent' ecrit le texte final ET
  -- remet deferred_render a NULL — reproduit exactement NotificationSender.
  update public.notification_logs
     set status = 'sent',
         sent_at = now(),
         subject = 'Fichiers reçus',
         body = 'Vous avez déposé 1 fichier(s) sur la commande CDE-2026-00042.',
         deferred_render = null
   where id = v_row.id;

  if (select body from public.notification_logs where id = v_row.id) <> 'Vous avez déposé 1 fichier(s) sur la commande CDE-2026-00042.' then
    raise exception 'scenario a (MAJEUR) : le sceau aurait du ecrire le texte FINAL';
  end if;
  if (select deferred_render from public.notification_logs where id = v_row.id) is not null then
    raise exception 'scenario a (MAJEUR) : le sceau aurait du remettre deferred_render a NULL';
  end if;

  reset role;

  -- ECHOUE sur sent -> sent : old.status n est PLUS 'pending', la tolerance
  -- de scellement ne s applique donc plus — toute reecriture de subject/body
  -- est refusee, EXACTEMENT comme un message SANS rendu differe.
  begin
    update public.notification_logs set body = 'texte pirate apres envoi' where id = v_row.id;
  exception
    when insufficient_privilege then
      if sqlerrm like 'notification_logs_immutable:%' then v_rejected := true; end if;
  end;
  if not v_rejected then
    raise exception 'scenario a (MAJEUR) : un message deja sent a pu voir son corps reecrit une seconde fois';
  end if;

  raise notice 'scenario a (sceau pending->sent OK, sent->sent REFUSE) OK';
end;
$$;

-- ── (b) sent -> pending est REFUSE ──────────────────────────────────────────
do $$
declare
  v_tenant_a uuid;
  v_template_files uuid;
  v_id uuid;
  v_rejected boolean := false;
begin
  select tenant_a, template_files into v_tenant_a, v_template_files from e10_15d2_context;

  insert into public.notification_logs (tenant_id, event_id, event_name, aggregate_type, aggregate_id, template_id, channel, status, recipient, subject, body, sent_at)
  values (v_tenant_a, gen_random_uuid(), 'order.files_submitted', 'order', gen_random_uuid(), v_template_files, 'email', 'sent', 'deja-sent@example.test', 'Sujet', 'Corps envoye', now())
  returning id into v_id;

  begin
    update public.notification_logs set status = 'pending' where id = v_id;
  exception
    when insufficient_privilege then
      if sqlerrm like 'notification_logs_immutable:%' then v_rejected := true; end if;
  end;
  if not v_rejected then
    raise exception 'scenario b (MAJEUR) : un statut TERMINAL a pu redevenir pending — le sceau serait reouvrable';
  end if;

  raise notice 'scenario b (sent->pending REFUSE) OK';
end;
$$;

-- ── (c) une ligne RECLAMEE (attempts = 1) N ABSORBE PAS une occurrence ──────
do $$
declare
  v_tenant_a uuid;
  v_template_files uuid;
  v_order_id uuid := gen_random_uuid();
  v_row_1 public.notification_logs;
  v_row_2 public.notification_logs;
  v_n integer;
begin
  select tenant_a, template_files into v_tenant_a, v_template_files from e10_15d2_context;

  set local role service_role;

  select * into v_row_1 from public.api_enqueue_notification_message(
    v_tenant_a, gen_random_uuid(), 'order.files_submitted', 'order', v_order_id, v_template_files,
    'email', 'pending', 'reclame@example.test', null, 'Corps lot 1', null, 10, null
  );

  -- Simule la RECLAMATION par le drain d envoi : attempts passe a 1 (mutable,
  -- colonne de suivi), status reste pending (comme api_claim_notification_messages).
  update public.notification_logs set attempts = 1 where id = v_row_1.id;

  -- Un fait survient ENTRE la reclamation et l accuse de remise du
  -- prestataire : NE DOIT PAS etre absorbe dans v_row_1 (attempts=1 la sort
  -- du regroupement, index ET requete de la branche (b)).
  select * into v_row_2 from public.api_enqueue_notification_message(
    v_tenant_a, gen_random_uuid(), 'order.files_submitted', 'order', v_order_id, v_template_files,
    'email', 'pending', 'reclame@example.test', null, 'Corps lot 2', null, 10, null
  );

  if v_row_2.id = v_row_1.id then
    raise exception 'scenario c (MAJEUR, absorption silencieuse) : une occurrence survenue APRES la reclamation a ete fondue dans le message deja reclame (id=%)', v_row_1.id;
  end if;
  if v_row_2.occurrence_count <> 1 then
    raise exception 'scenario c (MAJEUR) : le second message aurait du naitre avec occurrence_count=1 (nouvelle fenetre), obtenu %', v_row_2.occurrence_count;
  end if;

  select count(*) into v_n from public.notification_logs
   where template_id = v_template_files and aggregate_id = v_order_id and status = 'pending';
  if v_n <> 2 then
    raise exception 'scenario c (MAJEUR) : deux lignes pending distinctes attendues (une reclamee, une neuve), obtenu %', v_n;
  end if;

  reset role;
  raise notice 'scenario c (ligne reclamee n absorbe pas une occurrence, nouveau message cree) OK';
end;
$$;

-- ── (d) NON-REGRESSION — tolerance template_id non nul -> null (cascade FK) ─
-- Reprend le scenario 8 de gescom-e10-15c-notification-dispatch.sql, REJOUE
-- ICI pour prouver que la REECRITURE du trigger par CETTE migration ne casse
-- pas la tolerance E10.15c (§8.23 point 11.4 §3, "conservee MOT POUR MOT").
do $$
declare
  v_tenant_a uuid;
  v_step_alt uuid;
  v_template_cascade uuid;
  v_log_id uuid;
begin
  select tenant_a, step_a_alt into v_tenant_a, v_step_alt from e10_15d2_context;

  insert into public.notification_templates (
    tenant_id, event_name, channel, audience, production_step_id, name, subject, body, is_active
  ) values (
    v_tenant_a, 'order.step_changed', 'email', 'customer', v_step_alt, 'E10.15d-2 modele cascade', 'Sujet', 'Corps', true
  ) returning id into v_template_cascade;

  set local role service_role;
  select id into v_log_id from public.api_enqueue_notification_message(
    v_tenant_a, gen_random_uuid(), 'order.step_changed', 'order', gen_random_uuid(), v_template_cascade,
    'email', 'pending', 'cascade@example.test', 'Sujet', 'Corps', null
  );
  reset role;

  -- La suppression de l etape NE DOIT PAS lever `notification_logs_immutable`.
  delete from public.production_steps where id = v_step_alt;

  if exists (select 1 from public.notification_templates where id = v_template_cascade) then
    raise exception 'scenario d (MAJEUR) : le modele aurait du etre emporte en cascade par la suppression de l etape';
  end if;
  if not exists (select 1 from public.notification_logs where id = v_log_id) then
    raise exception 'scenario d (MAJEUR) : l entree de journal aurait du SURVIVRE a la suppression du modele';
  end if;
  if (select template_id from public.notification_logs where id = v_log_id) is not null then
    raise exception 'scenario d (MAJEUR) : template_id aurait du passer a NULL (on delete set null), pas rester renseigne';
  end if;

  raise notice 'scenario d (NON-REGRESSION tolerance template_id, cascade FK) OK';
end;
$$;

-- ── (e) regroupement NOMINAL — cinq depots en dix minutes, UN message,
--        occurrence_count = 5 ───────────────────────────────────────────────
do $$
declare
  v_tenant_a uuid;
  v_template_files uuid;
  v_order_id uuid := gen_random_uuid();
  v_row public.notification_logs;
  v_n integer;
  i integer;
begin
  select tenant_a, template_files into v_tenant_a, v_template_files from e10_15d2_context;

  set local role service_role;

  for i in 1..5 loop
    select * into v_row from public.api_enqueue_notification_message(
      v_tenant_a, gen_random_uuid(), 'order.files_submitted', 'order', v_order_id, v_template_files,
      'email', 'pending', 'nominal@example.test', null, format('Corps depot %s', i), null, 10, null
    );
  end loop;

  if v_row.occurrence_count <> 5 then
    raise exception 'scenario e (MAJEUR) : occurrence_count attendu 5 apres cinq depots regroupes, obtenu %', v_row.occurrence_count;
  end if;
  if v_row.body <> 'Corps depot 1' then
    raise exception 'scenario e (MAJEUR) : le corps aurait du rester celui de la PREMIERE occurrence (immuabilite), obtenu %', v_row.body;
  end if;

  select count(*) into v_n from public.notification_logs
   where template_id = v_template_files and aggregate_id = v_order_id and status = 'pending';
  if v_n <> 1 then
    raise exception 'scenario e (MAJEUR) : UN SEUL message regroupe attendu pour les cinq depots, obtenu %', v_n;
  end if;

  reset role;
  raise notice 'scenario e (regroupement nominal, cinq depots -> un message, occurrence_count=5) OK';
end;
$$;

rollback;
