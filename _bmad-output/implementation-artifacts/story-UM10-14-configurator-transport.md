---
id: UM10.14
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM10.7, UM10.9]
---
# UM10.14 — Injecter explicitement le transport du configurateur

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Problème

Le storefront fournissait déjà une passerelle Clariprint anonyme au moteur de
configuration. Le hook partagé appelait néanmoins le contexte de services
workspace avant de retenir cette passerelle, ce qui entretenait une dépendance
implicite à l’identité Magrit.

## Résultat

- `useProductConfigurator` exige un `ClariprintPricingGateway` ;
- le hook ne consulte plus `BrowserServicesContext` ;
- l’overlay propage ce port obligatoire ;
- le catalogue boutique et la page gamme injectent la passerelle storefront ;
- la carte produit du workspace injecte séparément la passerelle Magrit.

## Validation

- garde-fou d’architecture sur l’absence du contexte dans le hook partagé ;
- vérification de l’injection explicite workspace et storefront ;
- typecheck, suite Vitest complète et build de production.
