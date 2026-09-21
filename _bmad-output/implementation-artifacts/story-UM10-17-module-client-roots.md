---
id: UM10.17
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM10.15, UM10.16]
---
# UM10.17 — Séparer les composition roots HTTP

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Problème

Les hooks storefront utilisaient les bons transports, mais leurs clients
étaient encore construits dans le même contexte React que les clients Magrit.
Une future importation erronée pouvait donc réintroduire un client workspace
dans une surface boutique sans franchir de frontière de module visible.

## Résultat

- `ModuleClientsContext` ne compose plus que les clients workspace ;
- `StorefrontModuleClientsContext` compose séparément identity, shops, orders
  et diagnostics avec `anonymousClient` ;
- le provider storefront est explicite dans la racine applicative ;
- tous les composants boutique importent leurs hooks depuis ce module dédié ;
- aucun client utilisant `apiRuntime.client` n’est exposé par le registre
  storefront.

## Validation

- garde-fous d’architecture sur les deux composition roots ;
- vérification que le registre storefront ne contient aucun client workspace ;
- typecheck, suite Vitest complète et build de production.
