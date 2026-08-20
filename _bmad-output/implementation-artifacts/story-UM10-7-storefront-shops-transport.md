---
id: UM10.7
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM5.3, UM10.6]
---
# UM10.7 — Isoler le transport catalogue boutique

## Problème

Les routes publiques `probe` et `catalog` étaient encore appelées par
l’instance Shops du workspace. Un utilisateur Magrit connecté pouvait donc
joindre son bearer aux lectures de la boutique, même si l’accès privé était
correctement résolu par le cookie storefront côté BFF.

## Résultat

- le composition root fournit une instance Shops storefront sans bearer ;
- `PublicShop` utilise cette instance pour le garde minimal et le catalogue ;
- la gestion des boutiques dans Magrit conserve l’instance workspace ;
- une boutique privée dépend uniquement de sa session boutique HttpOnly.

## Validation

- garde-fou distinct pour les clients Shops workspace et storefront ;
- tests d’architecture API-first et typecheck modulaire ;
- suite Vitest et build de production.
