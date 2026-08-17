---
id: UM7.3
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM7.2]
---
# UM7.3 — Surface de contrôle de la migration legacy

## Objectif

Rendre la migration contrôlable par un administrateur avant la suppression du
modèle historique, sans transformer cet écran en outil de mutation dangereux.

## Résultat

- panneau intégré à la surface runtime « Utilisateurs et rôles » ;
- panneau absent lorsqu’aucun ancien accès `shop_only` n’existe ;
- affichage par email et boutique du résultat (`créé`, `réutilisé`, `ignoré`) ;
- total des commandes historiques rattachées ;
- alerte explicite si une ligne est encore sans résultat ou a été ignorée ;
- lecture exclusive via la façade `ShopCustomersApiClient`.

La migration elle-même reste une opération serveur. Aucun bouton du navigateur
ne peut déclencher le backfill ou supprimer l’ancien membre.

## Validation

- test de frontière anti-Supabase direct ;
- présence dans la surface Utilisateurs existante ;
- cas vide masqué et anomalies identifiables ;
- tests applicatifs et build de production.
