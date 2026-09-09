-- ============================================================================
-- Sprint 5 Gestion commerciale — story E10.19a : le gabarit de bon de
-- commande. Contrat : openapi/magrit-core.v1.yaml, docs/api/CONVENTIONS.md
-- §8.20 (E10.19), notamment §6 ("ce que le contrat porte") et §10 ("les
-- quatre decisions d Arnaud", decision (D)).
-- ----------------------------------------------------------------------------
-- Perimetre STRICT de ce lot (E10.19a uniquement — E10.19b, la table
-- `order_documents`/le moteur de generation/`generateOrderDocument`/
-- `getOrderDocument`, N EST PAS livree ici) :
--
--   1. `document_pdf_templates.document_type` — le `check` passe de
--      `in ('quote')` a `in ('quote', 'order')` (arbitrage (A) : gabarit
--      DISTINCT par type, aucune migration de STRUCTURE requise, l index
--      unique partiel `(tenant_id, document_type) where is_default` et le
--      nom unique `(tenant_id, document_type, lower(btrim(name)))` portaient
--      deja un defaut/une unicite PAR TYPE depuis 4a).
--
--   2. `document_pdf_template_fields.field` — le `check` gagne les CINQ
--      valeurs `order.*` du contrat (`order.number`, `order.created_at`,
--      `order.quote_number`, `order.customer_reference`,
--      `order.expected_delivery_date`). Meme discipline que 4b : cette
--      contrainte EN BASE est une DEFENSE EN PROFONDEUR (le schema Zod du
--      module la tient deja cote applicatif), elle ne porte PAS le
--      sous-ensemble PAR TYPE (un `order.*` sur un gabarit `quote` reste
--      syntaxiquement un `DocumentFieldId` valide pour cette contrainte-la) —
--      cette garde-la est semantique et vit en TypeScript
--      (`document-field-map-validator.ts`, meme parti que la geometrie en
--      4b), PIEGE D ORDONNANCEMENT du contrat §4 : elle est posee DANS CE
--      MEME LOT, en meme temps que les valeurs, pour que ce soit la SEULE
--      fenetre ou l ajout n est pas un durcissement retroactif d une carte
--      deja enregistree (CA13).
--
--   3. `commercial_orders.show_discounts` / `commercial_orders.
--      customer_reference` — LES DEUX COLONNES GELEES de la decision (D) :
--      « le bon de commande MONTRE les remises », et la regle qui les tient
--      est RECOPIEE a la conversion plutot que jointe au rendu ("la valeur
--      imprimee et la valeur engagee sont une seule valeur, resolue une
--      seule fois", §8.18 #10, etendue au bon de commande par §8.20 §10).
--      Ajoutees au trigger d immuabilite `commercial_orders_immutable()`
--      (ce sont des valeurs ENGAGEES, pas un reglage d ecran), et
--      RETRO-REMPLIES pour les commandes deja converties.
--
--      `show_discounts` a une SOURCE REELLE : `commercial_quotes.
--      show_discounts` (migration 20260901000600). Backfill par JOINTURE sur
--      `quote_id`, puis colonne passee `not null` une fois toutes les lignes
--      renseignees.
--
--      `customer_reference` N A PAS DE SOURCE — et c est un ecart de donnees
--      a DIRE, pas a masquer : AUCUNE colonne `customer_reference` n existe
--      sur `commercial_quotes` (verifie dans les migrations, et documente
--      exactement dans les memes termes par
--      `src/modules/quote-documents/application/document-field-value-resolver.ts`,
--      "ECART DE DONNEES ... combler ce trou est une story distincte sur le
--      module commercial-quotes"). Le contrat §8.20 §10 dit "la donnee n
--      existait pas plus que l autre sur la commande" : la colonne est donc
--      ajoutee ICI (le contrat l exige, `order.customer_reference` est
--      publie au catalogue), mais elle reste NULLABLE et VAUT NULL sur
--      TOUTE commande, faute de source, retro-remplissage INCLUS — combler
--      cette source cote `commercial_quotes` est HORS PERIMETRE de cette
--      story, signale au rapport de fin de story plutot que devine. Le
--      moteur (E10.19b) n imprimera donc RIEN pour `order.customer_reference`
--      tant que cette source amont n existera pas (regle "valeur absente =
--      rien imprime", §8.18 §3), exactement comme `quote.customer_reference`
--      aujourd hui.
--
--   4. `api_convert_commercial_quote(uuid, uuid)` — RECREEE (MEME SIGNATURE)
--      pour lire `commercial_quotes.show_discounts` SOUS LE MEME VERROU
--      `for update` deja pose, et l ecrire sur la ligne `commercial_orders`
--      creee. `customer_reference` est insere `null` (aucune source, voir
--      point 3). Rien d autre ne change dans cette fonction.
-- ============================================================================

-- ── 1. `document_pdf_templates.document_type` — enumeration ADDITIVE ───────
alter table public.document_pdf_templates
  drop constraint if exists document_pdf_templates_document_type_check,
  add constraint document_pdf_templates_document_type_check
    check (document_type in ('quote', 'order'));

comment on column public.document_pdf_templates.document_type is
  'E10.19a — quote (devis, E10.10b-4) ou order (bon de commande, accuse de commande, E10.19). DEUX GABARITS DISTINCTS par tenant (arbitrage (A) du 2026-09-10) : AUCUN repli d un type sur l autre, jamais.';

-- ── 2. `document_pdf_template_fields.field` — cinq valeurs `order.*` ───────
alter table public.document_pdf_template_fields
  drop constraint if exists document_pdf_template_fields_field_check,
  add constraint document_pdf_template_fields_field_check
    check (field in (
      'quote.number', 'quote.issued_at', 'quote.valid_until', 'quote.customer_reference',
      'order.number', 'order.created_at', 'order.quote_number', 'order.customer_reference',
      'order.expected_delivery_date',
      'customer.company_name', 'customer.contact_name', 'customer.billing_address_block',
      'customer.billing_line1', 'customer.billing_line2', 'customer.billing_postal_code',
      'customer.billing_city', 'customer.billing_country', 'customer.email', 'customer.phone',
      'customer.siret', 'customer.vat_number',
      'totals.lines_subtotal', 'totals.global_discount', 'totals.net_total', 'totals.vat_rate',
      'totals.vat_amount', 'totals.total_incl_tax',
      'page.number', 'page.count', 'page.number_of_count'
    ));

-- ── 3. `commercial_orders` — deux colonnes GELEES (decision D) ─────────────
-- `show_discounts` porte `default false` (meme valeur que `commercial_quotes.
-- show_discounts`, migration 20260901000600) : NON par confort d ecriture,
-- mais parce que d autres fixtures de tests SQL du depot inserent directement
-- des lignes `commercial_orders` SANS passer par `api_convert_commercial_quote`
-- (`tests/sql/gescom-e10-14-order-step-changes.sql`,
-- `tests/sql/gescom-e10-17a-order-files.sql`) — verifie par EXECUTION REELLE
-- de la suite `pnpm test:storefront:sql` au moment de cette story : sans ce
-- defaut, les deux fichiers echouent sur une violation NOT NULL. Le defaut
-- ne change rien au chemin nominal : `api_convert_commercial_quote` (point 5
-- ci-dessous) ecrit TOUJOURS la valeur REELLEMENT recopiee du devis source,
-- jamais ce defaut.
alter table public.commercial_orders
  add column if not exists show_discounts boolean not null default false,
  add column if not exists customer_reference text
    check (customer_reference is null or btrim(customer_reference) <> '');

comment on column public.commercial_orders.show_discounts is
  'E10.19a (decision D, contrat §8.20 §10) — RECOPIEE de commercial_quotes.show_discounts A LA CONVERSION, jamais relue au travers de quote_id au moment du rendu ("la valeur imprimee et la valeur engagee sont une seule valeur, resolue une seule fois"). GELEE par commercial_orders_immutable(). Regle d IMPRESSION du bon de commande (E10.19b), PAS publiee sur CommercialOrderDetail (contrat : "ouvrirait a une interface d atelier de filtrer de son cote").';
comment on column public.commercial_orders.customer_reference is
  'E10.19a (decision D) — destinee a etre RECOPIEE de commercial_quotes a la conversion, meme regle que show_discounts. AUCUNE colonne source n existe encore sur commercial_quotes (ecart de donnees documente, meme famille que quote.customer_reference — voir document-field-value-resolver.ts) : vaut NULL sur TOUTE commande tant que cette source amont n est pas ajoutee, story distincte hors perimetre d E10.19a. GELEE par commercial_orders_immutable(). PAS publiee sur CommercialOrderDetail.';

-- Backfill : SOURCE REELLE pour show_discounts (commercial_quotes.show_discounts,
-- jointure sur quote_id, unique et not null) — remplace le `default false`
-- ci-dessus par la valeur REELLE du devis source pour toute commande deja
-- convertie AVANT ce lot. customer_reference n a aucune source (point 3 de
-- l en-tete) : reste NULL, deja sa valeur par defaut a l ajout de colonne —
-- aucune UPDATE necessaire.
update public.commercial_orders o
   set show_discounts = q.show_discounts
  from public.commercial_quotes q
 where q.id = o.quote_id;

-- ── 4. Trigger d immuabilite — les deux colonnes rejoignent la liste GELEE ─
create or replace function public.commercial_orders_immutable()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if not exists (select 1 from public.tenants t where t.id = old.tenant_id) then
      -- Cascade depuis la suppression du tenant parent : legitime.
      return old;
    end if;
    raise exception 'order.immutable: une commande ne se supprime jamais directement (%)', old.id;
  end if;

  if new.customer_id is distinct from old.customer_id
     or new.quote_id is distinct from old.quote_id
     or new.number is distinct from old.number
     or new.source_quote_status is distinct from old.source_quote_status
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at
     or new.lines_subtotal is distinct from old.lines_subtotal
     or new.global_discount is distinct from old.global_discount
     or new.effective_discount_rate is distinct from old.effective_discount_rate
     or new.net_total is distinct from old.net_total
     or new.vat_rate is distinct from old.vat_rate
     or new.vat_regime is distinct from old.vat_regime
     or new.vat_amount is distinct from old.vat_amount
     or new.total_incl_tax is distinct from old.total_incl_tax
     -- E10.19a (decision D) : deux colonnes ENGAGEES de plus, jamais un
     -- reglage d ecran — meme famille que les totaux ci-dessus.
     or new.show_discounts is distinct from old.show_discounts
     or new.customer_reference is distinct from old.customer_reference
  then
    raise exception 'order.immutable: seuls status et updated_at sont modifiables sur une commande (%)', old.id;
  end if;

  return new;
end;
$$;

-- Le trigger existant (commercial_orders_immutable_before_write,
-- 20260908010000) pointe deja sur cette fonction : `create or replace
-- function` suffit, aucun drop/create de trigger necessaire (meme patron que
-- la completion has_field_map en 4b, 20260909030000).

-- ── 5. `api_convert_commercial_quote` — QUATRIEME `create or replace`
--    (apres E10.12 : 20260908010000, E10.13 : 20260908020000, E10.16 :
--    20260909010000). Corps RECOPIE VERBATIM depuis la version E10.16 —
--    PAS depuis la version E10.12 d origine, qui n aurait pas porte
--    `current_production_step_id` (E10.13) ni `customer_contact_id`
--    (E10.16) et aurait donc REGRESSE ces deux lots (verifie par execution
--    reelle de `pnpm test:storefront:sql` : la premiere version de cette
--    migration, batie par erreur sur 20260908010000, faisait ECHOUER
--    `tests/sql/gescom-e10-16-order-contact-and-delivery.sql`, corrige avant
--    la remise de cette story). DEUX differences bornees, ajoutees a la
--    version E10.16 et RIEN d autre :
--      (i) la lecture SOUS LE MEME VERROU `for update` gagne `show_discounts` ;
--      (ii) l INSERT dans commercial_orders porte
--           `show_discounts`/`customer_reference`.
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
  v_show_discounts boolean;
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
  -- E10.13/E10.16/E10.19a.
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

  -- E10.16 — `decided_by_account_id` lu SOUS LE MEME VERROU DE LIGNE (patron
  -- B1, qa-review round 1 d E10.12). E10.19a AJOUTE `show_discounts` a cette
  -- MEME lecture, pour la MEME raison : la valeur figee sur la commande est
  -- ainsi TOUJOURS celle reellement en vigueur au moment de la transition,
  -- jamais un snapshot pris avant l attente du verrou — jamais une seconde
  -- requete separee, qui rouvrirait la fenetre de concurrence que B1 a
  -- fermee.
  select status, customer_id, decided_by_account_id, show_discounts
    into v_prior_status, v_customer_id, v_decided_by_account_id, v_show_discounts
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

  -- E10.16 — `customer_contact_id`, sous-requete SCALAIRE deterministe (cle
  -- primaire de `shop_customer_accounts`) ; `current_production_step_id`
  -- (E10.13), premiere etape active du tenant par position. E10.19a AJOUTE
  -- `show_discounts` (RECOPIE du devis source, lu SOUS VERROU ci-dessus) et
  -- `customer_reference` (NULL, aucune source n existant encore sur
  -- `commercial_quotes` — voir en-tete de fichier). Rien d autre ne change.
  insert into public.commercial_orders (
    tenant_id, customer_id, quote_id, number, status, source_quote_status,
    lines_subtotal, global_discount, effective_discount_rate, net_total,
    vat_rate, vat_regime, vat_amount, total_incl_tax, created_by,
    current_production_step_id, customer_contact_id,
    show_discounts, customer_reference
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
      where sca.id = v_decided_by_account_id),
    v_show_discounts, null
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
  'E10.12/E10.13/E10.16/E10.19a — POST /quotes/{quoteId}/conversions. Transition ATOMIQUE sent/accepted -> converted, numerotation CDE-AAAA-NNNNN, copie FIGEE des lignes et totaux, audit d entete converted, ETAPE DE PRODUCTION INITIALE (E10.13), INTERLOCUTEUR (E10.16). E10.19a : show_discounts/customer_reference (decision D) RECOPIEES sur la commande, GELEES par commercial_orders_immutable(). Ouverte a TOUT membre du tenant (aucune garde de capability, arbitrage Arnaud 2026-09-08).';

revoke all on function public.api_convert_commercial_quote(uuid, uuid) from public, anon;
grant execute on function public.api_convert_commercial_quote(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';

-- ============================================================================
-- REVERSIBILITE — le CLI Supabase ne gere pas de bloc `down`. SQL de retrait,
-- a jouer tel quel dans une migration inverse si la story est annulee :
--
--   -- 5. api_convert_commercial_quote : rejouer la version PORTEE PAR
--   -- 20260909010000_gescom_e10_16_order_contact_and_delivery.sql (SANS
--   -- show_discounts/customer_reference) pour revenir a l etat d avant
--   -- E10.19a — PAS la version E10.12 (20260908010000), qui perdrait
--   -- current_production_step_id (E10.13) et customer_contact_id (E10.16).
--
--   -- 4. commercial_orders_immutable() : rejouer la version PORTEE PAR
--   -- 20260908010000 (sans show_discounts/customer_reference dans la garde,
--   -- INCHANGEE par E10.13/E10.14/E10.16).
--
--   alter table public.commercial_orders drop column if exists customer_reference;
--   alter table public.commercial_orders drop column if exists show_discounts;
--
--   alter table public.document_pdf_template_fields
--     drop constraint if exists document_pdf_template_fields_field_check,
--     add constraint document_pdf_template_fields_field_check
--       check (field in (
--         'quote.number', 'quote.issued_at', 'quote.valid_until', 'quote.customer_reference',
--         'customer.company_name', 'customer.contact_name', 'customer.billing_address_block',
--         'customer.billing_line1', 'customer.billing_line2', 'customer.billing_postal_code',
--         'customer.billing_city', 'customer.billing_country', 'customer.email', 'customer.phone',
--         'customer.siret', 'customer.vat_number',
--         'totals.lines_subtotal', 'totals.global_discount', 'totals.net_total', 'totals.vat_rate',
--         'totals.vat_amount', 'totals.total_incl_tax',
--         'page.number', 'page.count', 'page.number_of_count'
--       ));
--
--   alter table public.document_pdf_templates
--     drop constraint if exists document_pdf_templates_document_type_check,
--     add constraint document_pdf_templates_document_type_check
--       check (document_type in ('quote'));
--
--   notify pgrst, 'reload schema';
--
-- Aucune table nouvelle : le retrait ne perd que les deux colonnes et
-- l elargissement des deux enumerations, jamais une ligne existante.
-- ============================================================================
