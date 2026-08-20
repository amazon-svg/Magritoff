---
id: UM10.37
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM10.36]
---
# UM10.37 — Isoler les parcours de mot de passe storefront

## Résultat

- `useStorefrontCredentialSetup` pilote l'activation d'une invitation et la
  récupération du mot de passe boutique ;
- le jeton éphémère et la nature du parcours sont fournis explicitement au hook ;
- validation, attente, succès et erreurs neutralisées sont centralisés ;
- les pages d'activation et de récupération ne connaissent plus le client identité ;
- aucun compte, bearer ou mécanisme d'authentification Magrit n'est réutilisé.

## Validation

- garde-fous d'architecture adaptés à la nouvelle frontière ;
- suite Vitest complète, typecheck et build de production.
