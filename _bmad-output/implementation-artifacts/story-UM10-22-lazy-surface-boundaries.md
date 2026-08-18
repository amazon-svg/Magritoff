---
id: UM10.22
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM10.21]
---
# UM10.22 — Charger les frontières de surface à la demande

## Problème

Les runtimes storefront et workspace étaient physiquement séparés, mais le
routeur importait encore leurs deux frontières statiquement. Le bundle initial
pouvait donc charger l'adaptateur Supabase Auth Magrit lors d'une visite directe
de la boutique.

## Résultat

- `StorefrontRuntimeBoundary` et `WorkspaceRuntimeBoundary` sont chargées par
  imports dynamiques distincts ;
- chaque route racine affiche le fallback commun pendant le chargement de sa
  composition d'identité ;
- une entrée `/shop/...` ne suit plus statiquement le graphe du runtime
  workspace ;
- les composants métier déjà découpés conservent leur stratégie de chargement.

## Validation

- garde-fou interdisant les imports statiques des deux frontières dans le
  routeur ;
- garde-fou vérifiant le `Suspense` des deux racines de surface ;
- contrôle des chunks de production, typecheck et suite Vitest complète.
