# Story S2.16 — Home : devis en cours + reprise (option C)

> **Epic 2 — extension boutique e-commerce standard.** FR-ECOM-06.
> **Statut :** livré (code, non commité — confirmation push requise). **Branche :** `beta/v5`. **Décision Arnaud 2026-07-07 : OPTION C.**
> **Tests :** 661 vitest verts (baseline 650 + 11 nouveaux : 4 `summarizeCartResume` + 7 `resolvePendingQuotes`). 0 régression. Build Vite vert.

## Contexte & décision d'architecture (option C)

`QuotesProvider` est monté dans `AppShell` ([src/app/AppShell.tsx](../../src/app/AppShell.tsx)), qui enveloppe **toutes** les routes, y compris `/shop/:slug` (`PublicShop`). Mais la boutique publique est **anonyme / hors-tenant** : `useTenant().currentTenant` y est `null`, donc `QuotesContext.reload()` renvoie systématiquement `[]`. Les devis n'y sont donc **pas exploitables**.

Conséquence (décision Arnaud, tranchée dans [epics.md L739-741](../planning-artifacts/epics.md)) : **scinder** la story S2.7 étendue en deux blocs, chacun là où sa donnée est disponible :

| Bloc | Emplacement | Source de donnée | Contexte dispo |
|---|---|---|---|
| **Panier en cours / reprise** | Home **boutique** (`PortalHome`) | `cart: CartLine[]` (état local `PublicShop`) | oui (portail) |
| **Devis en attente** | Page dédiée **sous-menu « Devis »** du tableau de bord (`DashboardQuotesPending`, route `dashboard/quotes/pending`) | `useQuotes().quotes` filtrés `en_cours` | oui (tenant) |

> **Placement retenu (décision Arnaud 2026-07-07, 2e itération)** : le bloc devis n'est PAS sur la home/Profil mais devient une **entrée de sous-menu sous « Devis »** dans la sidebar dashboard, à côté de « Gabarits de devis » (`sub: true` dans [DashboardLayout.tsx](../../src/app/components/dashboard/DashboardLayout.tsx)). Elle ouvre une page dédiée listant tous les devis « en cours » pour reprise.

## User story

**As an** acheteur B2B / deviseur Pro,
**I want** retrouver sur la home mes devis en attente (dashboard) et mon panier non finalisé (boutique),
**So that** je reprenne mes affaires en cours en un clic.

## Acceptance Criteria

**AC1 — Devis en attente (page dédiée sous-menu Devis)**
Given l'utilisateur a des devis au statut « en cours » (`statusGroup === 'en_cours'` : draft/sent/pending)
When il ouvre le sous-menu « Devis en attente » (`dashboard/quotes/pending`)
Then la page liste les devis avec **nom client**, **référence**, **état**, **date**, **montant** (TTC), et un bouton **« Reprendre »** qui ouvre l'éditeur (`/dashboard/quotes/:id/edit`).

**AC2 — Panier en cours (boutique home)**
Given le panier de la boutique (`cart`) contient au moins un article
When la home boutique (`PortalHome`) rend
Then une section « Votre panier en cours » affiche le **nombre d'articles** + **total** et un bouton **« Reprendre mon panier »** qui bascule sur la vue panier (`onView('cart')`).

**AC3 — Repli data-driven**
Given aucun devis « en cours » (resp. panier vide)
When la page/home rend
Then côté **boutique** la section panier **ne s'affiche pas** (pas de bloc vide béant, symétrie avec Nouveautés S2.15) ; côté **page devis en attente** un **état vide explicite** est affiché (« Aucun devis en attente. » + lien vers la bibliothèque).

## Périmètre — réutilisation stricte (NE PAS refaire)

- `QuotesContext` (scope mine/all, statuts) — [src/app/contexts/QuotesContext.tsx](../../src/app/contexts/QuotesContext.tsx).
- `quoteStatus.statusGroup` / `statusGroupDef` — mapping des 3 groupes (S-QUOTES-3).
- `DashboardQuoteEditor` (route `dashboard/quotes/:id/edit`) — cible du bouton Reprendre.
- `useTenantPath()` (`tp`) pour préfixer le slug tenant.
- Bloc `PortalHome` existant (hero + raccourcis + Nouveautés S2.15 + Commandes récentes) — on **insère** un bloc, on ne réécrit pas.

## Conception technique

### Helpers purs (testables, TDD)

1. `summarizeCartResume(cart)` → `{ lineCount, itemCount, totalHT } | null` — dans [shopHomeSections.ts](../../src/app/utils/shopHomeSections.ts) (déjà le foyer des sections home boutique, S2.15). Renvoie `null` si panier vide (repli AC3). Tax-agnostique : la TTC est appliquée côté composant via `applyTax`.
2. `resolvePendingQuotes(quotes, limit)` → `QuoteRecord[]` — nouveau fichier [dashboardHomeSections.ts](../../src/app/utils/dashboardHomeSections.ts). Filtre `statusGroup(q.status) === 'en_cours'`, trie `created_at` desc (défensif), plafonne à `limit`. Générique structurel (pas d'import de `QuotesContext` → pas de dépendance lourde/circulaire).

### testIds (déclarés dans [testIds.ts](../../src/app/lib/testIds.ts), pas d'invention)

- `shop.homeCartResume` = `shop-home-cart-resume`
- `shop.homeCartResumeBtn` = `shop-home-cart-resume-btn`
- `dashboard.pendingQuotes` = `dashboard-pending-quotes`
- `dashboard.pendingQuoteRow` = `dashboard-pending-quote-row`
- `dashboard.pendingQuoteResumeBtn` = `dashboard-pending-quote-resume-btn`

### Fichiers touchés

| Fichier | Nature |
|---|---|
| `src/app/utils/shopHomeSections.ts` | + `summarizeCartResume` |
| `src/app/utils/dashboardHomeSections.ts` | **nouveau** — `resolvePendingQuotes` |
| `src/app/lib/testIds.ts` | + 5 testids |
| `src/app/components/shop/portal/PortalHome.tsx` | + prop `cart` + bloc « Votre panier en cours » |
| `src/app/components/shop/PublicShop.tsx` | passe `cart={cart}` à `PortalHome` |
| `src/app/components/dashboard/DashboardQuotesPending.tsx` | **nouveau** — page « Devis en attente » (sous-menu Devis) |
| `src/app/routes.tsx` | + route lazy `quotes/pending` |
| `src/app/components/dashboard/DashboardLayout.tsx` | + entrée sidebar « Devis en attente » (`sub`, icône `FileClock`) |
| `tests/utils/shopHomeSections.test.ts` | + cas `summarizeCartResume` |
| `tests/utils/dashboardHomeSections.test.ts` | **nouveau** |

> `DashboardProfile` a été touché puis **rétabli à l'identique** (le bloc devis a migré vers la page dédiée). Diff net = 0 sur ce fichier.

## DoD

- [x] Story doc (ce fichier) — créé au démarrage.
- [x] Helpers purs + tests vitest (661 verts, 0 régression sur 650).
- [x] testids déclarés (5), aucun inventé hors `testIds.ts`.
- [x] Microcopy FR sans anglicisme (« Votre panier en cours », « Reprendre mon panier », « Vos devis en attente », « Reprendre », « Tout voir »).
- [x] Build Vite vert (1.91s).
- [x] TF Notion (4 cas P08 dashboard + P09 boutique) — `TF-NOTION-S2.16.md`.
- [x] Sécurité : aucune requête ni RLS nouvelle (lecture composant only via contextes existants), pas de fuite cross-tenant (`QuotesContext` déjà cloisonné mine/all ; boutique anonyme → quotes vides).
- [ ] **Sally UX consult (DoD #5)** : NON invoquée — blocs de reprise réutilisent tokens + patterns existants (S2.15 Nouveautés / DashboardQuotes). À valider par Arnaud.
- [ ] Commit `feat(v5):` sans apostrophe — **en attente confirmation Arnaud avant push**.

## Notes

- **Placement du bloc devis** : tranché → **sous-menu « Devis en attente »** sous « Devis » (à côté de « Gabarits de devis »). La 1re itération (bloc sur la home/Profil) a été abandonnée à la demande d'Arnaud.
- Montant affiché côté devis = **TTC** (`total_ttc`), cohérent avec la bibliothèque de devis (`DashboardQuotes`).
- La page respecte le `scope` courant de `QuotesContext` (mine/all) : elle liste les devis en cours tels qu'exposés par le contexte, sans toggle propre.
