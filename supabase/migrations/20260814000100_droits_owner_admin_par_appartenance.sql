-- ============================================================================
-- 20260814000100 — Les droits owner/admin dérivent de l appartenance
-- ----------------------------------------------------------------------------
-- Retire le trigger sync_membership_functional_role (décision Arnaud
-- 2026-08-14, chantier gestion des utilisateurs).
--
-- Ce que faisait le trigger (AF5.1a, 20260811000300) : à chaque INSERT ou
-- UPDATE de tenant_members.role, il écrivait ou révoquait une affectation vers
-- les rôles fonctionnels nommés 'Owner' et 'Admin'. Deux défauts :
--
--   1. L appariement se faisait sur le NOM du rôle. Renommer « Owner » ou
--      « Admin » depuis l éditeur de rôles cassait la synchronisation des
--      droits, sans erreur ni trace.
--   2. Le même droit vivait dans deux systèmes (appartenance + affectations),
--      réconciliés à l écriture — précisément la superposition que le chantier
--      de gestion des utilisateurs résorbe.
--
-- Nouveau régime, une seule source par population :
--   - owner/admin : droits dérivés de l APPARTENANCE, à la lecture, dans
--     user_has_capability. Les valeurs 'owner'/'admin' sont contraintes par un
--     CHECK et non renommables depuis l UI — le défaut n° 1 disparaît.
--   - autres membres : droits par affectations de rôles, comme avant.
--
-- Une rétrogradation owner→member prend effet immédiatement : plus rien à
-- révoquer, le droit disparaît avec l appartenance qui le portait.
--
-- Sémantique préservée (presets phase A, décision Arnaud 2026-05-25) :
-- Owner = toutes les capabilities ; Admin = toutes sauf can_manage_roles.
-- NB : l Admin par appartenance suit désormais ce preset FIGÉ ; l édition du
-- rôle nommé « Admin » dans l éditeur ne module plus ses droits — elle ne
-- modulait déjà que ceux passés par le trigger, de façon non visible.
--
-- Idempotente.
-- ============================================================================

-- ─── 1. Retrait du mécanisme de synchronisation ─────────────────────────────

drop trigger if exists trg_sync_membership_functional_role on public.tenant_members;
drop function if exists public.sync_membership_functional_role();

-- ─── 2. Les droits owner/admin dérivent de l appartenance ───────────────────

create or replace function public.user_has_capability(
  p_tenant_id uuid,
  p_capability text
)
returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when public.is_super_admin() then true
    -- Appartenance owner/admin : le droit est porté par l enum, stable par
    -- construction. Aucun nom de rôle n entre dans la décision.
    when exists (
      select 1
      from public.tenant_members m
      where m.tenant_id = p_tenant_id
        and m.user_id = auth.uid()
        and (
          m.role = 'owner'
          or (m.role = 'admin' and p_capability <> 'can_manage_roles')
        )
    ) then true
    else exists (
      select 1
      from public.tenant_role_assignments ra
      join public.tenant_role_definitions rd on rd.id = ra.role_definition_id
      where ra.user_id = auth.uid()
        and ra.revoked_at is null
        and rd.tenant_id = p_tenant_id
        and rd.archived_at is null
        and coalesce((rd.capabilities->>p_capability)::boolean, false) = true
    )
  end;
$$;

grant execute on function public.user_has_capability(uuid, text) to authenticated;

-- ─── 3. Reprise des affectations écrites par l ancien mécanisme ─────────────
-- Les affectations Owner/Admin des membres owner/admin sont devenues
-- redondantes (le droit vient de l appartenance) et dangereuses (elles
-- survivraient à une rétrogradation). Révocation douce : auditée, réversible.
--
-- L appariement par nom est assumé ICI ET SEULEMENT ICI : cette reprise
-- défait très exactement ce que l ancien trigger écrivait, et il n écrivait
-- que sous ces deux noms. Une affectation Owner/Admin posée À LA MAIN sur un
-- membre simple est conservée : elle n a pas été écrite par le trigger, la
-- retirer serait une décision d administration, pas une reprise technique.

update public.tenant_role_assignments assignment
   set revoked_at = now(), revoked_by = null
  from public.tenant_role_definitions definition,
       public.tenant_members member
 where assignment.role_definition_id = definition.id
   and assignment.revoked_at is null
   and definition.name in ('Owner', 'Admin')
   and member.tenant_id = definition.tenant_id
   and member.user_id = assignment.user_id
   and member.role in ('owner', 'admin');

notify pgrst, 'reload schema';

