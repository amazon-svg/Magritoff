---
id: UM10.5
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM6.2, UM6.3, UM6.4, UM10.4]
---
# UM10.5 — Séparer l’interface des commandes client

## Problème

Le portail d’un compte boutique réutilisait encore la présentation historique
des utilisateurs Magrit : files « À valider », « À approuver » et « À
produire », compteurs et commandes de transitions internes. Le serveur vidait
déjà ces jeux de données pour une session storefront, mais leur présence dans
le composant entretenait un profil fonctionnel mixte et augmentait le risque de
régression.

## Résultat

- le portail boutique présente une seule liste « Mes commandes » ;
- seules les commandes `mine` du contrat serveur sont rendues ;
- le client conserve les actions qui lui appartiennent : consulter, renouveler,
  modifier ou annuler un brouillon ;
- validation, rejet, mise en production et expédition ne sont plus câblés dans
  cette surface ;
- les tableaux de bord Magrit conservent séparément leurs workflows internes.

Le filtrage serveur simultané par boutique et compte client demeure la barrière
d’autorisation. Cette simplification de l’interface constitue une défense en
profondeur, pas un remplacement des contrôles du BFF et de la base.

## Validation

- garde-fou d’architecture sur l’unique jeu `mine` et l’absence de transitions
  internes ;
- tests des conversions et actions client conservées ;
- typecheck, suite Vitest et build de production.
