---
id: AF1
epic: EPIC-8-API-FIRST
sprint: AF-A
priority: P0
effort: M
status: review
branch: refactor/api-first-foundation
depends_on: [AF0]
unblocks: [AF2]
---

# AF1 — Contrats HTTP et composition serveur

## User story

En tant qu équipe Magrit, nous voulons une façade HTTP `/api/v1` typée, indépendante du runtime et des fournisseurs, afin que les prochains modules exposent leurs cas d usage sans répliquer le transport, les erreurs ou l authentification.

## Critères d acceptation

1. **Given** un client du front, **when** il appelle une ressource Magrit, **then** il utilise un client fetch typé et une URL même origine sous `/api/v1`.
2. **Given** une erreur HTTP, **when** elle traverse la frontière, **then** elle respecte un contrat Problem Details stable avec `code`, `status` et `requestId`.
3. **Given** une route protégée, **when** aucun acteur n est résolu, **then** la façade retourne 401 sans exécuter le cas d usage.
4. **Given** une route avec paramètres, **when** elle correspond à un template OpenAPI `{param}`, **then** les paramètres décodés sont fournis au handler.
5. **Given** une exception inattendue, **when** elle remonte du handler, **then** le détail interne n est pas exposé et une réponse 500 corrélée est produite.
6. **Given** la composition de référence, **when** `GET /api/v1/health` est appelé, **then** le client et le handler partagent le même contrat et retournent la version API.
7. Aucun fichier `platform/api`, `server/api` ou contrat OpenAPI n importe Supabase, React ou un type de ligne PostgreSQL.
8. Le contrat est documenté dans un fichier OpenAPI versionné et testé en intégration sans serveur réseau.

## Tasks

- [x] Définir `ApiProblem`, les statuts, routes et contextes de requête.
- [x] Implémenter le client fetch typé et `ApiClientError`.
- [x] Implémenter le routeur Web standard `Request -> Response`.
- [x] Injecter résolution acteur, horloge et générateur de request ID.
- [x] Ajouter la composition de référence et `/api/v1/health`.
- [x] Ajouter OpenAPI et tests de contrat/intégration.
- [x] Étendre les tests d architecture au nouveau socle.
- [x] Préparer le TF AF1 localement, le connecteur Notion étant indisponible dans cette session.

## Dérogations R5

AF1 ne migre aucun caller brownfield. Le token provider optionnel du client prépare la coexistence temporaire avec Supabase Auth ; il ne dépend d aucun SDK fournisseur. La première réduction de baseline intervient en AF2.

## Plan de test

- `pnpm typecheck`
- `pnpm test:architecture`
- `pnpm vitest run tests/platform/api tests/server/api`
- `pnpm test`
- `pnpm build`

## Résultat de validation

- `pnpm typecheck` : vert.
- Tests ciblés API : 11/11 verts.
- Tests d architecture : 4/4 verts.
- Régression complète : 769 tests verts, 87 ignorés.
- Build Vite : vert, avec le warning historique de chunk principal supérieur à 600 kB.
- Dette Supabase UI : baseline inchangée, conformément à la dérogation AF1.
