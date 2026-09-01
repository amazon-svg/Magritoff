-- ============================================================================
-- E10.0 CA10 — outbox_events : append-only et isolation par tenant.
-- ----------------------------------------------------------------------------
-- Test COMPORTEMENTAL, execute par psql contre la base locale. Il remplace une
-- assertion textuelle sur le fichier de migration, qui ne pouvait pas echouer :
-- une migration ne change jamais apres coup, donc un `toContain()` sur son
-- texte ne detecte aucune regression. Un futur `drop trigger` ou un `grant
-- update` accorde par erreur passait inapercu.
--
-- Scenarios :
--   1. Un evenement s insere normalement.
--   2. UPDATE du payload -> refuse (42501), le contenu metier est immuable.
--   3. UPDATE du suivi de livraison -> accepte, c est la seule mutation prevue.
--   4. DELETE d une ligne NON publiee -> refuse (42501), on perdrait l evenement.
--   5. DELETE d une ligne publiee -> accepte, la purge reste possible.
--   6. Un membre du tenant B ne lit aucune ligne du tenant A (policy RLS).
--   7. Le role `authenticated` n a aucun privilege direct sur la table.
--
-- Lancer : pnpm test:storefront:sql (necessite Supabase local demarre).
-- ============================================================================

begin;

create temporary table gescom_outbox_context (
  actor_id uuid not null,
  tenant_a uuid not null,
  tenant_b uuid not null,
  event_pending uuid not null,
  event_published uuid not null
);

grant select on gescom_outbox_context to authenticated;

do $$
declare
  v_actor uuid;
  v_tenant_a uuid;
  v_tenant_b uuid;
  v_pending uuid;
  v_published uuid;
begin
  -- L acteur ne doit PAS etre super-admin : `is_super_admin()` court-circuite
  -- la policy de lecture et rendrait l assertion d isolation vide de sens.
  select u.id into v_actor
    from auth.users u
   where not exists (
     select 1
       from public.tenant_members tm
       join public.tenants t on t.id = tm.tenant_id
      where tm.user_id = u.id
        and t.is_system_tenant = true
        and tm.role in ('owner', 'admin')
   )
   order by u.created_at
   limit 1;

  if v_actor is null then
    raise exception
      'Un utilisateur Auth non super-admin est requis pour le scenario E10.0';
  end if;

  insert into public.tenants (slug, name)
  values ('e10-outbox-a', 'E10 Outbox Tenant A')
  returning id into v_tenant_a;

  insert into public.tenants (slug, name)
  values ('e10-outbox-b', 'E10 Outbox Tenant B')
  returning id into v_tenant_b;

  -- L acteur n est membre QUE du tenant B : il ne doit rien voir du tenant A.
  -- Tenant A n a pas de parent, donc aucun acces descendant ne le rattrape.
  insert into public.tenant_members (tenant_id, user_id, role, access_scope, allowed_shop_ids)
  values (v_tenant_b, v_actor, 'owner', 'magrit_full', '{}');

  insert into public.outbox_events (
    tenant_id, event_name, event_version, aggregate_type, aggregate_id, payload
  ) values (
    v_tenant_a,
    'quote.converted',
    1,
    'quote',
    gen_random_uuid(),
    jsonb_build_object('quote_number', 'DEV-2026-00042', 'total_ht', '1234.50')
  ) returning id into v_pending;

  insert into public.outbox_events (
    tenant_id, event_name, event_version, aggregate_type, aggregate_id, payload, published_at
  ) values (
    v_tenant_a,
    'price_rule.changed',
    1,
    'price_rule',
    gen_random_uuid(),
    jsonb_build_object('rule_id', gen_random_uuid()),
    now()
  ) returning id into v_published;

  -- Temoin du tenant B, insere ici car aucune policy n autorise un role client
  -- a ecrire dans l outbox : l ecriture est le fait du service, jamais du client.
  insert into public.outbox_events (
    tenant_id, event_name, aggregate_type, aggregate_id, payload
  ) values (v_tenant_b, 'customer.created', 'customer', gen_random_uuid(), '{}'::jsonb);

  insert into gescom_outbox_context (
    actor_id, tenant_a, tenant_b, event_pending, event_published
  ) values (v_actor, v_tenant_a, v_tenant_b, v_pending, v_published);
end;
$$;

-- ── Contraintes de forme : un nom d evenement hors convention est refuse ────
do $$
declare
  v_tenant uuid;
  v_rejected boolean := false;
begin
  select tenant_a into v_tenant from gescom_outbox_context;

  begin
    insert into public.outbox_events (tenant_id, event_name, aggregate_type, aggregate_id, payload)
    values (v_tenant, 'QuoteConverted', 'quote', gen_random_uuid(), '{}'::jsonb);
  exception
    when check_violation then v_rejected := true;
  end;

  if not v_rejected then
    raise exception 'Un event_name hors convention snake_case a ete accepte';
  end if;
end;
$$;

-- ── Append-only : le contenu metier est immuable ───────────────────────────
do $$
declare
  v_pending uuid;
  v_published uuid;
  v_rejected boolean := false;
begin
  select event_pending, event_published into v_pending, v_published
    from gescom_outbox_context;

  -- 2. UPDATE du payload -> refuse.
  begin
    update public.outbox_events
       set payload = jsonb_build_object('total_ht', '0.00')
     where id = v_pending;
  exception
    when insufficient_privilege then
      if sqlerrm not like 'outbox_append_only:%' then
        raise exception 'Refus inattendu sur UPDATE payload : %', sqlerrm;
      end if;
      v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'Le payload d un evenement a pu etre modifie';
  end if;

  -- Le tenant d un evenement est tout aussi immuable : le deplacer d un tenant
  -- a un autre reecrirait l historique.
  v_rejected := false;
  begin
    update public.outbox_events
       set tenant_id = (select tenant_b from gescom_outbox_context)
     where id = v_pending;
  exception
    when insufficient_privilege then v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'Le tenant d un evenement a pu etre reecrit';
  end if;

  -- 3. UPDATE du suivi de livraison -> accepte.
  update public.outbox_events
     set delivery_attempts = delivery_attempts + 1,
         last_error = 'timeout consommateur'
   where id = v_pending;

  if (select delivery_attempts from public.outbox_events where id = v_pending) <> 1 then
    raise exception 'Le suivi de livraison n a pas pu etre mis a jour';
  end if;

  -- 4. DELETE d une ligne non publiee -> refuse.
  v_rejected := false;
  begin
    delete from public.outbox_events where id = v_pending;
  exception
    when insufficient_privilege then
      if sqlerrm not like 'outbox_append_only:%' then
        raise exception 'Refus inattendu sur DELETE non publie : %', sqlerrm;
      end if;
      v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'Un evenement non publie a pu etre supprime';
  end if;

  -- 5. DELETE d une ligne publiee -> accepte (purge de l historique).
  delete from public.outbox_events where id = v_published;
  if exists (select 1 from public.outbox_events where id = v_published) then
    raise exception 'La purge d un evenement publie a echoue';
  end if;
end;
$$;

-- ── Isolation par tenant : la policy RLS, exercee reellement ───────────────
-- La table est fermee a `authenticated` par revoke. On accorde le SELECT le
-- temps de la transaction pour EXERCER la policy elle-meme : sans cela on ne
-- testerait que le grant, et la policy — seconde barriere — resterait
-- invérifiée.
grant select on public.outbox_events to authenticated;

set local role authenticated;

select set_config(
  'request.jwt.claim.sub',
  (select actor_id::text from gescom_outbox_context),
  true
);

do $$
declare
  v_tenant_a uuid;
  v_tenant_b uuid;
  v_visible integer;
  v_own integer;
begin
  select tenant_a, tenant_b into v_tenant_a, v_tenant_b from gescom_outbox_context;

  select count(*) into v_visible
    from public.outbox_events
   where tenant_id = v_tenant_a;

  if v_visible <> 0 then
    raise exception
      'Un membre du tenant B lit % evenement(s) du tenant A', v_visible;
  end if;

  -- Controle inverse : la policy filtre bien PAR TENANT, elle ne masque pas
  -- tout. Sans cette verification, une policy renvoyant toujours faux
  -- passerait l assertion ci-dessus pour la mauvaise raison.
  select count(*) into v_own
    from public.outbox_events
   where tenant_id = v_tenant_b;

  if v_own <> 1 then
    raise exception
      'Un membre du tenant B lit % evenement(s) de son propre tenant, 1 attendu', v_own;
  end if;
end;
$$;

reset role;

-- ── Privileges : hors de cette transaction, `authenticated` n a rien ───────
-- On retire le SELECT accorde plus haut pour les besoins du test, puis on
-- verifie qu aucun role client ne conserve le moindre privilege direct.
revoke select on public.outbox_events from authenticated;

do $$
declare
  v_granted text[];
begin
  select coalesce(array_agg(distinct grantee || ':' || privilege_type), '{}')
    into v_granted
    from information_schema.table_privileges
   where table_schema = 'public'
     and table_name = 'outbox_events'
     and lower(grantee) in ('authenticated', 'anon', 'public');

  if array_length(v_granted, 1) is not null then
    raise exception
      'outbox_events expose % aux roles client', array_to_string(v_granted, ', ');
  end if;
end;
$$;

rollback;
