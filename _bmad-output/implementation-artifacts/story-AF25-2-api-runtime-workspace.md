---
id: AF25.2
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF25.1]
---
# AF25.2 — Injecter le runtime API dans workspace et backoffice

## Résultat livré

- migration des dashboards tenant, commandes, boutiques, PIM, gammes,
  utilisateurs, rôles et règles commerciales ;
- migration des hooks de rôles de commande et de capabilities ;
- migration du panneau de diagnostic ;
- suppression des lectures de session devenues inutiles dans ces composants ;
- les clients fonctionnels continuent d’appartenir à leurs modules, mais
  reçoivent tous le transport du composition root React.

## Exception bornée

`InviteUserModalV2` reconstruit encore un transport après
`refreshSession()`. Ce chemin garantit que la commande d’invitation part avec
le jeton fraîchement renouvelé sans attendre un nouveau rendu React. Il est
désormais l’unique construction directe autorisée dans workspace et fera
l’objet d’une évolution du runtime (`withAccessToken` ou rotation interne) dans
un lot dédié.

Un garde-fou d’architecture fige cette exception à un seul fichier.
