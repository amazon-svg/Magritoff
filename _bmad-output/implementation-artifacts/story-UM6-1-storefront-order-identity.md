---
id: UM6.1
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM5.3]
---
# UM6.1 — Rattacher la création de commande au compte boutique

- route de création Orders ouverte à une session storefront HttpOnly valide ;
- validation du cookie côté BFF puis nouvelle validation atomique dans
  PostgreSQL avant toute écriture ;
- correspondance stricte entre la boutique de la session et celle du checkout ;
- ajout de `shop_customer_account_id` sur la commande ;
- conservation séparée de `acted_by_magrit_user_id` pour une délégation ;
- commandes directes sans faux utilisateur Magrit dans `created_by` ;
- reçus d'idempotence storefront isolés par compte boutique ;
- maintien du parcours historique Magrit et de sa primitive SQL existante ;
- tests de route, d'architecture et scénario SQL transactionnel.

Cette story migre uniquement la création initiale. La lecture du portail,
l'édition du brouillon, les transitions et les audits doivent encore être
alignés sur `shop_customer_account_id` dans les stories UM6 suivantes.
