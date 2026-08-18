---
id: UM10.8
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM10.1, UM10.7]
---
# UM10.8 — Neutraliser l’identité Magrit de l’éditorial storefront

## Problème

La recherche conversationnelle boutique utilisait déjà le cookie storefront,
mais l’enrichissement facultatif des pages de catégorie appelait encore la
route tenant `category-editorial` avec le client Diagnostics du workspace. En
mode délégué, le bearer Magrit pouvait donc modifier le rendu de la boutique.

## Résultat

- `PortalCatalog` utilise un client Diagnostics sans bearer Magrit ;
- la route tenant actuelle refuse normalement cet appel anonyme ;
- ce refus est absorbé par le fallback déterministe existant, sans page vide ni
  erreur visible pour le client ;
- la recherche conversationnelle storefront reste inchangée et continue de
  passer par son proxy autorisé par cookie boutique.

L’enrichissement éditorial IA sera réactivé uniquement lorsqu’une route dédiée
pourra résoudre le slug et la session boutique côté BFF.

## Validation

- garde-fou d’architecture sur le client Diagnostics storefront ;
- tests, typecheck modulaire et build de production.
