---
id: UM10.4
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM8.4, UM10.2]
---
# UM10.4 — Isoler l’état transactionnel par boutique

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

| TF | Cas de test | Statut | Priorité | Parcours | Cible | Stories liées |
|---|---|---|---|---|---|---|
| [TF-152](https://app.notion.com/3c6d0131973c81df8252fc0a6936848b) | P12 — Un compte par boutique : même email = deux comptes, une session ne vaut que pour sa boutique | OK | P0 — Critique | P12 — Comptes clients boutique | B5 | SPEC-IDENTITY-STORE-01, UM1-1, UM2-1, UM10-4, invariant 3 |

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Problème

React peut conserver la même instance de `PublicShop` lors d’une navigation de
`/shop/a` vers `/shop/b`. Le panier, la dernière confirmation, les avertissements
de renouvellement et les filtres pouvaient donc survivre au changement de slug.
Pendant le premier rendu, la marque A pouvait également être brièvement peinte
sous l’URL de B avant le déclenchement de l’effect de chargement.

## Résultat

- panier, dernière commande confirmée, avertissements, filtres temporaires,
  signal du drawer et clé d’idempotence sont réinitialisés à la frontière slug ;
- le rendu reste sur le loader tant que la boutique chargée ne correspond pas
  exactement au slug courant ;
- une commande ou un panier de A ne peut plus être présenté ni soumis dans B.

## Validation

- garde-fou d’architecture dédié aux resets et au garde avant peinture ;
- tests storefront ciblés et typecheck modulaire.
