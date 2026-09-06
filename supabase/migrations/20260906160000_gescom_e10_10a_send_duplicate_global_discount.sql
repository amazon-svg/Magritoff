-- ============================================================================
-- Sprint 5 Gestion commerciale — story E10.10a : statut + envoi (`draft` ->
-- `sent`), garde d etat sur `updateQuote` (dette p4, docs/api/CONVENTIONS.md
-- §8.6), duplication, remise globale, reglages commerciaux (validite par
-- defaut). Contrat : openapi/magrit-core.v1.yaml, section E10.10a.
-- ----------------------------------------------------------------------------
-- Ce que cette migration fait :
--
--   1. Nouvelles colonnes sur `commercial_quotes` : filiation de duplication
--      (`source_quote_id`), remise GLOBALE sous la forme ou elle a ete saisie
--      (`global_discount_rate` XOR `target_net_total`, miroir exact du geste
--      LIGNE d E10.9 — CHECK d exclusion mutuelle, comme
--      `commercial_quote_lines_origin_project_item_coherence`), surcharge de
--      TVA (`vat_rate`), cycle d envoi (`sent_at`/`last_sent_at`/`sent_by`).
--      AUCUN total n est persiste : `QuoteTotals` est DERIVE a chaque lecture
--      (cote application, `computeQuoteTotals()`) a partir des lignes et de
--      ces colonnes — memes lignes, meme total, jamais une seconde verite qui
--      pourrait diverger d un total recalcule.
--
--   2. Journal d audit append-only de l ENTETE, `commercial_quote_header_
--      audit` — DISTINCT du journal des LIGNES (`commercial_quote_line_
--      audit`, E10.9). Meme mecanisme pour les modifications de champ
--      ('updated', une entree par champ REELLEMENT change, trigger AFTER
--      UPDATE generique) ; les transitions ('sent', 'resent', 'duplicated')
--      sont ecrites EXPLICITEMENT par les fonctions ci-dessous, dans la MEME
--      transaction que l ecriture qu elles journalisent.
--
--   3. `commercial_settings` — ressource SINGLETON par tenant, porte
--      aujourd hui `default_validity_days` (E10.10a point 9). Lecture
--      OUVERTE a tout membre (via `api_get_commercial_settings`, qui cree la
--      ligne implicitement a la premiere lecture), ecriture GARDEE par
--      `can_manage_pricing` (E10.11).
--
--   4. `api_send_commercial_quote` — ENVOIE (`draft` -> `sent`) ou RENVOIE
--      (`sent` -> `sent`) un devis, EN UNE SEULE TRANSACTION : garde de
--      statut, garde "au moins une ligne", calcul de `valid_until` (SEULEMENT
--      si elle est encore `null`, depuis `commercial_settings.default_
--      validity_days`), ecriture d audit. `security invoker` : aucune table
--      touchee ici n a de RLS plus stricte que ce qu un membre du tenant
--      peut deja voir/ecrire (contrairement a `commercial_quote_number_
--      counters`, qui n intervient pas ici).
--
--   5. `api_duplicate_commercial_quote` — DUPLIQUE un devis : nouveau devis
--      `draft`, MEME compteur de numerotation que la creation depuis un
--      projet (`commercial_quote_number_counters`), lignes recopiees avec
--      leur geste commercial DEJA FIGE (aucun recalcul de prix — E10.8
--      gelee), `valid_until` REMISE a `null`. `security definer`, comme
--      `api_create_commercial_quote_from_project_items` : seule voie
--      d ecriture du compteur, ferme par ailleurs (aucune policy RLS dessus).
--
-- Nommage des codes d erreur, cote application (pas en base) :
-- `quote.update_requires_draft`, `quote.send_forbidden_status`, `quote.
-- send_requires_lines`, `quote.resend_immutable`. Ce fichier ne fait que
-- lever des `raise exception '<code>: <detail>'`, traduits par l adaptateur
-- Supabase (`mapQuoteSendError()`).
-- ============================================================================

-- ── 1. Nouvelles colonnes d entete (E10.10a) ────────────────────────────────
alter table public.commercial_quotes
  add column if not exists source_quote_id     uuid references public.commercial_quotes(id),
  add column if not exists global_discount_rate numeric(6,4),
  add column if not exists target_net_total     numeric(12,2),
  add column if not exists vat_rate             numeric(6,4),
  add column if not exists sent_at              timestamptz,
  add column if not exists last_sent_at         timestamptz,
  add column if not exists sent_by              uuid references auth.users(id);

comment on column public.commercial_quotes.source_quote_id is
  'E10.10a — devis dont celui-ci est une COPIE (duplicateQuote). NULL pour un devis cree depuis un projet. Filiation informative, aucune synchronisation.';
comment on column public.commercial_quotes.global_discount_rate is
  'E10.10a — remise globale exprimee en TAUX, appliquee APRES les remises de ligne. Exclusif de target_net_total (contrainte ci-dessous). Negatif = majoration, plafonne a 1.0000.';
comment on column public.commercial_quotes.target_net_total is
  'E10.10a — remise globale FORMALISEE en prix final HT. Exclusif de global_discount_rate. La remise correspondante est DEDUITE (QuoteTotals), jamais stockee.';
comment on column public.commercial_quotes.vat_rate is
  'E10.10a — surcharge de TVA par devis. NULL = regime fiscal du tenant (tenants.tax_regime).';
comment on column public.commercial_quotes.sent_at is
  'E10.10a — instant du PREMIER envoi (sendQuote). NULL tant que jamais envoye. Ne bouge jamais ensuite, y compris sur un renvoi.';
comment on column public.commercial_quotes.last_sent_at is
  'E10.10a — instant de la DERNIERE remise au client. Egal a sent_at au premier envoi, avance a chaque renvoi.';
comment on column public.commercial_quotes.sent_by is
  'E10.10a — commercial qui a declenche le PREMIER envoi. Inchange par un renvoi (voir le journal d entete pour l auteur de chaque renvoi).';

alter table public.commercial_quotes
  add constraint commercial_quotes_global_discount_exclusive check (
    not (global_discount_rate is not null and target_net_total is not null)
  ),
  -- Seule borne cote remise (100 %, devis offert) : aucune borne du cote de
  -- la majoration (Rate signe, meme regle qu au niveau ligne, E10.9 CA2).
  add constraint commercial_quotes_global_discount_rate_max check (
    global_discount_rate is null or global_discount_rate <= 1.0000
  ),
  add constraint commercial_quotes_target_net_total_non_negative check (
    target_net_total is null or target_net_total >= 0
  );

create index if not exists commercial_quotes_source_quote_idx
  on public.commercial_quotes (source_quote_id) where source_quote_id is not null;

-- ── 2. Journal d audit de l ENTETE, append-only, DISTINCT des lignes ───────
create table if not exists public.commercial_quote_header_audit (
  id             uuid primary key default gen_random_uuid(),
  quote_id       uuid not null references public.commercial_quotes(id) on delete cascade,
  change_set_id  uuid not null,
  action         text not null check (action in ('updated', 'sent', 'resent', 'duplicated')),
  field          text check (field in ('global_discount_rate', 'target_net_total', 'vat_rate', 'show_discounts', 'valid_until')),
  previous_value text,
  new_value      text,
  quote_snapshot jsonb,
  actor_id       uuid references auth.users(id),
  actor_label    text,
  occurred_at    timestamptz not null default now(),

  -- Forme par action (contrat QuoteAuditEntry) : 'updated' porte `field`,
  -- jamais `quote_snapshot` ; 'sent' porte `quote_snapshot`, jamais `field` ;
  -- 'resent'/'duplicated' ne portent ni l un ni l autre (le contenu n a pas
  -- change ; le lien vers la copie est dans `new_value`, pas un snapshot).
  constraint commercial_quote_header_audit_shape check (
    (action = 'updated' and field is not null and quote_snapshot is null)
    or (action = 'sent' and field is null and quote_snapshot is not null)
    or (action in ('resent', 'duplicated') and field is null and quote_snapshot is null)
  )
);

comment on table public.commercial_quote_header_audit is
  'E10.10a — journal append-only de l ENTETE d un devis (remise globale, affichage des remises, validite, TVA, envoi, renvoi, duplication). DISTINCT de commercial_quote_line_audit (E10.9), qui porte les lignes. Jamais edite ni supprime par l application.';

create index if not exists commercial_quote_header_audit_quote_idx
  on public.commercial_quote_header_audit (quote_id, occurred_at desc);

alter table public.commercial_quote_header_audit enable row level security;

-- Meme garde que commercial_quote_line_audit depuis E10.11
-- (20260904150000_gescom_e10_11_audit_select_capability.sql) : isolation
-- TENANT + droit metier can_manage_pricing, des la creation de cette table —
-- pas de fenetre ou elle serait seulement isolee par tenant.
drop policy if exists "commercial_quote_header_audit_select" on public.commercial_quote_header_audit;
create policy "commercial_quote_header_audit_select" on public.commercial_quote_header_audit for select using (
  is_super_admin()
  or exists (
    select 1 from public.commercial_quotes q
    where q.id = commercial_quote_header_audit.quote_id
      and q.tenant_id in (select public.current_user_tenant_ids())
      and public.user_has_capability(q.tenant_id, 'can_manage_pricing')
  )
);

comment on policy "commercial_quote_header_audit_select" on public.commercial_quote_header_audit is
  'RLS = isolation TENANT + droit metier can_manage_pricing (E10.11), garde applicative repetee ici en defense en profondeur contre un appel PostgREST direct — meme raisonnement que commercial_quote_line_audit_select.';

-- Append-only : ecriture reservee aux fonctions SECURITY DEFINER ci-dessous
-- (elles s executent avec les privileges du proprietaire de la table, ce
-- revoke ne les affecte pas).
revoke insert, update, delete on table public.commercial_quote_header_audit from authenticated, anon;

-- ── 2bis. Trigger generique 'updated' — une entree PAR CHAMP REELLEMENT
--    change, sur les CINQ champs tracables (contrat QuoteAuditField). Couvre
--    `updateQuote` (UPDATE ordinaire) ET les champs que `api_send_commercial_
--    quote` modifie en meme temps que la transition (show_discounts fige a
--    l envoi, valid_until calculee) : LA MEME transaction ecrit alors le
--    'updated' (ce trigger) ET le 'sent' (insertion explicite de la
--    fonction), partageant le meme change_set_id via `magrit.change_set_id`
--    (meme mecanisme que `commercial_quote_lines_write_audit`, E10.9).
--
--    `status`/`sent_at`/`last_sent_at`/`sent_by`/`created_by`/`updated_at` ne
--    sont PAS des champs tracables : une transition a sa propre action
--    ('sent'/'resent'), pas une entree "champ change" qui perdrait le
--    contexte de l envoi (contrat, QuoteAuditField).
create or replace function public.commercial_quotes_write_header_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_change_set uuid;
  v_actor uuid := auth.uid();
  v_actor_label text;
begin
  select email into v_actor_label from auth.users where id = v_actor;

  begin
    v_change_set := nullif(current_setting('magrit.change_set_id', true), '')::uuid;
  exception when others then
    v_change_set := null;
  end;
  if v_change_set is null then
    v_change_set := gen_random_uuid();
  end if;

  if new.global_discount_rate is distinct from old.global_discount_rate then
    insert into public.commercial_quote_header_audit
      (quote_id, change_set_id, action, field, previous_value, new_value, actor_id, actor_label)
    values
      (new.id, v_change_set, 'updated', 'global_discount_rate',
       old.global_discount_rate::text, new.global_discount_rate::text, v_actor, v_actor_label);
  end if;

  if new.target_net_total is distinct from old.target_net_total then
    insert into public.commercial_quote_header_audit
      (quote_id, change_set_id, action, field, previous_value, new_value, actor_id, actor_label)
    values
      (new.id, v_change_set, 'updated', 'target_net_total',
       old.target_net_total::text, new.target_net_total::text, v_actor, v_actor_label);
  end if;

  if new.vat_rate is distinct from old.vat_rate then
    insert into public.commercial_quote_header_audit
      (quote_id, change_set_id, action, field, previous_value, new_value, actor_id, actor_label)
    values
      (new.id, v_change_set, 'updated', 'vat_rate', old.vat_rate::text, new.vat_rate::text, v_actor, v_actor_label);
  end if;

  if new.show_discounts is distinct from old.show_discounts then
    insert into public.commercial_quote_header_audit
      (quote_id, change_set_id, action, field, previous_value, new_value, actor_id, actor_label)
    values
      (new.id, v_change_set, 'updated', 'show_discounts',
       old.show_discounts::text, new.show_discounts::text, v_actor, v_actor_label);
  end if;

  if new.valid_until is distinct from old.valid_until then
    insert into public.commercial_quote_header_audit
      (quote_id, change_set_id, action, field, previous_value, new_value, actor_id, actor_label)
    values
      (new.id, v_change_set, 'updated', 'valid_until',
       old.valid_until::text, new.valid_until::text, v_actor, v_actor_label);
  end if;

  return new;
end;
$$;

drop trigger if exists commercial_quotes_audit_update on public.commercial_quotes;
create trigger commercial_quotes_audit_update
  after update on public.commercial_quotes
  for each row
  when (old.* is distinct from new.*)
  execute function public.commercial_quotes_write_header_audit();

-- ── 3. Reglages commerciaux (E10.10a, point 9) — ressource SINGLETON ───────
create table if not exists public.commercial_settings (
  tenant_id              uuid primary key references public.tenants(id) on delete cascade,
  default_validity_days  integer check (default_validity_days is null or default_validity_days between 1 and 3650),
  updated_at             timestamptz not null default now()
);

comment on table public.commercial_settings is
  'E10.10a — reglages commerciaux du tenant, ressource SINGLETON. Porte aujourd hui default_validity_days (validite par defaut des devis, appliquee A L ENVOI). NULL = aucune validite par defaut (etat initial, decision explicite plutot qu une valeur inventee).';
comment on column public.commercial_settings.default_validity_days is
  'Nombre de jours de validite appliques a un devis dont valid_until est encore NULL, comptes depuis sendQuote (jamais depuis la creation). Modifier ce reglage ne recalcule AUCUN devis existant.';

drop trigger if exists commercial_settings_set_updated_at on public.commercial_settings;
create or replace function public.commercial_settings_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger commercial_settings_set_updated_at
  before update on public.commercial_settings
  for each row execute function public.commercial_settings_set_updated_at();

alter table public.commercial_settings enable row level security;

-- Lecture OUVERTE a tout membre du tenant (contrat, getCommercialSettings :
-- « l editeur de devis doit pouvoir afficher la validite par defaut »).
drop policy if exists "commercial_settings_select" on public.commercial_settings;
create policy "commercial_settings_select" on public.commercial_settings for select using (
  is_super_admin()
  or tenant_id in (select public.current_user_tenant_ids())
);

-- Ecriture GARDEE par can_manage_pricing (E10.11) : fixer la duree de
-- validite des devis d un tenant est une politique commerciale, pas un
-- reglage d affichage.
drop policy if exists "commercial_settings_write" on public.commercial_settings;
create policy "commercial_settings_write" on public.commercial_settings for all using (
  is_super_admin()
  or (
    tenant_id in (select public.current_user_tenant_ids())
    and public.user_has_capability(commercial_settings.tenant_id, 'can_manage_pricing')
  )
) with check (
  is_super_admin()
  or (
    tenant_id in (select public.current_user_tenant_ids())
    and public.user_has_capability(commercial_settings.tenant_id, 'can_manage_pricing')
  )
);

-- `api_get_commercial_settings` — CREE IMPLICITEMENT la ligne a la premiere
-- lecture (contrat : « un tenant en a exactement un »). `security definer` :
-- un membre SANS can_manage_pricing doit pouvoir declencher cette creation
-- (lecture ouverte a tout membre), ce que la policy d ECRITURE lui interdit
-- normalement — la fonction verifie donc ELLE-MEME l appartenance au tenant,
-- plutot que de compter sur la RLS qu elle bypasse.
create or replace function public.api_get_commercial_settings(p_tenant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_row public.commercial_settings;
begin
  if v_actor is null then
    raise exception 'authentication_required';
  end if;

  if not (
    public.is_super_admin()
    or exists (
      select 1 from public.tenant_members tm
      where tm.tenant_id = p_tenant_id and tm.user_id = v_actor
    )
  ) then
    raise exception 'permission_denied: commercial settings forbidden';
  end if;

  insert into public.commercial_settings (tenant_id)
  values (p_tenant_id)
  on conflict (tenant_id) do nothing;

  select * into v_row from public.commercial_settings where tenant_id = p_tenant_id;
  return to_jsonb(v_row);
end;
$$;

revoke all on function public.api_get_commercial_settings(uuid) from public, anon;
grant execute on function public.api_get_commercial_settings(uuid) to authenticated;

-- ── 4. ENVOI / RENVOI — api_send_commercial_quote ──────────────────────────
-- `security definer` : la fonction ecrit DIRECTEMENT dans `commercial_quote_
-- header_audit` (entree 'sent'/'resent'), fermee en INSERT a `authenticated`
-- (append-only, section 2). En SECURITY INVOKER, cette insertion serait
-- refusee pour l appelant reel — seul le trigger 'updated' (lui-meme
-- SECURITY DEFINER) y echapperait, laissant le 'sent'/'resent' introuvable.
-- Verifie donc ELLE-MEME l appartenance au tenant (comme `api_duplicate_
-- commercial_quote`) plutot que de compter sur la RLS qu elle bypasse.
create or replace function public.api_send_commercial_quote(
  p_tenant_id uuid,
  p_quote_id uuid,
  p_show_discounts boolean,
  p_show_discounts_provided boolean
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_quote public.commercial_quotes;
  v_line_count integer;
  v_default_validity integer;
  v_new_valid_until date;
  v_change_set uuid := gen_random_uuid();
  v_snapshot jsonb;
begin
  if v_actor is null then
    raise exception 'authentication_required';
  end if;

  if not (
    public.is_super_admin()
    or exists (
      select 1 from public.tenant_members tm
      where tm.tenant_id = p_tenant_id
        and tm.user_id = v_actor
        and tm.role in ('admin', 'member')
    )
  ) then
    raise exception 'permission_denied: quote send forbidden';
  end if;

  select * into v_quote
    from public.commercial_quotes
   where id = p_quote_id
     and tenant_id = p_tenant_id
   for update;
  if v_quote.id is null then
    raise exception 'quote.not_found: devis % introuvable', p_quote_id;
  end if;

  if v_quote.status not in ('draft', 'sent') then
    raise exception 'quote.send_forbidden_status: devis % a l etat % (draft ou sent requis)', p_quote_id, v_quote.status;
  end if;

  -- Toutes les entrees d audit nees de cette transaction (le trigger
  -- generique 'updated' ET l entree explicite 'sent'/'resent' ci-dessous)
  -- partagent CE change_set_id.
  perform set_config('magrit.change_set_id', v_change_set::text, true);

  if v_quote.status = 'draft' then
    select count(*) into v_line_count from public.commercial_quote_lines where quote_id = p_quote_id;
    if v_line_count = 0 then
      raise exception 'quote.send_requires_lines: devis % sans ligne', p_quote_id;
    end if;

    v_new_valid_until := v_quote.valid_until;
    if v_new_valid_until is null then
      select default_validity_days into v_default_validity
        from public.commercial_settings where tenant_id = p_tenant_id;
      if v_default_validity is not null then
        v_new_valid_until := (now() at time zone 'utc')::date + v_default_validity;
      end if;
    end if;

    update public.commercial_quotes
       set status = 'sent',
           sent_at = now(),
           last_sent_at = now(),
           sent_by = v_actor,
           valid_until = v_new_valid_until,
           show_discounts = case when p_show_discounts_provided then p_show_discounts else show_discounts end
     where id = p_quote_id;

    select jsonb_build_object(
             'quote', to_jsonb(q),
             'lines', coalesce(
               (select jsonb_agg(to_jsonb(l) order by l.position)
                  from public.commercial_quote_lines l
                 where l.quote_id = q.id),
               '[]'::jsonb
             )
           )
      into v_snapshot
      from public.commercial_quotes q
     where q.id = p_quote_id;

    insert into public.commercial_quote_header_audit
      (quote_id, change_set_id, action, field, previous_value, new_value, quote_snapshot, actor_id, actor_label)
    values
      (p_quote_id, v_change_set, 'sent', null, null, null, v_snapshot, v_actor,
       (select email from auth.users where id = v_actor));
  else
    -- RENVOI : le contenu ne bouge pas. Une divergence de show_discounts est
    -- un refus, jamais une modification silencieuse (deux clients
    -- detiendraient sinon deux documents differents portant le meme numero).
    if p_show_discounts_provided and p_show_discounts is distinct from v_quote.show_discounts then
      raise exception 'quote.resend_immutable: show_discounts ne peut pas changer sur un renvoi';
    end if;

    update public.commercial_quotes
       set last_sent_at = now()
     where id = p_quote_id;

    insert into public.commercial_quote_header_audit
      (quote_id, change_set_id, action, field, previous_value, new_value, quote_snapshot, actor_id, actor_label)
    values
      (p_quote_id, v_change_set, 'resent', null, null, null, null, v_actor,
       (select email from auth.users where id = v_actor));
  end if;

  return p_quote_id;
end;
$$;

revoke all on function public.api_send_commercial_quote(uuid, uuid, boolean, boolean) from public, anon;
grant execute on function public.api_send_commercial_quote(uuid, uuid, boolean, boolean) to authenticated;

-- ── 5. DUPLICATION — api_duplicate_commercial_quote ────────────────────────
-- `security definer` : seule voie d ecriture de `commercial_quote_number_
-- counters` (aucune policy RLS dessus, deni total), meme raisonnement que
-- `api_create_commercial_quote_from_project_items` (E10.3). Verifie donc
-- ELLE-MEME l appartenance au tenant, comme cette derniere.
create or replace function public.api_duplicate_commercial_quote(
  p_tenant_id uuid,
  p_source_quote_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_source public.commercial_quotes;
  v_year integer;
  v_next integer;
  v_number text;
  v_new_quote_id uuid;
begin
  if v_actor is null then
    raise exception 'authentication_required';
  end if;

  if not (
    public.is_super_admin()
    or exists (
      select 1 from public.tenant_members tm
      where tm.tenant_id = p_tenant_id
        and tm.user_id = v_actor
        and tm.role in ('admin', 'member')
    )
  ) then
    raise exception 'permission_denied: quote duplication forbidden';
  end if;

  select * into v_source
    from public.commercial_quotes
   where id = p_source_quote_id
     and tenant_id = p_tenant_id;
  if v_source.id is null then
    raise exception 'quote.not_found: devis % introuvable', p_source_quote_id;
  end if;

  v_year := extract(year from (now() at time zone 'utc'))::integer;

  insert into public.commercial_quote_number_counters (tenant_id, year, last_value)
  values (p_tenant_id, v_year, 1)
  on conflict (tenant_id, year)
  do update set last_value = public.commercial_quote_number_counters.last_value + 1
  returning last_value into v_next;

  v_number := 'DEV-' || v_year::text || '-' || lpad(v_next::text, 5, '0');

  -- `valid_until` REMISE a NULL (jamais recopiee) : une copie faite six mois
  -- plus tard heriterait sinon d une date deja passee. `status` toujours
  -- 'draft' ; `sent_at`/`last_sent_at`/`sent_by` restent NULL (defauts de
  -- colonne) ; `source_quote_id` trace la filiation.
  insert into public.commercial_quotes
    (tenant_id, customer_id, project_id, source_quote_id, number, status,
     show_discounts, global_discount_rate, target_net_total, vat_rate, created_by)
  values
    (p_tenant_id, v_source.customer_id, v_source.project_id, v_source.id, v_number, 'draft',
     v_source.show_discounts, v_source.global_discount_rate, v_source.target_net_total, v_source.vat_rate, v_actor)
  returning id into v_new_quote_id;

  -- Lignes recopiees avec leur geste commercial DEJA FIGE (sale_price,
  -- discount_rate, margin_variation, breakdown compris) : AUCUN recalcul de
  -- prix (E10.8 gelee). Le trigger d audit d E10.9 (AFTER INSERT) alimente
  -- automatiquement le journal des LIGNES de la copie, une entree 'added' par
  -- ligne — la garde d etat "devis brouillon" (BEFORE INSERT) laisse passer
  -- ces insertions puisque la copie est fraichement creee en 'draft'.
  insert into public.commercial_quote_lines
    (quote_id, origin, project_item_id, label, product_config, quantity, chiffrage_quantity, position,
     production_price, public_price, customer_price, applied_margin_rate, applied_rule_id,
     sale_price, sale_margin_rate, discount_rate, margin_variation, breakdown)
  select
    v_new_quote_id, l.origin, l.project_item_id, l.label, l.product_config, l.quantity, l.chiffrage_quantity, l.position,
    l.production_price, l.public_price, l.customer_price, l.applied_margin_rate, l.applied_rule_id,
    l.sale_price, l.sale_margin_rate, l.discount_rate, l.margin_variation, l.breakdown
  from public.commercial_quote_lines l
  where l.quote_id = p_source_quote_id
  order by l.position;

  -- Tracabilite DANS LES DEUX SENS, sans doublon : la copie porte
  -- `source_quote_id` (deja ecrit ci-dessus), le journal d entete de l
  -- ORIGINAL recoit cette entree 'duplicated'.
  insert into public.commercial_quote_header_audit
    (quote_id, change_set_id, action, field, previous_value, new_value, quote_snapshot, actor_id, actor_label)
  values
    (p_source_quote_id, gen_random_uuid(), 'duplicated', null, null, v_new_quote_id::text, null, v_actor,
     (select email from auth.users where id = v_actor));

  return v_new_quote_id;
end;
$$;

revoke all on function public.api_duplicate_commercial_quote(uuid, uuid) from public, anon;
grant execute on function public.api_duplicate_commercial_quote(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';

-- ============================================================================
-- REVERSIBILITE — le CLI Supabase ne gere pas de bloc `down`. SQL de retrait,
-- a jouer tel quel dans une migration inverse si la story est annulee :
--
--   revoke execute on function public.api_duplicate_commercial_quote(uuid, uuid) from authenticated;
--   drop function if exists public.api_duplicate_commercial_quote(uuid, uuid);
--   revoke execute on function public.api_send_commercial_quote(uuid, uuid, boolean, boolean) from authenticated;
--   drop function if exists public.api_send_commercial_quote(uuid, uuid, boolean, boolean);
--   revoke execute on function public.api_get_commercial_settings(uuid) from authenticated;
--   drop function if exists public.api_get_commercial_settings(uuid);
--   drop policy if exists "commercial_settings_write" on public.commercial_settings;
--   drop policy if exists "commercial_settings_select" on public.commercial_settings;
--   drop trigger if exists commercial_settings_set_updated_at on public.commercial_settings;
--   drop function if exists public.commercial_settings_set_updated_at();
--   drop table if exists public.commercial_settings;
--   drop trigger if exists commercial_quotes_audit_update on public.commercial_quotes;
--   drop function if exists public.commercial_quotes_write_header_audit();
--   drop policy if exists "commercial_quote_header_audit_select" on public.commercial_quote_header_audit;
--   drop table if exists public.commercial_quote_header_audit;
--   alter table public.commercial_quotes
--     drop constraint if exists commercial_quotes_target_net_total_non_negative,
--     drop constraint if exists commercial_quotes_global_discount_rate_max,
--     drop constraint if exists commercial_quotes_global_discount_exclusive,
--     drop column if exists sent_by,
--     drop column if exists last_sent_at,
--     drop column if exists sent_at,
--     drop column if exists vat_rate,
--     drop column if exists target_net_total,
--     drop column if exists global_discount_rate,
--     drop column if exists source_quote_id;
--   notify pgrst, 'reload schema';
--
-- Aucune autre table ne reference commercial_settings/commercial_quote_
-- header_audit : le retrait est sans effet de bord au-dela de la perte du
-- reglage et du journal eux-memes. Le retrait des colonnes de
-- commercial_quotes est sans effet sur commercial_quote_lines (aucune FK
-- dans ce sens).
-- ============================================================================
