-- ============================================================================
-- Sprint 5 Gestion commerciale — story E10.16 : « Ecran de detail d une
-- commande » — interlocuteur (customer_contact_id) et date de livraison
-- prevue (expected_delivery_date) sur commercial_orders. Contrat :
-- openapi/magrit-core.v1.yaml, docs/api/CONVENTIONS.md §8.17 (arbitrages
-- Arnaud du 2026-09-09, reserve (b) fermee).
-- ----------------------------------------------------------------------------
-- Ce que cette migration fait, et RIEN d autre (§3/§6 du contrat : perimetre
-- strictement borne a ces deux colonnes) :
--
--   1. Deux colonnes NULLABLES sur commercial_orders, SANS DEFAUT, SANS
--      rattrapage retroactif :
--        - customer_contact_id uuid references customer_contacts(id) on
--          delete set null — interlocuteur de la commande, recopie A LA
--          CONVERSION depuis la chaine commercial_quotes.decided_by_account_id
--          (E10.10b-2) -> shop_customer_accounts.customer_contact_id (E10.5).
--          `on delete set null`, jamais `restrict` ni `cascade` : meme parti
--          que ces deux colonnes sources — le document survit a la personne.
--        - expected_delivery_date date — posee, SANS AUCUN ECRIVAIN dans ce
--          lot (reserve (h) du contrat, §5) : vaudra NULL sur 100% des
--          commandes tant qu une story n aura pas tranche qui la saisit et
--          quand. Ce n est PAS le `delais` Clariprint (nombre de jours par
--          LIGNE, sans point de depart — jamais une date de livraison).
--
--      Aucun index : aucune lecture publiee ne filtre/trie sur ces colonnes
--      (un index sur expected_delivery_date se posera avec la story qui en
--      aura la mesure, ex. tri de grille CA6, non cadree ici).
--
--   2. `api_convert_commercial_quote(uuid, uuid)` — TROISIEME `create or
--      replace` de cette fonction (apres E10.12 : 20260908010000, puis
--      E10.13 : 20260908020000). Corps RECOPIE VERBATIM depuis la version
--      E10.13, DEUX differences bornees :
--        (i) le `SELECT ... FOR UPDATE` DEJA POSE (patron B1, qa-review
--            round 1 d E10.12) lit AUSSI `decided_by_account_id`, SOUS LE
--            MEME VERROU DE LIGNE — jamais une seconde requete separee, qui
--            rouvrirait la fenetre de concurrence que B1 a fermee.
--        (ii) `customer_contact_id` rejoint la liste de colonnes/valeurs de
--             l `insert` sur `commercial_orders`, sous-requete SCALAIRE
--             DETERMINISTE (cle primaire de `shop_customer_accounts`). Rend
--             `NULL` SANS ERREUR si `decided_by_account_id` est `NULL`
--             (devis converti depuis `sent` sans decision portail — cas le
--             plus frequent) ou si le compte trouve n a lui-meme aucun
--             `customer_contact_id` (E10.5 : compte auto-inscrit ou legacy).
--             `expected_delivery_date` N EST PAS dans cette liste : rien ne
--             la calcule, l omettre la laisse a NULL — la valeur juste.
--      Rien d autre ne change : ni la garde de permission (tout membre du
--      tenant), ni les `set_config` d echappatoire d immuabilite et leur
--      remise a vide sur chaque branche de sortie, ni la transition atomique
--      du devis, ni la numerotation, ni les totaux figes, ni l etape de
--      production initiale (E10.13).
--
--   `commercial_orders_immutable()` N EST PAS TOUCHEE, ni recreee, ni
--   editee — consigne opposable du contrat (§3), deja avertie par les
--   migrations E10.13/E10.14 : c est une liste de REFUS par colonne, donc
--   les deux colonnes neuves sont MUTABLES sans que le trigger soit modifie
--   (meme mecanisme qui a laisse passer `current_production_step_id`,
--   E10.13). Cette mutabilite N EST PAS un chemin d ecriture ouvert :
--   aucune policy RLS d ecriture n existe sur `commercial_orders` (une seule
--   voie : cette fonction `security definer`) et aucun `grant update` cible
--   n est ajoute ici. Elle permet en revanche au `on delete set null` de la
--   FK `customer_contact_id` de s executer normalement le jour ou
--   l interlocuteur est supprime chez le client, sans jamais heurter le
--   trigger d immuabilite (verifie par le scenario 5 du test SQL associe,
--   tests/sql/gescom-e10-16-order-contact-and-delivery.sql).
--
-- Nommage des codes d erreur, cote base : INCHANGES (quote.not_found,
-- quote.conversion_forbidden_status, permission_denied,
-- authentication_required).
-- ============================================================================

-- ── 1. Colonnes ──────────────────────────────────────────────────────────
alter table public.commercial_orders
  add column if not exists customer_contact_id uuid
    references public.customer_contacts(id) on delete set null,
  add column if not exists expected_delivery_date date;

comment on column public.commercial_orders.customer_contact_id is
  'E10.16 — interlocuteur de la commande (customer_contacts), ou NULL. Recopie A LA CONVERSION depuis commercial_quotes.decided_by_account_id -> shop_customer_accounts.customer_contact_id (E10.5/E10.10b-2) : la personne qui a accepte le devis depuis son portail. NULL frequent et normal : devis converti depuis sent sans decision portail (cas le plus courant), compte boutique auto-inscrit/legacy sans lien de gestion, ou compte supprime depuis (on delete set null, meme parti que decided_by_account_id). Aucun chemin d ecriture hors de api_convert_commercial_quote : ni PATCH, ni policy RLS d ecriture, ni grant update cible.';
comment on column public.commercial_orders.expected_delivery_date is
  'E10.16 — date de livraison PROMISE au client (jour calendaire, pas un instant — meme forme que commercial_quotes.valid_until), ou NULL. AUCUN ECRIVAIN dans ce lot (reserve (h), docs/api/CONVENTIONS.md §8.17) : vaut NULL sur toute commande tant qu une story n aura pas tranche qui la saisit et quand. Ce n est PAS le delais Clariprint (nombre de jours par ligne de devis, enfoui dans product_config, sans point de depart).';

-- ── 2. `api_convert_commercial_quote` — RECOPIE VERBATIM (base E10.13,
--    20260908020000) + DEUX differences bornees (voir en-tete) ────────────
create or replace function public.api_convert_commercial_quote(
  p_tenant_id uuid,
  p_quote_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_actor uuid := auth.uid();
  v_prior_status text;
  v_customer_id uuid;
  v_decided_by_account_id uuid;
  v_updated_id uuid;
  v_change_set uuid := gen_random_uuid();
  v_totals record;
  v_year integer;
  v_next integer;
  v_number text;
  v_order_id uuid;
begin
  if v_actor is null then
    raise exception 'authentication_required';
  end if;

  -- Decision #9 du contrat E10.12 (arbitrage Arnaud, 2026-09-08, reserve (b)
  -- close) : TOUT membre du tenant, aucune garde de capability. INCHANGE par
  -- E10.13/E10.16.
  if not (
    public.is_super_admin()
    or exists (
      select 1 from public.tenant_members tm
      where tm.tenant_id = p_tenant_id
        and tm.user_id = v_actor
        and tm.role in ('admin', 'member')
    )
  ) then
    raise exception 'permission_denied: quote conversion forbidden';
  end if;

  perform set_config('magrit.change_set_id', v_change_set::text, true);
  perform set_config('magrit.quote_transition', 'true', true);

  -- E10.16 — SEULE difference (i) : `decided_by_account_id` rejoint la
  -- lecture SOUS LE MEME VERROU DE LIGNE (patron B1, qa-review round 1
  -- d E10.12) — jamais une seconde requete separee, qui rouvrirait la
  -- fenetre de concurrence que B1 a fermee.
  select status, customer_id, decided_by_account_id
    into v_prior_status, v_customer_id, v_decided_by_account_id
  from public.commercial_quotes
  where id = p_quote_id and tenant_id = p_tenant_id
  for update;

  if not found then
    perform set_config('magrit.quote_transition', '', true);
    perform set_config('magrit.change_set_id', '', true);
    raise exception 'quote.not_found: devis % introuvable', p_quote_id;
  end if;

  update public.commercial_quotes cq
     set status = 'converted',
         converted_at = now()
   where cq.id = p_quote_id
     and cq.tenant_id = p_tenant_id
     and cq.status in ('sent', 'accepted')
  returning cq.id into v_updated_id;

  if v_updated_id is null then
    perform set_config('magrit.quote_transition', '', true);
    perform set_config('magrit.change_set_id', '', true);
    raise exception 'quote.conversion_forbidden_status: devis % a l etat % (sent ou accepted requis)', p_quote_id, v_prior_status;
  end if;

  insert into public.commercial_quote_header_audit
    (quote_id, change_set_id, action, field, previous_value, new_value, quote_snapshot, actor_id, actor_label)
  values
    (p_quote_id, v_change_set, 'converted', null, v_prior_status, 'converted', null, v_actor,
     (select email from auth.users where id = v_actor));

  select * into v_totals from private.commercial_order_totals_at_conversion(p_quote_id);

  v_year := extract(year from (now() at time zone 'utc'))::integer;

  insert into public.commercial_order_number_counters (tenant_id, year, last_value)
  values (p_tenant_id, v_year, 1)
  on conflict (tenant_id, year)
  do update set last_value = public.commercial_order_number_counters.last_value + 1
  returning last_value into v_next;

  v_number := 'CDE-' || v_year::text || '-' || lpad(v_next::text, 5, '0');

  -- E10.16 — SEULE difference (ii) : `customer_contact_id` rejoint la liste
  -- de colonnes et de valeurs, sous-requete SCALAIRE deterministe (cle
  -- primaire de `shop_customer_accounts`). NULL sans erreur si
  -- `v_decided_by_account_id` est NULL (aucune ligne ne correspond, `sca.id
  -- = NULL` n est jamais vrai) ou si le compte trouve n a lui-meme aucun
  -- `customer_contact_id` (E10.5). `expected_delivery_date` N EST PAS dans
  -- cette liste : rien ne la calcule, l omettre la laisse a NULL.
  insert into public.commercial_orders (
    tenant_id, customer_id, quote_id, number, status, source_quote_status,
    lines_subtotal, global_discount, effective_discount_rate, net_total,
    vat_rate, vat_regime, vat_amount, total_incl_tax, created_by,
    current_production_step_id, customer_contact_id
  )
  values (
    p_tenant_id, v_customer_id, p_quote_id, v_number, 'validated', v_prior_status,
    v_totals.lines_subtotal, v_totals.global_discount, v_totals.effective_discount_rate, v_totals.net_total,
    v_totals.vat_rate, v_totals.vat_regime, v_totals.vat_amount, v_totals.total_incl_tax, v_actor,
    (select ps.id
       from public.production_steps ps
      where ps.tenant_id = p_tenant_id
        and ps.is_active
      order by ps.position
      limit 1),
    (select sca.customer_contact_id
       from public.shop_customer_accounts sca
      where sca.id = v_decided_by_account_id)
  )
  returning id into v_order_id;

  insert into public.commercial_order_lines (
    order_id, source_quote_line_id, origin, label, product_config, quantity, position,
    production_price, public_price, customer_price, applied_margin_rate, applied_rule_id,
    sale_price, sale_margin_rate, discount_rate, margin_variation, breakdown
  )
  select
    v_order_id, l.id, l.origin, l.label, l.product_config, l.quantity, l.position,
    l.production_price, l.public_price, l.customer_price, l.applied_margin_rate, l.applied_rule_id,
    l.sale_price, l.sale_margin_rate, l.discount_rate, l.margin_variation, l.breakdown
  from public.commercial_quote_lines l
  where l.quote_id = p_quote_id
  order by l.position;

  perform set_config('magrit.quote_transition', '', true);
  perform set_config('magrit.change_set_id', '', true);

  return v_order_id;
end;
$$;

comment on function public.api_convert_commercial_quote(uuid, uuid) is
  'E10.12/E10.13/E10.16 — POST /quotes/{quoteId}/conversions. Transition ATOMIQUE sent/accepted -> converted, numerotation CDE-AAAA-NNNNN, copie FIGEE des lignes et totaux, audit d entete converted, ETAPE DE PRODUCTION INITIALE (E10.13), INTERLOCUTEUR recopie depuis decided_by_account_id -> shop_customer_accounts.customer_contact_id (E10.16, NULL frequent et normal, lu SOUS LE MEME VERROU que le statut/client). Ouverte a TOUT membre du tenant (aucune garde de capability).';

revoke all on function public.api_convert_commercial_quote(uuid, uuid) from public, anon;
grant execute on function public.api_convert_commercial_quote(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';

-- ============================================================================
-- REVERSIBILITE — le CLI Supabase ne gere pas de bloc `down`. SQL de retrait,
-- a jouer tel quel dans une migration inverse si la story est annulee :
--
--   -- api_convert_commercial_quote : revenir a la version E10.13
--   -- (20260908020000) — recopier tel quel le corps de cette migration-la,
--   -- qui n a ni v_decided_by_account_id ni customer_contact_id.
--   create or replace function public.api_convert_commercial_quote(uuid, uuid) ...
--   alter table public.commercial_orders drop column if exists customer_contact_id;
--   alter table public.commercial_orders drop column if exists expected_delivery_date;
--   notify pgrst, 'reload schema';
--
-- Aucune autre table n est touchee : le retrait est sans effet de bord au-
-- dela de la perte de ces deux colonnes et de leur valeur.
-- ============================================================================
