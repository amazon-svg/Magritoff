---
story_id: P0.5
epic: Sprint 4 — PIM-Boutique-Commandes (Phase 0 Préalables)
title: ADR-ORDERS-1 — Documentation bascule shop_orders → tenant_orders
status: draft
target_branch: beta/v5
agent: Dev (Claude Code)
size: XS (<0.5j)
adr_ref: architecture.md §4.10
unblocks: Phase 1 (S-MIGRATION-ORDERS + S-DUAL-READ)
---

# Story P0.5 — ADR Orders model bascule

## Story (As / I want / So that)

**As an** architecte projet Magrit
**I want** documenter formellement la décision de basculer `submitCart()` de `shop_orders` (legacy) vers `tenant_orders` (modèle Order entity v1.1) + dual-read `PortalOrders` pour préserver l'historique
**So that** les stories Phase 1 (S-MIGRATION-ORDERS, S-DUAL-READ) et Phase 3 (S3.1-S3.5) ont une base architecturale claire, et qu'aucun dev futur ne refasse l'erreur historique de ne consommer que `shop_orders` sans intégrer le nouveau modèle.

## Contexte

L'audit Winston du 2026-05-17 a révélé que **deux modèles de commandes co-existent en prod B5** :
- `shop_orders` (legacy v3) : utilisé activement par `submitCart()` (insertion) et `PortalOrders.tsx` (lecture) sur la boutique B2B
- `tenant_orders` + `tenant_order_items` + `tenant_order_status_events` (v1.1) : créés par S1.4 (Sprint 3), mais **aucun code applicatif n'y écrit ou n'y lit** à date du 17/05

Sans décision tracée et formalisée, les stories du sprint 4 (Phase 1 bascule + Phase 3 lifecycle) seraient implémentées sans bases archi → risque de double refacto, perte des hooks NFR16 / E4.3 / S5.2 pré-câblés sur tenant_orders, et NFR6 cross-tenant cassé sur shop_orders.

Trois options ont été présentées à Arnaud (Winston recommandation 17/05) :
- **A** — Garder shop_orders + déprécier tenant_orders (haute dette long terme)
- **B** — Basculer maintenant + dual-read (recommandée Winston, alignement v1.1)
- **C** — Bascule post-démo (risque double migration si S3.x avancent en parallèle)

**Arnaud a tranché Option B** (réponse 17/05) : bascule immédiate.

## Acceptance Criteria

**AC1** — Section `### 4.10 Order Entity — Bascule shop_orders → tenant_orders + Dual-Read` ajoutée à `_bmad-output/planning-artifacts/architecture.md` entre §4.9 et Step 5.

**AC2** — La section couvre les 7 angles requis :
1. **Contexte** : 2 modèles co-existent depuis S1.4 sans bascule
2. **Décision** : Option B (bascule + dual-read)
3. **Pourquoi** : 5 raisons (alignement v1.1, NFR6, hooks NFR16/E4.3/S5.2, audit trail, évite refacto double)
4. **Alternatives écartées** : A et C avec arguments
5. **Trade-off** : bifurcation temporaire des cohorts shop_orders/tenant_orders
6. **Pattern à respecter** : do/don't pour les stories suivantes
7. **Référence mémoire BMAD** : sprint-status-2026-05-17.md

**AC3** — Les Phase 1 stories (S-MIGRATION-ORDERS, S-DUAL-READ) référencent cette ADR explicitement dans leurs story docs respectives (à créer en Phase 1).

**AC4** — Aucun changement code applicatif dans cette story (la bascule code est traitée par S-MIGRATION-ORDERS).

## Décisions clés résumées

| Aspect | Décision |
|---|---|
| **Nouveau modèle pour écritures** | `tenant_orders` + `tenant_order_items` |
| **Lecture historique** | UNION `shop_orders` legacy + `tenant_orders` (badge UI "Legacy") |
| **Transitions statut** | RPC `update_tenant_order_status` uniquement (matrice §4.1) |
| **Cohort `shop_orders` legacy** | Figée — aucune nouvelle écriture après bascule |
| **Cleanup éventuel V2+** | Script migration shop_orders → tenant_orders, optionnel, hors v1.1 |
| **Numéro ADR** | §4.10 (Step 4 Core Architectural Decisions) |

## Fichiers touchés

- `_bmad-output/planning-artifacts/architecture.md` : +90 lignes (§4.10, déjà rédigé en amont du sprint)

## Tests / Vérifications

- Lecture humaine de §4.10 par Arnaud avant commit final
- Pas de test code (story doc-only)

## TF Notion à créer en fin de story

Aucun (story purement documentaire — pas de comportement testable côté UI/DB).

## Notes

ADR rédigée en amont du sprint et déjà présente dans `architecture.md`. Ce story doc formalise la traçabilité BMAD (chaque livrable = un story doc). La bascule effective est dans les stories Phase 1.
