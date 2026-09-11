-- ============================================================================
-- Sprint 5 Gestion commerciale — story E10.22d (pilotage PAR ESPACE de la
-- purge automatique des fichiers de commande). Contrat :
-- openapi/magrit-core.v1.yaml (deja ecrit par l architecte, extension du
-- schema CommercialSettings/UpdateCommercialSettingsCommand, E10.10a),
-- docs/api/CONVENTIONS.md §8.22bis.
-- ----------------------------------------------------------------------------
-- ORIGINE : E10.22a/a-bis/b/c sont DEJA livres, commites et deployes sur
-- ightkxebexuzfjdbpsdg -- et INERTES (aucun pg_cron planifie, aucun secret
-- Vault pose). Ce lot pose l INTERRUPTEUR avant d armer le mecanisme, jamais
-- apres : aucun fichier n a jamais ete detruit ni annonce a ce jour.
--
-- DECISION D ARNAUD (2026-09-11), NON ROUVERTE ICI : pilotage PAR ESPACE
-- (pas d interrupteur global Magrit), reglage DESACTIVE par defaut pour tout
-- tenant qui n y a jamais touche (reserve (i) du contrat, FERMEE le
-- 2026-09-11).
--
-- PERIMETRE STRICT DE CE LOT, AUCUNE MIGRATION PASSEE EDITEE (regle du
-- depot, sans exception) :
--
--   1. DEUX colonnes neuves sur `commercial_settings` (E10.10a,
--      `20260906160000`, DEJA EN PRODUCTION) : `order_file_purge_enabled`
--      (boolean, defaut false) et `order_file_purge_enabled_at` (timestamptz,
--      instant de la DERNIERE activation, null a l arret). Coherence par
--      CHECK (jamais par discipline applicative, regle db.md) : un etat
--      "arme sans date d armement" est refuse par la base.
--
--   2. Trigger `commercial_settings_track_purge_activation` (BEFORE INSERT OR
--      UPDATE) : pose `now()` sur une transition false->true, `null` sur
--      true->false, laisse la valeur INCHANGEE quand le booleen ne change
--      pas (empeche de repousser le plancher en re-cliquant sur "activer").
--      Cohabite avec `commercial_settings_set_updated_at` (BEFORE UPDATE,
--      DEJA en place) : deux triggers distincts, colonnes disjointes,
--      executes par ordre alphabetique de nom (verifie sans effet de bord au
--      rejeu de ce fichier).
--
--   3. Fonction IMMUTABLE `public.order_file_effective_purge_at(purge_at,
--      enabled_at)` — UNE SEULE definition pour TROIS appelants (leçon du
--      litteral 24h recopie deux fois en E10.22c, M3) : rend
--      `greatest(purge_at, enabled_at + interval '30 days')`, `null` si
--      `enabled_at` est `null` (jamais appelee hors d un espace ARME dans ce
--      lot, les callers filtrent deja `order_file_purge_enabled`).
--
--   4. `create or replace` sur DEUX fonctions DEJA DEPLOYEES (migrations
--      `20260910000500` et `20260910000600`, JAMAIS EDITEES elles-memes) :
--        - `api_claim_order_file_purge_notices` — jointure INTERNE sur
--          `commercial_settings` filtree `order_file_purge_enabled` (absence
--          de ligne = a l arret, sans reprise ni cas particulier, reserve (i)
--          fermee), CTE et `group by` sur l ECHEANCE EFFECTIVE plutot que
--          `purge_at` brut.
--        - `api_claim_order_files_for_purge` — meme jointure interne, garde
--          etendue avec DEUX clauses supplementaires : `n.confirmed_at >=
--          s.order_file_purge_enabled_at` sur CHACUN des deux rappels
--          (§4 du contrat : un rappel confirme sous une activation PASSEE
--          n autorise rien sous la suivante).
--
--   5. DEUX fonctions NEUVES :
--        - `api_reset_stale_order_file_purge_notices()` — VIVACITE (§4 du
--          contrat) : dans un espace ARME, remet a NULL les pointeurs vers
--          des rappels CREES AVANT l activation courante (sans quoi la garde
--          du point 4 deviendrait insatisfiable pour toujours). Appelee EN
--          TETE de tour, symetrique de `api_expire_order_file_purge_notices`.
--          Le trigger `updated_at` de `commercial_order_files` est DEJA
--          desarme sur ces colonnes (`20260910000500`) : aucun ETag n en
--          souffre.
--        - `api_count_blocked_order_file_purges` (DEJA DEPLOYEE,
--          `20260910000600`, ETENDUE ici par `create or replace`) — jointure
--          EXTERNE (doit continuer de voir les espaces desarmes),
--          CINQUIEME motif `purge_desactivee`, negation EXACTE de la garde
--          etendue du point 4.
--
-- CE QUE CE LOT NE FAIT PAS :
--   - `api_claim_orphan_order_file_objects` (E10.22c) N EST PAS TOUCHEE : le
--     nettoyage des objets orphelins reste actif pour TOUS les tenants,
--     INDEPENDAMMENT de ce reglage (§3 du contrat — un objet orphelin n est
--     une donnee d aucun espace, rien a "conserver").
--   - `purge_at` (colonne du fichier, E10.22a) N EST JAMAIS MODIFIEE : le
--     plancher vit ENTIEREMENT dans les reglages (`order_file_purge_enabled_at`),
--     jamais sur la piece.
--   - Aucun endpoint `/api/v1` neuf, aucune modification d
--     `openapi/magrit-core.v1.yaml` (deja ecrit par l architecte -- verifie
--     ligne a ligne avant d ecrire ce fichier), aucun `pg_cron` neuf ni
--     modifie (geste d exploitation E10.22e, hors perimetre, distinct).
-- ============================================================================

-- ── 1. Colonnes de pilotage sur `commercial_settings` (E10.10a) ────────────
alter table public.commercial_settings
  add column if not exists order_file_purge_enabled    boolean not null default false,
  add column if not exists order_file_purge_enabled_at  timestamptz;

comment on column public.commercial_settings.order_file_purge_enabled is
  'E10.22d — interrupteur PAR ESPACE de la purge automatique des fichiers de commande (E10.22). false = TOUT LE PIPELINE est arrete pour cet espace (aucun rappel, aucune destruction, aucun evenement order_files.purge_scheduled/purged) -- SAUF le nettoyage des objets orphelins (E10.22c), qui reste actif dans tous les cas. false PAR DEFAUT (arbitrage Arnaud du 2026-09-11, reserve (i) fermee) : aucun espace ne purge ses fichiers tant qu un administrateur ne l a pas arme explicitement.';
comment on column public.commercial_settings.order_file_purge_enabled_at is
  'E10.22d — instant de la DERNIERE activation. null quand le reglage est a l arret. JAMAIS ecrit par l application : pose par le trigger commercial_settings_track_purge_activation, sur la transition false->true UNIQUEMENT (repasser true alors que c etait deja true ne le change pas -- le plancher ne se recule pas en cliquant). Fonde CommercialSettings.order_file_purge_effective_from (= cette date + 30 jours, calcule cote application) et la garde de purge etendue (confirmed_at >= cette date sur les deux rappels).';

alter table public.commercial_settings
  drop constraint if exists commercial_settings_purge_activation_coherence;
alter table public.commercial_settings
  add constraint commercial_settings_purge_activation_coherence check (
    (order_file_purge_enabled and order_file_purge_enabled_at is not null)
    or (not order_file_purge_enabled and order_file_purge_enabled_at is null)
  );

-- qa-review round 1, B1 BLOQUANT : `authenticated` detient INSERT/DELETE sur
-- commercial_settings (grants Supabase par defaut, RLS `for all` sans
-- restriction de colonne) -- un INSERT direct pouvait fournir sa PROPRE
-- valeur d order_file_purge_enabled_at (le trigger, plus haut, la CONSERVAIT
-- via coalesce sur la branche INSERT), antidatant le plancher de 30 jours et
-- rouvrant integralement le piege des 48h que ce lot existe pour fermer. Le
-- trigger SANS coalesce (ci-dessus) ferme cette faille A LUI SEUL -- verifie
-- par execution reelle en qa-review round 2 (INSERT, UPDATE, DELETE+INSERT
-- antidates tous rejetes ; `disable trigger`/`session_replication_role`
-- refuses par les privileges Postgres eux-memes, `authenticated` n etant
-- proprietaire ni superuser).
--
-- qa-review round 2, M3 : un `revoke insert (col)` / `revoke update (col)`
-- SEUL NE RETIRE RIEN a un GRANT de TABLE deja existant (grant Supabase par
-- defaut) -- verifie inerte par execution (INSERT/UPDATE antidates encore
-- accord es apres un premier essai qui l affirmait a tort en double defense).
-- Le blocage REEL par privilege exige de revoquer d abord le privilege de
-- TABLE, puis de le regranter colonne par colonne :
revoke insert, update on public.commercial_settings from authenticated, anon;
grant insert (tenant_id, default_validity_days, order_file_purge_enabled),
      update (default_validity_days, order_file_purge_enabled)
  on public.commercial_settings to authenticated;
-- Les fixtures anterieures a ce lot qui doivent antidater legitimement
-- (22a/22b-22c) et le scenario F de ce cas SQL passent par `alter table ...
-- disable trigger`, DEJA le patron employe par le scenario A de ce meme cas.

-- ── 2. Trigger de suivi de l activation — POSE LE PLANCHER, NE LE REPOUSSE
-- JAMAIS SUR UN RE-CLIC (§4/§5 du contrat) ─────────────────────────────────
create or replace function public.commercial_settings_track_purge_activation()
returns trigger
language plpgsql
as $$
begin
  -- `clock_timestamp()`, PAS `now()` : `now()` est le temps de TRANSACTION,
  -- fige pour toute sa duree — deux transitions false->true dans la meme
  -- transaction (constate a l execution reelle de ce cas SQL, scenario B)
  -- poseraient sinon EXACTEMENT le meme plancher, alors que l intention du
  -- trigger est bien d enregistrer l instant reel de CHAQUE activation.
  -- qa-review round 1, B1 : PAS de coalesce ici -- toute valeur fournie par
  -- l appelant sur l INSERT est IGNOREE sans condition (defense en
  -- profondeur, doublee du revoke insert/update colonne plus bas : meme si
  -- l un des deux venait a manquer, l autre ferme seul l antidatage).
  if tg_op = 'INSERT' then
    if new.order_file_purge_enabled then
      new.order_file_purge_enabled_at := clock_timestamp();
    else
      new.order_file_purge_enabled_at := null;
    end if;
    return new;
  end if;

  -- UPDATE : transition false -> true POSE clock_timestamp() (rearme le
  -- plancher, EFFET DE BORD ASSUME ET VOULU, contrat
  -- UpdateCommercialSettingsCommand.order_file_purge_enabled) ; transition
  -- true -> false REMET a null ; true -> true ou false -> false : INCHANGE
  -- (empeche de repousser le plancher en re-cliquant sur "activer" alors
  -- que c etait deja actif).
  if new.order_file_purge_enabled and not coalesce(old.order_file_purge_enabled, false) then
    new.order_file_purge_enabled_at := clock_timestamp();
  elsif not new.order_file_purge_enabled then
    new.order_file_purge_enabled_at := null;
  else
    new.order_file_purge_enabled_at := old.order_file_purge_enabled_at;
  end if;
  return new;
end;
$$;

comment on function public.commercial_settings_track_purge_activation() is
  'E10.22d — pose order_file_purge_enabled_at = clock_timestamp() SEULEMENT sur une transition false->true ; le remet a null sur true->false ; le laisse INCHANGE si le booleen ne change pas. Empeche de repousser le plancher de 30 jours (CommercialSettings.order_file_purge_effective_from) en re-activant un reglage deja actif. clock_timestamp() plutot que now() : deux transitions dans la meme transaction ne doivent jamais partager le meme plancher (qa-review, execution reelle).';

drop trigger if exists commercial_settings_track_purge_activation on public.commercial_settings;
create trigger commercial_settings_track_purge_activation
  before insert or update on public.commercial_settings
  for each row execute function public.commercial_settings_track_purge_activation();

-- ── 3. Echeance EFFECTIVE d un fichier — UNE SEULE definition, TROIS
-- appelants (leçon M3, E10.22c : litteral 24h recopie deux fois) ───────────
create or replace function public.order_file_effective_purge_at(
  p_purge_at timestamptz,
  p_enabled_at timestamptz
)
returns timestamptz
language sql
immutable
as $$
  select case
    when p_enabled_at is null then null
    else greatest(p_purge_at, p_enabled_at + interval '30 days')
  end;
$$;

comment on function public.order_file_effective_purge_at(timestamptz, timestamptz) is
  'E10.22d — echeance EFFECTIVE d un fichier sous un espace ARME : greatest(purge_at, enabled_at + 30 jours). null si enabled_at est null (espace a l arret -- jamais appelee hors d un espace filtre order_file_purge_enabled dans ce lot). purge_at LUI-MEME n est jamais modifie : ce plancher vit entierement dans les reglages. Litteral "30 days" duplique avec le defaut de colonne commercial_order_files.purge_at (meme discipline documentee que E10.22c, M3) : aucune primitive Postgres ne partage une constante entre ces deux endroits aussi simplement qu un module TypeScript.';

-- ── 4. `api_claim_order_file_purge_notices` — jointure INTERNE, echeance
-- EFFECTIVE plutot que purge_at brut ───────────────────────────────────────
create or replace function public.api_claim_order_file_purge_notices(
  p_stage text,
  p_lead_days integer
)
returns table (
  claimed_notice_id uuid,
  claimed_tenant_id uuid,
  claimed_file_count integer,
  claimed_order_count integer
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_group record;
  v_notice_id uuid;
  v_days_before integer;
  v_order_ids uuid[];
begin
  if p_stage not in ('first', 'second') then
    raise exception 'order_file_purge.invalid_stage: %', p_stage;
  end if;

  -- E10.22d : jointure INTERNE sur commercial_settings filtree
  -- order_file_purge_enabled -- un tenant SANS ligne (jamais ouvert l ecran)
  -- ou avec enabled=false est EXCLU sans reprise ni cas particulier (reserve
  -- (i) du contrat, fermee le 2026-09-11 : l absence de ligne vaut "a
  -- l arret"). candidates/group by portent desormais l ECHEANCE EFFECTIVE
  -- (order_file_effective_purge_at), jamais f.purge_at brut.
  for v_group in
    with candidates as (
      select f.id, f.order_id,
             public.order_file_effective_purge_at(f.purge_at, s.order_file_purge_enabled_at) as effective_purge_at,
             o.tenant_id
        from public.commercial_order_files f
        join public.commercial_orders o on o.id = f.order_id
        join public.commercial_settings s on s.tenant_id = o.tenant_id and s.order_file_purge_enabled
       where f.deleted_at is null
         and f.purged_at is null
         and public.order_file_effective_purge_at(f.purge_at, s.order_file_purge_enabled_at) - (p_lead_days || ' days')::interval <= now()
         and (case p_stage when 'first' then f.purge_notice_1_id else f.purge_notice_2_id end) is null
       order by f.id
       for update of f skip locked
    )
    select tenant_id, effective_purge_at,
           array_agg(id) as file_ids,
           count(*)::integer as file_count,
           count(distinct order_id)::integer as order_count,
           array_agg(distinct order_id) as order_ids
      from candidates
     group by tenant_id, effective_purge_at
     order by tenant_id, effective_purge_at
  loop
    if not exists (select 1 from public.api_resolve_order_file_purge_recipients(v_group.tenant_id)) then
      continue;
    end if;

    v_days_before := greatest(0, ceil(extract(epoch from (v_group.effective_purge_at - now())) / 86400.0))::integer;
    v_order_ids := (select coalesce(array_agg(x), array[]::uuid[]) from (select unnest(v_group.order_ids) as x limit 50) s);

    insert into public.commercial_order_file_purge_notices
      (tenant_id, stage, purge_at, file_count, order_count)
    values
      (v_group.tenant_id, p_stage, v_group.effective_purge_at, v_group.file_count, v_group.order_count)
    returning id into v_notice_id;

    execute format(
      'update public.commercial_order_files set %I = $1 where id = any($2)',
      case p_stage when 'first' then 'purge_notice_1_id' else 'purge_notice_2_id' end
    ) using v_notice_id, v_group.file_ids;

    insert into public.outbox_events
      (tenant_id, event_name, event_version, aggregate_type, aggregate_id, payload)
    values (
      v_group.tenant_id,
      'order_files.purge_scheduled',
      1,
      'tenant',
      v_group.tenant_id,
      jsonb_build_object(
        'notice_id', v_notice_id,
        'stage', p_stage,
        'file_count', v_group.file_count,
        'order_count', v_group.order_count,
        'purge_at', to_char(v_group.effective_purge_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'days_before_purge', v_days_before,
        'order_ids', to_jsonb(v_order_ids)
      )
    );

    claimed_notice_id := v_notice_id;
    claimed_tenant_id := v_group.tenant_id;
    claimed_file_count := v_group.file_count;
    claimed_order_count := v_group.order_count;
    return next;
  end loop;
end;
$$;

comment on function public.api_claim_order_file_purge_notices(text, integer) is
  'E10.22a, ETENDUE par E10.22d — jointure INTERNE sur commercial_settings (order_file_purge_enabled), groupe (tenant, ECHEANCE EFFECTIVE = order_file_effective_purge_at, jamais purge_at brut). Le reste inchange : verifie un destinataire joignable, cree le rappel, rattache les fichiers, insere order_files.purge_scheduled -- transactionnel. service_role SEUL.';

-- (grants deja poses par 20260910000500, create or replace les conserve)

-- ── 5. `api_claim_order_files_for_purge` — meme jointure interne, garde
-- ETENDUE (confirmed_at >= enabled_at sur les DEUX rappels, §4 du contrat) ──
create or replace function public.api_claim_order_files_for_purge(
  p_limit integer default 500
)
returns table (
  purged_file_id   uuid,
  purged_order_id  uuid,
  purged_tenant_id uuid,
  purged_byte_size bigint
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  return query
  with candidates as (
    select f.id, f.order_id, f.byte_size, o.tenant_id
      from public.commercial_order_files f
      join public.commercial_orders o on o.id = f.order_id
      -- E10.22d : jointure INTERNE, absence de ligne ou enabled=false EXCLUT
      -- le tenant (reserve (i) fermee, meme raisonnement que la reclamation
      -- de rappels ci-dessus).
      join public.commercial_settings s on s.tenant_id = o.tenant_id and s.order_file_purge_enabled
     where f.deleted_at is null
       and f.purged_at is null
       and public.order_file_effective_purge_at(f.purge_at, s.order_file_purge_enabled_at) <= now()
       and exists (
             select 1 from public.commercial_order_file_purge_notices n
              where n.id = f.purge_notice_1_id and n.tenant_id = o.tenant_id
                and n.confirmed_at is not null and n.failed_at is null
                -- E10.22d (§4 du contrat) : un rappel confirme sous une
                -- activation PASSEE n autorise rien sous la suivante -- sans
                -- cette clause, un espace desactive puis reactive verrait
                -- ses fichiers immediatement purgeables sur la foi de
                -- rappels d une activation anterieure.
                and n.confirmed_at >= s.order_file_purge_enabled_at
           )
       and exists (
             select 1 from public.commercial_order_file_purge_notices n
              where n.id = f.purge_notice_2_id and n.tenant_id = o.tenant_id
                and n.confirmed_at is not null and n.failed_at is null
                and n.confirmed_at >= s.order_file_purge_enabled_at
           )
       and f.purge_notice_1_id is distinct from f.purge_notice_2_id
     order by f.id
     limit greatest(p_limit, 0)
     for update of f skip locked
  ),
  marked as (
    update public.commercial_order_files f
       set deleted_at = now(),
           purged_at = now(),
           deleted_by = null,
           deleted_by_label = 'Purge automatique'
      from candidates c
     where f.id = c.id
    returning f.id as marked_id, c.order_id as marked_order_id, c.tenant_id as marked_tenant_id, c.byte_size as marked_byte_size
  )
  select marked_id, marked_order_id, marked_tenant_id, marked_byte_size from marked;
end;
$$;

comment on function public.api_claim_order_files_for_purge(integer) is
  'E10.22b, ETENDUE par E10.22d — jointure INTERNE sur commercial_settings (order_file_purge_enabled), echeance EFFECTIVE (order_file_effective_purge_at) au lieu de purge_at brut, garde des deux rappels confirmes ETENDUE avec confirmed_at >= order_file_purge_enabled_at (un rappel d une activation PASSEE n autorise rien sous la suivante). Le reste inchange : reclame et MARQUE (deleted_at/purged_at/deleted_by_label), rend tenant_id/order_id/file_id/byte_size, JAMAIS storage_path. service_role SEUL.';

-- ── 6. `api_reset_stale_order_file_purge_notices` (NEUVE) — VIVACITE, sans
-- laquelle la garde du point 5 deviendrait insatisfiable pour toujours ─────
create or replace function public.api_reset_stale_order_file_purge_notices()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_count integer;
begin
  with candidates as (
    select f.id, s.order_file_purge_enabled_at as enabled_at
      from public.commercial_order_files f
      join public.commercial_orders o on o.id = f.order_id
      join public.commercial_settings s on s.tenant_id = o.tenant_id and s.order_file_purge_enabled
      left join public.commercial_order_file_purge_notices n1 on n1.id = f.purge_notice_1_id
      left join public.commercial_order_file_purge_notices n2 on n2.id = f.purge_notice_2_id
     where f.deleted_at is null
       and f.purged_at is null
       and (
         (f.purge_notice_1_id is not null and n1.created_at < s.order_file_purge_enabled_at)
         or (f.purge_notice_2_id is not null and n2.created_at < s.order_file_purge_enabled_at)
       )
     for update of f skip locked
  ),
  updated as (
    update public.commercial_order_files f
       set purge_notice_1_id = case
             when f.purge_notice_1_id is not null and exists (
               select 1 from public.commercial_order_file_purge_notices n
                where n.id = f.purge_notice_1_id and n.created_at < c.enabled_at
             ) then null
             else f.purge_notice_1_id
           end,
           purge_notice_2_id = case
             when f.purge_notice_2_id is not null and exists (
               select 1 from public.commercial_order_file_purge_notices n
                where n.id = f.purge_notice_2_id and n.created_at < c.enabled_at
             ) then null
             else f.purge_notice_2_id
           end
      from candidates c
     where f.id = c.id
    returning f.id
  )
  select count(*) into v_count from updated;

  return v_count;
end;
$$;

comment on function public.api_reset_stale_order_file_purge_notices() is
  'E10.22d — VIVACITE (§4 du contrat) : dans un espace ARME, remet a NULL les pointeurs (purge_notice_1_id/2_id) vers des rappels CREES AVANT l activation courante (order_file_purge_enabled_at) -- sans cette fonction, la garde etendue de api_claim_order_files_for_purge (confirmed_at >= enabled_at) rendrait ces fichiers BLOQUES POUR TOUJOURS apres une reactivation. Appelee EN TETE de tour (PurgeSweepService, etape 0), symetrique de api_expire_order_file_purge_notices. Le trigger updated_at de commercial_order_files est DEJA desarme sur ces colonnes (20260910000500) : aucun ETag n en souffre. service_role SEUL.';

revoke all on function public.api_reset_stale_order_file_purge_notices() from public, anon, authenticated;
grant execute on function public.api_reset_stale_order_file_purge_notices() to service_role;

-- ── 7. `api_count_blocked_order_file_purges` — jointure EXTERNE conservee,
-- CINQUIEME motif `purge_desactivee` (negation EXACTE de la garde etendue) ──
create or replace function public.api_count_blocked_order_file_purges()
returns table (
  blocked_tenant_id uuid,
  blocked_reason     text,
  blocked_count      integer
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select o.tenant_id,
         case
           -- E10.22d : espace SANS ligne de reglages OU enabled=false --
           -- TOUJOURS bloque, quel que soit l etat des rappels. Motif qui ne
           -- se confond jamais avec un incident (rappel_non_confirme etc.) :
           -- ici c est un CHOIX, pas une panne.
           when not coalesce(s.order_file_purge_enabled, false)
             then 'purge_desactivee'
           when f.purge_notice_1_id is null or f.purge_notice_2_id is null
             then 'rappel_non_emis'
           when f.purge_notice_1_id = f.purge_notice_2_id
             then 'rappels_identiques'
           when n1.failed_at is not null or n2.failed_at is not null
             then 'rappel_en_echec'
           else 'rappel_non_confirme'
         end as reason,
         count(*)::integer as blocked_count
    from public.commercial_order_files f
    join public.commercial_orders o on o.id = f.order_id
    -- Jointure EXTERNE, DELIBEREMENT (elle doit continuer de voir les
    -- espaces desarmes ou sans ligne -- contrairement aux fonctions de
    -- reclamation ci-dessus, qui les EXCLUENT via une jointure interne).
    left join public.commercial_settings s on s.tenant_id = o.tenant_id
    left join public.commercial_order_file_purge_notices n1
      on n1.id = f.purge_notice_1_id and n1.tenant_id = o.tenant_id
    left join public.commercial_order_file_purge_notices n2
      on n2.id = f.purge_notice_2_id and n2.tenant_id = o.tenant_id
   where f.deleted_at is null
     and f.purged_at is null
     -- E10.22d : le seuil "echu" depend de l etat du reglage -- ECHEANCE
     -- EFFECTIVE si l espace est ARME (coherent avec la garde de purge
     -- etendue), purge_at BRUT sinon (aucun plancher d activation ne
     -- s applique a un espace qui n a jamais active la purge).
     and (
       case
         when coalesce(s.order_file_purge_enabled, false)
           then public.order_file_effective_purge_at(f.purge_at, s.order_file_purge_enabled_at) <= now()
         else f.purge_at <= now()
       end
     )
     -- NEGATION EXACTE de la garde ETENDUE de api_claim_order_files_for_purge
     -- (E10.22d) -- toute modification de cette garde DOIT etre repercutee
     -- ici, sous peine de compter comme "bloque" un fichier deja purge (ou
     -- l inverse).
     and not (
       coalesce(s.order_file_purge_enabled, false)
       and f.purge_notice_1_id is not null
       and f.purge_notice_2_id is not null
       and f.purge_notice_1_id is distinct from f.purge_notice_2_id
       and n1.confirmed_at is not null and n1.failed_at is null and n1.confirmed_at >= s.order_file_purge_enabled_at
       and n2.confirmed_at is not null and n2.failed_at is null and n2.confirmed_at >= s.order_file_purge_enabled_at
     )
   group by o.tenant_id, reason;
$$;

comment on function public.api_count_blocked_order_file_purges() is
  'E10.22b, ETENDUE par E10.22d — jointure EXTERNE (voit aussi les espaces desarmes/sans ligne), CINQUIEME motif purge_desactivee (l espace n a pas arme le mecanisme -- un CHOIX, pas un incident). Negation EXACTE de la garde ETENDUE de api_claim_order_files_for_purge. Lecture SEULE. service_role SEUL.';

notify pgrst, 'reload schema';

-- ============================================================================
-- REVERSIBILITE — le CLI Supabase ne gere pas de bloc `down`. SQL de retrait,
-- a jouer tel quel dans une migration inverse si la story est annulee.
-- `create or replace` sur des fonctions DEJA deployees : le retrait restaure
-- leur forme d avant ce lot en rejouant leur corps EXACT tel qu ecrit dans
-- `20260910000500`/`20260910000600` (jamais en editant ces fichiers) --
-- rien a `drop` pour elles.
--
--   revoke execute on function public.api_reset_stale_order_file_purge_notices() from service_role;
--   drop function if exists public.api_reset_stale_order_file_purge_notices();
--   drop function if exists public.order_file_effective_purge_at(timestamptz, timestamptz);
--
--   drop trigger if exists commercial_settings_track_purge_activation on public.commercial_settings;
--   drop function if exists public.commercial_settings_track_purge_activation();
--
--   alter table public.commercial_settings
--     drop constraint if exists commercial_settings_purge_activation_coherence,
--     drop column if exists order_file_purge_enabled_at,
--     drop column if exists order_file_purge_enabled;
--
--   -- Restaurer api_claim_order_file_purge_notices, api_claim_order_files_for_purge
--   -- et api_count_blocked_order_file_purges a leur forme 20260910000500/000600
--   -- (create or replace, corps exact de ces fichiers).
--
--   notify pgrst, 'reload schema';
--
-- Les fichiers deja purges/rappels deja crees par ce mecanisme AVANT un
-- rollback restent en l etat (§5 du contrat E10.22 : une purge ne s annule
-- jamais). Aucune donnee de commercial_settings n est reprise par cette
-- migration (reserve (i) fermee : defaut false, aucun UPDATE de reprise) --
-- le rollback ne perd donc aucune reprise a l inverse.
-- ============================================================================
