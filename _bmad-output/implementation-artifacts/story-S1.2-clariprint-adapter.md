---
story_id: S1.2
epic: 1 — Stack Foundations
title: ClariprintAdapter pattern + erreurs typées
status: livrée
delivered_at: 2026-05-09
target_branch: beta/v5
agent: Dev (rétrofit document 2026-05-10)
size: M
commit: 632db88
---

# Story S1.2 — ClariprintAdapter pattern

## Story

**As a** dev Magrit
**I want** une abstraction `ClariprintAdapter` avec sanitization défensive intégrée et erreurs typées
**So that** les endpoints v1.1 (overlay, mockup, order) consomment Clariprint sans risque d'exposition de payloads invalides à l'utilisateur.

## Contexte

Étend le travail S0.2 (`validateClariprintResponse` + sanitization endpoint) en formalisant un pattern Adapter complet avec erreurs typées discriminées.

## AC validés

**AC1** ✅ Fichiers créés dans `src/server/clariprint/` : interface `ClariprintAdapter`, impl prod `ClariprintHttpAdapter`, impl tests `ClariprintMockAdapter`, errors `ClariprintError`
**AC2** ✅ Toute interaction avec Clariprint passe par cet adapter (convention)
**AC3** ✅ `ClariprintError` discriminée par `kind` ∈ {`negative_price`, `nan_price`, `undefined_field`, `missing_required_product`, `network`, `timeout`, `unauthenticated`, `unknown`}
**AC4** ✅ `ClariprintMockAdapter` utilisable dans tests vitest avec scénarios programmables (`setNextResponse()`)
**AC5** ✅ Singleton `httpAdapter` exporté pour consommateurs prod

## Décisions

| Décision | Justification |
|---|---|
| Délégation à `validateClariprintResponse` (S0.2) plutôt que dupliquer la logique | DRY, single source of truth |
| Mapping erreur backend → kind via heuristique sur le message | Pragmatique, l'API Clariprint ne fournit pas de codes d'erreur typés à ce stade |
| Pas de `cancelOrder()` ou autres méthodes au-delà de `computePrice()` | YAGNI, à étendre quand un consommateur en a besoin |

## Fichiers touchés

| Fichier | Modif |
|---|---|
| `src/server/clariprint/ClariprintAdapter.ts` (nouveau) | 179 lignes |

## Écarts

Aucun — conforme à Architecture §4.4 (ADR-4).

## Commit

- `632db88` : `feat(v5): ClariprintAdapter pattern avec erreurs typees (S1.2)`

## Statut

✅ Livrée et pushée. Adoption progressive à venir (Order entity Epic 3, mockup engine Epic 4 utiliseront l'adapter).
