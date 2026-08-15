---
id: AF29.9
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF29.8]
---
# AF29.9 — Verrouiller la composition des clients API React

## Résultat livré

- un garde-fou parcourt tout `src/app` et détecte les constructions de classes
  dont le nom se termine par `ApiClient` ;
- seuls `ApiRuntimeContext` pour le transport et `ModuleClientsContext` pour
  les façades métier peuvent contenir ces constructions ;
- toute réintroduction dans un composant, hook ou contexte métier fait échouer
  immédiatement `pnpm test:architecture`.

Les tests spécialisés par domaine restent présents pour documenter les
intentions locales. Ce verrou transversal protège aussi les futurs clients qui
ne seraient pas encore connus de la liste actuelle.
