---
id: AF29.4
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF29.3]
---
# AF29.4 — Composer la façade Catalog dans un root unique

## Résultat livré

- `ModuleClientsProvider` crée l'unique façade Catalog de l'application ;
- le contexte PIM, l'administration PIM et la gestion des gammes actives
  consomment cette instance injectée ;
- ces écrans ne construisent plus leur propre façade à partir du transport ;
- un garde-fou d'architecture confine la construction au composition root.

Les chargements, ingestions PIM et abonnements de gammes conservent leurs
contrats existants. Le lot ne touche pas à la gestion fonctionnelle des
utilisateurs, rôles, membres ou invitations.
