---
id: UM10.38
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM10.37]
---
# UM10.38 — Verrouiller la frontière des vues storefront

## Résultat

- les composants de la surface boutique n'importent plus le contexte des clients
  de module ;
- les hooks clients Shops, Orders, Identity et Diagnostics sont interdits dans
  les vues ;
- l'orchestration asynchrone reste portée par des hooks dédiés et testables ;
- les adaptateurs Supabase demeurent confinés à la couche d'infrastructure.

## Validation

- garde-fou transversal appliqué aux 37 composants TypeScript du storefront ;
- suite Vitest complète, typecheck et build de production.
