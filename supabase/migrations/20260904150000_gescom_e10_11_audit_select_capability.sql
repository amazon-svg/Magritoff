-- ============================================================================
-- Sprint 5 Gestion commerciale — story E10.11 (correction qa-review, bloquant
-- B1) : ferme la lecture DIRECTE des journaux d audit de prix aux seuls
-- porteurs de `can_manage_pricing`.
-- ----------------------------------------------------------------------------
-- Migration DISTINCTE de 20260904142026_gescom_e10_11_can_manage_pricing.sql
-- (ne la modifie pas) : cette derniere durcissait deja `price_rules_write` /
-- `product_range_default_margins_write`, mais elle n avait PAS ete deployee
-- sur le projet Supabase partage au moment de ce correctif (dette t2,
-- story-E10-11 §Dette) — un `psql`/`supabase db push` pourrait donc l avoir
-- deja jouee sur un poste local dans l intervalle, sans garantie de l etat.
-- Une nouvelle migration, strictement additive sur des policies EXISTANTES
-- (`drop policy if exists` puis `create policy`, meme pattern que le reste du
-- depot), evite toute ambiguite sur « une migration deja appliquee ne change
-- jamais apres coup » (regle rappelee par 20260904142026 elle-meme).
--
-- ── Bloquant B1 (qa-review round sur 1568143) ───────────────────────────────
-- `commercial_quote_line_audit_select` (20260904000100_gescom_e10_9_quote_
-- line_discounts.sql:517-525) et `price_rules_audit_select` (20260902000200_
-- gescom_e10_6_price_rules.sql:268-272) ne filtrent QUE par isolation tenant.
-- Un membre simple du tenant, sans `can_manage_pricing`, obtenait donc en 200
-- via un appel PostgREST DIRECT (`GET .../rest/v1/commercial_quote_line_
-- audit?select=*`) exactement la donnee de supervision que le contrat
-- declare protegee (`listQuoteAuditEntries`, garde applicative 403
-- `identity.role_required` — CommercialQuotesService.listAuditEntries()).
--
-- L argument qui justifiait l ouverture lors de l ecriture de la policy
-- d origine (E10.9, commentaire cite ci-dessous) — « une RLS fermee
-- masquerait une absence d habilitation derriere une page vide » — ne
-- s applique plus en DEFENSE EN PROFONDEUR une fois `can_manage_pricing`
-- livre : `listAuditEntries()` evalue deja la capability AVANT toute lecture
-- cote API (commercial-quotes-service.ts, `assertCanManagePricing`
-- equivalent), donc la RLS fermee ne produira JAMAIS la page vide trompeuse
-- sur le chemin API — elle ferme uniquement le contournement direct.
--
-- ── Reserve R5 (meme qa-review) ─────────────────────────────────────────────
-- `price_rules_audit_select` porte le meme trou, meme s il n est expose par
-- aucun endpoint aujourd hui : meme classe de donnee de supervision
-- (avant/apres d une regle de prix), meme correction par cohesion plutot que
-- par exposition constatee.
--
-- Idempotente (drop policy if exists avant chaque create policy).
-- ============================================================================

drop policy if exists "commercial_quote_line_audit_select" on public.commercial_quote_line_audit;
create policy "commercial_quote_line_audit_select" on public.commercial_quote_line_audit for select using (
  is_super_admin()
  or exists (
    select 1 from public.commercial_quotes q
    where q.id = commercial_quote_line_audit.quote_id
      and q.tenant_id in (select public.current_user_tenant_ids())
      and public.user_has_capability(q.tenant_id, 'can_manage_pricing')
  )
);

comment on policy "commercial_quote_line_audit_select" on public.commercial_quote_line_audit is
  'RLS = isolation TENANT + droit metier can_manage_pricing (E10.11, defense en profondeur reelle). '
  'Historique : la policy d origine (E10.9, 20260904000100) filtrait par tenant SEUL, avec le '
  'commentaire "une RLS fermee masquerait une absence d habilitation derriere une absence de trace" — '
  'cet argument valait tant qu aucun droit dedie n existait pour distinguer un refus d habilitation '
  'd une absence de trace. Depuis E10.11, la garde applicative (CommercialQuotesService.listAuditEntries, '
  '403 identity.role_required) est evaluee AVANT toute lecture sur le chemin API : elle produit deja le '
  'refus explicite, jamais une page vide trompeuse. Fermer la RLS ici ne ferme donc que le contournement '
  'par appel PostgREST direct (qa-review B1 sur 1568143), sans regression sur le comportement de l API.';

-- Reserve R5 (meme qa-review) : meme classe de donnee de supervision, meme
-- garde, par coherence — aucun endpoint ne l expose aujourd hui mais un appel
-- PostgREST direct y avait acces au meme titre.
drop policy if exists "price_rules_audit_select" on public.price_rules_audit;
create policy "price_rules_audit_select" on public.price_rules_audit for select using (
  is_super_admin()
  or (
    tenant_id in (select public.current_user_tenant_ids())
    and public.user_has_capability(price_rules_audit.tenant_id, 'can_manage_pricing')
  )
);

comment on policy "price_rules_audit_select" on public.price_rules_audit is
  'RLS = isolation TENANT + droit metier can_manage_pricing (E10.11, reserve R5 qa-review sur 1568143, '
  'meme raisonnement que commercial_quote_line_audit_select ci-dessus). Aucun endpoint n expose ce '
  'journal aujourd hui : la garde ferme uniquement le contournement par appel PostgREST direct.';

notify pgrst, 'reload schema';

-- ============================================================================
-- REVERSIBILITE — le CLI Supabase ne gere pas de bloc `down`. SQL de retrait,
-- a jouer tel quel dans une migration inverse si la story est annulee
-- (restaure exactement les policies telles qu issues de 20260904000100 et
-- 20260902000200) :
--
--   drop policy if exists "commercial_quote_line_audit_select" on public.commercial_quote_line_audit;
--   create policy "commercial_quote_line_audit_select" on public.commercial_quote_line_audit for select using (
--     is_super_admin()
--     or exists (
--       select 1 from public.commercial_quotes q
--       where q.id = commercial_quote_line_audit.quote_id
--         and q.tenant_id in (select public.current_user_tenant_ids())
--     )
--   );
--
--   drop policy if exists "price_rules_audit_select" on public.price_rules_audit;
--   create policy "price_rules_audit_select" on public.price_rules_audit for select using (
--     is_super_admin()
--     or tenant_id in (select public.current_user_tenant_ids())
--   );
--
--   notify pgrst, 'reload schema';
-- ============================================================================
