---
id: UM10.35
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM10.34]
---
# UM10.35 — Isoler l'éditorial de catégorie storefront

## Résultat

- `useStorefrontCategoryEditorial` devient la façade de l'enrichissement IA ;
- le slug boutique et le cookie storefront restent les seules clés d'accès ;
- le cache `sessionStorage` est centralisé par famille ;
- un timeout de douze secondes garantit le repli vers le socle déterministe ;
- `PortalCatalog` ne connaît plus le client Diagnostics.

## Validation

- garde-fous API-first et séparation storefront/workspace adaptés ;
- suite Vitest complète, typecheck et build de production.
