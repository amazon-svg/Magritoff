---
id: UM8.3
epic: EPIC-UM-STORE-IDENTITY
status: done-code
branch: feat/storefront-identity-um2
depends_on: [UM8.1]
---
# UM8.3 — Séparer le catalogue de rôles Magrit

## Objectif

Empêcher qu'un compte Magrit reçoive encore le rôle historique « Acheteur »,
désormais remplacé par un compte propre à chaque boutique.

## Résultat

- les rôles portent un contexte d'identité explicite ;
- les rôles équipe sont `magrit` ;
- le rôle Acheteur existant devient `storefront_legacy` et reste conservé pour
  l'audit et la migration ;
- les listes de rôles, invitations et écrans d'assignation Magrit n'exposent
  que le contexte `magrit` ;
- PostgreSQL bloque une nouvelle assignation ou propagation d'un rôle
  storefront vers un membre Magrit ;
- les assignations historiques restent lisibles et révocables.

## Validation

- scénario SQL avec invitation Magrit autorisée et rôle Acheteur refusé ;
- tests des frontières de repository ;
- typecheck, suite applicative et build.
