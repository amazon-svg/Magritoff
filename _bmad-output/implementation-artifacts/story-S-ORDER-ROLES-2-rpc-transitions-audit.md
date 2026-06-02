---
story_id: S-ORDER-ROLES-2
parent_story: S-ORDER-ROLES (overview)
epic: 3 — Module Commandes (extension scope rôles)
title: RPC assignation/transitions rôles + audit events automatique
status: spec-ready (post Phase 0.4 cadrage qualité, 2026-05-22)
created_at: 2026-05-22
target_branch: beta/v5
agent: TBD (Dev hat, Sprint 6)
size: M (2-3j)
prd_ref: _bmad-output/planning-artifacts/prd.md (FR18-24)
predecessors: [S-ORDER-ROLES-1 livré]
successors: [S-ORDER-ROLES-3, S-N1-APPROVAL, S3.5 Audit trail UI]
sprint_cible: Sprint 6 (roadmap qualité-first)
---

# Story S-ORDER-ROLES-2 — RPC transitions + audit events

## Contexte

Deuxième des 3 sous-stories de S-ORDER-ROLES. Apporte la **logique métier serveur** : RPCs Postgres pour assignation/révocation de rôles, RPC pour transitions de statuts, et triggers d'audit qui peuplent automatiquement `tenant_order_role_events` (créée en S-ORDER-ROLES-1).

Voir [story-S-ORDER-ROLES-roles-commande.md](story-S-ORDER-ROLES-roles-commande.md) pour le contexte business complet.

**Dépend critiquement** de S-ORDER-ROLES-1 livré (schéma DB + helpers).

## Story (user story)

**As a** plateforme Magrit B2B,
**I want** que toutes les opérations sensibles sur les rôles workflow (assignation, révocation, mise à jour capabilities, transitions de statuts) passent par des RPCs Postgres avec validation business + audit automatique,
**So that** (a) la cohérence métier est garantie (pas d'assignation à un user non-membre du tenant, pas de transition de statut illégale), (b) l'audit trail est exhaustif et immuable, (c) le front n'a jamais à manipuler directement les tables d'autorisation.

## Acceptance Criteria

### AC1 — RPC `assign_tenant_order_role(p_order_id, p_role_definition_id, p_user_id)` SECURITY DEFINER

**Given** un admin tenant authentifié appelle la RPC
**When** la RPC s'exécute
**Then** elle :
1. Vérifie que `auth.uid()` est admin du tenant qui possède la commande (sinon EXCEPTION `permission_denied`)
2. Vérifie que `p_user_id` est membre du tenant (jointure `tenant_members`, sinon EXCEPTION `user_not_member`)
3. Vérifie que `p_role_definition_id` appartient au même tenant (sinon EXCEPTION `role_mismatch_tenant`)
4. Vérifie scope du rôle : si `scope='shop'`, alors `tenant_orders.shop_id` doit matcher `tenant_role_definitions.scope_shop_id` (sinon EXCEPTION `role_scope_mismatch`)
5. INSERT dans `tenant_order_roles` (idempotent via `ON CONFLICT DO NOTHING` sur UNIQUE — réassignation = no-op silencieux)
6. INSERT dans `tenant_order_role_events` avec `event_type='assigned'`, `actor_user_id=auth.uid()`, `payload={role_name, capabilities}`
7. Retourne le UUID de la row `tenant_order_roles` créée (ou existante)

**And** la RPC est testée vitest avec 8+ cas (admin OK, non-admin BLOCKED, user non-membre BLOCKED, role tenant mismatch BLOCKED, role scope=shop OK, role scope=shop mismatch BLOCKED, réassignation idempotente, audit event créé).

### AC2 — RPC `revoke_tenant_order_role(p_assignment_id)` SECURITY DEFINER

**Given** un admin tenant ou l'user lui-même (auto-révocation) appelle la RPC
**When** la RPC s'exécute
**Then** elle :
1. Vérifie autorisation (admin tenant OU `auth.uid() = tenant_order_roles.user_id`)
2. UPDATE `tenant_order_roles SET revoked_at = now()`
3. INSERT dans `tenant_order_role_events` avec `event_type='revoked'`, `actor_user_id=auth.uid()`, `payload={reason: 'manual'}`
4. Retourne le timestamp `revoked_at`

**And** une revocation double est idempotente (no-op si déjà révoqué).

### AC3 — RPC `update_tenant_order_role_capabilities(p_role_definition_id, p_capabilities jsonb)` SECURITY DEFINER

**Given** un admin tenant modifie les capabilities d'un rôle de son catalog
**When** la RPC s'exécute
**Then** elle :
1. Vérifie que `auth.uid()` est admin du tenant qui possède la `role_definition`
2. Valide le format jsonb : seules les 4 clés `can_validate`, `can_cancel`, `can_modify`, `can_export` sont autorisées (sinon EXCEPTION `invalid_capabilities_keys`)
3. UPDATE `tenant_role_definitions SET capabilities = p_capabilities`
4. INSERT dans `tenant_order_role_events` pour CHAQUE commande qui a ce rôle assigné non-révoqué, avec `event_type='capability_updated'`, `payload={old_capabilities, new_capabilities}` (rétro-traçabilité)

**And** la RPC est marquée TRANSACTION (rollback total si une étape échoue).

### AC4 — RPC `transition_tenant_order_status(p_order_id, p_new_status_code)` SECURITY DEFINER

**Given** un user avec capability `can_validate` (ou `can_cancel` selon transition cible) appelle la RPC
**When** la RPC s'exécute
**Then** elle :
1. Vérifie via `public.user_has_order_role(p_order_id, capability)` que le user a la capability requise pour la transition (matrice transitions ↔ capability ci-dessous)
2. Vérifie que `p_new_status_code` existe dans `tenant_order_status_definitions` pour le tenant de la commande
3. Vérifie que la transition est légale via la matrice (cf. AC5 ci-dessous)
4. UPDATE `tenant_orders SET status = p_new_status_code, updated_at = now()`
5. INSERT dans `tenant_order_status_events` (table existante S1.4) avec `event_type='status_transition'`, `actor_user_id=auth.uid()`, `payload={from_status, to_status}`
6. Retourne le nouveau status

**And** la RPC est testée vitest avec 10+ cas couvrant transitions légales / illégales / capabilities manquantes / status custom non-existant.

### AC5 — Matrice transitions canoniques `tenant_order_status_transitions`

**Given** une table de matrice transitions est créée par migration `20260{XXX}_02_order_status_transitions.sql`
**When** elle est seedée
**Then** elle contient les transitions canoniques par défaut pour chaque tenant :

| from_status | to_status | required_capability | self_service ?  |
|---|---|---|---|
| draft | pending | (aucune — auto post-submitCart) | oui acheteur |
| draft | cancelled | can_cancel | oui acheteur |
| pending | validated | can_validate | non, validateur |
| pending | cancelled | can_cancel | non, admin |
| validated | shipped | (statut producteur, Producteur role) | non, owner shop |
| shipped | delivered | (réservé V2+) | hors scope |
| * | cancelled | can_cancel | non, admin (sauf draft) |

**And** la table permet l'ajout de transitions custom par tenant (cohérent Q7 = statuts extensibles).

### AC6 — Triggers audit auto (defensive belt-and-suspenders)

**Given** les RPCs ci-dessus INSERT dans les tables d'audit explicitement
**When** un acteur malveillant ou un script tente d'UPDATE/DELETE direct sur `tenant_order_roles` ou `tenant_orders.status` en contournant RPC
**Then** un trigger Postgres `tg_audit_tenant_order_roles_changes` AFTER UPDATE/DELETE journalise dans `tenant_order_role_events` (ou table audit générique) avec `event_type='direct_db_modification'`, `actor_user_id=auth.uid()`, `payload={old_row, new_row}`
**And** un trigger équivalent sur `tenant_orders` capture les UPDATE de `status` hors RPC

**Rationale** : double couche (RPC explicite + trigger défensif) garantit que **rien** ne contourne l'audit, même un super_admin distrait. Coût minimal, gain sécurité majeur.

### AC7 — Tests vitest `tests/rpc/order_roles_rpc.test.ts` (15+ cas)

**Given** un harness vitest qui exerce les 4 RPCs avec des profils variés (admin tenant, member tenant, super_admin, anonyme, cross-tenant)
**When** chaque RPC est appelée
**Then** les assertions tiennent : autorisations correctes, transitions valides, audit events présents, idempotence.

### AC8 — TF Notion

Au moins 2 TF Notion :
- "Transition statut commande avec capability OK / KO" (Parcours P08, Persona Validateur N+1)
- "Assignation rôle commande par admin tenant" (Parcours P02, Persona Admin tenant)

## Out of scope (à traiter en S-ORDER-ROLES-3 ou S-N1-APPROVAL)

- ❌ UI admin pour gérer le catalog rôles → S-ORDER-ROLES-3
- ❌ UI PortalOrders tabs filtrés → S-ORDER-ROLES-3
- ❌ Edge function `order-workflow-step` pour notifications Resend par étape → S-N1-APPROVAL
- ❌ UI audit trail (modale "Historique des statuts") → S3.5

## Tasks

- [ ] Task 1 — Rédiger migration `20260{XXX}_02_order_status_transitions.sql` (matrice canonique + seed 9 tenants)
- [ ] Task 2 — Implémenter RPC `assign_tenant_order_role`
- [ ] Task 3 — Implémenter RPC `revoke_tenant_order_role`
- [ ] Task 4 — Implémenter RPC `update_tenant_order_role_capabilities` (TRANSACTION)
- [ ] Task 5 — Implémenter RPC `transition_tenant_order_status` (joint matrice + capability check)
- [ ] Task 6 — Implémenter triggers défensifs `tg_audit_tenant_order_roles_changes` + équivalent sur `tenant_orders`
- [ ] Task 7 — Tests vitest `tests/rpc/order_roles_rpc.test.ts` (15+ cas)
- [ ] Task 8 — Appliquer migration prod
- [ ] Task 9 — Créer les 2 TF Notion

## DoD spécifique

- [ ] Audit prod fait avant migration (principe #4)
- [ ] Story doc écrit AVANT démarrage code (principe #9)
- [ ] Pas de Sally UX consult requise (story purement backend)
- [ ] TF Notion créé en parallèle (principe #8)
- [ ] Story scindée à < 3j (principe #7, ici 2-3j ✅)
- [ ] Checkpoint récap obligatoire à la fin de S-ORDER-ROLES-2 avant démarrer -3 (principe #2)
- [ ] Smoke E2E acheteur AI confirme aucune régression sur submitCart + PortalOrders existant (principe #3)

## References

- [Overview S-ORDER-ROLES](story-S-ORDER-ROLES-roles-commande.md)
- [S-ORDER-ROLES-1 schéma DB](story-S-ORDER-ROLES-1-schema-db-rls.md) — prérequis
- [Pattern RPC existant S1.4] — `public.update_tenant_order_status` dans `20260509_01_e1_orders_v1_1.sql`
- [Pattern test RLS+RPC existant] — `tests/rls/orders_isolation.test.ts`
