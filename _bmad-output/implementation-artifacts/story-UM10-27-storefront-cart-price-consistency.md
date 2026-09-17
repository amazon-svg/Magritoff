---
id: UM10.27
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM10.26]
---
# UM10.27 — Conserver le prix canonique du panier jusqu'à la commande

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Problème

Un ajout rapide depuis le catalogue peut conserver `price_ht = 0` lorsque le
prix Clariprint n'a pas encore été calculé. Le drawer résolvait alors un prix
marché (75 € HT dans le cas de recette), tandis que le checkout et la création
de commande relisaient directement la valeur nulle du produit. L'acheteur
voyait donc un panier à 75 € puis un checkout à 0 €.

## Résultat

- une fonction pure résout le prix canonique de chaque ligne de panier ;
- le drawer, le montant d'en-tête, le checkout et la commande utilisent la
  même résolution ;
- le prix unitaire transmis au BFF Orders est celui présenté à l'acheteur ;
- le détail TTC du drawer ne retombe plus à zéro lorsque le résumé utilise un
  prix marché.

## Validation

- test unitaire du prix catalogue et du fallback prix marché ;
- audit navigateur avec un compte boutique local authentifié ;
- 75 € HT / 90 € TTC observés de façon identique dans le panier et le checkout ;
- bouton final actif, sans création d'une nouvelle commande pendant l'audit ;
- suite Vitest complète, typecheck et build.
