---
id: AF30.9
epic: EPIC-8-API-FIRST
priority: P2
status: done
branch: feat/storefront-identity-um2
depends_on: [AF30.8]
---
# AF30.9 — Isoler la gestion des mockups boutique

## Intention

`ShopCustomMockups` pilote directement lecture, téléversement et restauration
via Shops. La grille visuelle doit consommer un état résolu et ne conserver que
le sélecteur de fichiers navigateur.

## Critères d'acceptation

- lecture et indexation des overrides portées par un hook ;
- réponses tardives ignorées après changement de boutique ;
- téléversement et restauration suivis d'un rafraîchissement contrôlé ;
- messages d'erreur existants conservés ;
- composant sans client Shops ;
- garde-fou d'architecture, tests, typecheck modulaire et build verts.

## Résultat livré

- `useShopCustomMockups` porte lecture, indexation, téléversement, restauration
  et rafraîchissement des overrides ;
- les résultats tardifs sont neutralisés après un changement de boutique ;
- la grille visuelle conserve uniquement le sélecteur de fichiers et les
  previews déterministes ;
- le garde-fou API-first interdit le retour du client Shops dans le composant.

## Validation

- 165 fichiers de tests passés ;
- 1 223 tests passés, 0 ignoré, 0 échec ;
- typecheck modulaire et build de production passés.
