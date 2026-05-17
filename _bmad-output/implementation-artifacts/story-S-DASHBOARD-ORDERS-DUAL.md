---
story_id: S-DASHBOARD-ORDERS-DUAL
epic: Sprint 4 — PIM-Boutique-Commandes (Phase 1 — mini-fix complémentaire bascule orders)
title: DashboardOrders dual-read minimal pour persona owner tenant
status: livrée (attente test manuel Arnaud)
delivered_at: 2026-05-18
final_result: "DashboardOrders refactoré : dual-read scope tenant via ShopsContext + 2 queries Promise.all + helpers PortalOrders.helpers réutilisés + colonne Boutique + marker legacy. 328 tests vitest verts (0 régression)."
target_branch: beta/v5
agent: Dev (Claude Code)
size: S (~1j)
depends_on: S-DUAL-READ (helpers normalize réutilisables), S-MIGRATION-ORDERS (tenant_orders peuplé)
unblocks: démo owner tenant 23/05 (vision agrégée commandes)
follows_on: S3.1 OrderHistoryTable (Phase 3) qui étendra avec filtres + tri + pagination + persona acheteur shop_only
discovered_in: feedback Arnaud 2026-05-18 — DashboardOrders affiche "0 commande" alors que les commandes existent en DB
---

# Story S-DASHBOARD-ORDERS-DUAL — Vue owner toutes commandes du tenant

## Story (As / I want / So that)

**As an** owner tenant qui consulte son dashboard `/t/:slug/dashboard/orders`
**I want** voir TOUTES les commandes passées sur TOUTES les boutiques de mon tenant (cohort legacy `shop_orders` + nouvelles `tenant_orders` v1.1)
**So that** j'aie une vision agrégée business immédiate pour piloter ma production et mes ventes, peu importe la boutique d'origine ou le modèle de données (transitoire bascule v1.1).

## Contexte

Bug pré-existant signalé par Arnaud 2026-05-18 (post-livraison S-MIGRATION-ORDERS) : la page `/t/:slug/dashboard/orders` affiche systématiquement "0 commande(s) enregistrée(s)" alors que des commandes existent en prod (shop_orders + tenant_orders).

Cause racine : [`DashboardOrders.tsx`](src/app/components/dashboard/DashboardOrders.tsx) (79 lignes) query une **table `orders` inexistante** dans le schema actuel + filtre par `user_id` (colonne absente) → query échoue silencieusement → array vide → "0 commande". Placeholder hérité jamais câblé.

Cette story livre un **fix minimal** : dual-read shop_orders (legacy) + tenant_orders (v1.1) scopé par tenant, avec colonne Boutique en plus pour distinguer entre shops du tenant. Réutilise les helpers `PortalOrders.helpers.ts` livrés en S-DUAL-READ (Sprint 4 Phase 1).

**Hors scope** (reporté à S3.1 OrderHistoryTable, Phase 3) :
- Filtres avancés (statut, date, montant)
- Tri par colonne cliquable
- Pagination > 100 commandes
- Persona acheteur shop_only (S-DUAL-READ couvre ce cas côté `/shop/:slug`)
- Vue détail d'une commande (modale lignes/audit trail)

## Acceptance Criteria

**AC1** — `DashboardOrders.tsx` refactoré pour query 2 sources en parallèle (Promise.all) :
- Query A : `shop_orders` joint via `shops.tenant_id = currentTenant.id` (ou filtre `shop_id IN (shops du tenant)`)
- Query B : `tenant_orders` joint avec `tenant_order_items`, filtre `tenant_id = currentTenant.id`
- Limit 100 chacune (200 max)

**AC2** — Réutilise les helpers `PortalOrders.helpers.ts` :
- `normalizeShopOrder(row)` → OrderUI
- `normalizeTenantOrder(row, taxedTotal)` → OrderUI
- `mergeAndSortOrders(legacy, v11)` → tri DESC
- `STATUS_LABELS` → labels statuts unifiés

**AC3** — Interface UI étendue avec colonne **Boutique** :
- Pour shop_orders : afficher `shops.slug` (depuis ShopsContext ou fetch direct)
- Pour tenant_orders : idem (via shop_id → shop lookup)
- Si shop slug introuvable : afficher "—"

**AC4** — Tableau colonnes : Date / Boutique / Client / Articles / Total HT / Total TTC / Statut (avec marker legacy comme PortalOrders Sally H1-bis)

**AC5** — Loading state + empty state + error state cohérents avec PortalOrders patterns.

**AC6** — Pas de filter par user.id ou customer_email (le owner voit TOUT). RLS doit autoriser (cf. policies S1.4 : `tenant_orders_select` autorise `current_user_can_access_shop` ET `is_super_admin`. Pour shop_orders : `owner_user_id = auth.uid()` couvre l'owner).

**AC7** — Test manuel : depuis `/t/imprimerie-ipa/dashboard/orders` avec compte owner, vérifier que les commandes des shops du tenant apparaissent (legacy + v1.1 mixées avec marker).

**AC8** — Aucun nouveau test vitest requis (les helpers réutilisés sont déjà couverts par les 15 tests S-DUAL-READ).

## Décisions techniques

| Décision | Choix | Argument |
|---|---|---|
| Source shops du tenant | ShopsContext.shops si dispo, fallback fetch direct par tenant_id | Évite double fetch si Context déjà peuplé |
| Filtre Query A shop_orders | `shop_id IN (select id from shops where tenant_id = X)` ou `shop_id IN (shops_array)` | Simple, performant sur ≤ 10 shops par tenant typique |
| Persona acheteur shop_only | Hors scope (S-DUAL-READ couvre /shop/:slug) | Pas de duplication. Dashboard = owner perspective. |
| Affichage customer (col Client) | shop_orders.customer_name pour legacy, "Acheteur tenant" pour v1.1 (created_by uuid pas dénormalisé en nom) | Cohérent rendu, lookup auth.users hors scope MVP |
| Tri | Par défaut DESC date (helper mergeAndSortOrders) | Standard, S3.1 ajoutera tri cliquable |

## Risques & mitigations

| Risque | Mitigation |
|---|---|
| RLS shop_orders bloque le owner | RLS owner_user_id = auth.uid() couvre. Vérifier en prod. |
| Beaucoup de shops dans le tenant (>10) | Acceptable MVP. S3.1 ajoutera pagination. |
| Performance dégradée sur tenant avec 1000+ commandes | Limit 100 par cohort = 200 max. Suffisant pour démo. |
| Drift visuel avec PortalOrders | Réutilise helpers + STATUS_LABELS + marker legacy → cohérent visuellement. |

## Procédure d'exécution

### Étape 1 — Code DashboardOrders.tsx
Refacto complet (le code actuel est inutilisable). Réutilise helpers PortalOrders.helpers.ts.

### Étape 2 — Test manuel (Arnaud)
Sur `/t/imprimerie-ipa/dashboard/orders` connecté en owner.

### Étape 3 — Commit + push + TF Notion.

## TF Notion à créer

- **TF "DashboardOrders dual-read commandes tenant (owner perspective)"** :
  - Parcours : P02 — Gestion utilisateurs (proche : vue agrégée business owner)
  - Persona : Owner tenant
  - Type : Manuel humain + IA Chrome
  - URL départ : http://localhost:5177/t/imprimerie-ipa/dashboard/orders
  - Étapes : se connecter en owner → naviguer dashboard → onglet Commandes → vérifier que TOUTES les commandes des shops du tenant apparaissent (legacy + v1.1)
  - Résultat attendu : N commandes affichées triées chrono DESC, colonne Boutique distinguer les sources, marker gris sur legacy

## Notes

Story complémentaire à S-MIGRATION-ORDERS + S-DUAL-READ. Permet au persona owner de profiter immédiatement de la bascule (visualisation), sans attendre Phase 3 S3.1 (filtres avancés).
