---
id: AF32.1
epic: EPIC-8-API-FIRST
priority: P2
status: done
branch: feat/storefront-identity-um2
depends_on: [AF31.6]
---

# AF32.1 — Attribuer les surfaces au module comptes boutique

## Intention

Le module `shop-customers` déclarait quatre sorties dans son manifeste mais ne
contribuait à aucune surface. Les chemins d'activation et de récupération de mot
de passe restaient donc codés directement par le host storefront.

## Résultat

- activation et réinitialisation sont des routes storefront actives du module ;
- le host résout leurs chemins depuis le registre de contributions ;
- portail et workspace sont explicitement reconnus comme montages intégrés ;
- la future administration des comptes boutique est déclarée au backoffice avec
  `availability: planned` et n'est pas exposée dans le runtime actuel ;
- les contributions restent indépendantes de React et du fournisseur.

## Validation

- tests du registre, des chemins runtime et des frontières architecturales ;
- 177 fichiers et 1 257 tests passés ;
- typecheck modulaire et build de production passés.
