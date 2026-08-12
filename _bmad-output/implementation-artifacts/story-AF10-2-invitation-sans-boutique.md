---
id: AF10.2
epic: EPIC-8-API-FIRST
priority: P0
status: done
branch: refactor/api-first-foundation
depends_on: [AF10.1]
---

# AF10.2 — Invitation dans un tenant sans boutique

## Incident

La modale s’ouvrait par défaut en scope `shop_only`. Dans un tenant sans
boutique, aucune sélection n’était possible et le bouton d’envoi restait
désactivé sans explication suffisamment directe.

## Correction

- bascule automatique sur `magrit_full` quand l’API retourne zéro boutique ;
- désactivation explicite du choix « Boutique(s) » dans ce cas ;
- message indiquant de créer une boutique avant de pouvoir limiter le périmètre ;
- conservation de la règle : un scope `shop_only` exige toujours au moins une
  boutique, afin d’éviter une invitation sans accès effectif.

## Diagnostic local

La base locale contient plusieurs tenants de test sans boutique. Les boutiques
existantes restent correctement rattachées à leurs tenants respectifs ; la
liste vide observée n’est donc pas une disparition globale des boutiques.
