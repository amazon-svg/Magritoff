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
status: pending
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
