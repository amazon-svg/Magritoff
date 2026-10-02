# Workflow documentaire et de livraison

## Évolution normale

```text
Besoin, réunion ou incident
        ↓
Décision ou brouillon documenté
        ↓
Analyse d'impact sur l'existant
        ↓
Mise à jour de l'artefact canonique
        ↓
Approbation humaine
        ↓
Planification dans un sprint
        ↓
Code et tests dans la même PR
        ↓
Revue distincte et preuves
        ↓
Livraison et mise à jour des statuts
```

## Modification d'une spécification existante

- Changement additif : ajouter un critère ou une story liée.
- Changement partiel : réviser la spécification canonique et déprécier précisément les critères remplacés.
- Remplacement complet : marquer l'ancien élément `superseded` et référencer son successeur.
- Suppression : marquer `deprecated` et documenter les conséquences.

Git conserve l'historique. Il ne faut pas créer de séries de fichiers `v1`, `v2` ou `final` pour un même élément canonique.

## Compte rendu

Un compte rendu approuvé confirme ce qui a été dit et décidé. `propagationStatus` indique si ses conséquences ont été reportées :

- `pending`
- `partial`
- `complete`
- `not-applicable`

Une propagation est complète lorsque chaque décision ou action possède une destination, une preuve de clôture ou une justification de classement sans suite.

## Génération automatique

La régénération périodique complète du backlog est écartée. Les agents peuvent produire des brouillons, index et rapports, mais une validation humaine reste nécessaire. Le système qualité peut relire la correspondance entre application, spécifications et tests.
