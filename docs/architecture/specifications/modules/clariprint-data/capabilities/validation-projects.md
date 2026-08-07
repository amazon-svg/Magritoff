# Capacité `validation-projects`

**Statut :** draft

## Responsabilité

Préparer et suivre des cas de référence permettant de valider une publication avec le solveur, sans devenir propriétaire du calcul ou d'un outil général de devis.

## Concepts

- `ValidationProjectRef` ;
- `ProductTestCase` ;
- `SolverRun` ;
- `SolverRunResult` ;
- décomposition impression, façonnage, conditionnement, matière et transport.

## Cas d'usage

- créer ou importer un cas de test ;
- l'associer à une publication ou un sandbox ;
- déclencher un calcul via le port solveur ;
- afficher le détail et les documents de résultat ;
- comparer plusieurs exécutions ;
- recalculer en conservant l'historique.

## Invariants

- entrées, publication, environnement et contrat solveur identifiés ;
- résultat immuable après réception ;
- recalcul = nouvelle exécution ;
- statut `test` distinct de toute production ;
- coûts affichés issus de la réponse solveur ;
- propriété et droits sur les projets vérifiés par le module propriétaire.

## Frontière

Si les projets appartiennent à un autre module ou système, Clariprint Data ne stocke que références, corpus de validation et résultats nécessaires à la preuve de compatibilité. Les intégrations Hopes-Studio/OptimProject restent derrière un port dédié.

## Validation

- [ ] Chaque résultat permet de retrouver ses entrées et sa publication.
- [ ] Un recalcul ne remplace pas le résultat précédent.
- [ ] Un projet d'un autre tenant ou BU reste inaccessible.
- [ ] Les erreurs solveur sont corrélées et classifiées.
- [ ] Aucun calcul officiel n'est exécuté par une copie locale divergente.

## Décisions ouvertes

1. Module propriétaire des projets.
2. Contrats Hopes-Studio et OptimProject.
3. Inclusion ou non dans le MVP.
