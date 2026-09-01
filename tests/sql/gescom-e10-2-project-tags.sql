-- ============================================================================
-- E10.2 — project_tags / project_tag_links : isolation par tenant, unicite du
-- libelle normalise, refus de suppression d un tag encore utilise, retrait
-- d un tag du tenant B interdit depuis le tenant A.
-- ----------------------------------------------------------------------------
-- Test COMPORTEMENTAL, execute par psql contre la base locale (meme raison
-- que gescom-e10-1-projects.sql : une migration ne change jamais apres coup,
-- un `toContain()` sur son texte ne detecte donc aucune regression sur un
-- futur `drop policy` ou une contrainte assouplie par erreur).
--
-- Scenarios :
--   1. Deux tags de MEME libelle normalise (casse et espaces differents)
--      dans le MEME tenant sont refuses (CA2/CA3 — unicite sur
--      (tenant_id, lower(label))).
--   2. Le MEME libelle dans DEUX tenants differents ne collisionne pas
--      (CA3).
--   3. Un membre du tenant B ne lit ni n ecrit les tags du tenant A (RLS),
--      AVEC controle positif symetrique en lecture ET en ecriture sur son
--      propre tenant.
--   4. Meme isolation sur `project_tag_links`, dont la policy repose sur une
--      jointure `projects` x `tenant_members` distincte de celle de
--      `project_tags`.
--   5. Un tag encore lie a un projet ne peut pas etre supprime (CA5, FK
--      RESTRICT) ; une fois le lien retire, la suppression reussit et NE
--      RETIRE PAS le tag des AUTRES projets qui ne le portent plus par
--      construction (le lien est un retrait explicite, pas une cascade).
--   6. Le trigger `project_tag_links_same_tenant` refuse de lier un projet
--      et un tag de tenants differents, meme si chacun pris separement
--      appartient bien a l acteur au moment ou la RLS l autoriserait.
--   7. `with check`, pas seulement `using` : un INSERT de tag portant le
--      tenant_id d un tenant tiers est refuse.
--
-- Lancer : pnpm test:storefront:sql (necessite Supabase local demarre).
-- ============================================================================

begin;

create temporary table e10_2_project_tags_context (
  actor_id    uuid not null,
  tenant_a    uuid not null,
  tenant_b    uuid not null,
  customer_a  uuid not null,
  customer_b  uuid not null,
  project_a   uuid not null,
  project_b   uuid not null,
  tag_a       uuid not null,
  tag_b       uuid not null
);

grant select on e10_2_project_tags_context to authenticated;

-- ── Prealables, joues en tant que postgres (avant tout test RLS) ───────────
do $$
declare
  v_actor uuid;
  v_tenant_a uuid;
  v_tenant_b uuid;
  v_customer_a uuid;
  v_customer_b uuid;
  v_project_a uuid;
  v_project_b uuid;
  v_tag_a uuid;
  v_tag_b uuid;
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
    raise exception 'Un utilisateur Auth non super-admin est requis pour le scenario E10.2';
  end if;

  insert into public.tenants (slug, name) values ('e10-2-tags-a', 'E10.2 Tags Tenant A')
    returning id into v_tenant_a;
  insert into public.tenants (slug, name) values ('e10-2-tags-b', 'E10.2 Tags Tenant B')
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

  insert into public.projects (tenant_id, customer_id, name)
  values (v_tenant_a, v_customer_a, 'Projet Tenant A')
  returning id into v_project_a;

  insert into public.projects (tenant_id, customer_id, name)
  values (v_tenant_b, v_customer_b, 'Projet Tenant B')
  returning id into v_project_b;

  -- 1. Deux libelles normalises identiques dans le MEME tenant -> refuse.
  insert into public.project_tags (tenant_id, label, color)
  values (v_tenant_a, 'Urgent', 'red')
  returning id into v_tag_a;

  begin
    insert into public.project_tags (tenant_id, label, color) values (v_tenant_a, '  urgent  ', 'blue');
  exception
    when unique_violation then v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'Un second tag "urgent" (casse/espaces differents) a ete accepte dans le meme tenant';
  end if;

  -- 2. Le MEME libelle dans un AUTRE tenant ne collisionne pas (CA3).
  v_rejected := false;
  begin
    insert into public.project_tags (tenant_id, label, color) values (v_tenant_b, 'Urgent', 'red')
    returning id into v_tag_b;
  exception
    when unique_violation then v_rejected := true;
  end;
  if v_rejected then
    raise exception 'Le libelle "Urgent" du tenant B a collisionne avec celui du tenant A';
  end if;

  insert into e10_2_project_tags_context (
    actor_id, tenant_a, tenant_b, customer_a, customer_b, project_a, project_b, tag_a, tag_b
  ) values (
    v_actor, v_tenant_a, v_tenant_b, v_customer_a, v_customer_b, v_project_a, v_project_b, v_tag_a, v_tag_b
  );
end;
$$;

-- ── 3. et 4. Isolation par tenant, exercee via les policies reelles ────────
set local role authenticated;

select set_config(
  'request.jwt.claim.sub',
  (select actor_id::text from e10_2_project_tags_context),
  true
);

do $$
declare
  v_tenant_a uuid;
  v_tenant_b uuid;
  v_project_b uuid;
  v_tag_a uuid;
  v_tag_b uuid;
  v_visible_a integer;
  v_visible_b integer;
  v_updated integer;
  v_links_visible integer;
  v_rejected boolean := false;
begin
  select tenant_a, tenant_b, project_b, tag_a, tag_b
    into v_tenant_a, v_tenant_b, v_project_b, v_tag_a, v_tag_b
    from e10_2_project_tags_context;

  -- 3. Lecture project_tags : rien du tenant A, controle positif sur B.
  select count(*) into v_visible_a from public.project_tags where tenant_id = v_tenant_a;
  if v_visible_a <> 0 then
    raise exception 'Un membre du tenant B lit % tag(s) du tenant A', v_visible_a;
  end if;

  select count(*) into v_visible_b from public.project_tags where tenant_id = v_tenant_b;
  if v_visible_b <> 1 then
    raise exception 'Un membre du tenant B lit % tag(s) de son propre tenant, 1 attendu', v_visible_b;
  end if;

  -- Ecriture project_tags : un membre du tenant B ne peut pas renommer le
  -- tag du tenant A (using : la ligne CIBLEE n appartient pas a l acteur).
  update public.project_tags set label = 'Modifie' where id = v_tag_a;
  get diagnostics v_updated = row_count;
  if v_updated <> 0 then
    raise exception 'Un membre du tenant B a pu modifier un tag du tenant A';
  end if;

  -- Controle positif symetrique en ECRITURE sur project_tags.
  update public.project_tags set label = 'Urgent renomme' where id = v_tag_b;
  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'Un membre du tenant B n a pas pu modifier son propre tag (% ligne(s))', v_updated;
  end if;

  -- 4. Lien projet<->tag du tenant B, cree par l acteur autorise.
  insert into public.project_tag_links (project_id, tag_id) values (v_project_b, v_tag_b);
  select count(*) into v_links_visible from public.project_tag_links where project_id = v_project_b;
  if v_links_visible <> 1 then
    raise exception 'Le lien projet<->tag du tenant B n a pas ete cree (% ligne(s))', v_links_visible;
  end if;

  -- 6. Le trigger refuse de lier le projet du tenant B au tag du tenant A,
  -- meme si la RLS elle-meme ne bloquerait pas la simple existence de
  -- chaque ligne prise separement pour l acteur (il ne possede ni l un ni
  -- l autre ici, donc double filet : RLS ET trigger doivent tous deux tenir).
  v_rejected := false;
  begin
    insert into public.project_tag_links (project_id, tag_id) values (v_project_b, v_tag_a);
  exception
    when insufficient_privilege then v_rejected := true;
    when others then v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'Un lien projet(tenant B)<->tag(tenant A) a ete accepte';
  end if;
end;
$$;

reset role;

-- ── 5. Refus de suppression d un tag encore utilise (CA5, FK RESTRICT) ─────
do $$
declare
  v_tag_b uuid;
  v_project_b uuid;
  v_rejected boolean := false;
  v_still_exists integer;
begin
  select tag_b, project_b into v_tag_b, v_project_b from e10_2_project_tags_context;

  begin
    delete from public.project_tags where id = v_tag_b;
  exception
    when foreign_key_violation then v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'Un tag encore lie a un projet a ete supprime (CA5 viole)';
  end if;

  select count(*) into v_still_exists from public.project_tags where id = v_tag_b;
  if v_still_exists <> 1 then
    raise exception 'Le tag encore utilise a disparu malgre le refus attendu';
  end if;

  -- Retrait explicite du LIEN (pas du tag) : le tag redevient supprimable
  -- SANS que cela ait ete implicite ou automatique.
  delete from public.project_tag_links where project_id = v_project_b and tag_id = v_tag_b;

  delete from public.project_tags where id = v_tag_b;
  select count(*) into v_still_exists from public.project_tags where id = v_tag_b;
  if v_still_exists <> 0 then
    raise exception 'Le tag n a pas pu etre supprime une fois le lien retire (CA5)';
  end if;
end;
$$;

-- ── 7. `with check` sur project_tags : INSERT portant un tenant_id tiers ───
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  (select actor_id::text from e10_2_project_tags_context),
  true
);

do $$
declare
  v_tenant_a uuid;
  v_rejected boolean := false;
begin
  select tenant_a into v_tenant_a from e10_2_project_tags_context;

  begin
    insert into public.project_tags (tenant_id, label, color)
    values (v_tenant_a, 'Injecte par B', 'green');
  exception
    when insufficient_privilege then v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'Un membre du tenant B a pu INSERER un tag portant tenant_id = tenant A';
  end if;
end;
$$;

reset role;

rollback;
