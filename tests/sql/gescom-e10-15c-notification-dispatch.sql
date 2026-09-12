-- ============================================================================
-- E10.15c — la chaine d envoi des notifications : table `notification_logs`
-- (RLS, immuabilite par trigger, non-DELETE-only comme outbox_events),
-- `api_enqueue_notification_message` (idempotence, regroupement CORRIGE
-- 2026-09-12 — §8.23 point 4, RECTIFICATIF D ARBITRAGE), `api_claim_notification_messages`
-- (reclamation atomique, backoff, rebut par fraicheur, exclusion des entrees
-- `dropped`), `purge_expired_notification_logs` (retention RGPD), privileges.
-- ----------------------------------------------------------------------------
-- Test COMPORTEMENTAL, execute par psql contre la base locale : ces
-- mecanismes vivent ENTIEREMENT dans la migration `20260912000100` — une
-- lecture de son texte ne prouve pas qu ils se comportent correctement sous
-- appel reel (meme lecon que E10.10b-3/E10.15a).
--
-- Scenarios :
--   1. RLS (lecture) — un tenant A ne lit JAMAIS les entrees d un tenant B
--      (etancheite inter-tenant, pas seulement la presence de la policy).
--   2. Immuabilite — `body`/`subject`/`recipient`/`event_id` ne sont pas
--      modifiables ; `status`/`attempts`/`occurrence_count` le sont ;
--      `DELETE` est TOUJOURS autorise (retention RGPD), y compris sur une
--      ligne encore `pending` (pas seulement `sent`) — contrairement a
--      `outbox_events`.
--   3. `api_enqueue_notification_message` — idempotence stricte (meme
--      `event_id`+`template_id`+destinataire -> aucune seconde ligne) ET
--      regroupement CORRIGE (§8.23 point 4) :
--        (a) deux DESTINATAIRES, meme modele, meme objet, fenetre 0 -> DEUX
--            lignes pending distinctes, occurrence_count = 1 chacune ;
--        (b) deux EVENEMENTS distincts, fenetre 0, MEME destinataire -> DEUX
--            lignes (preuve que M2/B1 sont corriges — la version d origine
--            absorbait silencieusement le second dans le compteur du
--            premier) ;
--        (c) deux evenements distincts, fenetre 10, MEME destinataire -> UNE
--            seule ligne, occurrence_count = 2, `next_attempt_at` INCHANGEE
--            entre les deux appels (jamais repoussee par une occurrence
--            supplementaire).
--   4. `api_claim_notification_messages` — reclamation atomique, rebut par
--      fraicheur (`status -> failed`), backoff a la reclamation, ET
--      EXCLUSION d une entree `dropped` (`recipient is null`) — jamais
--      reclamee, quel que soit `next_attempt_at`.
--   5. Privileges d execution — ni `anon` ni `authenticated` ne peuvent
--      executer `api_enqueue_notification_message`/`api_claim_notification_messages`
--      (`insufficient_privilege`) — `service_role` SEUL.
--   6. `purge_expired_notification_logs()` — comportement (supprime ce qui
--      depasse `notification_retention_days` DU TENANT, conserve le reste)
--      ET privileges (`service_role` SEUL, `anon`/`authenticated` refuses).
--   7. Ecriture directe REFUSEE — `authenticated` ne peut ni `insert`, ni
--      `update`, ni `delete` sur `notification_logs` (RLS/grants), alors
--      meme qu il PEUT lire ses propres entrees (scenario 1) : le scenario 1
--      ne prouve que la lecture, pas l ecriture.
--   8. Tolerance du trigger d immuabilite sur `template_id` : la suppression
--      d une etape de production emportant son modele en cascade (`on
--      delete cascade` sur `notification_templates.production_step_id`) doit
--      pouvoir `SET NULL` le `template_id` des entrees de journal qui le
--      citent (`on delete set null`) SANS faire echouer la cascade — a
--      PROUVER par l execution, pas a deduire de la lecture de la migration.
--
-- Lancer : pnpm test:storefront:sql (necessite Supabase local demarre).
-- ============================================================================

begin;

create temporary table e10_15c_context (
  tenant_a    uuid not null,
  tenant_b    uuid not null,
  actor_a     uuid not null,
  actor_b     uuid not null,
  step_a_to   uuid not null,
  step_a_alt  uuid not null,
  template_a  uuid not null
);

grant select on e10_15c_context to authenticated;

do $$
declare
  v_tenant_a uuid;
  v_tenant_b uuid;
  v_actor_a uuid := gen_random_uuid();
  v_actor_b uuid := gen_random_uuid();
  v_step_a_to uuid;
  v_step_a_alt uuid;
  v_template_a uuid;
begin
  insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
    values
      (v_actor_a, 'e10-15c-actor-a@example.test', 'x', now(), now(), now(), 'authenticated', 'authenticated'),
      (v_actor_b, 'e10-15c-actor-b@example.test', 'x', now(), now(), now(), 'authenticated', 'authenticated');

  insert into public.tenants (slug, name) values ('e10-15c-tenant-a', 'E10.15c Tenant A') returning id into v_tenant_a;
  insert into public.tenants (slug, name) values ('e10-15c-tenant-b', 'E10.15c Tenant B') returning id into v_tenant_b;

  insert into public.tenant_members (tenant_id, user_id, role, access_scope, allowed_shop_ids)
    values (v_tenant_a, v_actor_a, 'admin', 'magrit_full', '{}');
  insert into public.tenant_members (tenant_id, user_id, role, access_scope, allowed_shop_ids)
    values (v_tenant_b, v_actor_b, 'admin', 'magrit_full', '{}');

  select id into v_step_a_to from public.production_steps where tenant_id = v_tenant_a and position = 0;
  select id into v_step_a_alt from public.production_steps where tenant_id = v_tenant_a and position = 1;

  insert into public.notification_templates (
    tenant_id, event_name, channel, audience, name, subject, body, is_active
  ) values (
    v_tenant_a, 'order.step_changed', 'email', 'customer', 'E10.15c modele', 'Sujet', 'Corps {{step.label}}', true
  ) returning id into v_template_a;

  insert into e10_15c_context (tenant_a, tenant_b, actor_a, actor_b, step_a_to, step_a_alt, template_a)
  values (v_tenant_a, v_tenant_b, v_actor_a, v_actor_b, v_step_a_to, v_step_a_alt, v_template_a);
end;
$$;

-- ── 1 — RLS (lecture) : etancheite inter-tenant ─────────────────────────────
do $$
declare
  v_tenant_a uuid;
  v_tenant_b uuid;
begin
  select tenant_a, tenant_b into v_tenant_a, v_tenant_b from e10_15c_context;

  insert into public.notification_logs (tenant_id, event_id, event_name, aggregate_type, aggregate_id, channel, status, recipient, subject, body)
  values (v_tenant_a, gen_random_uuid(), 'order.step_changed', 'order', gen_random_uuid(), 'email', 'pending', 'a@example.test', 'Sujet A', 'Corps A');
  insert into public.notification_logs (tenant_id, event_id, event_name, aggregate_type, aggregate_id, channel, status, recipient, subject, body)
  values (v_tenant_b, gen_random_uuid(), 'order.step_changed', 'order', gen_random_uuid(), 'email', 'pending', 'b@example.test', 'Sujet B', 'Corps B');
end;
$$;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select actor_a::text from e10_15c_context), 'role', 'authenticated')::text, true);

do $$
declare
  v_n integer;
  v_other_seen integer;
begin
  select count(*) into v_n from public.notification_logs where tenant_id = (select tenant_a from e10_15c_context);
  if v_n <> 1 then
    raise exception 'scenario 1 : tenant A devrait voir exactement 1 entree, obtenu %', v_n;
  end if;

  select count(*) into v_other_seen from public.notification_logs where tenant_id = (select tenant_b from e10_15c_context);
  if v_other_seen <> 0 then
    raise exception 'scenario 1 (MAJEUR) : tenant A a pu lire % entree(s) du tenant B', v_other_seen;
  end if;

  raise notice 'scenario 1 (RLS, etancheite inter-tenant) OK';
end;
$$;

reset role;

-- ── 2 — Immuabilite (trigger), DELETE toujours autorise (pending compris) ──
do $$
declare
  v_id uuid;
  v_tenant_a uuid;
  v_rejected boolean := false;
begin
  select tenant_a into v_tenant_a from e10_15c_context;
  select id into v_id from public.notification_logs where tenant_id = v_tenant_a limit 1;

  -- Colonnes de suivi : mutables.
  update public.notification_logs set status = 'sent', sent_at = now(), attempts = 1, occurrence_count = 2 where id = v_id;
  if (select status from public.notification_logs where id = v_id) <> 'sent' then
    raise exception 'scenario 2 : status aurait du etre mutable';
  end if;

  -- Contenu metier : immuable (body).
  begin
    update public.notification_logs set body = 'hack' where id = v_id;
  exception
    when insufficient_privilege then
      if sqlerrm like 'notification_logs_immutable:%' then v_rejected := true; end if;
  end;
  if not v_rejected then
    raise exception 'scenario 2 (MAJEUR) : le corps d une notification a pu etre modifie apres insertion';
  end if;

  -- Contenu metier : immuable (recipient).
  v_rejected := false;
  begin
    update public.notification_logs set recipient = 'hack@example.test' where id = v_id;
  exception
    when insufficient_privilege then
      if sqlerrm like 'notification_logs_immutable:%' then v_rejected := true; end if;
  end;
  if not v_rejected then
    raise exception 'scenario 2 (MAJEUR) : le destinataire d une notification a pu etre modifie apres insertion';
  end if;

  -- Contenu metier : immuable (subject) — TROU COMBLE (qa-review M1).
  v_rejected := false;
  begin
    update public.notification_logs set subject = 'Sujet pirate' where id = v_id;
  exception
    when insufficient_privilege then
      if sqlerrm like 'notification_logs_immutable:%' then v_rejected := true; end if;
  end;
  if not v_rejected then
    raise exception 'scenario 2 (MAJEUR) : le sujet d une notification a pu etre modifie apres insertion';
  end if;

  -- DELETE toujours autorise (retention RGPD), CONTRAIREMENT a outbox_events —
  -- sur une ligne `sent`.
  delete from public.notification_logs where id = v_id;
  if exists (select 1 from public.notification_logs where id = v_id) then
    raise exception 'scenario 2 : DELETE aurait du etre accepte sur une ligne sent (retention RGPD)';
  end if;

  -- DELETE d une ligne encore `pending` — TROU COMBLE (qa-review M1) : c est
  -- exactement ce que fait la purge de retention en usage reel (une ligne
  -- n a aucune raison d avoir ete envoyee avant d etre purgee).
  insert into public.notification_logs (tenant_id, event_id, event_name, aggregate_type, aggregate_id, channel, status, recipient, subject, body)
  values (v_tenant_a, gen_random_uuid(), 'order.step_changed', 'order', gen_random_uuid(), 'email', 'pending', 'pending-delete@example.test', 'Sujet', 'Corps')
  returning id into v_id;
  delete from public.notification_logs where id = v_id;
  if exists (select 1 from public.notification_logs where id = v_id) then
    raise exception 'scenario 2 (MAJEUR) : DELETE aurait du etre accepte sur une ligne PENDING (retention RGPD)';
  end if;

  raise notice 'scenario 2 (immuabilite + DELETE toujours autorise, pending compris) OK';
end;
$$;

-- ── 3 — api_enqueue_notification_message : idempotence + regroupement ──────
-- CORRIGE 2026-09-12 (§8.23 point 4, RECTIFICATIF D ARBITRAGE) : les trois
-- scenarios (a)/(b)/(c) exigés par l architecte, en sus de l idempotence.
do $$
declare
  v_tenant_a uuid;
  v_template_a uuid;
  v_order_id uuid := gen_random_uuid();
  v_event_1 uuid := gen_random_uuid();
  v_row_1 public.notification_logs;
  v_row_1_replay public.notification_logs;
  v_n integer;
begin
  select tenant_a, template_a into v_tenant_a, v_template_a from e10_15c_context;

  set local role service_role;

  select * into v_row_1 from public.api_enqueue_notification_message(
    v_tenant_a, v_event_1, 'order.step_changed', 'order', v_order_id, v_template_a,
    'email', 'pending', 'client@example.test', 'Sujet', 'Corps etape 1', null
  );

  -- Idempotence : meme evenement, meme modele, meme destinataire -> AUCUNE
  -- seconde ligne, la meme est rendue.
  select * into v_row_1_replay from public.api_enqueue_notification_message(
    v_tenant_a, v_event_1, 'order.step_changed', 'order', v_order_id, v_template_a,
    'email', 'pending', 'client@example.test', 'Sujet', 'Corps etape 1 (rejeu, ignore)', null
  );
  if v_row_1_replay.id <> v_row_1.id then
    raise exception 'scenario 3 (idempotence) : le rejeu aurait du rendre la MEME ligne (id=%, rejeu=%)', v_row_1.id, v_row_1_replay.id;
  end if;
  select count(*) into v_n from public.notification_logs where event_id = v_event_1 and template_id = v_template_a;
  if v_n <> 1 then
    raise exception 'scenario 3 (idempotence, MAJEUR) : le rejeu a cree une seconde ligne (n=%)', v_n;
  end if;

  -- Entree DROPPED (aucun destinataire) : recipient NULL accepte, distincte
  -- de la ligne pending ci-dessus (coalesce(recipient,'') differe).
  perform public.api_enqueue_notification_message(
    v_tenant_a, gen_random_uuid(), 'order.step_changed', 'order', v_order_id, v_template_a,
    'email', 'dropped', null, null, 'Corps sans destinataire', 'notification.no_recipient: test'
  );
  select count(*) into v_n from public.notification_logs where template_id = v_template_a and aggregate_id = v_order_id and status = 'dropped';
  if v_n <> 1 then
    raise exception 'scenario 3 (dropped) : une entree dropped aurait du etre creee (n=%)', v_n;
  end if;

  reset role;
  raise notice 'scenario 3 (idempotence + dropped) OK';
end;
$$;

-- (a) deux DESTINATAIRES, meme modele, meme objet metier, fenetre 0 -> DEUX
-- lignes pending DISTINCTES, occurrence_count = 1 chacune. Preuve que la cle
-- de regroupement porte desormais le destinataire (B1).
do $$
declare
  v_tenant_a uuid;
  v_template_a uuid;
  v_order_id uuid := gen_random_uuid();
  v_event uuid := gen_random_uuid();
  v_row_r1 public.notification_logs;
  v_row_r2 public.notification_logs;
  v_n integer;
begin
  select tenant_a, template_a into v_tenant_a, v_template_a from e10_15c_context;
  set local role service_role;

  select * into v_row_r1 from public.api_enqueue_notification_message(
    v_tenant_a, v_event, 'order.step_changed', 'order', v_order_id, v_template_a,
    'email', 'pending', 'destinataire-1@example.test', 'Sujet', 'Corps', null
  );
  select * into v_row_r2 from public.api_enqueue_notification_message(
    v_tenant_a, v_event, 'order.step_changed', 'order', v_order_id, v_template_a,
    'email', 'pending', 'destinataire-2@example.test', 'Sujet', 'Corps', null
  );

  if v_row_r1.id = v_row_r2.id then
    raise exception 'scenario 3a (MAJEUR, B1) : deux destinataires distincts auraient du recevoir DEUX lignes, obtenu UNE seule (id=%)', v_row_r1.id;
  end if;
  if v_row_r1.occurrence_count <> 1 or v_row_r2.occurrence_count <> 1 then
    raise exception 'scenario 3a (MAJEUR, B1) : occurrence_count attendu 1 pour chaque destinataire, obtenu % et %', v_row_r1.occurrence_count, v_row_r2.occurrence_count;
  end if;

  select count(*) into v_n from public.notification_logs where template_id = v_template_a and aggregate_id = v_order_id and status = 'pending';
  if v_n <> 2 then
    raise exception 'scenario 3a (MAJEUR, B1) : deux lignes pending distinctes attendues, obtenu %', v_n;
  end if;

  reset role;
  raise notice 'scenario 3a (deux destinataires, fenetre 0 -> deux lignes distinctes) OK';
end;
$$;

-- (b) deux EVENEMENTS distincts, fenetre 0, MEME destinataire -> DEUX lignes.
-- Preuve que M2 est corrige : la version d origine, sans le predicat
-- `coalescing_window_minutes > 0`, aurait FUSIONNE ces deux evenements en un
-- seul message dont le corps (immuable) aurait menti sur l etat reel.
do $$
declare
  v_tenant_a uuid;
  v_template_a uuid;
  v_order_id uuid := gen_random_uuid();
  v_event_1 uuid := gen_random_uuid();
  v_event_2 uuid := gen_random_uuid();
  v_row_1 public.notification_logs;
  v_row_2 public.notification_logs;
  v_n integer;
begin
  select tenant_a, template_a into v_tenant_a, v_template_a from e10_15c_context;
  set local role service_role;

  select * into v_row_1 from public.api_enqueue_notification_message(
    v_tenant_a, v_event_1, 'order.step_changed', 'order', v_order_id, v_template_a,
    'email', 'pending', 'meme-destinataire@example.test', 'Sujet etape 1', 'Corps etape 1', null
  );
  select * into v_row_2 from public.api_enqueue_notification_message(
    v_tenant_a, v_event_2, 'order.step_changed', 'order', v_order_id, v_template_a,
    'email', 'pending', 'meme-destinataire@example.test', 'Sujet etape 2', 'Corps etape 2', null
  );

  if v_row_1.id = v_row_2.id then
    raise exception 'scenario 3b (MAJEUR, M2) : fenetre 0 -> deux evenements auraient du produire DEUX lignes, obtenu UNE seule (id=%) — le message mentirait sur l etat reel', v_row_1.id;
  end if;
  if v_row_1.occurrence_count <> 1 or v_row_2.occurrence_count <> 1 then
    raise exception 'scenario 3b (MAJEUR, M2) : occurrence_count attendu 1 pour chaque ligne (fenetre 0 = aucun regroupement), obtenu % et %', v_row_1.occurrence_count, v_row_2.occurrence_count;
  end if;
  if v_row_2.body <> 'Corps etape 2' then
    raise exception 'scenario 3b (MAJEUR) : le corps de la seconde ligne aurait du etre le SIEN (fenetre 0), obtenu %', v_row_2.body;
  end if;

  select count(*) into v_n from public.notification_logs where template_id = v_template_a and aggregate_id = v_order_id and status = 'pending';
  if v_n <> 2 then
    raise exception 'scenario 3b (MAJEUR, M2) : deux lignes pending distinctes attendues, obtenu %', v_n;
  end if;

  reset role;
  raise notice 'scenario 3b (deux evenements, fenetre 0, meme destinataire -> deux lignes) OK';
end;
$$;

-- (c) deux EVENEMENTS distincts, fenetre 10, MEME destinataire -> UNE seule
-- ligne, occurrence_count = 2, next_attempt_at INCHANGEE entre les deux
-- appels (jamais repoussee par une occurrence supplementaire, contrat).
do $$
declare
  v_tenant_a uuid;
  v_template_a uuid;
  v_order_id uuid := gen_random_uuid();
  v_event_1 uuid := gen_random_uuid();
  v_event_2 uuid := gen_random_uuid();
  v_row_1 public.notification_logs;
  v_row_2 public.notification_logs;
  v_n integer;
begin
  select tenant_a, template_a into v_tenant_a, v_template_a from e10_15c_context;
  set local role service_role;

  select * into v_row_1 from public.api_enqueue_notification_message(
    v_tenant_a, v_event_1, 'order.files_submitted', 'order', v_order_id, v_template_a,
    'email', 'pending', 'meme-destinataire-groupe@example.test', null, 'Corps lot 1', null, 10
  );
  select * into v_row_2 from public.api_enqueue_notification_message(
    v_tenant_a, v_event_2, 'order.files_submitted', 'order', v_order_id, v_template_a,
    'email', 'pending', 'meme-destinataire-groupe@example.test', null, 'Corps lot 2', null, 10
  );

  if v_row_2.id <> v_row_1.id then
    raise exception 'scenario 3c (MAJEUR) : fenetre 10 -> le second evenement aurait du REGROUPER, pas creer une ligne (id=%, second=%)', v_row_1.id, v_row_2.id;
  end if;
  if v_row_2.occurrence_count <> 2 then
    raise exception 'scenario 3c : occurrence_count attendu 2, obtenu %', v_row_2.occurrence_count;
  end if;
  if v_row_2.body <> 'Corps lot 1' then
    raise exception 'scenario 3c (MAJEUR) : le corps aurait du rester celui de la PREMIERE occurrence (immuabilite), obtenu %', v_row_2.body;
  end if;
  if v_row_2.next_attempt_at <> v_row_1.next_attempt_at then
    raise exception 'scenario 3c (MAJEUR) : next_attempt_at ne doit JAMAIS etre repoussee par une occurrence supplementaire (premier=%, second=%)', v_row_1.next_attempt_at, v_row_2.next_attempt_at;
  end if;

  select count(*) into v_n from public.notification_logs where template_id = v_template_a and aggregate_id = v_order_id and status = 'pending';
  if v_n <> 1 then
    raise exception 'scenario 3c (MAJEUR) : une seule ligne pending attendue (fenetre active), obtenu %', v_n;
  end if;

  reset role;
  raise notice 'scenario 3c (deux evenements, fenetre 10, meme destinataire -> une ligne regroupee, next_attempt_at inchangee) OK';
end;
$$;

-- ── 4 — api_claim_notification_messages : reclamation, rebut, backoff,
--        exclusion des entrees dropped ────────────────────────────────────
do $$
declare
  v_tenant_a uuid;
  v_template_a uuid;
  v_fresh uuid;
  v_stale uuid;
  v_dropped uuid;
  v_n integer;
  v_attempts integer;
begin
  select tenant_a, template_a into v_tenant_a, v_template_a from e10_15c_context;

  -- Purge du RESIDU des scenarios de regroupement (3/3a/3b/3c) : ce sont
  -- des lignes `pending` LEGITIMES, mais `api_claim_notification_messages`
  -- n a pas de filtre par tenant (c est un drain GLOBAL) — les laisser
  -- trainer fausserait le compte de CE scenario. Deja assertees plus haut,
  -- les repousser ici (attempts incremente) est sans consequence.
  set local role service_role;
  perform public.api_claim_notification_messages(1000, 5, interval '24 hours');
  reset role;

  insert into public.notification_logs (tenant_id, event_id, event_name, aggregate_type, aggregate_id, template_id, channel, status, recipient, subject, body, created_at)
  values (v_tenant_a, gen_random_uuid(), 'order.step_changed', 'order', gen_random_uuid(), v_template_a, 'email', 'pending', 'fresh@example.test', 'Sujet', 'Corps', now() - interval '10 minutes')
  returning id into v_fresh;

  -- 48h > p_max_age par defaut (24h) : doit etre rebute au premier tour.
  insert into public.notification_logs (tenant_id, event_id, event_name, aggregate_type, aggregate_id, template_id, channel, status, recipient, subject, body, created_at)
  values (v_tenant_a, gen_random_uuid(), 'order.step_changed', 'order', gen_random_uuid(), v_template_a, 'email', 'pending', 'stale@example.test', 'Sujet', 'Corps', now() - interval '48 hours')
  returning id into v_stale;

  -- dropped : recipient NULL, NE DOIT JAMAIS etre reclame.
  insert into public.notification_logs (tenant_id, event_id, event_name, aggregate_type, aggregate_id, template_id, channel, status, recipient, subject, body, created_at)
  values (v_tenant_a, gen_random_uuid(), 'order.step_changed', 'order', gen_random_uuid(), v_template_a, 'email', 'dropped', null, null, 'Corps', now() - interval '10 minutes')
  returning id into v_dropped;

  set local role service_role;

  select count(*) into v_n from public.api_claim_notification_messages(10, 5, interval '24 hours');
  if v_n <> 1 then
    raise exception 'scenario 4 : attendu 1 ligne reclamee (la fraiche), obtenu %', v_n;
  end if;

  select attempts into v_attempts from public.notification_logs where id = v_fresh;
  if v_attempts <> 1 then
    raise exception 'scenario 4 : attempts du message frais attendu 1, obtenu %', v_attempts;
  end if;

  if (select status from public.notification_logs where id = v_stale) <> 'failed' then
    raise exception 'scenario 4 (MAJEUR) : le message trop vieux aurait du etre rebute (status=failed)';
  end if;
  if (select attempts from public.notification_logs where id = v_stale) <> 5 then
    raise exception 'scenario 4 : attempts du message rebute attendu 5, obtenu %', (select attempts from public.notification_logs where id = v_stale);
  end if;

  if (select status from public.notification_logs where id = v_dropped) <> 'dropped' then
    raise exception 'scenario 4 (MAJEUR) : l entree dropped n aurait jamais du etre touchee par la reclamation';
  end if;

  -- Reclamation IMMEDIATE d un second lot : rien n est rendu (next_attempt_at
  -- repousse par la reclamation precedente).
  select count(*) into v_n from public.api_claim_notification_messages(10, 5, interval '24 hours');
  if v_n <> 0 then
    raise exception 'scenario 4 : une seconde reclamation immediate n aurait rien du rendre, obtenu %', v_n;
  end if;

  reset role;
  raise notice 'scenario 4 (reclamation, rebut, backoff, exclusion dropped) OK';
end;
$$;

-- ── 5 — privileges d execution : anon/authenticated refuses ────────────────
do $$
declare
  v_denied boolean := false;
begin
  begin
    set local role authenticated;
    perform 1 from public.api_claim_notification_messages(1, 5, interval '24 hours');
  exception
    when insufficient_privilege then v_denied := true;
  end;
  reset role;
  if not v_denied then
    raise exception 'scenario 5 : authenticated a pu executer api_claim_notification_messages';
  end if;
end;
$$;

do $$
declare
  v_denied boolean := false;
begin
  begin
    set local role anon;
    perform 1 from public.api_claim_notification_messages(1, 5, interval '24 hours');
  exception
    when insufficient_privilege then v_denied := true;
  end;
  reset role;
  if not v_denied then
    raise exception 'scenario 5 : anon a pu executer api_claim_notification_messages';
  end if;
end;
$$;

do $$
declare
  v_denied boolean := false;
  v_tenant_a uuid;
  v_template_a uuid;
begin
  select tenant_a, template_a into v_tenant_a, v_template_a from e10_15c_context;
  begin
    set local role authenticated;
    perform public.api_enqueue_notification_message(
      v_tenant_a, gen_random_uuid(), 'order.step_changed', 'order', gen_random_uuid(), v_template_a,
      'email', 'pending', 'x@example.test', 'S', 'B', null
    );
  exception
    when insufficient_privilege then v_denied := true;
  end;
  reset role;
  if not v_denied then
    raise exception 'scenario 5 : authenticated a pu executer api_enqueue_notification_message';
  end if;
  raise notice 'scenario 5 (privileges d execution) OK';
end;
$$;

-- ── 6 — purge_expired_notification_logs() : comportement + privileges ──────
do $$
declare
  v_tenant_a uuid;
  v_old uuid;
  v_fresh uuid;
  v_deleted integer;
  v_denied boolean := false;
begin
  select tenant_a into v_tenant_a from e10_15c_context;

  insert into public.commercial_settings (tenant_id) values (v_tenant_a)
    on conflict (tenant_id) do nothing;
  -- Retention par defaut : 90 jours (E10.15a).

  -- Depasse la retention (90 j par defaut) : doit etre PURGEE.
  insert into public.notification_logs (tenant_id, event_id, event_name, aggregate_type, aggregate_id, channel, status, recipient, subject, body, created_at)
  values (v_tenant_a, gen_random_uuid(), 'order.step_changed', 'order', gen_random_uuid(), 'email', 'sent', 'vieux@example.test', 'Sujet', 'Corps', now() - interval '100 days')
  returning id into v_old;

  -- DANS la retention : doit SURVIVRE.
  insert into public.notification_logs (tenant_id, event_id, event_name, aggregate_type, aggregate_id, channel, status, recipient, subject, body, created_at)
  values (v_tenant_a, gen_random_uuid(), 'order.step_changed', 'order', gen_random_uuid(), 'email', 'sent', 'recent@example.test', 'Sujet', 'Corps', now() - interval '10 days')
  returning id into v_fresh;

  -- Privileges : anon/authenticated refuses, service_role SEUL.
  begin
    set local role authenticated;
    perform public.purge_expired_notification_logs();
  exception
    when insufficient_privilege then v_denied := true;
  end;
  reset role;
  if not v_denied then
    raise exception 'scenario 6 (MAJEUR) : authenticated a pu executer purge_expired_notification_logs';
  end if;

  v_denied := false;
  begin
    set local role anon;
    perform public.purge_expired_notification_logs();
  exception
    when insufficient_privilege then v_denied := true;
  end;
  reset role;
  if not v_denied then
    raise exception 'scenario 6 (MAJEUR) : anon a pu executer purge_expired_notification_logs';
  end if;

  -- Comportement, service_role.
  set local role service_role;
  select public.purge_expired_notification_logs() into v_deleted;
  reset role;

  if v_deleted < 1 then
    raise exception 'scenario 6 : au moins 1 ligne aurait du etre purgee, obtenu %', v_deleted;
  end if;
  if exists (select 1 from public.notification_logs where id = v_old) then
    raise exception 'scenario 6 (MAJEUR) : la ligne au-dela de la retention aurait du etre purgee';
  end if;
  if not exists (select 1 from public.notification_logs where id = v_fresh) then
    raise exception 'scenario 6 (MAJEUR) : la ligne DANS la retention n aurait pas du etre touchee';
  end if;

  raise notice 'scenario 6 (purge_expired_notification_logs : comportement + privileges) OK';
end;
$$;

-- ── 7 — ecriture DIRECTE refusee a authenticated (insert/update/delete) ────
-- Le scenario 1 ne prouve que la LECTURE ; celui-ci prouve l ECRITURE.
do $$
declare
  v_tenant_a uuid;
  v_template_a uuid;
  v_id uuid;
  v_denied boolean := false;
begin
  select tenant_a, template_a into v_tenant_a, v_template_a from e10_15c_context;
  -- `request.jwt.claims` (actor_a, tenant_a) est DEJA pose pour toute la
  -- transaction depuis le scenario 1 (`is_local = true` -> valable jusqu au
  -- ROLLBACK final, pas seulement le temps d une commande) : rien a refaire.

  -- INSERT.
  begin
    set local role authenticated;
    insert into public.notification_logs (tenant_id, event_id, event_name, aggregate_type, aggregate_id, channel, status, recipient, subject, body)
    values (v_tenant_a, gen_random_uuid(), 'order.step_changed', 'order', gen_random_uuid(), 'email', 'pending', 'x@example.test', 'S', 'B');
  exception
    when insufficient_privilege then v_denied := true;
  end;
  reset role;
  if not v_denied then
    raise exception 'scenario 7 (MAJEUR) : authenticated a pu INSERT sur notification_logs';
  end if;

  -- UPDATE, sur une ligne LISIBLE (meme tenant).
  select id into v_id from public.notification_logs where tenant_id = v_tenant_a limit 1;
  v_denied := false;
  begin
    set local role authenticated;
    update public.notification_logs set status = 'failed' where id = v_id;
  exception
    when insufficient_privilege then v_denied := true;
  end;
  reset role;
  if not v_denied then
    raise exception 'scenario 7 (MAJEUR) : authenticated a pu UPDATE une entree lisible de notification_logs';
  end if;

  -- DELETE, meme ligne.
  v_denied := false;
  begin
    set local role authenticated;
    delete from public.notification_logs where id = v_id;
  exception
    when insufficient_privilege then v_denied := true;
  end;
  reset role;
  if not v_denied then
    raise exception 'scenario 7 (MAJEUR) : authenticated a pu DELETE une entree lisible de notification_logs';
  end if;

  raise notice 'scenario 7 (ecriture directe refusee a authenticated) OK';
end;
$$;

-- ── 8 — tolerance du trigger sur template_id (cascade FK) ───────────────────
-- Suppression d une etape de production emportant son modele en CASCADE
-- (`notification_templates.production_step_id ... on delete cascade`), qui
-- doit a son tour SET NULL le template_id des entrees de journal qui le
-- citent (`notification_logs.template_id ... on delete set null`) SANS
-- faire echouer la cascade — arbitrage §8.23 point 4, A PROUVER PAR
-- L EXECUTION.
do $$
declare
  v_tenant_a uuid;
  v_step_alt uuid;
  v_template_cascade uuid;
  v_log_id uuid;
begin
  select tenant_a, step_a_alt into v_tenant_a, v_step_alt from e10_15c_context;

  insert into public.notification_templates (
    tenant_id, event_name, channel, audience, production_step_id, name, subject, body, is_active
  ) values (
    v_tenant_a, 'order.step_changed', 'email', 'customer', v_step_alt, 'E10.15c modele cascade', 'Sujet', 'Corps', true
  ) returning id into v_template_cascade;

  set local role service_role;
  select id into v_log_id from public.api_enqueue_notification_message(
    v_tenant_a, gen_random_uuid(), 'order.step_changed', 'order', gen_random_uuid(), v_template_cascade,
    'email', 'pending', 'cascade@example.test', 'Sujet', 'Corps', null
  );
  reset role;

  -- La suppression de l etape NE DOIT PAS lever
  -- `notification_logs_immutable` — c est exactement ce que le correctif
  -- du 2026-09-12 rend possible.
  delete from public.production_steps where id = v_step_alt;

  if exists (select 1 from public.notification_templates where id = v_template_cascade) then
    raise exception 'scenario 8 (MAJEUR) : le modele aurait du etre emporte en cascade par la suppression de l etape';
  end if;
  if not exists (select 1 from public.notification_logs where id = v_log_id) then
    raise exception 'scenario 8 (MAJEUR) : l entree de journal aurait du SURVIVRE a la suppression du modele';
  end if;
  if (select template_id from public.notification_logs where id = v_log_id) is not null then
    raise exception 'scenario 8 (MAJEUR) : template_id aurait du passer a NULL (on delete set null), pas rester renseigne';
  end if;
  if (select recipient from public.notification_logs where id = v_log_id) <> 'cascade@example.test' then
    raise exception 'scenario 8 : le reste de la ligne (recipient) n aurait pas du etre affecte par la cascade';
  end if;

  raise notice 'scenario 8 (tolerance du trigger sur template_id, cascade FK) OK';
end;
$$;

rollback;
