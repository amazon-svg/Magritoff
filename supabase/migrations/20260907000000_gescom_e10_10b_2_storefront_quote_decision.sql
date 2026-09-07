-- ============================================================================
-- Sprint 5 Gestion commerciale — story E10.10b-2 : decision du client
-- (accepter/refuser un devis depuis le portail boutique). Contrat :
-- openapi/magrit-core.v1.yaml, docs/api/CONVENTIONS.md §8.13quinquies.
-- ----------------------------------------------------------------------------
-- Ce que cette migration fait :
--
--   1. Deux colonnes d entete sur `commercial_quotes` : `decided_at`
--      (timestamptz, instant de la reponse) et `decided_by_account_id`
--      (uuid -> shop_customer_accounts, `on delete set null`). PREMIERE
--      ecriture de cette table jamais servie a un acteur qui n est PAS membre
--      du tenant.
--
--   2. `commercial_quote_header_audit` gagne deux actions, `accepted` et
--      `rejected` — memes contraintes de forme que `resent`/`duplicated`/
--      `status_forced` (ni `field` ni `quote_snapshot`, l instantane pris a
--      l envoi faisant deja foi, un devis `sent` etant immuable). Ce sont les
--      deux SEULES actions de ce journal dont l auteur n est pas un membre de
--      l espace : `actor_id` y reste NULL, `actor_label` porte le libelle
--      FIGE du compte boutique.
--
--   3. `api_decide_storefront_quote` — ACCEPTE ou REFUSE un devis `sent`, EN
--      UNE SEULE TRANSACTION : visibilite (4 causes indiscernables, memes que
--      `api_get_storefront_quote`), session DELEGUEE refusee, garde de statut,
--      garde de peremption (meme expression que `expired`, calculee EN BASE),
--      transition ATOMIQUE (`update ... where status = 'sent'`, `found`
--      teste DANS LA MEME instruction que la garde), ecriture d audit. Rend
--      `table (id uuid, customer_id uuid)` — ZERO LIGNE sur les 4 causes de
--      visibilite, JAMAIS une exception — plutot qu un simple `uuid` :
--      `customer_id` n entre dans AUCUNE representation servie au client,
--      mais l ADAPTATEUR (couche application) en a besoin pour publier
--      l EVENEMENT sortant (`QuoteDecisionPayload.customer_id`) sans une
--      seconde lecture.
--      `security definer`, `grant execute to anon` (meme regime que les deux
--      fonctions de lecture : c est la seule facon dont une session boutique
--      peut jamais l appeler, aucun JWT n existant pour ce mode) — d ou la
--      RE-VERIFICATION COMPLETE du jeton et de la chaine d autorisation a
--      l interieur meme de la fonction, jamais un `accountId` recu en clair.
--
--      Echappatoire d immuabilite (`magrit.quote_transition`,
--      `commercial_quotes_require_draft_before_write()`, migration
--      20260906160000) posee puis REMISE A VIDE explicitement avant CHAQUE
--      retour, y compris les retours d echec — meme correctif que B7
--      (E10.10a round 5, §8.12bis) : `set_config(nom, valeur, true)` a la
--      semantique de `SET LOCAL`, portee par la TRANSACTION englobante, pas
--      par la fonction, et ne pas la remettre a vide rouvrirait le trou que
--      B3 visait a fermer pour tout enchainement dans la meme transaction.
--
--   4. Dette v3 (renforcement `tenant_id`), §8.13quater/§8.13quinquies : les
--      deux fonctions de LECTURE de la migration 20260906170000
--      (`api_list_storefront_quotes`, `api_get_storefront_quote`) sont
--      REMPLACEES ICI par `create or replace function`, JAMAIS par une
--      edition de cette migration deja passee — meme discipline que la lecon
--      d E10.10a (§8.12, "erreur de process") : `create or replace` est
--      correct que la migration source soit deployee ou non sur le projet
--      partage, une edition en place ne l est pas. Le seul changement de
--      comportement est l ajout d une jointure EXPLICITE
--      `shops.tenant_id = customers.tenant_id`, en defense en profondeur du
--      trigger `enforce_shop_customer_contact_tenant_match()` (E10.5) : ces
--      deux fonctions restent `grant execute to anon`, donc joignables en RPC
--      PostgREST direct, hors de toute Edge Function. La fonction d ECRITURE
--      ci-dessus porte le MEME renforcement des sa premiere version — une
--      ecriture qui franchirait une frontiere de tenant ne se rattrape pas
--      comme une lecture.
--
--   5. Correctif de socle (§8.13quinquies, "trois points que dev-story ne
--      doit pas decouvrir en route", point 1) : la cle d idempotence STOCKEE
--      pour un `ShopCustomerPrincipal` derive desormais du COMPTE (pas
--      seulement de l espace) — voir `src/server/api/gescom-middleware.ts`.
--      Sans changement de SCHEMA, ce correctif ne vit pas dans cette
--      migration ; mentionne ici pour que le lien avec la story soit clair a
--      la lecture de ce fichier.
--
-- Nommage des codes d erreur, cote base, traduits par l adaptateur Supabase
-- (`mapStorefrontQuoteDecisionError()`) : `quote.decision_forbidden_delegated`,
-- `quote.decision_forbidden_status`, `quote.decision_expired`. La visibilite
-- (4 causes) rend `null`, jamais une exception — meme discipline que
-- `api_get_storefront_quote`, traduite par la route en 404 `quote.not_found`.
-- ============================================================================

-- ── 1. Colonnes d entete ─────────────────────────────────────────────────────
alter table public.commercial_quotes
  add column if not exists decided_at             timestamptz,
  add column if not exists decided_by_account_id  uuid references public.shop_customer_accounts(id) on delete set null;

comment on column public.commercial_quotes.decided_at is
  'E10.10b-2 — instant ou le CLIENT a repondu (accepte/refuse) depuis sa boutique. NULL tant qu il n a pas repondu ; ne bouge jamais ensuite (decision terminale).';
comment on column public.commercial_quotes.decided_by_account_id is
  'E10.10b-2 — compte client boutique (shop_customer_accounts) qui a repondu. NOMME PAR SON ESPACE DE NOMS (`_account_id`), distinct de sent_by/created_by qui sont des utilisateurs Magrit : ce n est PAS une reference auth.users. `on delete set null` : la reponse survit a la suppression du compte, son libelle etant deja fige dans le journal d entete (actor_label).';

-- ── 2. Journal d entete : deux actions de plus, memes contraintes de forme
--      que resent/duplicated/status_forced (ni field ni quote_snapshot) ─────
alter table public.commercial_quote_header_audit
  drop constraint if exists commercial_quote_header_audit_action_check,
  add constraint commercial_quote_header_audit_action_check
    check (action in ('updated', 'sent', 'resent', 'duplicated', 'status_forced', 'accepted', 'rejected'));

alter table public.commercial_quote_header_audit
  drop constraint if exists commercial_quote_header_audit_shape,
  add constraint commercial_quote_header_audit_shape check (
    (action = 'updated' and field is not null and quote_snapshot is null)
    or (action = 'sent' and field is null and quote_snapshot is not null)
    or (action in ('resent', 'duplicated', 'status_forced', 'accepted', 'rejected') and field is null and quote_snapshot is null)
  );

-- ── 3. Dette v3 — renforcement tenant_id sur les DEUX fonctions de lecture,
--      REMPLACEES ici, jamais editees dans 20260906170000 ────────────────────
create or replace function public.api_list_storefront_quotes(
  p_opaque_token text,
  p_status text default null,
  p_limit integer default 51,
  p_cursor_issued_at timestamptz default null,
  p_cursor_id uuid default null
)
returns table (
  id uuid,
  number text,
  status text,
  issued_at timestamptz,
  valid_until date,
  expired boolean,
  lines_subtotal numeric(12,2),
  global_discount numeric(12,2),
  effective_discount_rate numeric(6,4),
  net_total numeric(12,2),
  vat_rate numeric(6,4),
  vat_regime text,
  vat_amount numeric(12,2),
  total_incl_tax numeric(12,2)
)
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare
  v_session record;
  v_customer_id uuid;
  v_tenant_id uuid;
  v_limit integer;
begin
  if p_opaque_token is null
     or length(p_opaque_token) not between 32 and 512
     or p_opaque_token !~ '^[A-Za-z0-9_-]+$' then
    return;
  end if;

  select * into v_session from public.api_resolve_shop_customer_session(p_opaque_token);
  if v_session.account_id is null then
    return;
  end if;

  -- Dette v3 (§8.13quater/§8.13quinquies) — jointure EXPLICITE shops.tenant_id,
  -- en defense en profondeur du trigger enforce_shop_customer_contact_tenant_
  -- match() (E10.5) : cette fonction est grant execute to anon, joignable en
  -- RPC direct hors facade.
  select s.tenant_id into v_tenant_id from public.shops s where s.id = v_session.shop_id;
  if v_tenant_id is null then
    return;
  end if;

  select cc.customer_id into v_customer_id
  from public.shop_customer_accounts sca
  join public.customer_contacts cc on cc.id = sca.customer_contact_id
  where sca.id = v_session.account_id;

  -- CA7 (contrat) — compte sans interlocuteur rattache : liste vide, pas
  -- d exception. `return` sans `return query` rend un ensemble de zero ligne.
  if v_customer_id is null then
    return;
  end if;

  -- Un filtre incoherent (valeur hors enumeration StorefrontQuoteStatus,
  -- notamment 'draft') rend une liste vide plutot qu une erreur : le contrat
  -- Zod refuse deja 'draft' en amont (`status?: StorefrontQuoteStatus`), ceci
  -- est une seconde ligne de defense au cas ou la fonction serait appelee
  -- directement avec une valeur non prevue.
  if p_status is not null and p_status not in ('sent', 'accepted', 'rejected', 'converted') then
    return;
  end if;

  v_limit := greatest(least(coalesce(p_limit, 51), 201), 1);

  return query
  select
    q.id,
    q.number,
    q.status,
    q.sent_at,
    q.valid_until,
    -- `expired` : meme frontiere que computeQuoteWarnings() (TypeScript,
    -- quote-totals.ts) — valid_until est une DATE seule, la borne haute est
    -- le lendemain a minuit UTC (exclusive), pour qu un devis valide
    -- "jusqu au" jour J le reste toute la journee J.
    (q.valid_until is not null and (now() at time zone 'utc') >= ((q.valid_until + 1)::timestamp)) as expired,
    t.lines_subtotal,
    t.global_discount,
    t.effective_discount_rate,
    t.net_total,
    t.vat_rate,
    t.vat_regime,
    t.vat_amount,
    t.total_incl_tax
  from public.commercial_quotes q
  join public.customers c on c.id = q.customer_id
  cross join lateral private.commercial_quote_totals(q.id) t
  where q.customer_id = v_customer_id
    -- Dette v3 : renforcement EXPLICITE, plutot que de s en remettre au seul
    -- trigger enforce_shop_customer_contact_tenant_match() (E10.5).
    and c.tenant_id = v_tenant_id
    -- `draft` n existe jamais de ce cote (contrat) : la visibilite commence a
    -- l envoi et ne se retire plus.
    and q.status in ('sent', 'accepted', 'rejected', 'converted')
    and (p_status is null or q.status = p_status)
    and (
      p_cursor_issued_at is null
      or q.sent_at < p_cursor_issued_at
      or (q.sent_at = p_cursor_issued_at and q.id < p_cursor_id)
    )
  order by q.sent_at desc, q.id desc
  limit v_limit;
end;
$$;

comment on function public.api_list_storefront_quotes(text, text, integer, timestamptz, uuid) is
  'E10.10b-1 (renforcee E10.10b-2, dette v3) — GET /storefront-quotes. Devis sent/accepted/rejected/converted du client rattache au compte boutique de la session, jamais draft. Compte sans interlocuteur -> zero ligne, pas d exception (CA7 du contrat). Jointure EXPLICITE shops.tenant_id = customers.tenant_id en defense en profondeur.';

revoke all on function public.api_list_storefront_quotes(text, text, integer, timestamptz, uuid) from public, authenticated;
grant execute on function public.api_list_storefront_quotes(text, text, integer, timestamptz, uuid) to anon;

create or replace function public.api_get_storefront_quote(
  p_opaque_token text,
  p_quote_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare
  v_session record;
  v_customer_id uuid;
  v_tenant_id uuid;
  v_quote_id uuid;
  v_number text;
  v_status text;
  v_sent_at timestamptz;
  v_valid_until date;
  v_show_discounts boolean;
  v_expired boolean;
  v_totals record;
  v_lines jsonb;
begin
  if p_opaque_token is null
     or length(p_opaque_token) not between 32 and 512
     or p_opaque_token !~ '^[A-Za-z0-9_-]+$'
     or p_quote_id is null then
    return null;
  end if;

  select * into v_session from public.api_resolve_shop_customer_session(p_opaque_token);
  if v_session.account_id is null then
    return null;
  end if;

  -- Dette v3 : voir api_list_storefront_quotes ci-dessus, meme raisonnement.
  select s.tenant_id into v_tenant_id from public.shops s where s.id = v_session.shop_id;
  if v_tenant_id is null then
    return null;
  end if;

  select cc.customer_id into v_customer_id
  from public.shop_customer_accounts sca
  join public.customer_contacts cc on cc.id = sca.customer_contact_id
  where sca.id = v_session.account_id;

  if v_customer_id is null then
    return null;
  end if;

  -- 404 INDISCERNABLE (contrat) : identifiant inconnu, devis d un autre
  -- client, devis d un autre tenant (deja exclu par le join customer_id, qui
  -- est scope au tenant du client, RENFORCE ici par c.tenant_id), devis
  -- encore draft — les quatre rendent exactement le meme `null`, jamais
  -- distingues.
  select q.id, q.number, q.status, q.sent_at, q.valid_until, q.show_discounts
    into v_quote_id, v_number, v_status, v_sent_at, v_valid_until, v_show_discounts
  from public.commercial_quotes q
  join public.customers c on c.id = q.customer_id
  where q.id = p_quote_id
    and q.customer_id = v_customer_id
    and c.tenant_id = v_tenant_id
    and q.status in ('sent', 'accepted', 'rejected', 'converted');

  if not found then
    return null;
  end if;

  select * into v_totals from private.commercial_quote_totals(v_quote_id);

  v_expired := v_valid_until is not null
    and (now() at time zone 'utc') >= ((v_valid_until + 1)::timestamp);

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', l.id,
      'label', l.label,
      'product_config', l.product_config,
      'quantity', l.quantity,
      'position', l.position,
      'price_before_discount', case when v_show_discounts then l.customer_price else null end,
      'discount_rate', case when v_show_discounts then l.discount_rate else null end,
      'price', l.sale_price
    ) order by l.position), '[]'::jsonb)
    into v_lines
  from public.commercial_quote_lines l
  where l.quote_id = v_quote_id;

  return jsonb_build_object(
    'id', v_quote_id,
    'number', v_number,
    'status', v_status,
    'issued_at', v_sent_at,
    'valid_until', v_valid_until,
    'expired', v_expired,
    'totals', jsonb_build_object(
      'lines_subtotal', v_totals.lines_subtotal,
      'global_discount', v_totals.global_discount,
      'effective_discount_rate', v_totals.effective_discount_rate,
      'net_total', v_totals.net_total,
      'vat_rate', v_totals.vat_rate,
      'vat_regime', v_totals.vat_regime,
      'vat_amount', v_totals.vat_amount,
      'total_incl_tax', v_totals.total_incl_tax
    ),
    'lines', v_lines
  );
end;
$$;

comment on function public.api_get_storefront_quote(text, uuid) is
  'E10.10b-1 (renforcee E10.10b-2, dette v3) — GET /storefront-quotes/{quoteId}. Rend null (traduit en 404 quote.not_found par la route) sur les quatre causes indiscernables : session invalide, compte sans interlocuteur, devis d un autre client/tenant, devis encore draft. Jointure EXPLICITE shops.tenant_id = customers.tenant_id en defense en profondeur.';

revoke all on function public.api_get_storefront_quote(text, uuid) from public, authenticated;
grant execute on function public.api_get_storefront_quote(text, uuid) to anon;

-- ── 4. DECISION du client — api_decide_storefront_quote ─────────────────────
-- `security definer`, `grant execute to anon` : seule facon dont une session
-- boutique peut jamais l appeler (aucun JWT n existe pour ce mode). RE-
-- VERIFIE donc ELLE-MEME l integralite de la chaine d autorisation, jamais un
-- `accountId` recu en clair (meme raisonnement que les deux fonctions de
-- lecture ci-dessus, §8.13bis).
--
-- ORDRE DES REFUS, normatif (contrat, decision #3) : visibilite (aucune ligne
-- rendue, PAS une exception) -> session deleguee -> statut -> peremption ->
-- transition ATOMIQUE. La precondition (`If-Match`) n est PAS verifiee ici :
-- c est une garde applicative (ETag calcule sur la representation JSON
-- complete), verifiee par la ROUTE avant cet appel, meme discipline que
-- sendQuote.
--
-- RETOUR `table (id, customer_id)`, PAS un simple `uuid` : `customer_id` ne
-- fait PARTIE d AUCUNE representation servie au client (liste blanche
-- StorefrontQuote*, contrat b-1, decision #2) mais l ADAPTATEUR (couche
-- application, jamais expose au client) en a besoin pour publier
-- `quote.accepted`/`quote.rejected` (`QuoteDecisionPayload.customer_id`,
-- contrat, decision #6) sans une seconde lecture. Zero ligne = visibilite
-- refusee (traduit en 404 par la route), exactement comme un `uuid` NULL
-- l aurait fait.
create or replace function public.api_decide_storefront_quote(
  p_opaque_token text,
  p_quote_id uuid,
  p_decision text
)
returns table (
  id uuid,
  customer_id uuid
)
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare
  v_session record;
  v_customer_id uuid;
  v_tenant_id uuid;
  v_status text;
  v_valid_until date;
  v_label text;
  v_change_set uuid := gen_random_uuid();
  v_updated_id uuid;
begin
  if p_opaque_token is null
     or length(p_opaque_token) not between 32 and 512
     or p_opaque_token !~ '^[A-Za-z0-9_-]+$'
     or p_quote_id is null
     or p_decision not in ('accepted', 'rejected') then
    return;
  end if;

  select * into v_session from public.api_resolve_shop_customer_session(p_opaque_token);
  if v_session.account_id is null then
    return;
  end if;

  select s.tenant_id into v_tenant_id from public.shops s where s.id = v_session.shop_id;
  if v_tenant_id is null then
    return;
  end if;

  select cc.customer_id into v_customer_id
  from public.shop_customer_accounts sca
  join public.customer_contacts cc on cc.id = sca.customer_contact_id
  where sca.id = v_session.account_id;

  if v_customer_id is null then
    return;
  end if;

  -- 404 INDISCERNABLE, memes quatre causes que api_get_storefront_quote,
  -- CETTE operation n en ajoute aucune : un devis deja accepted/rejected/
  -- converted reste VISIBLE (il n est simplement plus decidable, 409 plus
  -- bas), seul un devis encore draft ou d un autre client/tenant est absent
  -- d ici.
  select q.status, q.valid_until into v_status, v_valid_until
  from public.commercial_quotes q
  join public.customers c on c.id = q.customer_id
  where q.id = p_quote_id
    and q.customer_id = v_customer_id
    and c.tenant_id = v_tenant_id
    and q.status in ('sent', 'accepted', 'rejected', 'converted');

  if not found then
    return;
  end if;

  -- SESSION DELEGUEE : refusee (contrat §8.13quinquies, confirme §8.13 point
  -- 7). Un membre qui depanne un client LIT comme lui, il n ENGAGE jamais a
  -- sa place — le journal perdrait sa valeur de preuve.
  if v_session.session_kind = 'delegated' then
    raise exception 'quote.decision_forbidden_delegated: session deleguee, devis %', p_quote_id;
  end if;

  if v_status <> 'sent' then
    raise exception 'quote.decision_forbidden_status: devis % a l etat % (sent requis)', p_quote_id, v_status;
  end if;

  -- PEREMPTION : MEME expression EXACTE que StorefrontQuote.expired
  -- (api_list_storefront_quotes/api_get_storefront_quote), verifiee DANS la
  -- transaction qui pose le statut, pas dans une lecture prealable.
  if v_valid_until is not null and (now() at time zone 'utc') >= ((v_valid_until + 1)::timestamp) then
    raise exception 'quote.decision_expired: devis % perime (valid_until %)', p_quote_id, v_valid_until;
  end if;

  v_label := coalesce(nullif(btrim(v_session.full_name), ''), v_session.email);

  -- Echappatoire d immuabilite (commercial_quotes_require_draft_before_write,
  -- migration 20260906160000) : POSEE puis REMISE A VIDE avant CHAQUE retour
  -- (correctif B7, E10.10a round 5) — set_config(..., true) est porte par la
  -- TRANSACTION englobante, pas par cette fonction.
  perform set_config('magrit.change_set_id', v_change_set::text, true);
  perform set_config('magrit.quote_transition', 'true', true);

  -- TRANSITION ATOMIQUE (contrat, "trois points que dev-story ne doit pas
  -- decouvrir en route", point 3) : la garde de statut ET l ecriture sont LA
  -- MEME instruction, `found` teste juste apres. Deux decisions concurrentes
  -- ne peuvent pas franchir ce controle toutes les deux : la seconde trouve
  -- `status <> 'sent'` et `v_updated_id` reste NULL, quel que soit ce que le
  -- premier `select` ci-dessus avait vu quelques instants plus tot.
  -- Alias `cq` OBLIGATOIRE : cette fonction `returns table (id uuid, ...)`
  -- introduit un parametre de sortie NOMME `id`, qui rendrait `where id =
  -- ...`/`returning id` ambigus avec la colonne `commercial_quotes.id`
  -- (erreur Postgres reelle, trouvee par l execution du cas SQL — pas
  -- seulement une precaution de style).
  update public.commercial_quotes cq
     set status = p_decision,
         decided_at = now(),
         decided_by_account_id = v_session.account_id
   where cq.id = p_quote_id
     and cq.status = 'sent'
  returning cq.id into v_updated_id;

  if v_updated_id is null then
    perform set_config('magrit.quote_transition', '', true);
    perform set_config('magrit.change_set_id', '', true);
    raise exception 'quote.decision_forbidden_status: devis % modifie entre-temps (sent requis)', p_quote_id;
  end if;

  -- Audit d entete (contrat, "audit d entete : ce que dev-story doit
  -- ecrire") : field/quote_snapshot NULL (l instantane pris a l envoi fait
  -- deja foi, un devis sent etant immuable), previous_value='sent',
  -- new_value=la decision, actor_id NULL (ce n est PAS un utilisateur
  -- Magrit), actor_label = libelle FIGE du compte boutique.
  insert into public.commercial_quote_header_audit
    (quote_id, change_set_id, action, field, previous_value, new_value, quote_snapshot, actor_id, actor_label)
  values
    (p_quote_id, v_change_set, p_decision, null, 'sent', p_decision, null, null, v_label);

  perform set_config('magrit.quote_transition', '', true);
  perform set_config('magrit.change_set_id', '', true);

  return query select v_updated_id, v_customer_id;
end;
$$;

comment on function public.api_decide_storefront_quote(text, uuid, text) is
  'E10.10b-2 — POST /storefront-quotes/{quoteId}/decisions. Transition ATOMIQUE sent -> accepted/rejected (update ... where status=''sent'', found teste dans la meme instruction). Rend ZERO LIGNE sur les 4 causes indiscernables de visibilite (comme api_get_storefront_quote) ; leve quote.decision_forbidden_delegated / quote.decision_forbidden_status / quote.decision_expired sinon. customer_id est rendu pour l EVENEMENT sortant (QuoteDecisionPayload), jamais pour la representation client. RE-VERIFIE elle-meme la session (grant execute to anon).';

revoke all on function public.api_decide_storefront_quote(text, uuid, text) from public, authenticated;
grant execute on function public.api_decide_storefront_quote(text, uuid, text) to anon;

notify pgrst, 'reload schema';

-- ============================================================================
-- REVERSIBILITE — le CLI Supabase ne gere pas de bloc `down`. SQL de retrait,
-- a jouer tel quel dans une migration inverse si la story est annulee :
--
--   revoke execute on function public.api_decide_storefront_quote(text, uuid, text) from anon;
--   drop function if exists public.api_decide_storefront_quote(text, uuid, text);
--
--   -- Restaure les DEUX fonctions de lecture a leur forme 20260906170000
--   -- (sans jointure customers/tenant_id) — voir ce fichier pour le corps
--   -- exact a rejouer via create or replace function.
--
--   alter table public.commercial_quote_header_audit
--     drop constraint if exists commercial_quote_header_audit_shape,
--     add constraint commercial_quote_header_audit_shape check (
--       (action = 'updated' and field is not null and quote_snapshot is null)
--       or (action = 'sent' and field is null and quote_snapshot is not null)
--       or (action in ('resent', 'duplicated', 'status_forced') and field is null and quote_snapshot is null)
--     );
--   alter table public.commercial_quote_header_audit
--     drop constraint if exists commercial_quote_header_audit_action_check,
--     add constraint commercial_quote_header_audit_action_check
--       check (action in ('updated', 'sent', 'resent', 'duplicated', 'status_forced'));
--
--   alter table public.commercial_quotes
--     drop column if exists decided_by_account_id,
--     drop column if exists decided_at;
--   notify pgrst, 'reload schema';
--
-- Retrait sans effet de bord sur les autres tables : aucune n a ete creee par
-- cette migration, et decided_by_account_id est la seule nouvelle reference
-- entrante vers shop_customer_accounts (on delete set null, pas de cascade).
-- ============================================================================
