---
id: AF29.5
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF29.4]
---
# AF29.5 — Composer les façades Libraries dans un root unique

## Résultat livré

- les façades Libraries et LibraryProducts sont créées dans
  `ModuleClientsProvider` avec le transport partagé ;
- `LibraryContext` reçoit les deux instances via des hooks dédiés ;
- le contexte ne construit plus directement de client de module ;
- un garde-fou confine les deux constructeurs au composition root.

Le CRUD des bibliothèques, les opérations bulk et la génération de produits
depuis le PIM conservent leurs contrats et comportements existants.
