---
id: UM9.2
epic: EPIC-UM-STORE-IDENTITY
status: done-code
branch: feat/storefront-identity-um2
depends_on: [UM2.8, UM9.1]
---
# UM9.2 — Récupération de mot de passe boutique

## Objectif

Permettre à un client de récupérer son accès sans Supabase Auth et sans qu’un
compte homonyme d’une autre boutique soit consulté ou modifié.

## Résultat

- action « Mot de passe oublié ? » depuis chaque formulaire storefront ;
- réponse 202 identique pour un email présent, absent ou temporairement limité ;
- email Resend contenant un lien à usage unique valable une heure ;
- page publique de choix du nouveau mot de passe ;
- incrément de version du credential et remise à zéro du verrouillage ;
- révocation de toutes les sessions directes antérieures ;
- aucun jeton de récupération exposé dans la réponse à la demande.

## Défenses

- recherche par `(shop_slug, normalized_email)` ;
- table et hashes de jetons dans le schéma `private` ;
- une émission maximum par minute et par compte ;
- message d’erreur neutre pour un jeton invalide, expiré ou consommé ;
- modification limitée au seul `shop_customer_account_id` du jeton.

## Validation

- 1 111 tests applicatifs ;
- 11 scénarios SQL storefront ;
- isolement explicite de deux comptes utilisant le même email ;
- typecheck modulaire et build de production.
