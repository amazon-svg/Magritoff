-- ============================================================================
-- Sprint 5 Gestion commerciale — story E10.10b-1 : lecture des devis dans le
-- portail client (troisieme mode d authentification de la facade E10,
-- `storefrontSession`), docs/api/CONVENTIONS.md §8.13.
-- ----------------------------------------------------------------------------
-- ── Pourquoi PAS une policy RLS sur commercial_quotes/commercial_quote_lines ─
-- Precedent constant du storefront (`api_get_storefront_portal_orders`,
-- 20260817000200) : l autorisation d un compte `shop_customer_accounts` passe
-- par une fonction `security definer`, jamais par une policy RLS ouverte aux
-- roles client. Ouvrir `commercial_quotes` a un second axe RLS (« OU
-- l appelant est un compte boutique dont l interlocuteur... ») aurait exige
-- de GRANT select a `anon`/`authenticated` sur une table aujourd hui fermee
-- a ces roles, pour un gain nul : les deux fonctions ci-dessous expriment
-- exactement la meme chaine d autorisation
-- (`commercial_quotes.customer_id -> customers -> customer_contacts ->
-- shop_customer_accounts`, E10.5) sans elargir la surface.
--
-- ── p_opaque_token, PAS p_shop_customer_account_id ──────────────────────────
-- Les deux fonctions RE-VERIFIENT le cookie de session (`p_opaque_token`) au
-- lieu de recevoir un `shop_customer_account_id` deja resolu, alors que le
-- texte de cadrage de la story suggerait ce second parametre. Deviation
-- assumee, motif : ces fonctions sont GRANT EXECUTE a `anon`, donc joignables
-- directement par quiconque detient la cle anonyme publique (PostgREST RPC),
-- en dehors de toute Edge Function. Un `p_shop_customer_account_id` fourni en
-- clair par l appelant y serait un IDENTIFIANT NON AUTHENTIFIE : n importe qui
-- pourrait lire les devis de n importe quel compte en enumerant des UUID.
-- `p_opaque_token` est la SEULE donnee que l appelant ne peut pas forger :
-- meme mecanisme de verification que `api_get_storefront_portal_orders` et
-- `api_resolve_shop_customer_session`, reutilise ici tel quel via
-- `public.api_resolve_shop_customer_session()` — aucune reimplementation de
-- la validation de session.
--
-- ── show_discounts : filtre EN BASE, jamais un champ transmis ───────────────
-- `private.commercial_quote_totals()` et `api_get_storefront_quote()` mettent
-- `null` aux champs sensibles a l interieur meme du SQL quand
-- `commercial_quotes.show_discounts = false`, PAS dans un mapping TypeScript
-- en aval : ces fonctions sont directement joignables (GRANT EXECUTE anon),
-- un filtrage seulement cote adaptateur laisserait fuir la remise a quiconque
-- appelle la fonction sans passer par la facade.
--
-- ── 404 indiscernable (4 causes) ─────────────────────────────────────────────
-- `api_get_storefront_quote` rend `null` (pas d exception) sur les quatre cas
-- distincts : session invalide, compte sans interlocuteur, devis d un autre
-- client/tenant, devis encore `draft`. La route HTTP traduit UN SEUL `null` en
-- 404 `quote.not_found`, sans jamais savoir laquelle des quatre causes s est
-- produite — c est la fonction elle-meme qui rend l ambiguite possible en ne
-- distinguant jamais ces cas dans sa valeur de retour.
-- ============================================================================

-- ── Principal `shop_customer` pour la facade Gestion commerciale ───────────
-- Reutilise `api_resolve_shop_customer_session` (20260816000500/20260816000800)
-- SANS le modifier : cette fonction est deja consommee par sept fonctions
-- storefront existantes, en changer la forme de retour serait une onde de
-- choc hors perimetre de cette story. `api_resolve_shop_customer_principal`
-- est un wrapper ADDITIF qui enrichit la session resolue de ce que la facade
-- E10 a besoin de connaitre pour construire un `ShopCustomerPrincipal`
-- (tenant_id, customer_id) sans toucher a l existant.
create or replace function public.api_resolve_shop_customer_principal(p_opaque_token text)
returns table (
  account_id uuid,
  shop_id uuid,
  tenant_id uuid,
  customer_id uuid,
  session_kind text
)
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare
  v_session record;
begin
  select * into v_session from public.api_resolve_shop_customer_session(p_opaque_token);
  if v_session.account_id is null then
    return;
  end if;

  return query
  select
    v_session.account_id,
    v_session.shop_id,
    s.tenant_id,
    cc.customer_id,
    v_session.session_kind
  from public.shops s
  left join public.shop_customer_accounts sca on sca.id = v_session.account_id
  left join public.customer_contacts cc on cc.id = sca.customer_contact_id
  where s.id = v_session.shop_id;
end;
$$;

comment on function public.api_resolve_shop_customer_principal(text) is
  'E10.10b-1 — enrichit api_resolve_shop_customer_session() de tenant_id (shops.tenant_id) et customer_id (E10.5, NULL si aucun interlocuteur rattache). Consomme par SupabaseApiPrincipalVerifier pour construire un ShopCustomerPrincipal.';

revoke all on function public.api_resolve_shop_customer_principal(text) from public, authenticated;
grant execute on function public.api_resolve_shop_customer_principal(text) to anon;

-- ── Totaux (StorefrontQuoteTotals), meme arithmetique que QuoteTotals (E10.10a) ─
-- Fonction PRIVEE (jamais grantee a anon/authenticated) : elle n est jamais
-- appelee directement, seulement DEPUIS les deux fonctions api_* ci-dessous,
-- qui ont deja verifie l acces au devis avant de l invoquer. Facteur commun
-- entre listStorefrontQuotes et getStorefrontQuote pour que l arithmetique ne
-- diverge jamais entre les deux operations.
create or replace function private.commercial_quote_totals(p_quote_id uuid)
returns table (
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
stable
set search_path = pg_catalog, public, private
as $$
declare
  v_global_discount_rate numeric(6,4);
  v_target_net_total numeric(12,2);
  v_vat_rate_override numeric(6,4);
  v_show_discounts boolean;
  v_tenant_tax_regime text;
  v_subtotal numeric(12,2);
  v_net_total numeric(12,2);
  v_global_discount numeric(12,2);
  v_effective_rate_raw numeric;
  v_effective_discount_rate numeric(6,4);
  v_raw_vat_rate numeric(6,4);
  v_vat_regime text;
  v_vat_amount numeric(12,2);
  v_total_incl_tax numeric(12,2);
begin
  select q.global_discount_rate, q.target_net_total, q.vat_rate, q.show_discounts, t.tax_regime::text
    into v_global_discount_rate, v_target_net_total, v_vat_rate_override, v_show_discounts, v_tenant_tax_regime
  from public.commercial_quotes q
  join public.tenants t on t.id = q.tenant_id
  where q.id = p_quote_id;

  if not found then
    return;
  end if;

  select coalesce(sum(l.sale_price), 0)::numeric(12,2) into v_subtotal
  from public.commercial_quote_lines l
  where l.quote_id = p_quote_id;

  -- Meme ordre CONTRACTUEL que computeQuoteTotals() (TypeScript,
  -- src/modules/commercial-quotes/application/quote-totals.ts) : sous-total
  -- -> net_total (cible OU taux OU sous-total tel quel) -> remise DEDUITE ->
  -- TVA en bas. round(numeric, n) de PostgreSQL arrondit au plus proche,
  -- moitie a l ecart de zero (deja etabli et exploite par le backfill E10.9,
  -- migration 20260904000100) : meme regle que roundDivHalfAwayFromZero cote
  -- TypeScript.
  if v_target_net_total is not null then
    v_net_total := v_target_net_total;
  elsif v_global_discount_rate is not null then
    v_net_total := round(v_subtotal * (1 - v_global_discount_rate), 2);
  else
    v_net_total := v_subtotal;
  end if;

  -- `net_total` est MoneyNonNegative (contrat) : ne peut jamais etre negatif
  -- ici en theorie (target_net_total >= 0 des la validation d ecriture,
  -- global_discount_rate <= 1.0000) ; clamp en DEFENSE, jamais leve.
  if v_net_total < 0 then
    v_net_total := 0;
  end if;

  v_global_discount := v_subtotal - v_net_total;

  if v_subtotal <> 0 then
    v_effective_rate_raw := round(v_global_discount / v_subtotal, 4);
    -- numeric(6,4) : au-dela de 99.9999 (ou en deca de -99.9999), le taux
    -- n est pas representable — assigner directement ferait lever une
    -- erreur "numeric field overflow" au lieu de rendre null (meme borne que
    -- isRateRepresentable() cote TypeScript).
    if v_effective_rate_raw > 99.9999 or v_effective_rate_raw < -99.9999 then
      v_effective_discount_rate := null;
    else
      v_effective_discount_rate := v_effective_rate_raw;
    end if;
  else
    v_effective_discount_rate := null;
  end if;

  -- Meme table que TAX_REGIME_RATES (TypeScript, quote-totals.ts), portee ICI
  -- cote SQL pour la meme raison qu elle est deja portee deux fois cote
  -- TypeScript (commentaire d origine, quote-totals.ts) : donnee LEGALE, pas
  -- un reglage, dupliquer plutot qu importer un module UI depuis une fonction
  -- SQL (qui ne peut de toute facon importer aucun module).
  v_raw_vat_rate := coalesce(
    v_vat_rate_override,
    case v_tenant_tax_regime
      when 'metropole_fr' then 0.2000
      when 'dom_tom' then 0.0850
      when 'franchise_tva' then 0.0000
      when 'export_eu' then 0.0000
      when 'export_world' then 0.0000
      else 0.0000
    end
  );
  -- Defense en profondeur (meme raisonnement que le clamp TypeScript,
  -- qa-review E10.10a round 1 B1) : vat_rate est deja contraint >= 0 en
  -- ecriture (CHECK commercial_quotes_vat_rate_non_negative), ce clamp ne
  -- protege qu une donnee corrompue par un autre biais.
  if v_raw_vat_rate < 0 then
    v_raw_vat_rate := 0;
  end if;
  v_vat_regime := case when v_vat_rate_override is not null then null else v_tenant_tax_regime end;
  v_vat_amount := round(v_net_total * v_raw_vat_rate, 2);
  v_total_incl_tax := v_net_total + v_vat_amount;

  return query select
    -- show_discounts = false : lines_subtotal/global_discount/
    -- effective_discount_rate valent null. net_total/vat_*/total_incl_tax
    -- restent TOUJOURS renseignes (contrat StorefrontQuoteTotals).
    case when v_show_discounts then v_subtotal else null end,
    case when v_show_discounts then v_global_discount else null end,
    case when v_show_discounts then v_effective_discount_rate else null end,
    v_net_total,
    v_raw_vat_rate,
    v_vat_regime,
    v_vat_amount,
    v_total_incl_tax;
end;
$$;

comment on function private.commercial_quote_totals(uuid) is
  'E10.10b-1 — StorefrontQuoteTotals, meme arithmetique que QuoteTotals (E10.10a). Fonction PRIVEE : jamais grantee, appelee uniquement depuis api_list_storefront_quotes/api_get_storefront_quote qui ont deja verifie l acces au devis.';

revoke all on function private.commercial_quote_totals(uuid) from public, anon, authenticated;

-- ── GET /storefront-quotes (listStorefrontQuotes) ───────────────────────────
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
  cross join lateral private.commercial_quote_totals(q.id) t
  where q.customer_id = v_customer_id
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
  'E10.10b-1 — GET /storefront-quotes. Devis sent/accepted/rejected/converted du client rattache au compte boutique de la session, jamais draft. Compte sans interlocuteur -> zero ligne, pas d exception (CA7 du contrat).';

revoke all on function public.api_list_storefront_quotes(text, text, integer, timestamptz, uuid) from public, authenticated;
grant execute on function public.api_list_storefront_quotes(text, text, integer, timestamptz, uuid) to anon;

-- ── GET /storefront-quotes/{quoteId} (getStorefrontQuote) ───────────────────
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

  select cc.customer_id into v_customer_id
  from public.shop_customer_accounts sca
  join public.customer_contacts cc on cc.id = sca.customer_contact_id
  where sca.id = v_session.account_id;

  if v_customer_id is null then
    return null;
  end if;

  -- 404 INDISCERNABLE (contrat) : identifiant inconnu, devis d un autre
  -- client, devis d un autre tenant (deja exclu par le join customer_id, qui
  -- est scope au tenant du client), devis encore draft — les quatre rendent
  -- exactement le meme `null`, jamais distingues.
  select q.id, q.number, q.status, q.sent_at, q.valid_until, q.show_discounts
    into v_quote_id, v_number, v_status, v_sent_at, v_valid_until, v_show_discounts
  from public.commercial_quotes q
  where q.id = p_quote_id
    and q.customer_id = v_customer_id
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
  'E10.10b-1 — GET /storefront-quotes/{quoteId}. Rend null (traduit en 404 quote.not_found par la route) sur les quatre causes indiscernables : session invalide, compte sans interlocuteur, devis d un autre client/tenant, devis encore draft.';

revoke all on function public.api_get_storefront_quote(text, uuid) from public, authenticated;
grant execute on function public.api_get_storefront_quote(text, uuid) to anon;

notify pgrst, 'reload schema';

-- ============================================================================
-- REVERSIBILITE — le CLI Supabase ne gere pas de bloc `down`. SQL de retrait,
-- a jouer tel quel dans une migration inverse si la story est annulee :
--
--   revoke execute on function public.api_get_storefront_quote(text, uuid) from anon;
--   drop function if exists public.api_get_storefront_quote(text, uuid);
--   revoke execute on function public.api_list_storefront_quotes(text, text, integer, timestamptz, uuid) from anon;
--   drop function if exists public.api_list_storefront_quotes(text, text, integer, timestamptz, uuid);
--   drop function if exists private.commercial_quote_totals(uuid);
--   revoke execute on function public.api_resolve_shop_customer_principal(text) from anon;
--   drop function if exists public.api_resolve_shop_customer_principal(text);
--   notify pgrst, 'reload schema';
--
-- Aucune table n est creee ni modifiee par cette migration : le retrait est
-- sans effet de bord sur commercial_quotes/commercial_quote_lines/
-- shop_customer_accounts, qui restent inchangees.
-- ============================================================================
