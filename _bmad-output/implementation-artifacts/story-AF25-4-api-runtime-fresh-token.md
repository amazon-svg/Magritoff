---
id: AF25.4
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF25.3]
---
# AF25.4 — Confinement des transports à jeton fraîchement obtenu

## Résultat livré

`ApiRuntimeContext` expose désormais deux usages :

- `client`, transport partagé suivant la session React courante ;
- `forAccessToken(token)`, transport ponctuel pour une commande exécutée
  immédiatement après connexion, inscription ou renouvellement.

Le checkout et l’envoi d’invitation utilisent cette fabrique. Ils ne
connaissent plus `FetchApiClient`, `globalThis.fetch` ni la stratégie de
construction HTTP.

## Invariant atteint

`ApiRuntimeContext.tsx` est l’unique fichier de `src/app` autorisé à construire
un `FetchApiClient`. Le test d’architecture parcourt toute l’UI et échoue dès
qu’une seconde composition du transport apparaît.
