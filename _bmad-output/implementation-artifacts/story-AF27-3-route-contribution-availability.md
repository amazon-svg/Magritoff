---
id: AF27.3
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF27.1]
---
# AF27.3 — Distinguer les routes actives des cibles planifiées

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Constat

Le registre décrivait comme exécutables une route storefront de création de
devis et trois routes backoffice. Aucun écran de création de devis n'est monté
dans `PublicShop` et aucun composition root backoffice n'existe encore.

Le bouton de fiche produit dont le test id historique contient `Quote` ajoute
uniquement le produit au panier. Le calcul Clariprint fournit un prix mais ne
persiste pas un devis client. Déclarer `/quote` comme actif aurait donc créé un
faux contrat runtime.

## Résultat livré

- une route peut être marquée `availability: planned` ;
- `SurfaceDefinition.routes` et `.navigation` ne contiennent que les éléments
  réellement montables ;
- `.plannedRoutes` et `.plannedNavigation` conservent les cibles produit ;
- `quotes.storefront.create` reste prévue, sans être exposée au portail ;
- les contributions backoffice Orders, Shops et Quotes restent prévues, sans
  simuler un backoffice actif ;
- le registre garantit par test que le backoffice courant n'expose aucune
  route ou navigation exécutable.

## Suite fonctionnelle

Avant d'activer `quotes.storefront.create`, définir le parcours panier → devis,
ses permissions, son état initial, son accusé de réception et son articulation
avec la commande. Avant d'activer les routes backoffice, créer un composition
root distinct du workspace Magrit et lui associer ses politiques d'accès.
