# Story AF30.15 — Commande API d’invitation client boutique

**Statut :** done  
**Date :** 2026-08-20

## Objectif

Faire correspondre le parcours UX « email + Envoyer l’invitation » à une seule
commande du module `shop-customers`, au lieu d’orchestrer dans React un appel de
création puis un appel d’activation.

## Réalisation

- ajout de `ShopCustomerInvitationService` dans la couche application ;
- ajout du contrat partagé `InviteShopCustomerCommand/Result` ;
- ajout de `POST /api/v1/tenants/:tenantId/shops/:shopId/customers/invitations` ;
- ajout de `ShopCustomersApiClient.invite()` ;
- remplacement de l’orchestration à deux appels dans le hook React ;
- composition explicite dans l’Edge Function `magrit-api` ;
- conservation de la route d’activation unitaire pour le renvoi depuis une ligne.

## Invariants

- l’identité reste `(shop_id, normalized_email)` ;
- un compte absent est créé avec le statut `invited` ;
- un compte `delegated_only` ou `invited` est réutilisé ;
- un compte `active` ou `suspended` est refusé explicitement ;
- le résultat expose toujours le lien manuel, même si l’email n’est pas envoyé ;
- le navigateur ne connaît ni Supabase ni la composition des deux services.

## Vérification

- tests de service : création, renvoi sans doublon, actif, suspendu ;
- test serveur/client du contrat HTTP unifié ;
- garde-fou composant/hook mis à jour sur `api.invite`.
