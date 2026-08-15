---
id: AF29.3
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF29.2]
---
# AF29.3 — Composer les façades Quotes dans un root unique

## Résultat livré

- les façades Quotes et QuoteTemplates sont créées une seule fois dans
  `ModuleClientsProvider` avec le transport authentifié partagé ;
- le panier, la modale d'impression et les contextes devis consomment ces
  instances injectées ;
- les composants React ne connaissent plus les constructeurs de ces modules ;
- un garde-fou d'architecture confine leurs constructions au composition root.

Les parcours de création, impression, édition et gestion des modèles conservent
leurs contrats métier et HTTP existants. Cette étape ne modifie que la
composition des dépendances.
