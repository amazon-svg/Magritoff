# Story AF30.15 — Commande API d’invitation client boutique

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

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
