---
id: UM5.3
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM2.7, UM5.2]
---
# UM5.3 — Autoriser le catalogue privé avec la session boutique

- résolution du cookie storefront HttpOnly exclusivement côté BFF ;
- conversion de la session en contexte d'accès typé, sans transmettre le jeton
  opaque au module Shops ;
- autorisation d'un catalogue `invite_only` uniquement lorsque le `shop_id` de
  la session correspond exactement à la boutique demandée ;
- maintien de l'accès historique des utilisateurs Magrit autorisés ;
- refus d'une session cliente provenant d'une autre boutique ;
- attente de la résolution de session dans le storefront avant de décider
  l'accès et de charger le catalogue ;
- tests serveur, UI et garde-fou d'architecture couvrant la frontière.

Cette story rend effectivement utilisable le catalogue privé après connexion
directe ou délégation, tout en conservant l'invariant « une session boutique =
une seule boutique ». Elle ne migre pas encore le panier ni la commande vers le
compte boutique ; ces références métier restent dans UM6.
