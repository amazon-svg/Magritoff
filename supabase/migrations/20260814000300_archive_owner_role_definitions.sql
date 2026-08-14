-- ============================================================================
-- 20260814000300 — Le rôle « Owner » quitte le catalogue de rôles
-- ----------------------------------------------------------------------------
-- Suite d admin unique (20260814000200, décision Arnaud 2026-08-14) : le
-- catalogue de chaque espace contenait encore le rôle nommé « Owner » seedé en
-- phase A. Vocabulaire obsolète — il n existe plus de rang au-dessus de
-- l admin, et le voir dans la matrice d assignation prête à confusion.
--
-- Archivage, pas suppression : l historique d audit des anciennes affectations
-- reste lisible, et les FK (tenant_order_roles.role_definition_id, restrict)
-- ne cassent pas. Un rôle archivé n est ni assignable, ni compté par
-- user_has_capability, ni affiché.
--
-- Les affectations actives restantes vers « Owner » (posées à la main sur des
-- membres simples — celles des owners/admins ont été reprises par
-- 20260814000100) sont révoquées en douceur : un rôle archivé ne doit plus
-- porter aucune affectation active.
--
-- Idempotente.
-- ============================================================================

update public.tenant_role_assignments assignment
   set revoked_at = now(), revoked_by = null
  from public.tenant_role_definitions definition
 where assignment.role_definition_id = definition.id
   and assignment.revoked_at is null
   and definition.name = 'Owner';

update public.tenant_role_definitions
   set archived_at = now()
 where name = 'Owner'
   and archived_at is null;

notify pgrst, 'reload schema';
