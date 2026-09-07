-- ============================================================================
-- E10.10b-2 — decision du client (accepter/refuser un devis depuis le portail
-- boutique) : `api_decide_storefront_quote()`, transition atomique, garde de
-- peremption, session deleguee refusee, audit d entete, immuabilite (echappa-
-- toire posee PUIS remise a vide), isolation inter-tenant/inter-client.
-- ----------------------------------------------------------------------------
-- Test COMPORTEMENTAL, execute par psql contre la base locale : la garde et
-- la transition vivent ENTIEREMENT dans `api_decide_storefront_quote()`
-- (migration 20260907000000) — une simple lecture de son texte ne prouve pas
-- qu elle se comporte correctement sous appel reel.
--
-- Scenarios :
--   1. Un compte AVEC interlocuteur ACCEPTE son propre devis `sent` : statut
--      -> accepted, decided_at/decided_by_account_id poses, une entree
--      d audit 'accepted' (field/quote_snapshot NULL, previous_value='sent',
--      new_value='accepted', actor_id NULL, actor_label = libelle du compte).
--   2. Meme compte REFUSE un second devis `sent` : symetrique exact (statut
--      -> rejected, entree 'rejected').
--   3. Session DELEGUEE : refusee, 403 applicatif -> exception
--      quote.decision_forbidden_delegated, AUCUNE ecriture.
--   4. Devis deja `accepted` (pas `sent`) : exception
--      quote.decision_forbidden_status, AUCUNE ecriture.
--   5. Devis `sent` mais PERIME (valid_until depassee) : exception
--      quote.decision_expired, AUCUNE ecriture.
--   6. Devis d un AUTRE client (meme tenant) ou d un AUTRE tenant : `null`
--      indiscernable, jamais une exception (meme discipline que
--      api_get_storefront_quote).
--   7. Jeton de session invalide (inexistant) : `null`, jamais une exception.
--   8. B7 (E10.10a round 5) applique a cette fonction : `magrit.
--      quote_transition`/`magrit.change_set_id` sont VIDES juste apres le
--      retour, dans la MEME transaction que ce fichier.
--   9. Decision invalide (`p_decision` hors 'accepted'/'rejected') : `null`,
--      defense en profondeur (le contrat Zod refuse deja cette valeur en
--      amont).
--
-- Lancer : pnpm test:storefront:sql (necessite Supabase local demarre).
-- ============================================================================

begin;

create temporary table e10_10b_2_context (
  tenant_a uuid not null,
  tenant_b uuid not null,
  shop_a uuid not null,
  customer_a1 uuid not null,
  customer_a2 uuid not null,
  customer_b uuid not null,
  contact_a1 uuid not null,
  account_a1 uuid not null,
  token_a1 text not null,
  token_delegated text not null,
  quote_to_accept uuid not null,
  quote_to_reject uuid not null,
  quote_already_accepted uuid not null,
  quote_expired uuid not null,
  quote_delegated_target uuid not null,
  quote_a2_sent uuid not null,
  quote_b_sent uuid not null
);

grant select on e10_10b_2_context to anon;

do $$
declare
  v_actor uuid;
  v_tenant_a uuid;
  v_tenant_b uuid;
  v_shop_a uuid;
  v_customer_a1 uuid;
  v_customer_a2 uuid;
  v_customer_b uuid;
  v_project_a1 uuid;
  v_project_a2 uuid;
  v_project_b uuid;
  v_contact_a1 uuid;
  v_contact_a2 uuid;
  v_account_a1 uuid;
  v_delegation_id uuid;
  v_token_a1 text;
  v_token_delegated text;
  v_quote_to_accept uuid;
  v_quote_to_reject uuid;
  v_quote_already_accepted uuid;
  v_quote_expired uuid;
  v_quote_delegated_target uuid;
  v_quote_a2_sent uuid;
  v_quote_b_sent uuid;
begin
  select id into v_actor from auth.users where email is not null order by created_at limit 1;
  if v_actor is null then raise exception 'Utilisateur Auth requis pour le scenario E10.10b-2'; end if;

  insert into public.tenants (slug, name) values ('e10-10b-2-tenant-a', 'E10.10b-2 Tenant A') returning id into v_tenant_a;
  insert into public.tenants (slug, name) values ('e10-10b-2-tenant-b', 'E10.10b-2 Tenant B') returning id into v_tenant_b;
  insert into public.tenant_members (tenant_id, user_id, role, access_scope, allowed_shop_ids)
    values (v_tenant_a, v_actor, 'admin', 'magrit_full', '{}');

  insert into public.shops (owner_user_id, tenant_id, name, slug)
    values (v_actor, v_tenant_a, 'E10.10b-2 Boutique A', 'e10-10b-2-boutique-a') returning id into v_shop_a;

  insert into public.customers (tenant_id, type, company_name, siret)
    values (v_tenant_a, 'company', 'E10.10b-2 Client A1', '73282932000074') returning id into v_customer_a1;
  insert into public.customers (tenant_id, type, company_name, siret)
    values (v_tenant_a, 'company', 'E10.10b-2 Client A2', '11111111100006') returning id into v_customer_a2;
  insert into public.customers (tenant_id, type, company_name, siret)
    values (v_tenant_b, 'company', 'E10.10b-2 Client B', '22222222200005') returning id into v_customer_b;

  insert into public.customer_contacts (customer_id, first_name, last_name, email)
    values (v_customer_a1, 'Contact', 'A1', 'contact.a1.e10-10b-2@example.test') returning id into v_contact_a1;
  insert into public.customer_contacts (customer_id, first_name, last_name, email)
    values (v_customer_a2, 'Contact', 'A2', 'contact.a2.e10-10b-2@example.test') returning id into v_contact_a2;

  insert into public.projects (tenant_id, customer_id, name) values (v_tenant_a, v_customer_a1, 'Projet A1') returning id into v_project_a1;
  insert into public.projects (tenant_id, customer_id, name) values (v_tenant_a, v_customer_a2, 'Projet A2') returning id into v_project_a2;
  insert into public.projects (tenant_id, customer_id, name) values (v_tenant_b, v_customer_b, 'Projet B') returning id into v_project_b;

  insert into public.shop_customer_accounts (shop_id, email, full_name, status, activated_at, customer_contact_id)
    values (v_shop_a, 'account.a1.e10-10b-2@example.test', 'Compte A1 Decideur', 'active', now(), v_contact_a1)
    returning id into v_account_a1;

  -- ── Session DIRECTE ───────────────────────────────────────────────────────
  select encode(extensions.gen_random_bytes(32), 'hex') into v_token_a1;
  insert into private.shop_customer_sessions (shop_customer_account_id, shop_id, token_hash, expires_at, session_kind)
    values (v_account_a1, v_shop_a, extensions.digest(convert_to(v_token_a1, 'UTF8'), 'sha256'), now() + interval '1 hour', 'direct');

  -- ── Session DELEGUEE : meme compte, meme boutique, session_kind different ─
  -- (scenario 3). Insertion DIRECTE plutot que via api_start_self_shop_
  -- customer_delegation() : ce chemin exige un role tenant_role_definitions
  -- avec can_impersonate_shop_customer, hors sujet de ce cas, qui ne teste que
  -- le REFUS de decideStorefrontQuote sur ce session_kind. La contrainte
  -- shop_customer_sessions_actor_check exige une ligne de delegation reelle
  -- (delegation_id NOT NULL) des que session_kind = 'delegated'.
  insert into private.shop_customer_delegations (shop_customer_account_id, shop_id, actor_magrit_user_id, expires_at)
    values (v_account_a1, v_shop_a, v_actor, now() + interval '1 hour')
    returning id into v_delegation_id;

  select encode(extensions.gen_random_bytes(32), 'hex') into v_token_delegated;
  insert into private.shop_customer_sessions
      (shop_customer_account_id, shop_id, token_hash, expires_at, session_kind, actor_magrit_user_id, delegation_id)
    values
      (v_account_a1, v_shop_a, extensions.digest(convert_to(v_token_delegated, 'UTF8'), 'sha256'), now() + interval '1 hour', 'delegated', v_actor, v_delegation_id);

  -- ── Devis A ACCEPTER : sent, valid_until lointaine ──────────────────────
  insert into public.commercial_quotes (tenant_id, customer_id, project_id, number, status, valid_until, show_discounts)
    values (v_tenant_a, v_customer_a1, v_project_a1, 'DEV-2026-91001', 'draft', '2099-01-01', true)
    returning id into v_quote_to_accept;
  insert into public.commercial_quote_lines (quote_id, project_item_id, origin, label, quantity, position, production_price, public_price, customer_price, applied_margin_rate, sale_price, discount_rate, breakdown)
    values (v_quote_to_accept, null, 'free', 'Flyers A5', 500, 0, 500.00, 1000.00, 1000.00, 1.0000, 950.00, 0.0500, '[{"post":"total","cost":"500.00","margin_rate":"1.0000","price":"1000.00","source":"prix_marche"}]'::jsonb);
  perform set_config('magrit.quote_transition', 'true', true);
  update public.commercial_quotes set status = 'sent', sent_at = now() - interval '1 day' where id = v_quote_to_accept;

  -- ── Devis A REFUSER : sent, valid_until lointaine ───────────────────────
  insert into public.commercial_quotes (tenant_id, customer_id, project_id, number, status, valid_until, show_discounts)
    values (v_tenant_a, v_customer_a1, v_project_a1, 'DEV-2026-91002', 'draft', '2099-01-01', true)
    returning id into v_quote_to_reject;
  insert into public.commercial_quote_lines (quote_id, project_item_id, origin, label, quantity, position, production_price, public_price, customer_price, applied_margin_rate, sale_price, discount_rate, breakdown)
    values (v_quote_to_reject, null, 'free', 'Cartes de visite', 1000, 0, 100.00, 200.00, 200.00, 1.0000, 200.00, 0.0000, '[{"post":"total","cost":"100.00","margin_rate":"1.0000","price":"200.00","source":"prix_marche"}]'::jsonb);
  perform set_config('magrit.quote_transition', 'true', true);
  update public.commercial_quotes set status = 'sent', sent_at = now() - interval '1 day' where id = v_quote_to_reject;

  -- ── Devis DEJA ACCEPTE (statut refuse, scenario 4) ──────────────────────
  insert into public.commercial_quotes (tenant_id, customer_id, project_id, number, status, valid_until, show_discounts)
    values (v_tenant_a, v_customer_a1, v_project_a1, 'DEV-2026-91003', 'draft', '2099-01-01', true)
    returning id into v_quote_already_accepted;
  insert into public.commercial_quote_lines (quote_id, project_item_id, origin, label, quantity, position, production_price, public_price, customer_price, applied_margin_rate, sale_price, discount_rate, breakdown)
    values (v_quote_already_accepted, null, 'free', 'Banderole', 1, 0, 100.00, 200.00, 200.00, 1.0000, 200.00, 0.0000, '[{"post":"total","cost":"100.00","margin_rate":"1.0000","price":"200.00","source":"prix_marche"}]'::jsonb);
  perform set_config('magrit.quote_transition', 'true', true);
  update public.commercial_quotes set status = 'sent', sent_at = now() - interval '2 days' where id = v_quote_already_accepted;
  perform set_config('magrit.quote_transition', 'true', true);
  update public.commercial_quotes set status = 'accepted', decided_at = now(), decided_by_account_id = v_account_a1 where id = v_quote_already_accepted;

  -- ── Devis PERIME encore sent (scenario 5) : valid_until depassee ────────
  insert into public.commercial_quotes (tenant_id, customer_id, project_id, number, status, valid_until, show_discounts)
    values (v_tenant_a, v_customer_a1, v_project_a1, 'DEV-2026-91004', 'draft', '2020-01-01', true)
    returning id into v_quote_expired;
  insert into public.commercial_quote_lines (quote_id, project_item_id, origin, label, quantity, position, production_price, public_price, customer_price, applied_margin_rate, sale_price, discount_rate, breakdown)
    values (v_quote_expired, null, 'free', 'Affiches', 1, 0, 100.00, 200.00, 200.00, 1.0000, 200.00, 0.0000, '[{"post":"total","cost":"100.00","margin_rate":"1.0000","price":"200.00","source":"prix_marche"}]'::jsonb);
  perform set_config('magrit.quote_transition', 'true', true);
  update public.commercial_quotes set status = 'sent', sent_at = now() - interval '10 days' where id = v_quote_expired;

  -- ── Devis CIBLE de la session DELEGUEE (scenario 3) : sent, jamais decide ─
  insert into public.commercial_quotes (tenant_id, customer_id, project_id, number, status, valid_until, show_discounts)
    values (v_tenant_a, v_customer_a1, v_project_a1, 'DEV-2026-91007', 'draft', '2099-01-01', true)
    returning id into v_quote_delegated_target;
  insert into public.commercial_quote_lines (quote_id, project_item_id, origin, label, quantity, position, production_price, public_price, customer_price, applied_margin_rate, sale_price, discount_rate, breakdown)
    values (v_quote_delegated_target, null, 'free', 'Devis pour scenario delegue', 1, 0, 100.00, 200.00, 200.00, 1.0000, 200.00, 0.0000, '[{"post":"total","cost":"100.00","margin_rate":"1.0000","price":"200.00","source":"prix_marche"}]'::jsonb);
  perform set_config('magrit.quote_transition', 'true', true);
  update public.commercial_quotes set status = 'sent', sent_at = now() where id = v_quote_delegated_target;

  -- ── Devis d un AUTRE client, meme tenant (isolation inter-client) ───────
  insert into public.commercial_quotes (tenant_id, customer_id, project_id, number, status, valid_until, show_discounts)
    values (v_tenant_a, v_customer_a2, v_project_a2, 'DEV-2026-91005', 'draft', '2099-01-01', true)
    returning id into v_quote_a2_sent;
  insert into public.commercial_quote_lines (quote_id, project_item_id, origin, label, quantity, position, production_price, public_price, customer_price, applied_margin_rate, sale_price, discount_rate, breakdown)
    values (v_quote_a2_sent, null, 'free', 'Devis client A2', 1, 0, 100.00, 200.00, 200.00, 1.0000, 200.00, 0.0000, '[{"post":"total","cost":"100.00","margin_rate":"1.0000","price":"200.00","source":"prix_marche"}]'::jsonb);
  perform set_config('magrit.quote_transition', 'true', true);
  update public.commercial_quotes set status = 'sent', sent_at = now() where id = v_quote_a2_sent;

  -- ── Devis d un AUTRE tenant (isolation inter-tenant) ────────────────────
  insert into public.commercial_quotes (tenant_id, customer_id, project_id, number, status, valid_until, show_discounts)
    values (v_tenant_b, v_customer_b, v_project_b, 'DEV-2026-91006', 'draft', '2099-01-01', true)
    returning id into v_quote_b_sent;
  insert into public.commercial_quote_lines (quote_id, project_item_id, origin, label, quantity, position, production_price, public_price, customer_price, applied_margin_rate, sale_price, discount_rate, breakdown)
    values (v_quote_b_sent, null, 'free', 'Devis tenant B', 1, 0, 100.00, 200.00, 200.00, 1.0000, 200.00, 0.0000, '[{"post":"total","cost":"100.00","margin_rate":"1.0000","price":"200.00","source":"prix_marche"}]'::jsonb);
  perform set_config('magrit.quote_transition', 'true', true);
  update public.commercial_quotes set status = 'sent', sent_at = now() where id = v_quote_b_sent;

  insert into e10_10b_2_context (
    tenant_a, tenant_b, shop_a, customer_a1, customer_a2, customer_b, contact_a1, account_a1,
    token_a1, token_delegated,
    quote_to_accept, quote_to_reject, quote_already_accepted, quote_expired, quote_delegated_target,
    quote_a2_sent, quote_b_sent
  ) values (
    v_tenant_a, v_tenant_b, v_shop_a, v_customer_a1, v_customer_a2, v_customer_b, v_contact_a1, v_account_a1,
    v_token_a1, v_token_delegated,
    v_quote_to_accept, v_quote_to_reject, v_quote_already_accepted, v_quote_expired, v_quote_delegated_target,
    v_quote_a2_sent, v_quote_b_sent
  );

  -- Remet a zero les GUC laisses par la construction du fixture ci-dessus,
  -- pour que le scenario 8 (B7) ne lise pas un residu de CE bloc plutot que
  -- de l appel qu il verifie reellement.
  perform set_config('magrit.quote_transition', '', true);
  perform set_config('magrit.change_set_id', '', true);
end;
$$;

-- ----------------------------------------------------------------------------
-- Chaque scenario se joue en DEUX temps : l APPEL de la fonction sous
-- `set local role anon` (role reel d une session boutique en production —
-- `security definer` bypasse la RLS pour l ECRITURE qu elle fait elle-meme,
-- mais PAS pour une lecture directe de `commercial_quotes` faite APRES par ce
-- fichier de test, qu aucune policy RLS n ouvre a `anon`), puis la
-- VERIFICATION d etat sous le role par defaut (postgres), qui lit les tables
-- directement. Assertions qui ne portent que sur la VALEUR RENDUE par la
-- fonction (id, ou null) restent dans le bloc `anon`.
-- ----------------------------------------------------------------------------

set local role anon;

-- ── 1. ACCEPTER : la fonction rend (id, customer_id) — customer_id NE FAIT
--      PARTIE d AUCUNE representation client, il n est rendu ici que pour
--      permettre a l ADAPTATEUR de publier l evenement sortant sans seconde
--      lecture (contrat, decision #6).
do $$
declare
  v_token text;
  v_quote uuid;
  v_customer uuid;
  v_result record;
begin
  select token_a1, quote_to_accept, customer_a1 into v_token, v_quote, v_customer from e10_10b_2_context;
  select * into v_result from public.api_decide_storefront_quote(v_token, v_quote, 'accepted');
  if v_result.id is distinct from v_quote then
    raise exception 'api_decide_storefront_quote(accepted) doit rendre l id du devis, obtenu %', v_result.id;
  end if;
  if v_result.customer_id is distinct from v_customer then
    raise exception 'api_decide_storefront_quote(accepted) doit rendre le customer_id du devis, obtenu %', v_result.customer_id;
  end if;
end;
$$;

-- ── 2. REFUSER : symetrique exact ──────────────────────────────────────────
do $$
declare
  v_token text;
  v_quote uuid;
  v_result record;
begin
  select token_a1, quote_to_reject into v_token, v_quote from e10_10b_2_context;
  select * into v_result from public.api_decide_storefront_quote(v_token, v_quote, 'rejected');
  if v_result.id is distinct from v_quote then
    raise exception 'api_decide_storefront_quote(rejected) doit rendre l id du devis';
  end if;
end;
$$;

-- ── 3. Session DELEGUEE : refusee ──────────────────────────────────────────
do $$
declare
  v_token_delegated text;
  v_quote uuid;
  v_rejected boolean := false;
begin
  select token_delegated, quote_delegated_target into v_token_delegated, v_quote from e10_10b_2_context;

  begin
    perform public.api_decide_storefront_quote(v_token_delegated, v_quote, 'accepted');
  exception
    when others then
      if sqlerrm like 'quote.decision_forbidden_delegated%' then
        v_rejected := true;
      else
        raise;
      end if;
  end;
  if not v_rejected then
    raise exception 'une session DELEGUEE a pu decider un devis (attendu : quote.decision_forbidden_delegated)';
  end if;
end;
$$;

-- ── 4. Devis pas sent (deja accepted) : refuse ─────────────────────────────
do $$
declare
  v_token text;
  v_quote uuid;
  v_rejected boolean := false;
begin
  select token_a1, quote_already_accepted into v_token, v_quote from e10_10b_2_context;

  begin
    perform public.api_decide_storefront_quote(v_token, v_quote, 'rejected');
  exception
    when others then
      if sqlerrm like 'quote.decision_forbidden_status%' then
        v_rejected := true;
      else
        raise;
      end if;
  end;
  if not v_rejected then
    raise exception 'un devis deja accepted a pu etre redecide (attendu : quote.decision_forbidden_status)';
  end if;
end;
$$;

-- ── 5. Devis sent mais PERIME : refuse ─────────────────────────────────────
do $$
declare
  v_token text;
  v_quote uuid;
  v_rejected boolean := false;
begin
  select token_a1, quote_expired into v_token, v_quote from e10_10b_2_context;

  begin
    perform public.api_decide_storefront_quote(v_token, v_quote, 'accepted');
  exception
    when others then
      if sqlerrm like 'quote.decision_expired%' then
        v_rejected := true;
      else
        raise;
      end if;
  end;
  if not v_rejected then
    raise exception 'un devis perime a pu etre decide (attendu : quote.decision_expired)';
  end if;
end;
$$;

-- ── 6. Isolation inter-client / inter-tenant : null indiscernable ─────────
do $$
declare
  v_token text;
  v_quote_a2 uuid;
  v_quote_b uuid;
begin
  select token_a1, quote_a2_sent, quote_b_sent into v_token, v_quote_a2, v_quote_b from e10_10b_2_context;

  if exists (select 1 from public.api_decide_storefront_quote(v_token, v_quote_a2, 'accepted')) then
    raise exception 'le compte A1 a pu decider un devis du client A2 (meme tenant) — fuite inter-client';
  end if;
  if exists (select 1 from public.api_decide_storefront_quote(v_token, v_quote_b, 'accepted')) then
    raise exception 'le compte A1 (tenant A) a pu decider un devis du tenant B — isolation inter-tenant rompue';
  end if;
end;
$$;

-- ── 7. Jeton de session invalide : zero ligne, jamais une exception ───────
do $$
declare
  v_quote uuid;
begin
  select quote_to_accept into v_quote from e10_10b_2_context;
  if exists (
    select 1 from public.api_decide_storefront_quote(
      'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff', v_quote, 'accepted'
    )
  ) then
    raise exception 'un jeton de session invalide rend autre chose que zero ligne';
  end if;
end;
$$;

-- ── 9. Decision hors enumeration : zero ligne, defense en profondeur ──────
do $$
declare
  v_token text;
  v_quote uuid;
begin
  select token_a1, quote_to_reject into v_token, v_quote from e10_10b_2_context;
  if exists (select 1 from public.api_decide_storefront_quote(v_token, v_quote, 'converted')) then
    raise exception 'une decision hors enumeration (converted) n a pas ete rejetee';
  end if;
end;
$$;

reset role;

-- ── Verification d etat (role par defaut) : scenarios 1 et 2, statut, ─────
--    decided_at/decided_by_account_id, audit d entete.
do $$
declare
  v_quote_accept uuid;
  v_quote_reject uuid;
  v_account uuid;
  v_row record;
  v_audit record;
  v_audit_count integer;
begin
  select quote_to_accept, quote_to_reject, account_a1
    into v_quote_accept, v_quote_reject, v_account
  from e10_10b_2_context;

  select status, decided_at, decided_by_account_id into v_row
  from public.commercial_quotes where id = v_quote_accept;
  if v_row.status <> 'accepted' then
    raise exception 'statut inattendu apres acceptation : %', v_row.status;
  end if;
  if v_row.decided_at is null then
    raise exception 'decided_at doit etre pose apres acceptation';
  end if;
  if v_row.decided_by_account_id <> v_account then
    raise exception 'decided_by_account_id inattendu : % (attendu %)', v_row.decided_by_account_id, v_account;
  end if;

  select action, field, previous_value, new_value, quote_snapshot, actor_id, actor_label into v_audit
  from public.commercial_quote_header_audit
  where quote_id = v_quote_accept and action = 'accepted';
  if not found then
    raise exception 'aucune entree d audit accepted trouvee';
  end if;
  if v_audit.field is not null or v_audit.quote_snapshot is not null then
    raise exception 'field/quote_snapshot doivent etre NULL sur accepted';
  end if;
  if v_audit.previous_value <> 'sent' or v_audit.new_value <> 'accepted' then
    raise exception 'previous_value/new_value inattendus : % / %', v_audit.previous_value, v_audit.new_value;
  end if;
  if v_audit.actor_id is not null then
    raise exception 'actor_id doit rester NULL (ce n est pas un utilisateur Magrit)';
  end if;
  if v_audit.actor_label <> 'Compte A1 Decideur' then
    raise exception 'actor_label inattendu : %', v_audit.actor_label;
  end if;

  if (select status from public.commercial_quotes where id = v_quote_reject) <> 'rejected' then
    raise exception 'statut inattendu apres refus';
  end if;
  select count(*) into v_audit_count
  from public.commercial_quote_header_audit
  where quote_id = v_quote_reject and action = 'rejected' and previous_value = 'sent' and new_value = 'rejected';
  if v_audit_count <> 1 then
    raise exception 'entree d audit rejected manquante ou dupliquee (%)', v_audit_count;
  end if;
end;
$$;

-- ── Verification d etat : scenarios 3/4/5, AUCUNE ecriture n a eu lieu ─────
do $$
declare
  v_quote_delegated uuid;
  v_quote_already_accepted uuid;
  v_quote_expired uuid;
begin
  select quote_delegated_target, quote_already_accepted, quote_expired
    into v_quote_delegated, v_quote_already_accepted, v_quote_expired
  from e10_10b_2_context;

  if (select status from public.commercial_quotes where id = v_quote_delegated) <> 'sent' then
    raise exception 'le statut a change malgre le refus de la session deleguee (scenario 3)';
  end if;
  if (select decided_at from public.commercial_quotes where id = v_quote_delegated) is not null then
    raise exception 'decided_at pose malgre le refus de la session deleguee (scenario 3)';
  end if;

  if (select status from public.commercial_quotes where id = v_quote_already_accepted) <> 'accepted' then
    raise exception 'le statut d un devis deja accepted a change malgre le refus (scenario 4)';
  end if;

  if (select status from public.commercial_quotes where id = v_quote_expired) <> 'sent' then
    raise exception 'le statut d un devis perime a change malgre le refus (scenario 5)';
  end if;
  if (select decided_at from public.commercial_quotes where id = v_quote_expired) is not null then
    raise exception 'decided_at pose malgre le refus de peremption (scenario 5)';
  end if;
end;
$$;

-- ── 8. B7 : GUC de transition/change_set VIDES apres retour ───────────────
--      (verifie DANS LA MEME transaction que ce fichier tout entier, apres
--      les appels — reussis ou refuses — de tous les scenarios ci-dessus).
do $$
declare
  v_transition text;
  v_change_set text;
begin
  v_transition := current_setting('magrit.quote_transition', true);
  v_change_set := current_setting('magrit.change_set_id', true);

  if v_transition is not null and v_transition <> '' then
    raise exception 'B7 : magrit.quote_transition encore % apres le retour de api_decide_storefront_quote (attendu vide/NULL)', v_transition;
  end if;
  if v_change_set is not null and v_change_set <> '' then
    raise exception 'B7 : magrit.change_set_id encore % apres le retour de api_decide_storefront_quote (attendu vide/NULL)', v_change_set;
  end if;
end;
$$;

rollback;
