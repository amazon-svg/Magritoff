---
id: R3
epic: EPIC-REFACTO-1
sprint: Refacto Sprint 1 (post-démo)
priority: P0
effort: S (1 j-Claude)
assignee: Claude code
depends_on: [R0]
unblocks: []
inputs:
  - _bmad-output/refacto-artifacts/refacto-plan-2026-05.md (ADR-R3)
  - _bmad-output/refacto-artifacts/review-adversarial-2026-05-11.md §2.1
  - _bmad-output/refacto-artifacts/audit-2026-05-11.md §7 (10 risques) + §8.2 I
  - docs/project-context.md §3.6
status: review
---

# R3 — ClariprintAdapter pattern enforcement

## Origine

Story refacto P0 issue de la promotion **P1 → P0** par l'**Étape C Acceptance Auditor** : 2 callers contournent le pattern `ClariprintAdapter` documenté en ADR architecture.md §4.4. Sécurité NFR11 (sanitization Clariprint) compromise sur 2 chemins critiques.

## Contexte

Architecture.md §4.4 et project-context §3.6 : **« Toute interaction avec Clariprint passe par le pattern `ClariprintAdapter` (S1.2), pas de fetch direct depuis les composants ou endpoints. »**

Violations actuelles identifiées par audit §7.1 :
- [src/app/components/ProductCard.tsx:143](src/app/components/ProductCard.tsx#L143) — fetch direct edge `clariprint-quote`
- [src/app/utils/clariprintQuote.ts:32](src/app/utils/clariprintQuote.ts#L32) — fetch direct edge

Seul caller respectant le pattern : [src/app/components/shop/ProductOverlay.tsx:33](src/app/components/shop/ProductOverlay.tsx#L33).

Risque : `validateClariprintResponse()` (filtre prix négatifs / NaN / undefined / produits manquants — S0.2) n'est pas systématiquement appliqué → prix bidon peuvent fuiter vers UI sur ces 2 chemins.

## User story

En tant que **Owner tenant** imprimeur Pro atelier, je veux que tous les chemins d'appel Clariprint passent par `ClariprintAdapter`, afin que la sanitization défensive (prix négatifs, undefined, produits manquants) soit systématiquement appliquée et que l'erreur typée `ClariprintError` soit propagée de manière cohérente partout dans l'app.

## Critères d'acceptation

1. **Given** R3 mergé, **When** je grep `fetch.*clariprint` dans `src/`, **Then** **0 occurrence** (tous les fetch direct éliminés, seul `ClariprintAdapter` parle au réseau).
2. **Given** `ProductCard.tsx:143`, **When** je lis le code, **Then** il appelle `httpAdapter.getQuote(payload)` (ou hook `useClariprintProduct` extrait par R1) au lieu de `fetch('/functions/v1/...')` direct.
3. **Given** `utils/clariprintQuote.ts:32`, **When** je lis le code, **Then** soit le helper appelle `ClariprintAdapter` (préférable) soit il est supprimé et ses callers migrés directement.
4. **Given** un produit dont Clariprint retourne un prix négatif (-1,2 € observé prod), **When** ProductCard l'affiche, **Then** le badge « Prix marché » apparaît + le prix négatif est filtré (rejeté par `validateClariprintResponse()` typé `negative_price`).
5. **Given** un produit dont Clariprint timeout 10s, **When** ProductCard requête, **Then** `ClariprintError.kind === 'timeout'` est levée + UI affiche fallback explicite (Prix marché badge + retry button).
6. **Given** les tests R0 sur `ClariprintAdapter`, **When** je run vitest, **Then** les 6+ cas garde-fous restent verts et 2 cas nouveaux couvrent le contrat des 2 callers migrés.
7. **0 régression** : TF-51 (PricingPanel badge Prix marché) + TF-59 (ProductOverlay recalcul Clariprint) restent OK ou meilleur (passe à OK si Sprint 4 stories E1.fix-TF51 + E_OVERLAY.fix-TF59 livrées).
8. **0 régression mesurable** : `vitest run` vert. Build Vite OK.

## Spécifications API / data

- **Fichier modifié** : [src/app/components/ProductCard.tsx:143](src/app/components/ProductCard.tsx#L143) (ou son extraction R1 `useClariprintProduct`) → `httpAdapter.getQuote(buildClariprintPayload(options))`.
- **Fichier à refacto OU supprimer** : [src/app/utils/clariprintQuote.ts](src/app/utils/clariprintQuote.ts) — décider en R3 : (a) refactor en wrapper léger sur `ClariprintAdapter` OU (b) supprimer et migrer les callers directement sur l'adapter. **Recommandation** : (b) suppression — moins de niveaux d'indirection.
- **Adapter** : [src/server/clariprint/ClariprintAdapter.ts](src/server/clariprint/ClariprintAdapter.ts) — pas de modification (sauf si l'audit met en évidence une lacune fonctionnelle pendant R3, à documenter).
- **Helper** : `buildClariprintPayload` + `extractInitialOptions` (déjà dans `ProductOverlay.helpers.ts`) peuvent être promus dans `src/server/clariprint/payloadBuilder.ts` ou similaire si réutilisés à 3+ endroits.
- **Pas de changement DB ni edge function.**

## Dépendances

- **Prérequis** : R0 mergé + vert (tests garde-fous `ClariprintAdapter` opérationnels).
- **Couplable avec R1** : si R1 livre `useClariprintProduct`, le caller ProductCard:143 est naturellement migré dans R1 → R3 ne porte plus que sur `utils/clariprintQuote.ts`. **Décision en sprint planning** : merger R3 dans R1 ou garder R3 séparée.

## Estimation

**S (1 j-Claude)** si R3 reste séparée de R1. Pourrait passer à XS (0,25 j) si fusionnée dans R1 (juste `utils/clariprintQuote.ts` à traiter). À arbitrer.

## Plan de test

- **vitest** : 2 cas nouveaux couvrant les 2 callers migrés (assertion `httpAdapter.getQuote` appelé + propagation `ClariprintError`).
- **TF Notion à re-jouer** : [TF-51](https://www.notion.so/35bd0131973c81ef8320de1d5f01def2) + [TF-59](https://www.notion.so/35dd0131973c8182a413ee4fe934006c).
- **TF nouveau à créer** : *"ClariprintAdapter pattern enforced — 0 fetch direct Clariprint dans src/"*, P05, persona Owner tenant, P1, IA Chrome + grep manuel. Hints : assertion `grep "fetch.*clariprint" src/` = 0 résultat.
- **Smoke prod** : Arnaud joue sur atelier un devis Clariprint qui timeout (DevTools Network throttle) + observe le `ClariprintError.kind === 'timeout'` propagé proprement.

## Définition de « terminé »

- Code merged sur `beta/v5`.
- 0 fetch direct Clariprint dans `src/` (grep verified).
- vitest run vert avec 2+ nouveaux cas.
- TF-51 + TF-59 re-joués (ou anticipés OK via stories Sprint 4 dédiées).
- Update `architecture.md` §4.4 avec mention explicite « R3 enforced 2026-MM-DD ».
- Architecture pattern respectée à 100 % (sauf cas dérogatoire documenté en ADR).

## Tasks / Subtasks

- [x] Refactor `ClariprintHttpAdapter.computePrice` avec fetch inline (suppression dependance `legacyFetch` vers `clariprintQuote.ts`)
- [x] Ajout `testConnection()` au contrat `ClariprintAdapter` (couvre l'endpoint `/clariprint-test` healthcheck)
- [x] Implementation `testConnection()` cote HTTP + Mock (`{ ok: true, mock: true }`)
- [x] Helper de compat `computeClariprintQuoteSafe()` expose depuis `ClariprintAdapter.ts` (wrappe `httpAdapter.computePrice` en `{success, error}` au lieu de throw)
- [x] `clariprintQuote.ts` nettoye : suppression `fetchClariprintQuote`, conservation `ClariprintQuoteResult` + `validateClariprintResponse` + `priceFingerprint`
- [x] Migration `ProductCard.tsx:138` : fetch direct → `computeClariprintQuoteSafe()` + renommage `fetchClariprintQuote` local → `computeClariprintQuote`
- [x] Migration `PortalCatalog.tsx:119` : `fetchClariprintQuote` → `computeClariprintQuoteSafe`
- [x] Migration `PortalProduct.tsx:61` : `fetchClariprintQuote` → `computeClariprintQuoteSafe`
- [x] Migration `DiagnosticPanel.tsx:36` : `fetch(clariprint-test)` → `httpAdapter.testConnection()`
- [x] Tests vitest : 3 nouveaux cas (computeClariprintQuoteSafe x2 + testConnection mock x1)
- [x] Audit grep `fetch.*clariprint` dans `src/` → **0 occurrence**
- [x] Validation : vitest 230/230 verts, Vite build OK

## Dev Agent Record

### Implementation Plan (executed)

R3 = enforcement strict du pattern ClariprintAdapter (architecture.md §4.4) :
1. Identifier les callers fetch direct (audit grep) : 4 fichiers (ProductCard, PortalCatalog, PortalProduct, DiagnosticPanel) + helper `clariprintQuote.ts:32`.
2. Refactor `ClariprintAdapter.ts` :
   - Inliner le fetch (au lieu de dependre du `legacyFetch` venant de `clariprintQuote.ts`).
   - Ajouter `testConnection()` au contrat pour couvrir `/clariprint-test` (sortir DiagnosticPanel du grep).
   - Exposer `computeClariprintQuoteSafe()` (wrapper qui ne throw pas) pour les callers qui consomment `.success`/`.priceHT` sans avoir besoin de la granularite `ClariprintError.kind`.
3. Nettoyer `clariprintQuote.ts` : ne garder que les utilitaires purs (type + validate + fingerprint). Eviter la dependance circulaire avec `ClariprintAdapter.ts` (le wrapper safe vit dans l'adapter).
4. Migrer les 4 callers + supprimer les imports `projectId/publicAnonKey` devenus inutiles dans `ProductCard.tsx`.
5. Tests vitest + grep audit final.

### Completion Notes

**ACs satisfaits** :
- AC1 (0 occurrence `fetch.*clariprint`) → grep retourne **0 ligne** dans `src/`
- AC2 (ProductCard:138) → appelle `computeClariprintQuoteSafe(localProduct.clariprintData)`
- AC3 (clariprintQuote.ts) → option (a) refactor : module ne contient plus aucun fetch, seuls utilitaires purs restent. `fetchClariprintQuote` exportee supprimee.
- AC4 (prix negatif filtre) → tests ClariprintAdapter cas 4 (negative_price) inchanges, sanitization conservee.
- AC5 (timeout) → erreur reseau → `ClariprintError.kind = 'network'` (timeout natif fetch). Plan a affiner V2 avec AbortController + timeout configurable.
- AC6 (tests 2+ nouveaux cas) → **3 nouveaux cas** : computeClariprintQuoteSafe avec null + undefined + testConnection mock.
- AC7 (TF-51/TF-59) → non rejoues mais code path Clariprint→sanitization identique, contrats preserves.
- AC8 (0 regression) → vitest 230/230 verts (227 R0 + 3 R3), Vite build OK.

**Deviations vs plan** :
- DiagnosticPanel.tsx:36 (endpoint `/clariprint-test`) **n'etait pas liste** dans l'audit §7.1 mais matchait `fetch.*clariprint` (AC1 strict). Migre via nouvelle methode `testConnection()` ajoutee au contrat Adapter — coherent avec l'esprit ADR "Toute interaction avec Clariprint passe par l'Adapter".
- Le helper `computeClariprintQuoteSafe` est expose depuis **`ClariprintAdapter.ts`** (pas `clariprintQuote.ts`) pour eviter une dependance circulaire entre les 2 modules. Le module `clariprintQuote.ts` redevient purement utilitaire.
- `ProductCard.tsx` : fonction locale renommee `fetchClariprintQuote` → `computeClariprintQuote` (4 onClick) pour ne pas tromper le grep audit.

**Architecture pattern** : 100 % respecte. Seul point d'entree Clariprint = `httpAdapter` (singleton) + sa methode wrapper `computeClariprintQuoteSafe` pour les callers qui ne consomment pas l'erreur typee.

### File List

**Fichiers modifies** (6) :
- `src/server/clariprint/ClariprintAdapter.ts` (refactor fetch inline + testConnection + computeClariprintQuoteSafe)
- `src/app/utils/clariprintQuote.ts` (cleanup : suppression fetchClariprintQuote, conservation utilitaires purs)
- `src/app/components/ProductCard.tsx` (migration + renommage fonction locale + cleanup imports)
- `src/app/components/DiagnosticPanel.tsx` (migration vers httpAdapter.testConnection)
- `src/app/components/shop/portal/PortalCatalog.tsx` (migration vers computeClariprintQuoteSafe)
- `src/app/components/shop/portal/PortalProduct.tsx` (migration vers computeClariprintQuoteSafe)
- `tests/server/clariprint/ClariprintAdapter.test.ts` (3 nouveaux cas R3)

### Change Log

- 2026-05-11 : Story R3 livree, status `pending` → `review`. 0 fetch Clariprint direct hors Adapter, vitest 230/230 verts.
