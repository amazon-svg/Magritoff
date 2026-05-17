---
sprint: Sprint 4 — PIM-Boutique-Commandes (BMAD)
status_date: 2026-05-17
agent: Claude Code (Dev)
prd_ref: _bmad-output/planning-artifacts/prd.md
architecture_ref: _bmad-output/planning-artifacts/architecture.md
epics_ref: _bmad-output/planning-artifacts/epics.md
target_branches: [beta/v5]
demo_target_date: 2026-05-23
head_at_start: c95b547
---

# Sprint Status — 2026-05-17

> Sprint Magrit B5 démarrant après le hotfix double-bug du 17/05 (HEAD `c95b547`). Focus : consolidation PIM/Gammes + bascule modèle commandes + finalisation lifecycle orders + consolidation boutique B2B.
>
> Démo client cible : **2026-05-23** (Phase 0 + Phase 1 + Phase 2 prioritaire doivent être livrées).

## Vue d'ensemble

| Indicateur | Valeur |
|---|---|
| **Sprint** | Sprint 4 — PIM-Boutique-Commandes |
| **Période** | 2026-05-17 → ~2026-05-30 (démo intermédiaire 2026-05-23) |
| **Phases** | 4 (Préalables + Orders bascule + Boutique conso + Orders lifecycle) |
| **Stories planifiées** | 16 (5 préalables + 2 bascule orders + 6 conso boutique + 5 lifecycle Epic 3) |
| **ADR à documenter** | 2 (ADR-PIM-RLS-1, ADR-ORDERS-1) |
| **Stories livrées à date** | 0 (sprint en cours) |
| **Migrations DB prévues** | 1+ (5 gammes seed extension + éventuelles indexes orders) |
| **Tests TF Notion à créer** | ~16 (1 par story) |
| **Baseline tests vitest** | 290 verts (HEAD `c95b547`) |

## Décisions d'architecture (ADR)

### ADR-PIM-RLS-1 — `product_definitions` reste en lecture publique (shared catalog)

**Décision** : la RLS de `product_definitions` est intentionnellement en **lecture publique**. Le PIM Magrit est un **catalogue vitrine partagé** (fiches SEO/marketing génériques générées par Claude Haiku via `pim-ingest`). Aucune donnée tenant sensible n'y est stockée. Le filtrage par boutique passe par `tenant_gamme_subscriptions` (gammes activées) + `shops.library_ids`/`excluded_product_ids` (granularité produit).

**Conséquence sprint** : aucun changement RLS. Documentation seulement (P0.1).

**Mémoire BMAD** : [project_pim_rls_shared_catalog.md](../../../.claude/projects/-Users-arnaudmazon-Documents-Claude-BMAD-Magrit/memory/project_pim_rls_shared_catalog.md)

### ADR-ORDERS-1 — Bascule `submitCart` → `tenant_orders` + dual-read `PortalOrders`

**Décision** : on bascule `submitCart()` pour insérer dans `tenant_orders` + `tenant_order_items` (livrés S1.4) au lieu de `shop_orders` (legacy v3). En parallèle, `PortalOrders.tsx` lit en UNION les deux tables pour préserver l'historique des commandes anciennes (cohort `shop_orders` figée + cohort `tenant_orders` qui s'enrichit).

**Pourquoi** :
- Alignement Architecture v1.1 / ADR-1 (`tenant_orders` = source de vérité Order entity)
- NFR6 isolation cross-tenant strict (manquant sur `shop_orders`)
- Hooks pré-câblés NFR16 e-invoicing (PA/PPF), E4.3 Stripe, S5.2 Canva
- Audit trail garanti par RPC `update_tenant_order_status` + table `tenant_order_status_events`
- Évite refacteur double des stories S3.x

**Trade-off** : bifurcation temporaire des données en prod (commandes legacy shop_orders + nouvelles tenant_orders). Géré par dual-read jusqu'à un éventuel cleanup futur (script de migration V2+ optionnel).

**Alternative écartée** : Option A (rester shop_orders) — refacto double S3.x + perte NFR6/NFR16. Option C (post-démo) — risque doublé si S3.x avancent avant bascule.

**Conséquence sprint** : Phase 1 (S-MIGRATION-ORDERS + S-DUAL-READ) traite la bascule. Stories S3.x consomment ensuite `tenant_orders` directement.

## Phase 0 — Préalables PIM/Gammes (~2j)

| Story | Description | Taille | Statut |
|---|---|---|---|
| **P0.1** | Documentation ADR-PIM-RLS-1 (ce fichier + ARCHITECTURE.md note) | XS | À faire |
| **P0.2** | Migration SQL +5 gammes : `kakemono`, `roll_up`, `etiquette`, `depliant_plie`, `banderole` avec `matching_rules` JSONB | S | À faire |
| **P0.3** | TenantOnboarding wizard E9.6 — adapter scroll/groupage pour 11 parents (vs 6) | S | À faire |
| **P0.4** | Smoke test ingestion PIM end-to-end (commande → `pim_candidates` → `pim-ingest` → `product_definitions`) | XS | À faire |
| **P0.5** | Documentation ADR-ORDERS-1 (ce fichier + ARCHITECTURE.md note) | XS | À faire |

**Sortie** : 1 migration SQL appliquée prod + 1 commit code (wizard) + 2 sections ARCHITECTURE.md.

## Phase 1 — Bascule modèle orders (~2j, ADR-ORDERS-1)

| Story | Description | Taille | Statut |
|---|---|---|---|
| **S-MIGRATION-ORDERS** | `submitCart()` insère dans `tenant_orders` + `tenant_order_items` au lieu de `shop_orders`. Adapte les types DB + tests. | M | À faire |
| **S-DUAL-READ** | `PortalOrders.tsx` query UNION `shop_orders` legacy + `tenant_orders` (groupage par `created_at` desc). Affiche badge "Legacy" pour les anciennes. | S | À faire |

**Sortie** : 2 commits + tests vitest + migration TF Notion existante "Mes commandes shop B2B" mise à jour.

## Phase 2 — Boutique consolidation (~5j, 6 stories S-CONSO)

| Story | Description | Taille | Prio démo | Statut |
|---|---|---|---|---|
| **S-CONSO-1** | Cleanup 3 thumbs placeholder PortalProduct | S | Basse | À faire |
| **S-CONSO-2** | aria-labels cart icon + Sheet drawer (a11y WCAG AA) + scan axe-core local | S | **Moyenne** | À faire |
| **S-CONSO-3** | Page de confirmation commande `PortalThankYou` (n° commande, email, total TTC, CTA retour catalogue) | M | **Haute (démo)** | À faire |
| **S-CONSO-4** | Recherche texte simple (fallback IA down) — input search PortalCatalog, filtre nom+description case-insensitive | M | Moyenne | À faire (post-démo) |
| **S-CONSO-5** | Tri grille catalogue (prix asc/desc, date) — menu déroulant ou 3 boutons, persistance localStorage par shop | M | Basse | À faire (post-démo) |
| **S-CONSO-6** | Décision UX workflow N+1 validation panier (échange Arnaud) : retirer placeholder OU câbler backend | S | À trancher | À faire |

**Sortie** : 6 commits + tests vitest + a11y scan green + 6 TF Notion.

## Phase 3 — Commandes lifecycle Epic 3 (~3-4j, post-démo)

| Story | Description | Taille | Statut |
|---|---|---|---|
| **S3.1** | OrderHistoryTable — étendre `PortalOrders` (déjà dual-read post Phase 1) avec filtres statut/date/montant, badge couleur statut | S | À faire |
| **S3.2** | Création commande depuis panier statut `draft` — valider après Phase 1 que le flow est complet, ajouter ACK UX | S | À faire |
| **S3.3** | Bouton Renouveler 1-clic — clone des items d'une commande passée vers panier courant | S | À faire |
| **S3.4** | Annulation commande draft (acheteur + admin) via RPC `update_tenant_order_status` | S | À faire |
| **S3.5** | Audit trail UI — modale "Historique des statuts" qui lit `tenant_order_status_events` (RPC déjà livré S1.4) | M | À faire |

**Sortie** : 5 commits + tests vitest + 5 TF Notion.

## Ordre d'exécution recommandé

```
Jour 1     : P0.1 + P0.2 + P0.5 (ADR + migration gammes)        [~1j]
Jour 2     : P0.3 + P0.4 (wizard onboarding + smoke test)        [~1j]
Jour 3-4   : Phase 1 — S-MIGRATION-ORDERS + S-DUAL-READ          [~2j]
Jour 5     : S-CONSO-2 + S-CONSO-3 (a11y + thank you démo)       [~1j]
Jour 6     : S-CONSO-1 + démo intermédiaire + buffer             [~1j]
─── DÉMO CLIENT 2026-05-23 ───
Jour 7-9   : Phase 3 commandes lifecycle S3.1→S3.5               [~3-4j]
Jour 10-11 : Phase 2 reste — S-CONSO-4 + S-CONSO-5 + S-CONSO-6   [~3j]
Jour 12    : Buffer / retro / pré-Sprint 5                       [~1j]
```

## Tests TF Notion à créer (DoD projet)

Selon convention Magrit, **1+ TF par story livrée**. Liste prévue :
- 5 TF Phase 0 (P0.1-P0.5)
- 2 TF Phase 1 (S-MIGRATION-ORDERS, S-DUAL-READ)
- 6 TF Phase 2 (S-CONSO-1 à 6)
- 5 TF Phase 3 (S3.1-S3.5)
- **Total : ~18 TF** dans la DB Notion 🧪 Cahiers de tests

## Risques identifiés

| Risque | Mitigation |
|---|---|
| Bifurcation orders prolongée (shop_orders legacy + tenant_orders) | Dual-read S-DUAL-READ couvre. Cleanup optionnel V2+ documenté dans ADR. |
| Démo 23/05 incomplete si Phase 1 retardée | Fallback : démo sur shop_orders seul (Option C pragmatique), bascule reportée. Décision à J-2. |
| Élargissement gammes casse TenantOnboarding existants | P0.3 dédié + smoke test wizard avant migration. |
| LLM Clariprint convention cm/mm pour nouveaux formats | Helpers `isLikelyCm` + `matchStandardFormat` du hotfix 17/05 couvrent. Validation P0.4. |

## Stories livrées ce sprint

*(à remplir au fur et à mesure)*

| Story | Document | Branche | Commit | Statut |
|---|---|---|---|---|
| — | — | — | — | — |

## Liens

- Sprint précédent : [sprint-status-2026-05-10.md](sprint-status-2026-05-10.md)
- Hotfix 17/05 : commits `86e2220` + `5325c6c` + `c95b547` (SPRINT_HANDOFF.md section 11)
- Mémoire ADR PIM RLS : [project_pim_rls_shared_catalog.md](../../../.claude/projects/-Users-arnaudmazon-Documents-Claude-BMAD-Magrit/memory/project_pim_rls_shared_catalog.md)
- Backlog Notion : https://www.notion.so/4d2e2ea106914ce5a69728fdb67dfddd
- TF Notion : https://www.notion.so/7e576e695d504cc9a32ead92f4dde01c
