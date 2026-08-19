---
id: UM10.34
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM10.33]
---
# UM10.34 — Isoler l'éditeur de commande storefront

## Résultat

- `useStorefrontOrderEditor` charge le brouillon et annule les lectures obsolètes ;
- quantités, prix, suppressions et total HT sont gérés dans la fonctionnalité ;
- la sauvegarde atomique conserve sa clé d'idempotence et ses erreurs métier ;
- `PortalOrderEditor` devient un dialogue de rendu sans accès au client Orders ;
- aucune identité Magrit ou Supabase Auth n'est introduite dans ce parcours.

## Validation

- garde-fous d'architecture sur le transport storefront ;
- suite Vitest complète, typecheck et build de production.
