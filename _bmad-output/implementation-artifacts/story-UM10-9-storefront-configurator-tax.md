---
id: UM10.9
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM10.2, UM10.7]
---
# UM10.9 — Injecter la fiscalité dans le configurateur storefront

## Problème

Le panier, le checkout et la fiche produit utilisaient déjà le régime fiscal du
catalogue public, mais le moteur partagé `useProductConfigurator` consultait
encore `TenantContext`. L’overlay et la page gamme pouvaient donc calculer le TTC
avec l’espace Magrit courant plutôt qu’avec la boutique visitée.

## Résultat

- le configurateur reçoit désormais un taux explicite et ne lit plus
  `TenantContext` ;
- `PublicShop` propage le taux du contrat `PublicShopCatalog` au catalogue, à
  l’overlay et à la page gamme ;
- l’atelier Magrit transmet séparément le taux de son tenant ;
- le taux métropole reste un fallback défensif pour les appels hors contexte.

## Validation

- garde-fou fiscal étendu à tous les composants de configuration boutique ;
- tests purs du configurateur et tests d’architecture ;
- typecheck, suite Vitest et build de production.
