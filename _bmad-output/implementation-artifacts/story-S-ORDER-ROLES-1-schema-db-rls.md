---
story_id: S-ORDER-ROLES-1
parent_story: S-ORDER-ROLES (overview)
epic: 3 — Module Commandes (extension scope rôles)
title: Schéma DB rôles workflow + enum statuts extensibles + RLS
status: spec-ready (post Phase 0.4 cadrage qualité, 2026-05-22)
created_at: 2026-05-22
target_branch: beta/v5
agent: TBD (Dev hat, Sprint 6)
size: M (2j)
prd_ref: _bmad-output/planning-artifacts/prd.md (FR18-24)
predecessors: [S1.4 Order entity livré, S-MIGRATION-ORDERS livré, Phase 0.4 cadrage Q4/Q6]
successors: [S-ORDER-ROLES-2, S-ORDER-ROLES-3]
sprint_cible: Sprint 6 (roadmap qualité-first)
adr_a_formaliser: §4.12 "Couche rôles workflow séparée de tenant_members.permissions"
---

# Story S-ORDER-ROLES-1 — Schéma DB rôles + enum statuts extensibles + RLS

## Contexte

Première des 3 sous-stories de S-ORDER-ROLES. Pose les **fondations DB** sans toucher au code applicatif. Une fois cette story livrée, S-ORDER-ROLES-2 (RPC + audit) et S-ORDER-ROLES-3 (UI) peuvent être développées en parallèle si nécessaire.

Voir [story-S-ORDER-ROLES-roles-commande.md](story-S-ORDER-ROLES-roles-commande.md) (overview) pour le contexte business complet + les réponses Arnaud aux 10 questions de cadrage.

## Story (user story)

**As a** plateforme Magrit B2B,
**I want** poser le schéma DB de la couche rôles workflow (catalog tenant + assignations users + rôles par commande + enum statuts extensibles) avec RLS strict,
**So that** les sous-stories suivantes (RPC transitions + audit, UI tabs filtrés) puissent s'appuyer sur des fondations solides, isolées multi-tenant, et auditables.

## Acceptance Criteria

### AC1 — Migration SQL `20260{XXX}_01_order_roles_schema.sql` appliquée

**Given** la migration crée 4 nouvelles tables + 1 table statuts extensibles
**When** elle est appliquée via `supabase db push --linked` (ou Dashboard SQL Editor en fallback)
**Then** les tables suivantes existent avec le schéma exact spécifié dans l'overview (§Décisions Q4 et Q6) :

1. `public.tenant_role_definitions` — catalog des rôles paramétrés par tenant (`id`, `tenant_id`, `name`, `capabilities jsonb`, `notify_policy`, `ordering_index`, `scope`, `scope_shop_id`, `created_at`, `created_by`, `archived_at`)
2. `public.tenant_role_assignments` — qui occupe quel rôle (indépendant commande) (`id`, `role_definition_id`, `user_id`, `assigned_at`, `assigned_by`, `revoked_at`)
3. `public.tenant_order_roles` — qui occupe quel rôle sur une commande (`id`, `order_id`, `role_definition_id`, `user_id`, `assigned_at`, `assigned_by`, `revoked_at`)
4. `public.tenant_order_role_events` — audit trail (`id`, `order_id`, `role_definition_id`, `user_id`, `event_type`, `actor_user_id`, `payload jsonb`, `occurred_at`)
5. `public.tenant_order_status_definitions` — enum extensible par tenant (`id`, `tenant_id`, `code`, `label`, `ordering_index`, `is_terminal bool`, `archived_at`)

**And** les contraintes suivantes sont en place :
- Sur `tenant_order_roles` : `UNIQUE (order_id, role_definition_id, user_id)` + index partiel sur `user_id WHERE revoked_at IS NULL` + index sur `order_id`
- Sur `tenant_role_definitions` : `UNIQUE (tenant_id, name)` (pas 2 rôles homonymes par tenant)
- FKs `ON DELETE CASCADE` sur `order_id` (suppression commande → cleanup rôles), `ON DELETE RESTRICT` sur `role_definition_id` (impossible de supprimer un rôle utilisé)

### AC2 — Seed des statuts canoniques + 2 rôles canoniques par tenant existant

**Given** la migration applique un seed initial pour les 9 tenants existants
**When** elle finit
**Then** chaque tenant a dans `tenant_order_status_definitions` les 5 statuts canoniques : `pending` (default), `validated`, `cancelled`, `shipped`, **et** `draft` (cf. cohérence S3.2-residual)
**And** chaque tenant a dans `tenant_role_definitions` 2 rôles canoniques pré-créés : "Acheteur" (`capabilities={can_validate:false, can_cancel:true, can_modify:false, can_export:true}`, `scope='tenant'`, `ordering_index=0`) + "Producteur" (`capabilities={can_validate:false, can_cancel:false, can_modify:false, can_export:true}`, `scope='tenant'`, `ordering_index=99`)
**And** **aucun rôle Validateur** n'est seedé : ces rôles sont créés à la demande par l'admin tenant (cf. Q1 Arnaud)

### AC3 — RLS strict sur les 5 tables

**Given** les 5 nouvelles tables ont RLS activée par migration
**When** on teste l'accès avec différents profils
**Then** les policies suivantes sont en place et testées :

- **`tenant_role_definitions`** : SELECT autorisé pour membres du tenant (`tenant_id = any(public.current_user_tenant_ids())`). INSERT/UPDATE/DELETE réservé aux admins tenant (`public.user_role_in_tenant(tenant_id) = 'admin'` OR `public.is_super_admin()`)
- **`tenant_role_assignments`** : SELECT autorisé pour membres du tenant via jointure `tenant_role_definitions.tenant_id`. INSERT/UPDATE/DELETE réservé aux admins tenant
- **`tenant_order_roles`** : SELECT autorisé si user est membre du tenant qui possède la commande (jointure `tenant_orders.tenant_id`) OU si user_id = auth.uid() (visibilité sur ses propres rôles assignés). INSERT/UPDATE réservé via RPC `assign_tenant_order_role` (Sprint 6 S-ORDER-ROLES-2) — pas d'INSERT direct
- **`tenant_order_role_events`** : SELECT autorisé pour membres du tenant qui possède la commande. INSERT autorisé via triggers/RPC uniquement, pas d'INSERT direct anon ou authn
- **`tenant_order_status_definitions`** : SELECT public read (suit ADR-PIM-RLS-1 pattern catalog partagé — chaque tenant voit ses propres statuts). INSERT/UPDATE/DELETE réservé admins tenant

### AC4 — Helper SQL `public.user_can_validate_order(order_id)` + `public.user_has_order_role(order_id, capability)`

**Given** les helpers SQL canoniques sont créés
**When** S-ORDER-ROLES-3 (UI) ou S-N1-APPROVAL (workflow) en a besoin
**Then** :
- `public.user_has_order_role(order_id uuid, capability text)` retourne `true` si l'user authn a un rôle assigné non-révoqué sur la commande avec `capabilities ->> capability = 'true'`
- `public.user_can_validate_order(order_id)` raccourci de `user_has_order_role(order_id, 'can_validate')`
- Les helpers sont marqués `STABLE SECURITY INVOKER` (respect RLS)
- Les helpers sont testés vitest (6+ cas : user sans rôle, user avec rôle mais capability false, user avec rôle révoqué, user avec rôle ET capability true, super admin, anonyme)

### AC5 — Tests vitest `tests/rls/order_roles_isolation.test.ts` (6+ cas)

**Given** un harness vitest qui set up 2 tenants + 4 users (admin A, member A, admin B, member B) avec 2 commandes dont 1 partagée via tenant_order_roles
**When** chaque user tente de lire / écrire les 5 nouvelles tables
**Then** les assertions cross-tenant strict tiennent : member A ne voit pas les rôles de tenant B, admin B ne peut pas modifier le catalog tenant A, etc.

**And** un cas spécifique vérifie que **l'INSERT direct dans `tenant_order_roles` par un user lambda est BLOQUÉ** (doit passer par RPC S-ORDER-ROLES-2).

### AC6 — ADR §4.12 formalisée dans `architecture.md`

**Given** la décision Q4 (couche séparée) est structurante
**When** la story est livrée
**Then** la section §4.12 est ajoutée à [architecture.md](../planning-artifacts/architecture.md) avec :
- Titre : "ADR-ORDER-ROLES-1 — Couche rôles workflow séparée de `tenant_members.permissions`"
- Décision (résumé 5 lignes)
- 4 raisons argumentées (cf. overview)
- Schéma cible (les 5 tables)
- Alternative écartée : extension `tenant_members.permissions` JSONB
- Conséquence sprint et long terme : couche réutilisable pour autres workflows (devis, Canva, publication boutique...)

### AC7 — TF Notion

**Given** la DoD globale (§5.1 project-context) impose 1+ TF Notion par story
**When** la story est livrée
**Then** au moins 1 cas TF est ajouté à la DB Notion 🧪 Cahiers de tests :
- Titre : "RLS isolation cross-tenant rôles workflow"
- Parcours : P02 (gestion utilisateurs / RLS)
- Persona : Admin tenant
- Type d'exécution : SQL DB
- Couvre les 6+ assertions AC5

## Out of scope (à traiter en S-ORDER-ROLES-2 ou -3)

- ❌ RPC `assign_tenant_order_role` / `revoke_tenant_order_role` / `update_tenant_order_role_capabilities` → S-ORDER-ROLES-2
- ❌ Triggers d'audit auto-INSERT dans `tenant_order_role_events` → S-ORDER-ROLES-2
- ❌ Matrice transitions statuts + RPC `transition_tenant_order_status` → S-ORDER-ROLES-2
- ❌ Notifications Resend → S-N1-APPROVAL
- ❌ UI admin catalog rôles → S-ORDER-ROLES-3
- ❌ UI PortalOrders tabs filtrés → S-ORDER-ROLES-3

## Tasks

- [ ] Task 1 — Audit prod 5min des `tenant_orders.status` existants pour décider de la liste `tenant_order_status_definitions` initiale (principe DoD #4 audit prod avant heuristique)
- [ ] Task 2 — Rédiger migration `20260{XXX}_01_order_roles_schema.sql` (5 tables + contraintes + indexes)
- [ ] Task 3 — Seed migration pour les 9 tenants existants (5 statuts canoniques + 2 rôles Acheteur/Producteur)
- [ ] Task 4 — Policies RLS pour les 5 tables (10+ policies)
- [ ] Task 5 — Helpers SQL `user_has_order_role` + `user_can_validate_order`
- [ ] Task 6 — Tests vitest `tests/rls/order_roles_isolation.test.ts` (6+ cas)
- [ ] Task 7 — Appliquer migration prod via `supabase db push --linked` (fallback Dashboard si historique désynchronisé — cf. dette tracée Sprint 8)
- [ ] Task 8 — Formaliser ADR §4.12 dans `architecture.md`
- [ ] Task 9 — Créer TF Notion AC7

## DoD spécifique (DoD étendue qualité-first §5.2)

- [ ] Audit prod fait avant écriture migration (principe #4)
- [ ] Story scindée à < 3j (principe #7, ici 2j ✅)
- [ ] Story doc écrit AVANT démarrage code (principe #9, ce doc ✅)
- [ ] ADR §4.12 formalisée (principe #6)
- [ ] TF Notion créé en parallèle, pas en fin de sprint (principe #8)
- [ ] Pas de Sally UX consult requise (story purement DB/RLS — principe #5 N/A)
- [ ] Pas d'audit a11y requis (pas d'UI exposée — principe #10 N/A)
- [ ] Smoke E2E acheteur AI confirme aucune régression (principe #3 — story DB ne devrait rien casser, à valider)

## References

- [Overview S-ORDER-ROLES](story-S-ORDER-ROLES-roles-commande.md) — décisions Q1-Q10
- [Roadmap qualité-first](../planning-artifacts/roadmap-v1.1-qualite-first-2026-05-21.md) — Sprint 6
- [supabase/migrations/20260509_01_e1_orders_v1_1.sql] — schéma `tenant_orders` de base
- [supabase/migrations/20260505_02_e9_user_permissions.sql] — `tenant_members.permissions` (référence, ne pas étendre)
- [Pattern test RLS livré S4.1a / S1.4] — `tests/rls/orders_isolation.test.ts`
