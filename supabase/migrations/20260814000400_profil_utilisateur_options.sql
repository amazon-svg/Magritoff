-- ============================================================================
-- 20260814000400 — Côté Magrit : deux profils (admin, utilisateur) et deux
--                  options (Boutiques, Commandes)
-- ----------------------------------------------------------------------------
-- Décision Arnaud 2026-08-14 (évolution UM validée) : les profils Magrit et
-- les types d utilisateurs boutique sont deux mondes distincts. Côté Magrit,
-- le catalogue de rôles disparaît au profit de :
--
--   admin        — tout (porté par l appartenance, cf. 20260814000200) ;
--   utilisateur  — socle devis, plus deux OPTIONS activables par l admin :
--     · Boutiques  : créer des boutiques et administrer les siennes ;
--     · Commandes  : administrer les commandes (Validateur et Producteur
--                    absorbés — valider, modifier, statuts, exporter, annuler).
--
-- Les options restent techniquement des définitions de rôles : le moteur de
-- capabilities (user_has_capability, access-profile) les sert sans changement.
-- Elles sont identifiées par une CLÉ SYSTÈME, pas par leur nom — le nom
-- s édite, la clé jamais (leçon du trigger apparié sur 'Owner'/'Admin').
--
-- Le portail boutique n est PAS touché : les rôles Acheteur/Validateur des
-- utilisateurs shop_only continuent de porter le workflow de validation des
-- commandes (bêta Groupe ICI) jusqu à la migration vers les comptes boutique.
--
-- La restriction « commandes des boutiques auxquelles le commercial est
-- associé » s activera avec les comptes miroir (SPEC-IDENTITY-STORE-01) : le
-- lien commercial↔boutique n a pas encore de support de données côté équipe.
--
-- partner : 0 occurrence en base — la valeur disparaît de la contrainte.
--
-- Idempotente.
-- ============================================================================

-- ─── 1. La clé système des rôles portés par le produit ──────────────────────

alter table public.tenant_role_definitions
  add column if not exists system_key text;

create unique index if not exists tenant_role_definitions_system_key_idx
  on public.tenant_role_definitions (tenant_id, system_key)
  where system_key is not null;

-- ─── 2. Le profil partner disparaît ─────────────────────────────────────────

update public.tenant_members set role = 'member' where role = 'partner';
update public.tenant_invitations set role = 'member' where role = 'partner';

alter table public.tenant_members
  drop constraint if exists tenant_members_role_admin_check;
alter table public.tenant_members
  add constraint tenant_members_role_admin_check
  check (role in ('admin', 'member'));

alter table public.tenant_invitations
  drop constraint if exists tenant_invitations_role_admin_check;
alter table public.tenant_invitations
  add constraint tenant_invitations_role_admin_check
  check (role in ('admin', 'member'));

-- ─── 3. Les deux options, dans chaque espace ────────────────────────────────

insert into public.tenant_role_definitions
  (tenant_id, name, description, capabilities, ordering_index, notify_policy, scope, system_key)
select t.id,
       'Boutiques',
       'Créer des boutiques et administrer les siennes',
       '{"can_manage_shops": true}'::jsonb,
       10, 'none', 'tenant', 'option_shops'
  from public.tenants t
 where not exists (
   select 1 from public.tenant_role_definitions d
    where d.tenant_id = t.id and d.system_key = 'option_shops'
 );

insert into public.tenant_role_definitions
  (tenant_id, name, description, capabilities, ordering_index, notify_policy, scope, system_key)
select t.id,
       'Commandes',
       'Administrer les commandes : valider, modifier, gérer les statuts, exporter, annuler',
       '{"can_validate": true, "can_modify": true, "can_cancel": true, "can_export": true}'::jsonb,
       20, 'none', 'tenant', 'option_orders'
  from public.tenants t
 where not exists (
   select 1 from public.tenant_role_definitions d
    where d.tenant_id = t.id and d.system_key = 'option_orders'
 );

-- ─── 4. Reprise des membres d équipe ────────────────────────────────────────
-- L appariement par NOM est assumé ici et seulement ici : il défait ce que la
-- phase A a seedé sous ces noms, comme les reprises 000100 et 000300.
-- Les utilisateurs shop_only ne sont pas concernés (workflow du portail).

-- 4a. Un membre d équipe Validateur ou Producteur reçoit l option Commandes.
insert into public.tenant_role_assignments (role_definition_id, user_id, assigned_by)
select distinct option_def.id, assignment.user_id, null::uuid
  from public.tenant_role_assignments assignment
  join public.tenant_role_definitions old_def on old_def.id = assignment.role_definition_id
  join public.tenant_members member
    on member.user_id = assignment.user_id and member.tenant_id = old_def.tenant_id
  join public.tenant_role_definitions option_def
    on option_def.tenant_id = old_def.tenant_id and option_def.system_key = 'option_orders'
 where assignment.revoked_at is null
   and old_def.name in ('Validateur', 'Producteur')
   and member.access_scope = 'magrit_full'
   and not exists (
     select 1 from public.tenant_role_assignments existing
      where existing.role_definition_id = option_def.id
        and existing.user_id = assignment.user_id
        and existing.revoked_at is null
   );

-- 4b. Les affectations de catalogue des membres d équipe sont révoquées :
-- leur profil est désormais appartenance + options.
update public.tenant_role_assignments assignment
   set revoked_at = now(), revoked_by = null
  from public.tenant_role_definitions definition,
       public.tenant_members member
 where assignment.role_definition_id = definition.id
   and assignment.revoked_at is null
   and definition.system_key is null
   and definition.name in ('Admin', 'Acheteur', 'Validateur', 'Producteur')
   and member.tenant_id = definition.tenant_id
   and member.user_id = assignment.user_id
   and member.access_scope = 'magrit_full';

-- 4c. La définition « Admin » du catalogue s archive : l admin est une
-- appartenance, pas un rôle assignable (même série que « Owner », 000300).
update public.tenant_role_definitions
   set archived_at = now()
 where name = 'Admin'
   and system_key is null
   and archived_at is null
   and not exists (
     select 1 from public.tenant_role_assignments assignment
      where assignment.role_definition_id = tenant_role_definitions.id
        and assignment.revoked_at is null
   );

notify pgrst, 'reload schema';
