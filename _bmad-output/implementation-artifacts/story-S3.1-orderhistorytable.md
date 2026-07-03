---
story_id: S3.1
epic: 3 — Module Commandes (Order entity user-facing)
title: OrderHistoryTable — extraction composant réutilisable + filtres (statut/période/montant) + tri colonne + badge statut couleur
status: in-progress (Sprint 5 Phase 1, 2026-05-23)
created_at: 2026-05-23
target_branch: beta/v5
agent: Claude Code (Dev hat)
size: M (1.5j)
prd_ref: _bmad-output/planning-artifacts/prd.md (FR19 historique commandes)
predecessors: [S-DUAL-READ (Sprint 4) — PortalOrders dual-read livré, STATUS_LABELS dans helpers ; S-DASHBOARD-ORDERS-DUAL (Sprint 4) — DashboardOrders scope tenant livré]
successors: [S3.3 Renouveler 1-clic — bouton sur ligne, S3.4 Annulation draft — bouton sur ligne, S-ORDER-ROLES-3 — tabs filtrés par rôle]
sprint_cible: Sprint 5 (roadmap qualité-first Orderbook & filet LLM)
---

# Story S3.1 — OrderHistoryTable + filtres + tri + badge couleur

## Contexte

Sprint 4 a livré PortalOrders (acheteur boutique `/shop/:slug`) et DashboardOrders (admin tenant) avec dual-read shop_orders (legacy) + tenant_orders (v1.1). Les 2 vues partagent la normalisation `OrderUI` et le mapping `STATUS_LABELS` via `PortalOrders.helpers.ts` mais **dupliquent la table HTML, le formatting et n'ont aucun filtre/tri configurable**.

Cette story extrait la table en composant réutilisable `OrderHistoryTable`, ajoute 3 filtres (statut multi, période preset/custom, montant min) + tri configurable par colonne, et centralise le mapping statuts dans `src/app/lib/orderStatus.ts` (anticipation S-ORDER-ROLES qui ajoutera des statuts d'approbation).

## User Story

**As an** acheteur B2B (sur ses commandes) OU admin tenant (sur toutes les commandes du tenant),
**I want** un tableau filtrable et triable de mon historique de commandes,
**So that** je retrouve rapidement une commande pour la consulter, la renouveler, ou en suivre le statut.

## Acceptance Criteria

### AC1 — Composant `OrderHistoryTable` réutilisable

**Given** la table HTML inline dans PortalOrders.tsx et DashboardOrders.tsx
**When** la story est livrée
**Then** un composant `src/app/components/shop/portal/OrderHistoryTable.tsx` existe et reçoit en props :
- `orders: OrderUI[]` (déjà fetchés)
- `loading: boolean` + `error: string | null` (état remonté par parent)
- `extraColumn?: { header: string; render: (o) => ReactNode }` (optionnel — DashboardOrders peut afficher la colonne "Boutique")
- `persistKey?: string` (clé localStorage pour filtres + tri, ex: `'orderHistory:shop:<shopId>'` ou `'orderHistory:dashboard:<tenantId>'`)

**And** PortalOrders.tsx + DashboardOrders.tsx consomment ce composant et leur table HTML inline disparaît (cohérence visuelle garantie).

### AC2 — Filtres (statut, période, montant min)

**Given** une OrderHistoryTable avec ≥ 5 commandes de statuts variés
**When** l'user interagit avec les filtres
**Then** :
- **Statut** : multi-select (checkbox dropdown ou chips) listant les statuts présents dans les orders (pas tous les statuts enum, juste ceux qui ont au moins 1 occurrence) → masque les non-cochés
- **Période** : preset (Tous / 7j / 30j / 90j / Cette année) + option custom date range (2 inputs date)
- **Montant HT min** : input numérique optionnel, masque les orders avec `total_ht < min`
- **Reset** : bouton qui remet les 3 filtres à leur état initial (statut=tous, période=Tous, montant=vide)
- **État vide filtré** : si 0 orders matchent les filtres → message "Aucune commande ne correspond aux filtres" + bouton Reset CTA

**And** l'état filtré est calculé client-side (pas de refetch DB).

### AC3 — Tri colonne cliquable

**Given** l'OrderHistoryTable avec ≥ 3 commandes
**When** l'user clique sur le header d'une colonne triable (Date, Total HT, Total TTC)
**Then** :
- 1er clic : tri ASC sur la colonne, indicateur `↑` visible
- 2e clic même colonne : tri DESC, indicateur `↓`
- 3e clic : retour à tri date desc par défaut, indicateur disparaît
- Click sur autre colonne triable : nouveau tri ASC sur cette colonne (l'ancien tri est remplacé)
- Les colonnes non-triables (Client, Articles, Statut) ne sont pas cliquables

**And** un attribut `aria-sort="ascending|descending|none"` est posé sur le `<th>` actif (a11y).

### AC4 — Centralisation `src/app/lib/orderStatus.ts`

**Given** le mapping `STATUS_LABELS` actuellement dans `PortalOrders.helpers.ts`
**When** la story est livrée
**Then** un nouveau lib `src/app/lib/orderStatus.ts` exporte :
- `type OrderStatus` (union des statuts canoniques tenant_orders + legacy shop_orders : `'draft' | 'validated' | 'in_production' | 'shipped' | 'delivered' | 'invoiced' | 'cancelled' | 'pending' | 'approved'`)
- `STATUS_LABELS: Record<OrderStatus, { label: string; className: string; group: 'workflow' | 'terminal' | 'legacy' }>` (extension du mapping actuel avec un champ `group`)
- `ORDER_STATUSES_ACTIVE: OrderStatus[]` (workflow : draft, validated, in_production, shipped)
- `ORDER_STATUSES_TERMINAL: OrderStatus[]` (delivered, invoiced, cancelled)
- `ORDER_STATUSES_LEGACY: OrderStatus[]` (pending, approved — shop_orders)
- `getStatusInfo(status: string): { label, className, group }` (fallback safe si statut inconnu)
- `labelToStatus(label: string): OrderStatus | null` (mapping inverse pour filtres UI)

**And** `PortalOrders.helpers.ts` réexporte ces symboles pour ne pas casser les call sites existants (compat transition).

**And** anticipation S-ORDER-ROLES : la structure permet d'ajouter facilement des statuts d'approbation (`pending_approval_n1`, `approved_n1`, `rejected_n1`, etc.) sans casser les groupes existants.

### AC5 — Badge statut couleur (extension visuelle si nécessaire)

**Given** le mapping actuel `STATUS_LABELS` qui définit déjà `className` par statut
**When** la story est livrée
**Then** le badge statut affiché dans la table utilise ces classes Tailwind cohérentes :
- `bg-warn-bg text-warn-fg border-warn-fg/20` pour draft/pending (jaune/orange)
- `bg-ok-bg text-ok-fg border-ok-line` pour validated/approved/delivered/invoiced (vert)
- `bg-info-bg text-info-fg border-info-fg/20` pour in_production/shipped (bleu)
- `bg-err-bg text-err-fg border-err-fg/20` pour cancelled (rouge)

**And** le badge inclut un `aria-label` lisible (ex: `aria-label="Statut: Brouillon"`).

### AC6 — Persistence filtres + tri localStorage

**Given** un user qui revient sur la même boutique
**When** il a précédemment appliqué un filtre / tri
**Then** ses préférences sont restaurées depuis localStorage avec la clé `persistKey` (sécurité : si `persistKey` non fourni, pas de persistance)

**And** la clé est scopée par contexte (`orderHistory:shop:<shopId>` ou `orderHistory:dashboard:<tenantId>`)

**And** si le format localStorage est invalide (corrompu) → fallback aux defaults sans crash.

### AC7 — Tests vitest

**Given** le composant OrderHistoryTable et lib orderStatus.ts
**When** la story est livrée
**Then** 2 fichiers de tests existent :
1. `src/app/lib/orderStatus.test.ts` : 8+ cas
   - getStatusInfo retourne le bon mapping pour chaque statut canonique
   - getStatusInfo fallback safe pour statut inconnu (label = raw, className neutre)
   - labelToStatus inverse correct + null si label inconnu
   - ORDER_STATUSES_ACTIVE / TERMINAL / LEGACY partitionnent bien tous les statuts (pas de chevauchement)
2. `src/app/components/shop/portal/OrderHistoryTable.test.tsx` : 6+ cas
   - Render basique avec 3 orders → 3 lignes affichées
   - Filtre statut multi-select → seules les orders du statut coché sont visibles
   - Filtre période 7j → orders > 7j masquées
   - Filtre montant min → orders < min masquées
   - Reset filtres → toutes orders réaffichées
   - Tri click Date asc → ordre asc, indicateur ↑, aria-sort='ascending'
   - Empty state filtré → message + bouton Reset

### AC8 — Audit a11y axe-core route `/shop/:slug/orders`

**Given** la nouvelle UI filtres + tri sur OrderHistoryTable
**When** la story est livrée
**Then** `pnpm a11y:scan` (ou équivalent) passe sans violation WCAG A + AA sur `/shop/:slug/orders` avec ≥ 5 orders affichées

**And** au minimum :
- `<th aria-sort>` sur colonnes triables
- `<button>` pour les filtres + le bouton Reset (pas de `<div onclick>`)
- `<label>` associé à chaque input filtre
- Contraste WCAG AA respecté sur badges statut (déjà OK depuis Sprint 4, à reconfirmer)

## Out of scope

- ❌ Pagination > 200 orders → V2+ si besoin (limit 100/cohort = 200 max actuellement, suffit pour MVP)
- ❌ Export CSV/PDF de l'historique → S4.x ou hors v1.1
- ❌ Recherche full-text par customer_name ou notes → V2+
- ❌ Filtre montant max → pas demandé, pragmatique
- ❌ Modale détail commande (audit trail) → S3.5
- ❌ Boutons Renouveler / Annuler sur ligne → S3.3 / S3.4
- ❌ Tabs filtrées par rôle (À valider / Mes commandes / À approuver) → S-ORDER-ROLES-3

## Tasks

- [ ] Task 1 — Créer `src/app/lib/orderStatus.ts` (export OrderStatus + STATUS_LABELS étendu + helpers)
- [ ] Task 2 — Tests vitest `orderStatus.test.ts` (8+ cas) → verts
- [ ] Task 3 — Refacto `PortalOrders.helpers.ts` pour réexporter depuis le lib (compat call sites)
- [ ] Task 4 — Créer `OrderHistoryTable.tsx` (composant pur, props filters/sort + extraColumn + persistKey)
- [ ] Task 5 — Tests vitest `OrderHistoryTable.test.tsx` (6+ cas filtre/tri/empty/reset) → verts
- [ ] Task 6 — Refactor `PortalOrders.tsx` pour consommer OrderHistoryTable
- [ ] Task 7 — Refactor `DashboardOrders.tsx` pour consommer OrderHistoryTable (avec extraColumn Boutique)
- [ ] Task 8 — Ajouter testIds dans `src/app/lib/testIds.ts` (orderFilterStatus, orderFilterPeriod, orderFilterAmountMin, orderFilterReset, orderSortHeader)
- [ ] Task 9 — Audit a11y `pnpm a11y:scan` sur `/shop/<slug>/orders` (0 violation)
- [ ] Task 10 — TF Notion (2 cas) créés EN PARALLÈLE du dev (lesson S-LLM-WRAPPER)
- [ ] Task 11 — Smoke local dev server : tester filtres + tri + persist + empty state
- [ ] Task 12 — Commit + push beta/v5

## DoD spécifique (10 principes Phase 0.1)

- [x] #5 Sally UX consult : court-circuit pragmatique → mockup ASCII validé par Arnaud (PO/UX final) en début de story, pas d'invocation Sally agent vu la simplicité
- [ ] #6 ADR si nouvelle décision archi : pas d'ADR nécessaire (extraction de composant + lib pur, pas de décision structurelle)
- [ ] #7 Story scindée < 3j : ✅ 1.5j
- [ ] #8 TF Notion en parallèle pas en fin : à faire en début (lesson S-LLM-WRAPPER)
- [ ] #9 Story doc au démarrage pas rétrofit : ✅ écrit avant code
- [ ] #10 Audit a11y route exposée acheteur : AC8

## References

- [Source: epics.md §Story S3.1] — spec d'origine (lignes 592+)
- [Source: roadmap-v1.1-qualite-first-2026-05-21.md Sprint 5] — Story S3.1 listée avec effort 1.5j et DoD spécifique
- [Source: src/app/components/shop/portal/PortalOrders.tsx] — table HTML actuelle à extraire (livré S-DUAL-READ)
- [Source: src/app/components/dashboard/DashboardOrders.tsx] — table HTML actuelle à extraire (livré S-DASHBOARD-ORDERS-DUAL)
- [Source: src/app/components/shop/portal/PortalOrders.helpers.ts:120] — STATUS_LABELS à centraliser dans lib
- [Source: project-context.md §5.2] — DoD étendue qualité-first applicable
- [Source: ARCHITECTURE.md §4.1] — Order entity v1.1 (tenant_orders schema canonique)
