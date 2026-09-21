---
id: UM10.7
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM5.3, UM10.6]
---
# UM10.7 — Isoler le transport catalogue boutique

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Problème

Les routes publiques `probe` et `catalog` étaient encore appelées par
l’instance Shops du workspace. Un utilisateur Magrit connecté pouvait donc
joindre son bearer aux lectures de la boutique, même si l’accès privé était
correctement résolu par le cookie storefront côté BFF.

## Résultat

- le composition root fournit une instance Shops storefront sans bearer ;
- `PublicShop` utilise cette instance pour le garde minimal et le catalogue ;
- la gestion des boutiques dans Magrit conserve l’instance workspace ;
- une boutique privée dépend uniquement de sa session boutique HttpOnly.

## Validation

- garde-fou distinct pour les clients Shops workspace et storefront ;
- tests d’architecture API-first et typecheck modulaire ;
- suite Vitest et build de production.
