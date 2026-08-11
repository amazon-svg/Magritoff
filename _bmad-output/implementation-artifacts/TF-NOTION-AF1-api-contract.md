# TF-AF1 — Contrats HTTP et composition serveur

## Préconditions

- Branche `refactor/api-first-foundation`.
- Dépendances installées avec le lockfile courant.

## Scénarios automatisés

| ID | Scénario | Résultat attendu | Statut |
|---|---|---|---|
| AF1-01 | Appeler `GET /api/v1/health` via `SystemApiClient` | Réponse typée `status=ok`, version `v1`, horodatage et request ID | OK |
| AF1-02 | Appeler une route inconnue | Problem Details 404 `api.not_found` | OK |
| AF1-03 | Utiliser une mauvaise méthode | Problem Details 405 `api.method_not_allowed` | OK |
| AF1-04 | Appeler une route protégée sans acteur | 401 sans exécution du cas d usage | OK |
| AF1-05 | Résoudre une route `{tenantId}` encodée | Paramètre décodé et acteur transmis | OK |
| AF1-06 | Envoyer un JSON invalide au regard du schéma | 422 `api.validation_failed` et erreurs par champ | OK |
| AF1-07 | Lever une exception interne | 500 corrélé, détail interne absent de la réponse | OK |
| AF1-08 | Recevoir une erreur via le client fetch | `ApiClientError` construit depuis le Problem Details | OK |
| AF1-09 | Fournir un access token au client | En-tête Bearer ajouté sans dépendance au SDK fournisseur | OK |
| AF1-10 | Appeler une route hors `/api/v1` | Refus local par le client | OK |
| AF1-11 | Inspecter le contrat OpenAPI | Version 3.1, health et `ApiProblem` présents | OK |

## Commandes de preuve

- `pnpm typecheck`
- `pnpm exec vitest run tests/platform/api tests/server/api`
- `pnpm test:architecture`
- `pnpm test`
- `pnpm build`

Cette fiche est prête à être recopiée dans Notion dès que le connecteur est disponible.
