# Backlog Git de Magrit

Le backlog est organisé en trois niveaux :

1. [`epics/`](epics/) pour les grands résultats produit ;
2. [`features/`](features/) pour les capacités reconnaissables ;
3. [`stories/`](stories/) pour les évolutions réalisables et vérifiables.

Toutes les stories Notion, dont les 146 « Pas commencé », doivent être importées ici au statut `draft`, puis révisées. Aucun statut Notion ne détermine à lui seul le statut de livraison.

Les story documents historiques de `_bmad-output/implementation-artifacts` ne sont pas supprimés. Ils deviennent des historiques d'implémentation et sont référencés depuis les nouvelles stories.

## Statuts

`specStatus` : `draft`, `review`, `approved`, `contradictory`, `superseded`, `deprecated`.

`deliveryStatus` : `not-started`, `ready`, `in-progress`, `implemented`, `verified`, `released`, `blocked`, `cancelled`.

Tout contenu importé ou produit par un agent commence à `draft`.
