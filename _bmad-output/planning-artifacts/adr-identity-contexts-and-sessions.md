---
id: ADR-IDENTITY-01
title: Contextes d’identité Magrit et boutique
date: 2026-08-16
status: accepted
epic: EPIC-UM-STORE-IDENTITY
---
# ADR — Séparer les contextes d’identité et de session

## Décision

Le système distingue trois contextes sans conversion implicite :

1. `workspace_user` : utilisateur Magrit autorisé sur workspace/backoffice ;
2. `shop_customer` : compte client authentifié, lié à une boutique unique ;
3. `delegated_shop_customer` : compte client joué avec conservation obligatoire
   de l’utilisateur Magrit réel et de l’identifiant de délégation.

Le module `members` reste propriétaire des utilisateurs Magrit. Le nouveau
module `shop-customers` devient propriétaire des comptes boutique et de leurs
sessions. Aucun rôle ou membre tenant ne représente un client boutique cible.

## Identité et unicité

La clé fonctionnelle d’un compte boutique est
`(shop_id, normalized_email)`. Une même adresse dans deux boutiques désigne
deux comptes, sessions et historiques indépendants.

## Frontière de sécurité

Le navigateur ne reçoit jamais le mot de passe aléatoire, l’identifiant Auth
technique ni le jeton de délégation. Le résultat JSON de « Se connecter à la
boutique » contient uniquement le compte métier, les métadonnées d’audit et le
chemin storefront. La session réelle sera portée par un cookie sécurisé lors de
l’implémentation UM2/UM5.

Les credentials et sessions storefront appartiennent au module
`shop-customers`, dans un schéma PostgreSQL `private` non exposé par PostgREST.
Le nouveau storefront n’utilise pas l’email global de Supabase Auth. Il ne stocke
que des hashes de mot de passe et de jeton ; les opérations serveur seront
exposées par des primitives étroites sans introduire `service_role` dans
`magrit-api`. Le champ `auth_subject_id` existant reste transitoire et ne fait
pas partie du nouveau contrat.

## Conséquences

- les contrats peuvent être développés avant la migration de données ;
- Orders, Quotes et paniers devront référencer `shop_customer_account_id` ;
- l’ancien modèle `shop_only` reste transitoire et ne doit plus inspirer de
  nouvelle API ;
- l’action unifiée orchestre compte miroir puis délégation, mais conserve deux
  opérations métier auditables et rejouables.
