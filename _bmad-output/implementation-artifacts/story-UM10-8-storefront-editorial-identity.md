---
id: UM10.8
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM10.1, UM10.7]
---
# UM10.8 — Neutraliser l’identité Magrit de l’éditorial storefront

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Problème

La recherche conversationnelle boutique utilisait déjà le cookie storefront,
mais l’enrichissement facultatif des pages de catégorie appelait encore la
route tenant `category-editorial` avec le client Diagnostics du workspace. En
mode délégué, le bearer Magrit pouvait donc modifier le rendu de la boutique.

## Résultat

- `PortalCatalog` utilise un client Diagnostics sans bearer Magrit ;
- la route tenant actuelle refuse normalement cet appel anonyme ;
- ce refus est absorbé par le fallback déterministe existant, sans page vide ni
  erreur visible pour le client ;
- la recherche conversationnelle storefront reste inchangée et continue de
  passer par son proxy autorisé par cookie boutique.

L’enrichissement éditorial IA sera réactivé uniquement lorsqu’une route dédiée
pourra résoudre le slug et la session boutique côté BFF.

## Évolution UM10.12

La route dédiée est désormais livrée. Elle résout le slug et le cookie côté BFF
avant la génération ; le fallback déterministe reste disponible uniquement en
cas d’indisponibilité du fournisseur.

## Validation

- garde-fou d’architecture sur le client Diagnostics storefront ;
- tests, typecheck modulaire et build de production.
