---
paths:
  - "openapi/**"
  - "src/modules/**/api/**"
  - "src/server/api/**"
  - "docs/api/**"
---

# Conventions API — Sprint 5 Gestion commerciale

Référence complète : `docs/api/CONVENTIONS.md` (créé par l'agent `architecte` en Lot 0) et `E10.0` sur Notion. Rappel des points bloquants :

- `openapi/magrit-core.v1.yaml` fait foi. Aucun endpoint n'est codé sans y être décrit d'abord. L'ancien `docs/architecture/api/openapi.yaml` est déprécié — ne pas y ajouter de nouveaux endpoints E10.
- Préfixe `/api/v1/`, ressources au pluriel en kebab-case.
- Le tenant est résolu depuis le jeton (Bearer JWT ou clé de service à scope), jamais depuis un paramètre de chemin ou de requête.
- Réponse succès : `{ "data": ..., "meta": {...} }`. Erreur : RFC 7807 `application/problem+json` avec un `code` métier stable (`domaine.raison`, ex. `project.customer_required`).
- Pagination par curseur : `?page[size]`, `?page[cursor]`, curseur suivant dans `meta.next_cursor`.
- Tout POST créant une ressource métier honore `Idempotency-Key`. Tout PATCH est protégé par `ETag`/`If-Match` (conflit → 409 + état courant).
- Montants en chaîne décimale (`"1234.50"`), taux en chaîne (`"0.5000"`), jamais de flottant JSON sur un prix.
- **Jamais de `row.created_at`/`row.updated_at` brut dans un DTO.** PostgREST sérialise un `timestamptz` avec un décalage explicite (`+00:00`), jamais le suffixe `Z` que `timestampSchema` exige — un bug de ce type a mis toute création/lecture E10 en 500 en production (2026-09-02), invisible en test car les fakes produisent déjà du `Z`. Toujours passer par `toIsoTimestamp()`/`toIsoTimestampOrNull()` (`src/modules/_shared/application/index.ts`) dans chaque adaptateur.
- Événements sortants via `outbox_events`, payload versionné, signature HMAC (`X-Magrit-Signature: sha256=...`).
- v1 additive seulement. Changement cassant → `/api/v2`, jamais de mutation rétroactive de v1.
- **Convention de dossiers par module** (décision Sprint 5, amende la lettre de E10.0 CA11) : suivre le pattern déjà en place dans le dépôt — `src/modules/<domaine>/api/` (contrats Zod) + `application/` (interfaces + service), implémentation dans `src/adapters/supabase/<domaine>-repository.ts`, routes dans `src/server/api/<domaine>-routes.ts`. Ne pas créer de sous-dossiers `routes/service/repository/dto/events/__tests__` littéraux — ce n'est pas la convention réelle du dépôt et casserait la cohérence avec les 10 modules existants.
- Chaque endpoint a un test de contrat qui valide requête et réponse contre l'OpenAPI. CI bloquante.
- Aucun composant React n'appelle Supabase directement — c'est vérifié par `tests/architecture/api-first-boundaries.test.ts` et `modular-ui-boundaries.test.ts`, qui gardent aussi les nouveaux modules E10.
