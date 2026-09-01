-- ============================================================================
-- E10.1 — projects / project_items : isolation par tenant, contrainte CA3
-- (client obligatoire) portee en base, retrait d un element sans suppression
-- d historique.
-- ----------------------------------------------------------------------------
-- Test COMPORTEMENTAL, execute par psql contre la base locale (meme raison
-- que gescom-e10-4-customers.sql : une migration ne change jamais apres
-- coup, un `toContain()` sur son texte ne detecte donc aucune regression sur
-- un futur `drop policy` ou une contrainte assouplie par erreur).
--
-- Scenarios :
--   1. Un projet sans `customer_id` est refuse (NOT NULL) — CA3 porte au
--      niveau base, pas seulement cote UI/service.
--   2. Un membre du tenant B ne lit ni n ecrit les projets du tenant A (RLS),
--      AVEC controle positif symetrique en lecture ET en ecriture sur son
--      propre tenant (meme discipline que m1 qa-review sur E10.4).
--   3. Meme isolation sur `project_items`, dont la policy repose sur une
--      jointure `projects` x `tenant_members` distincte de celle de
--      `projects` — jamais exercee jusqu ici.
--   4. Archiver un projet (`status = 'archived'`) est un UPDATE, jamais un
--      DELETE : la ligne reste lisible et son historique d elements intact.
--   5. (B3 qa-review) `with check`, pas seulement `using` : un INSERT
--      portant le tenant_id d un tenant tiers est refuse, et un UPDATE qui
--      ferait MUTER tenant_id (projects) ou project_id (project_items)
--      d une ligne qui appartient a l acteur, vers une valeur d un autre
--      tenant, est refuse. Le scenario 2 ne prouvait que `using` (cible
--      D UN AUTRE tenant) ; celui-ci porte sur une ligne qui appartient
--      bien a l acteur, donc n echoue QUE grace a `with check`.
--
-- Lancer : pnpm test:storefront:sql (necessite Supabase local demarre).
-- ============================================================================

begin;

create temporary table e10_1_projects_context (
  actor_id     uuid not null,
  tenant_a     uuid not null,
  tenant_b     uuid not null,
  customer_a   uuid not null,
  customer_b   uuid not null,
  project_a    uuid not null,
  project_b    uuid not null,
  item_a       uuid not null,
  item_b       uuid not null
);

grant select on e10_1_projects_context to authenticated;

-- ── Contrainte de forme, jouee en tant que postgres (avant tout test RLS) ───
do $$
declare
  v_actor uuid;
  v_tenant_a uuid;
  v_tenant_b uuid;
  v_customer_a uuid;
  v_customer_b uuid;
  v_project_a uuid;
  v_project_b uuid;
  v_item_a uuid;
  v_item_b uuid;
  v_rejected boolean := false;
begin
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
    raise exception 'Un utilisateur Auth non super-admin est requis pour le scenario E10.1';
  end if;

  insert into public.tenants (slug, name) values ('e10-1-projects-a', 'E10.1 Projects Tenant A')
    returning id into v_tenant_a;
  insert into public.tenants (slug, name) values ('e10-1-projects-b', 'E10.1 Projects Tenant B')
    returning id into v_tenant_b;

  -- L acteur n est membre QUE du tenant B.
  insert into public.tenant_members (tenant_id, user_id, role, access_scope, allowed_shop_ids)
  values (v_tenant_b, v_actor, 'admin', 'magrit_full', '{}');

  insert into public.customers (tenant_id, type, company_name, siret)
  values (v_tenant_a, 'company', 'Tenant A Impression', '73282932000074')
  returning id into v_customer_a;

  insert into public.customers (tenant_id, type, company_name, siret)
  values (v_tenant_b, 'company', 'Tenant B Impression', '56078919152347')
  returning id into v_customer_b;

  -- 1. Projet sans customer_id -> refuse (NOT NULL, porte le CA3 en base).
  begin
    insert into public.projects (tenant_id, name) values (v_tenant_a, 'Sans client');
  exception
    when not_null_violation then v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'Un projet sans customer_id a ete accepte';
  end if;

  -- Projets valides, un par tenant.
  insert into public.projects (tenant_id, customer_id, name)
  values (v_tenant_a, v_customer_a, 'Projet Tenant A')
  returning id into v_project_a;

  insert into public.projects (tenant_id, customer_id, name)
  values (v_tenant_b, v_customer_b, 'Projet Tenant B')
  returning id into v_project_b;

  -- Un element par projet, pour le scenario 3 (RLS project_items).
  insert into public.project_items (project_id, label, quote_payload)
  values (v_project_a, 'Element Tenant A', '{"quantity": 100}'::jsonb)
  returning id into v_item_a;

  insert into public.project_items (project_id, label, quote_payload)
  values (v_project_b, 'Element Tenant B', '{"quantity": 200}'::jsonb)
  returning id into v_item_b;

  insert into e10_1_projects_context (
    actor_id, tenant_a, tenant_b, customer_a, customer_b, project_a, project_b, item_a, item_b
  ) values (
    v_actor, v_tenant_a, v_tenant_b, v_customer_a, v_customer_b, v_project_a, v_project_b, v_item_a, v_item_b
  );
end;
$$;

-- ── 2. et 3. Isolation par tenant, exercee via les policies reelles ────────
set local role authenticated;

select set_config(
  'request.jwt.claim.sub',
  (select actor_id::text from e10_1_projects_context),
  true
);

do $$
declare
  v_tenant_a uuid;
  v_tenant_b uuid;
  v_project_a uuid;
  v_project_b uuid;
  v_item_a uuid;
  v_item_b uuid;
  v_visible_a integer;
  v_visible_b integer;
  v_items_visible_a integer;
  v_items_visible_b integer;
  v_updated integer;
  v_name text;
begin
  select tenant_a, tenant_b, project_a, project_b, item_a, item_b
    into v_tenant_a, v_tenant_b, v_project_a, v_project_b, v_item_a, v_item_b
    from e10_1_projects_context;

  -- 2. Lecture projects : rien du tenant A, controle positif sur le tenant B.
  select count(*) into v_visible_a from public.projects where tenant_id = v_tenant_a;
  if v_visible_a <> 0 then
    raise exception 'Un membre du tenant B lit % projet(s) du tenant A', v_visible_a;
  end if;

  select count(*) into v_visible_b from public.projects where tenant_id = v_tenant_b;
  if v_visible_b <> 1 then
    raise exception 'Un membre du tenant B lit % projet(s) de son propre tenant, 1 attendu', v_visible_b;
  end if;

  -- Ecriture projects : un membre du tenant B ne peut pas renommer un projet
  -- du tenant A. La policy `with check` bloque la ligne, l UPDATE affecte 0
  -- ligne plutot que de lever une erreur — RLS filtre la CIBLE avant l ecriture.
  update public.projects set name = 'Modifie' where id = v_project_a;
  get diagnostics v_updated = row_count;
  if v_updated <> 0 then
    raise exception 'Un membre du tenant B a pu modifier un projet du tenant A';
  end if;

  -- Controle positif symetrique en ECRITURE sur projects.
  update public.projects set name = 'Renomme par B' where id = v_project_b;
  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception
      'Un membre du tenant B n a pas pu modifier son propre projet (% ligne(s))', v_updated;
  end if;

  -- 3. Meme isolation sur project_items, jointure DIFFERENTE de celle de
  -- projects — jamais exercee avant ce test.
  select count(*) into v_items_visible_a
    from public.project_items where id = v_item_a;
  if v_items_visible_a <> 0 then
    raise exception 'Un membre du tenant B lit % element(s) du tenant A', v_items_visible_a;
  end if;

  select count(*) into v_items_visible_b
    from public.project_items where project_id = v_project_b;
  if v_items_visible_b <> 1 then
    raise exception
      'Un membre du tenant B lit % element(s) de son propre projet, 1 attendu', v_items_visible_b;
  end if;

  -- Ecriture project_items : refus sur l element du tenant A.
  update public.project_items set label = 'Modifie' where id = v_item_a;
  get diagnostics v_updated = row_count;
  if v_updated <> 0 then
    raise exception 'Un membre du tenant B a pu modifier un element du tenant A';
  end if;

  -- Controle positif : ecriture acceptee sur l element de son propre projet.
  update public.project_items set label = 'Modifie par B' where id = v_item_b;
  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception
      'Un membre du tenant B n a pas pu modifier un element de son propre projet (% ligne(s))',
      v_updated;
  end if;
  select label into v_name from public.project_items where id = v_item_b;
  if v_name is distinct from 'Modifie par B' then
    raise exception
      'La modification du libelle de l element du tenant B ne s est pas appliquee (valeur: %)', v_name;
  end if;

  -- 4. Archiver un projet est un UPDATE, jamais un DELETE : la ligne du
  -- tenant B reste lisible avec son statut archive et son element intact.
  update public.projects set status = 'archived' where id = v_project_b;
  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'L archivage du projet du tenant B a echoue (% ligne(s))', v_updated;
  end if;

  select count(*) into v_visible_b from public.projects where id = v_project_b and status = 'archived';
  if v_visible_b <> 1 then
    raise exception 'Le projet archive du tenant B n est plus lisible';
  end if;

  select count(*) into v_items_visible_b from public.project_items where project_id = v_project_b;
  if v_items_visible_b <> 1 then
    raise exception 'L archivage du projet a fait disparaitre son element (comportement attendu : jamais)';
  end if;
end;
$$;

-- ── B3 (qa-review) — `with check`, pas seulement `using` ───────────────────
-- Le bloc precedent ne prouve que `using` (visibilite/cible d un UPDATE sur
-- une ligne D UN AUTRE tenant). Il ne prouve PAS `with check` : sans cette
-- clause, un membre pourrait INSERER une ligne portant le tenant_id d un
-- tenant tiers, ou faire MUTER tenant_id/project_id d une ligne qui lui
-- appartient pour la faire "sortir" vers un tenant tiers. Les deux
-- scenarios ci-dessous echouent EXCLUSIVEMENT grace a `with check` : leur
-- ligne cible (avant modification) appartient bien a l acteur (tenant B),
-- donc `using` seul les laisserait passer.
do $$
declare
  v_tenant_a uuid;
  v_customer_a uuid;
  v_project_a uuid;
  v_project_b uuid;
  v_item_b uuid;
  v_rejected boolean := false;
  v_updated integer;
  v_still_tenant uuid;
  v_still_project uuid;
begin
  select tenant_a, customer_a, project_a, project_b, item_b
    into v_tenant_a, v_customer_a, v_project_a, v_project_b, v_item_b
    from e10_1_projects_context;

  -- INSERT explicite portant le tenant_id d un tenant tiers -> refuse par
  -- `with check` (aucune ligne existante, seul `with check` s applique).
  v_rejected := false;
  begin
    insert into public.projects (tenant_id, customer_id, name)
    values (v_tenant_a, v_customer_a, 'Injecte par B dans le tenant A');
  exception
    when insufficient_privilege then v_rejected := true;
  end;
  if not v_rejected then
    raise exception
      'Un membre du tenant B a pu INSERER un projet portant tenant_id = tenant A';
  end if;

  -- UPDATE qui mute tenant_id d un projet du tenant B VERS le tenant A. La
  -- ligne CIBLE appartient a l acteur (using passe) : seul with check,
  -- evalue sur la ligne APRES modification, peut bloquer ce detournement.
  v_rejected := false;
  begin
    update public.projects set tenant_id = v_tenant_a where id = v_project_b;
  exception
    when insufficient_privilege then v_rejected := true;
  end;
  if not v_rejected then
    raise exception
      'Un membre du tenant B a pu deplacer son propre projet vers le tenant A (mutation de tenant_id)';
  end if;
  select tenant_id into v_still_tenant from public.projects where id = v_project_b;
  if v_still_tenant is distinct from (select tenant_b from e10_1_projects_context) then
    raise exception 'Le projet du tenant B a change de tenant malgre le rejet attendu (valeur: %)', v_still_tenant;
  end if;

  -- UPDATE qui mute project_id d un element du tenant B pour le rattacher a
  -- un projet du tenant A. Meme raisonnement : la ligne CIBLE (item_b)
  -- appartient a l acteur, seul with check (qui rejoue la jointure
  -- projects x tenant_members sur la NOUVELLE valeur de project_id) protege.
  v_rejected := false;
  begin
    update public.project_items set project_id = v_project_a where id = v_item_b;
  exception
    when insufficient_privilege then v_rejected := true;
  end;
  if not v_rejected then
    raise exception
      'Un membre du tenant B a pu rattacher son propre element au projet du tenant A (mutation de project_id)';
  end if;
  select project_id into v_still_project from public.project_items where id = v_item_b;
  if v_still_project is distinct from v_project_b then
    raise exception
      'L element du tenant B a change de projet malgre le rejet attendu (valeur: %)', v_still_project;
  end if;
end;
$$;

reset role;

-- Aucune ligne bloquee ci-dessus n a ete modifiee (projects ET project_items).
do $$
declare
  v_project_a uuid;
  v_item_a uuid;
  v_still_name text;
  v_still_label text;
begin
  select project_a, item_a into v_project_a, v_item_a from e10_1_projects_context;

  select name into v_still_name from public.projects where id = v_project_a;
  if v_still_name <> 'Projet Tenant A' then
    raise exception
      'Le projet du tenant A a ete modifie malgre le blocage RLS attendu (valeur: %)', v_still_name;
  end if;

  select label into v_still_label from public.project_items where id = v_item_a;
  if v_still_label <> 'Element Tenant A' then
    raise exception
      'L element du tenant A a ete modifie malgre le blocage RLS attendu (valeur: %)', v_still_label;
  end if;
end;
$$;

rollback;
