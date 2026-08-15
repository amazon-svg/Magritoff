---
id: AF25.3
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF25.2]
---
# AF25.3 — Injecter le runtime API dans storefront et portail client

## Résultat livré

- `PublicShop`, catalogue, commandes, éditeur, confirmation et historique de
  commande utilisent le transport commun ;
- panier et modale de devis utilisent le même runtime ;
- acceptation d’invitation et redirections tenant/boutique sont migrées ;
- le helper d’audit reçoit désormais un `OrdersApiClient` au lieu de connaître
  le transport HTTP et le jeton ;
- les composants qui n’avaient besoin d’Auth que pour construire un client ne
  dépendent plus du contexte Auth.

## Exceptions restantes

Deux parcours construisent encore un transport avec un jeton explicitement
retourné par une opération Auth dans la même promesse :

1. inscription/connexion au checkout puis rattachement à la boutique ;
2. renouvellement de session puis envoi d’une invitation.

Avec le composition root, ces deux fichiers et `ApiRuntimeContext` sont les
trois seules occurrences de `new FetchApiClient` autorisées dans `src/app`.
La CI vérifie cette liste fermée.
