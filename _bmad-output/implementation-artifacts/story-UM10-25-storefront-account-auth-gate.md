---
id: UM10.25
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM10.24]
---
# UM10.25 — Garder le hub compte par la session boutique

## Problème

Sur une boutique ouverte à l'inscription, un visiteur anonyme pouvait ouvrir
« Compte » et voir un état « Aucune commande ». Cette présentation laissait
croire qu'une session existait alors que le BFF n'avait résolu aucun compte
boutique.

## Résultat

- le hub vérifie la session du couple compte/boutique avant d'afficher sa
  navigation ;
- sans session, il présente le formulaire boutique commun de connexion,
  création ou récupération ;
- l'inscription reste proposée uniquement pour une boutique `self_signup` ;
- la session créée est remontée à `PublicShop` sans Auth Magrit ;
- commandes, devis et profil ne sont rendus qu'après authentification.

## Validation

- parcours anonyme vérifié dans le navigateur sur Supabase local ;
- garde-fou sur le formulaire et la remontée de session ;
- typecheck, suite Vitest complète et build de production.
