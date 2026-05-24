---
story_id: S3.4
epic: 3 — Module Commandes (Order entity user-facing)
title: Annulation commande draft (acheteur sur sienne / admin tenant sur toutes)
status: in-progress (Sprint 5 Phase 1, 2026-05-23)
created_at: 2026-05-23
target_branch: beta/v5
agent: Claude Code (Dev hat)
size: S (0.5j)
prd_ref: _bmad-output/planning-artifacts/prd.md (FR19 audit trail)
predecessors: [S1.4 RPC update_tenant_order_status livré, S3.1 OrderHistoryTable, S3.2 permission can_order]
successors: [S3.5 Audit trail UI Sprint 6, S-ORDER-ROLES Sprint 6]
sprint_cible: Sprint 5 (roadmap qualité-first Orderbook & filet LLM)
---

# Story S3.4 — Annulation commande draft

## Contexte

S1.4 (Sprint 1-2, migration `20260509000100_e1_orders_v1_1.sql`) a déjà livré le RPC `public.update_tenant_order_status(p_order_id, p_new_status, p_reason)` qui :
- Vérifie l'auth (auth.uid() requis)
- Applique la matrice de transitions v1.1 (`draft → cancelled` autorisé pour auteur OU admin tenant)
- Insère `tenant_order_status_events` (audit trail garanti) avec `actor_id` = caller + `metadata.is_owner` + `metadata.is_admin_tenant`
- Peuple `cancelled_at = now()` automatiquement

Cette story se limite donc à l'**UI** : bouton "Annuler" sur les lignes draft + modal confirmation Sally-validée + appel RPC + refresh liste + feedback utilisateur. Aucun changement DB.

## User Story

**As an** acheteur B2B (sur ses propres commandes draft) OU admin tenant (sur n'importe quelle commande draft du tenant),
**I want** annuler une commande draft en 1 clic + 1 confirmation,
**So that** j'évite de l'engager si je change d'avis ou si elle est obsolète, et l'audit trail garde une trace de l'action.

## Acceptance Criteria

### AC1 — Bouton "Annuler" conditionnel

**Given** un acheteur OU admin tenant sur OrderHistoryTable
**When** la story est livrée
**Then** chaque ligne en statut `draft` affiche un bouton "Annuler" (icône `X` ou `Ban`)
**And** les commandes en statut != `draft` n'affichent PAS le bouton (RPC refuserait de toute façon, mais on évite de le proposer)
**And** les commandes cohort legacy `shop_orders` n'affichent PAS le bouton (le RPC `update_tenant_order_status` ne s'applique pas à cette cohort)

### AC2 — Modal confirmation (AlertDialog shadcn)

**Given** un acheteur clique "Annuler"
**When** le modal apparaît
**Then** le modal affiche :
- Titre : "Annuler cette commande ?"
- Description : "Cette action passera la commande en statut Annulée et tracera l'événement dans l'historique. L'opération est irréversible."
- 2 boutons : "Garder" (cancel/dismiss) + "Annuler la commande" (action danger, fond rouge ou icône warning)

**And** le focus initial est sur "Garder" (UX safe par défaut)
**And** Esc / clic outside ferme le modal sans action

### AC3 — Appel RPC + feedback

**Given** l'acheteur confirme l'annulation
**When** le bouton "Annuler la commande" est cliqué
**Then** `supabase.rpc('update_tenant_order_status', { p_order_id, p_new_status: 'cancelled', p_reason: null })` est appelé
**And** si succès : le modal se ferme + toast/feedback "Commande annulée" + la liste se rafraîchit (le statut passe à "Annulée" dans la table)
**And** si erreur RPC (permission denied / autre) : le modal reste + message d'erreur explicite affiché dans le modal (ne ferme pas)

### AC4 — Admin tenant peut annuler n'importe quelle draft (couvert par RPC)

**Given** un admin tenant sur DashboardOrders
**When** il clique "Annuler" sur une draft d'un acheteur tiers
**Then** la RPC autorise (le check `_is_admin_tenant := tm.role in ('owner', 'admin')` passe)
**And** l'event `tenant_order_status_events` enregistre `actor_id` = admin tenant + `metadata.is_admin_tenant = true` (pas `is_owner`)

### AC5 — Acheteur non-créateur sur sa shop ne peut PAS annuler (RLS bloque)

**Given** un acheteur shop_only A voit la commande draft d'un autre acheteur shop_only B (cas rare via dashboard partagé ou multi-acheteurs même boutique)
**When** A tente d'annuler
**Then** la RPC raise `'Permission denied: cancel requires owner or admin tenant'`
**And** l'erreur est affichée dans le modal sans fermer

### AC6 — Tests vitest

- Helper `formatCancelErrorMessage(rpcError)` (extrait pur) : map les patterns RPC error vers un message utilisateur lisible

## Out of scope

- Restoration d'une commande cancelled vers draft → V2+ (et la matrice RPC le refuse de toute façon)
- Cancel par reason text (zone de saisie raison) → V2+ — pour l'instant `p_reason: null` suffit (l'audit trail garde actor_id + is_owner/is_admin_tenant)
- Annulation bulk (multi-sélection lignes) → V2+
- Confirmation via 2FA / code email → hors v1.1

## Tasks

- [ ] Task 1 — Helper pur `formatCancelErrorMessage` (extrait map error patterns) + tests vitest
- [ ] Task 2 — OrderHistoryTable : prop `onCancelOrder?: (order) => Promise<void>` + bouton conditionnel draft + testId
- [ ] Task 3 — Nouveau composant `CancelOrderConfirmDialog.tsx` réutilisable (AlertDialog shadcn)
- [ ] Task 4 — PortalOrders : passe `onCancelOrder` du parent à OrderHistoryTable
- [ ] Task 5 — DashboardOrders : implémente `onCancelOrder` (admin tenant peut annuler n'importe quelle draft du tenant)
- [ ] Task 6 — PublicShop : implémente `handleCancelOrder` (acheteur sur ses propres drafts)
- [ ] Task 7 — Refresh orders après cancel (re-fetch ou update local state)
- [ ] Task 8 — TF Notion 2 cas (acheteur self / admin tenant sur draft tiers)
- [ ] Task 9 — Smoke local + commit + push

## DoD spécifique

- [ ] #5 Sally UX consult : court-circuit pragmatique → modal shadcn AlertDialog standard, texte Sally-style (questionnaire safe par défaut "Garder", action danger explicite "Annuler la commande")
- [ ] #6 Pas d'ADR (extension UI, le RPC existe déjà S1.4)
- [ ] #7 Story < 3j : 0.5j ✅
- [ ] #8 TF Notion en parallèle ✅
- [ ] #9 Story doc au démarrage ✅
- [ ] #10 a11y : AlertDialog Radix gère focus trap + Esc + aria-modal nativement
