---
id: UM10.16
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM10.14]
---
# UM10.16 — Injecter le transport de devis atelier

## Problème

Le hook historique `useClariprintProduct` choisissait encore implicitement le
gateway workspace dans `BrowserServicesContext`. Il n’était plus utilisé par le
storefront, mais conservait un comportement différent du moteur de
configuration désormais fondé sur l’injection explicite.

## Résultat

- le hook exige une passerelle de calcul de prix ;
- il ne dépend plus du contexte React des services navigateur ;
- `ProductCard`, surface Magrit, injecte explicitement son gateway workspace ;
- les deux moteurs de calcul partagés suivent maintenant la même convention.

## Validation

- contrat du hook mis à jour pour rendre le paramètre obligatoire ;
- garde-fou d’architecture contre le retour de `useBrowserServices` ;
- typecheck, suite Vitest complète et build de production.
