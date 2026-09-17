---
id: UM10.30
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM10.29]
---
# UM10.30 — Isoler le cycle de chargement du catalogue storefront

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Problème

`PublicShop` mélangeait encore composition d'écran, transport Shops, garde
d'accès, conversion du contrat public et gestion des reprises réseau. Ce bloc
rendait la surface difficile à faire évoluer et facilitait le retour d'appels
directs dans le composant.

## Résultat

- `usePublicShopCatalog` devient la façade React du catalogue public ;
- le probe minimal reste exécuté avant toute lecture du contenu privé ;
- les états `loading`, `ready`, `authentication_required`, `not_found` et
  `unavailable` forment un contrat explicite consommé par la surface ;
- le mapping API vers les modèles de lecture boutique, produits, PIM et régime
  fiscal est centralisé et testable séparément ;
- les rafraîchissements au focus et toutes les quinze secondes restent
  fail-closed et sont désormais hors du composant d'écran ;
- le retry technique relance le cycle complet sans exposer le client HTTP.

## Validation

- test unitaire du mapping catalogue public ;
- garde-fous d'architecture interdisant `publicProbe` et `publicCatalog` dans
  `PublicShop` ;
- tests ciblés, typecheck, recette navigateur, suite Vitest complète et build.
