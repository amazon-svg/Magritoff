---
story_id: S3.3
epic: 3 — Module Commandes (Order entity user-facing)
title: Bouton Renouveler 1-clic depuis OrderHistoryTable
status: in-progress (Sprint 5 Phase 1, 2026-05-23)
created_at: 2026-05-23
target_branch: beta/v5
agent: Claude Code (Dev hat)
size: S (0.5j)
prd_ref: _bmad-output/planning-artifacts/prd.md (FR20)
predecessors: [S3.1 OrderHistoryTable livré, S3.2-residual permission can_order livrée, S-MIGRATION-ORDERS / S-DUAL-READ (tenant_orders + tenant_order_items)]
successors: [S-N1-APPROVAL workflow Sprint 6]
sprint_cible: Sprint 5 (roadmap qualité-first Orderbook & filet LLM)
---

# Story S3.3 — Renouveler une commande en 1 clic

## User Story

**As an** acheteur B2B,
**I want** renouveler une commande passée en un clic avec pré-remplissage des produits et options Clariprint,
**So that** je gagne du temps sur les commandes récurrentes (cas Claire Mercier Journey 2).

## Acceptance Criteria

### AC1 — Bouton "Renouveler" sur les lignes éligibles

**Given** un acheteur sur OrderHistoryTable avec ≥ 1 commande non-`draft` non-`cancelled`
**When** la story est livrée
**Then** chaque ligne éligible affiche un bouton "Renouveler" (icône `RotateCw`)
**And** les commandes en statut `draft` ou `cancelled` n'affichent PAS le bouton (rien à renouveler depuis un draft ou un cancelled)
**And** les commandes cohort legacy `shop_orders` (source='legacy') n'affichent PAS le bouton (items inline JSONB sans product_id stable, mapping fragile)

### AC2 — Rebuild cart depuis items + redirect

**Given** un acheteur clique "Renouveler" sur une commande v1.1 éligible
**When** l'action déclenche le rebuild
**Then** la query `tenant_order_items` WHERE order_id = orderId résout les lignes snapshotées
**And** pour chaque item :
- Si `product_id` UUID + produit existe dans le catalogue shop courant → ajouté au cart avec `qty = item.quantity`
- Si `product_id` null OU produit retiré → warning "Produit indisponible : <label>" (item skip)

**And** le cart est rempli avec les lignes résolues (`setCart(newLines)`, remplace le cart actuel si existant + confirm si non vide)
**And** la vue bascule sur `cart` (le drawer panier s'ouvre automatiquement)
**And** la commande originale n'est PAS modifiée (lecture seule)

### AC3 — Warnings affichés à l'acheteur

**Given** des items dont les produits ne sont plus dispo dans le catalogue shop courant
**When** l'acheteur arrive sur PortalCart après renew
**Then** un banner en haut du cart liste les warnings : "X produit(s) indisponible(s) ont été retirés du panier : [labels]"
**And** le banner est dismissable (le user le ferme manuellement)
**And** si 0 warning, pas de banner affiché

### AC4 — Édit + validation = nouvelle commande draft

**Given** l'acheteur ajuste les quantités dans le panier renouvelé
**When** il clique "Passer commande"
**Then** une NOUVELLE commande `draft` est créée via submitCart (logique S3.2 existante) avec les options renouvelées
**And** la commande originale reste intacte (statut, items, dates)
**And** l'admin tenant reçoit la notification email standard (S3.2-residual AC1)

### AC5 — Tests vitest helper pur

**Given** la fonction `rebuildCartFromOrderItems(items, currentShopProducts)`
**When** la story est livrée
**Then** 6+ cas vitest verts :
- items vides → cart vide + 0 warning
- 1 item product_id matchant catalogue → 1 line cart, qty correcte
- 1 item product_id absent du catalogue → 0 line + 1 warning avec label
- 2 items mix matchant/absent → 1 line + 1 warning
- 1 item product_id null → 0 line + 1 warning (legacy library product)
- préserve config Clariprint snapshot (merge avec produit catalogue)

## Out of scope

- Renouvellement sur commande cohort legacy `shop_orders` (mapping fragile, peu de valeur — la cohort legacy est figée pré-bascule 17/05)
- Renouvellement multi-orders (sélection plusieurs commandes pour merger) → V2+
- Renouvellement avec ajustement automatique quantité (suggérer +10% comme dans Magrit IA) → V2+
- Re-validation des options Clariprint contre l'API courante (les options sont supposées stables sur la durée d'usage métier — si elles changent, le devis temps réel le détectera au moment du calcul prix)

## Tasks

- [ ] Task 1 — Helper pur `src/app/components/shop/portal/orderRenewal.helpers.ts` (rebuildCartFromOrderItems + tests vitest 6+ cas verts)
- [ ] Task 2 — OrderHistoryTable : nouvelle colonne "Actions" + bouton Renouveler conditionnel (callback onRenewOrder optionnel, masqué pour draft/cancelled/legacy)
- [ ] Task 3 — testIds : orderRenewBtn
- [ ] Task 4 — PortalOrders : reçoit prop `onRenewOrder` du parent, passe à OrderHistoryTable
- [ ] Task 5 — PublicShop : implémente `handleRenewOrder` (query items + appel helper + setCart + setView('cart') + setRenewalWarnings)
- [ ] Task 6 — PortalCart : nouveau banner warnings (props.renewalWarnings) dismissable
- [ ] Task 7 — Smoke local dev server : commander 2 produits, attendre validate ailleurs (ou utiliser commande existante), renew → cart rempli + warning si applicable
- [ ] Task 8 — TF Notion en parallèle (DoD #8, lesson S-LLM-WRAPPER)
- [ ] Task 9 — Commit + push

## DoD spécifique

- [ ] #5 Sally UX consult : court-circuit pragmatique (S validée par défaut, icône `RotateCw` + label hover, banner warnings simple) — pas d'invocation Sally agent
- [ ] #6 Pas d'ADR (extension UI + helper pur sans décision archi)
- [ ] #7 Story < 3j : 0.5j ✅
- [ ] #8 TF Notion en parallèle pas en fin ✅
- [ ] #9 Story doc au démarrage ✅
- [ ] #10 Audit a11y route /shop/<slug>/orders : déjà couvert S3.1 (patterns ARIA en place), bouton renew respecte `<button type="button">` + `aria-label` + `title` tooltip
