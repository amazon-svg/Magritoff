---
id: UM10.32
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM10.31]
---
# UM10.32 — Isoler la liste des commandes storefront

## Résultat

- `useStorefrontOrderList` charge exclusivement le dataset `mine` du compte ;
- la façade gère chargement, erreur, rechargement et annulation propriétaire ;
- l'annulation conserve sa clé d'idempotence et sa traduction d'erreur ;
- `PortalOrders` ne connaît plus le client HTTP et se limite au rendu et aux
  dialogues de sélection ;
- aucune action de validation, production ou expédition Magrit n'est exposée.

## Validation

- garde-fous d'architecture du portail Orders adaptés à la nouvelle frontière ;
- suite Vitest complète, typecheck et build de production.
