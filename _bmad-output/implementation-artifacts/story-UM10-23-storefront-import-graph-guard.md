---
id: UM10.23
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM10.22]
---
# UM10.23 — Verrouiller le graphe d'import storefront

## Problème

Les contrôles précédents vérifiaient surtout les fichiers de composition pris
isolément. Un réexport ou un import indirect pouvait réintroduire un adaptateur
Supabase dans la racine storefront sans laisser de référence visible dans la
frontière de route.

## Résultat

- un test parcourt récursivement les imports et réexports statiques TypeScript
  depuis `StorefrontRuntimeBoundary` ;
- les imports exclusivement typés sont ignorés comme ils le sont au build ;
- le graphe doit contenir la racine storefront dédiée ;
- le runtime workspace et tous les fichiers `adapters/supabase` sont interdits
  dans ce graphe.

## Validation

- test d'architecture dédié ;
- vérification du build : les marqueurs Supabase/GoTrue restent confinés au
  chunk `WorkspaceRuntimeBoundary` ;
- typecheck et suite Vitest complète.
