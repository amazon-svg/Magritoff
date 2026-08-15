---
id: AF26.1
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF25.4]
---
# AF26.1 — Déclarer les sorties multi-surfaces du module Orders

## Résultat livré

Le module Orders déclare désormais ses fonctionnalités et capabilities sans
dépendance React :

- storefront : checkout, monté par l’hôte boutique ;
- customer portal : historique des commandes du client, monté par l’hôte ;
- workspace : gestion des commandes du tenant, route lazy du router ;
- backoffice : pilotage production et transitions, prêt pour un composition
  root backoffice dédié.

La route `/dashboard/orders` n’est plus déclarée manuellement dans
`routes.tsx`. Elle provient de `ordersWorkspaceContribution` et son composant
est résolu dans `workspaceRuntimeRoutes`, comme le module Account.

## Limite volontaire

Les vues storefront et portail restent orchestrées dans `PublicShop` : leur
contribution est déclarative avec `mount: host`. Le backoffice est déclaré mais
pas encore monté par une application distincte. Ces déclarations fixent le
contrat d’insertion avant la séparation physique des hôtes.
