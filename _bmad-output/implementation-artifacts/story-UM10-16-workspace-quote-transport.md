---
id: UM10.16
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM10.14]
---
# UM10.16 — Injecter le transport de devis atelier

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

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
