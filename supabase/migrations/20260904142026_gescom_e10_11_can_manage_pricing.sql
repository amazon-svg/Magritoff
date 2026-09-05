-- ============================================================================
-- Sprint 5 Gestion commerciale — story E10.11 : droit dedie `can_manage_pricing`
-- ----------------------------------------------------------------------------
-- Durcit les policies d ecriture de `price_rules` et
-- `product_range_default_margins` (posees par
-- 20260902000200_gescom_e10_6_price_rules.sql:245-296), pour qu elles verifient
-- `public.user_has_capability(tenant_id, 'can_manage_pricing')` plutot que
-- `tm.role in ('admin', 'member')`.
--
-- ── Pourquoi c est un vrai resserrement, pas une reformulation ─────────────
-- La garde `role in ('admin', 'member')` couvrait, en pratique, TOUT membre
-- du tenant : `member` est le role de base de toute affectation
-- (`tenant_members.role`), il n existait donc aucune facon d etre membre d un
-- tenant SANS pouvoir ecrire ces deux tables par appel PostgREST direct. La
-- garde « admin uniquement » que CA7 d E10.6 exigeait pour son ecran
-- (`src/modules/pricing/surface-contributions.ts`) n a jamais existe en base
-- — seulement dans l UI. Cette migration aligne la base sur l intention.
--
-- ── Pourquoi ce n est PAS une regression d acces ────────────────────────────
-- `public.user_has_capability` (20260814000200_admin_unique.sql:130-157 —
-- remplace la version d origine de 20260814000100, qui parlait encore de
-- `owner` ; `owner` n est plus une valeur possible de `tenant_members.role`
-- depuis cette meme migration) derive TOUS les droits metier de l
-- appartenance `admin`, sauf `can_manage_roles`. `can_manage_pricing` n en
-- est pas exclu : tout `admin` actuel conserve donc l acces intact. Seul un
-- membre simple (`role = 'member'`, sans affectation de role portant
-- `can_manage_pricing`) perd la possibilite d ecrire ces deux tables — ce
-- qu il n aurait jamais du avoir (voir ci-dessus). Aucun role de tenant ne
-- porte aujourd hui `can_manage_pricing` dans ses `capabilities` (docs/api/
-- CONVENTIONS.md §8.11, s2) : l attribution a un non-admin est une decision
-- d administration future, via l editeur de roles existant
-- (`POST /api/v1/tenants/{tenantId}/roles`), pas une action de cette migration.
--
-- ── Lecture, hors perimetre ─────────────────────────────────────────────────
-- `price_rules_select` / `product_range_default_margins_select` restent
-- INCHANGEES (ouvertes a tout membre du tenant) : `resolvePriceRule` et
-- `getProductRangeDefaultMargin` sont les entrees du PricingEngine (E10.21),
-- necessaires a tout commercial pour chiffrer une affaire — les fermer
-- romprait §7 (v1 additive, une lecture deja publiee ne se restreint pas).
--
-- ── Bloquant B2 (qa-review round 2) ─────────────────────────────────────────
-- La version d origine de ces deux policies testait UNIQUEMENT
-- `user_has_capability(tenant_id, 'can_manage_pricing')`, sans exiger
-- l appartenance actuelle au tenant. Or `user_has_capability`
-- (20260814000200_admin_unique.sql:130-157) porte une troisieme branche qui
-- interroge `tenant_role_assignments`/`tenant_role_definitions` SANS jamais
-- verifier `tenant_members` : un utilisateur qui quitte un tenant
-- (`members-repository.ts` supprime la ligne `tenant_members` mais ne
-- revoque aucune `tenant_role_assignments`, faute de FK/trigger de cascade)
-- conservait donc la capacite d ecrire/supprimer `price_rules`/
-- `product_range_default_margins` de ce tenant par appel PostgREST direct,
-- alors qu il ne pouvait meme plus les LIRE (`price_rules_select` exige
-- `current_user_tenant_ids()`). C etait une regression par rapport a la
-- policy E10.6 remplacee (`tm.role in ('admin','member')`, qui exigeait de
-- facto une ligne `tenant_members`). Correction : `tenant_id in (select
-- public.current_user_tenant_ids())` est ajoute en tete de chaque
-- `using`/`with check`, meme garde que celle deja posee par
-- `20260904150000_gescom_e10_11_audit_select_capability.sql` pour la
-- LECTURE des journaux d audit. Corrige directement dans cette migration
-- (jamais deployee sur le projet Supabase partage — dette t2, docs/api/
-- CONVENTIONS.md §8.11) plutot que par une 3e migration additive.
--
-- Idempotente (drop policy if exists avant chaque create policy, meme
-- pattern que la migration d origine).
-- ============================================================================

drop policy if exists "price_rules_write" on public.price_rules;
create policy "price_rules_write" on public.price_rules for all using (
  is_super_admin()
  or (
    price_rules.tenant_id in (select public.current_user_tenant_ids())
    and public.user_has_capability(price_rules.tenant_id, 'can_manage_pricing')
  )
) with check (
  is_super_admin()
  or (
    price_rules.tenant_id in (select public.current_user_tenant_ids())
    and public.user_has_capability(price_rules.tenant_id, 'can_manage_pricing')
  )
);

drop policy if exists "product_range_default_margins_write" on public.product_range_default_margins;
create policy "product_range_default_margins_write" on public.product_range_default_margins for all using (
  is_super_admin()
  or (
    product_range_default_margins.tenant_id in (select public.current_user_tenant_ids())
    and public.user_has_capability(product_range_default_margins.tenant_id, 'can_manage_pricing')
  )
) with check (
  is_super_admin()
  or (
    product_range_default_margins.tenant_id in (select public.current_user_tenant_ids())
    and public.user_has_capability(product_range_default_margins.tenant_id, 'can_manage_pricing')
  )
);

notify pgrst, 'reload schema';

-- ============================================================================
-- REVERSIBILITE — le CLI Supabase ne gere pas de bloc `down`. SQL de retrait,
-- a jouer tel quel dans une migration inverse si la story est annulee
-- (restaure exactement les policies de 20260902000200_gescom_e10_6_price_
-- rules.sql:245-296) :
--
--   drop policy if exists "price_rules_write" on public.price_rules;
--   create policy "price_rules_write" on public.price_rules for all using (
--     is_super_admin()
--     or exists (
--       select 1 from public.tenant_members tm
--       where tm.tenant_id = price_rules.tenant_id
--         and tm.user_id = auth.uid()
--         and tm.role in ('admin', 'member')
--     )
--   ) with check (
--     is_super_admin()
--     or exists (
--       select 1 from public.tenant_members tm
--       where tm.tenant_id = price_rules.tenant_id
--         and tm.user_id = auth.uid()
--         and tm.role in ('admin', 'member')
--     )
--   );
--
--   drop policy if exists "product_range_default_margins_write" on public.product_range_default_margins;
--   create policy "product_range_default_margins_write" on public.product_range_default_margins for all using (
--     is_super_admin()
--     or exists (
--       select 1 from public.tenant_members tm
--       where tm.tenant_id = product_range_default_margins.tenant_id
--         and tm.user_id = auth.uid()
--         and tm.role in ('admin', 'member')
--     )
--   ) with check (
--     is_super_admin()
--     or exists (
--       select 1 from public.tenant_members tm
--       where tm.tenant_id = product_range_default_margins.tenant_id
--         and tm.user_id = auth.uid()
--         and tm.role in ('admin', 'member')
--     )
--   );
--
--   notify pgrst, 'reload schema';
-- ============================================================================
