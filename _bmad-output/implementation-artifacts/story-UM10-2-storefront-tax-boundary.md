---
id: UM10.2
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM10.1, UM5.3]
---
# UM10.2 — Isoler la politique fiscale du storefront

## Problème

Le panier, la fiche produit, le checkout et la confirmation lisaient encore
`TenantContext.currentTenant`. Une boutique pouvait donc afficher la TVA de
l’espace Magrit actif dans le navigateur, alors que son compte et son contexte
commercial doivent être indépendants.

## Résultat

- le contrat `PublicShopCatalog` expose un `taxRegime` obligatoire et validé ;
- le repository serveur résout ce régime depuis la boutique active via une
  primitive SQL minimale, accessible au rôle anonyme sans ouvrir la table
  `tenants` protégée par RLS ;
- `PublicShop` transforme le régime en taux puis l’injecte explicitement dans
  la fiche produit, le panier, le checkout et la confirmation ;
- aucun de ces écrans storefront ne dépend désormais de `TenantContext` ou de
  `useTenant` ;
- le régime par défaut reste `metropole_fr` uniquement pendant le chargement,
  tandis qu’un régime absent ou inconnu est rejeté par le contrat API.

## Validation

- garde-fou d’architecture sur les cinq composants storefront ;
- tests de contrat : régime obligatoire, valeurs admises et valeur inconnue ;
- migration appliquée au Supabase Docker local ; appel réel en rôle `anon` ;
- 1 115 tests Vitest, typecheck modulaire et build Vite.
