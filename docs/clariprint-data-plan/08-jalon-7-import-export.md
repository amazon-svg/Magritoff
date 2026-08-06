# J7 — Import contrôlé et export solveur

**Statut initial :** à préparer  
**Dépendances :** J5 et J6

## Goal

Importer un parc pilote sans corruption silencieuse et livrer une publication complète au solveur avec un contrat versionné et observable.

## Périmètre import

- format tabulaire limité au pilote ;
- version du modèle d'import ;
- prévisualisation ;
- créations, mises à jour et rejets ;
- idempotence ;
- import vers un brouillon uniquement ;
- bilan réconcilié.

## Périmètre export

- génération JSON complète ;
- validation par schéma ;
- fichier et/ou endpoint décidé au J0 ;
- timeout et erreurs typées ;
- identifiant de corrélation ;
- accusé de réception ;
- nouvelle tentative idempotente ;
- historique des livraisons.

## Livrables

1. Format d'import versionné et fichier exemple.
2. Pipeline prévisualiser, valider, confirmer et réconcilier.
3. `SolverDatasetPublisher` et son adaptateur.
4. Schéma JSON et fixtures contractuelles.
5. Tableau des statuts de livraison.
6. Procédure de reprise après échec.

## Critères de validation

- [ ] `J7-VAL-01` Un import ne modifie jamais directement une publication.
- [ ] `J7-VAL-02` Une prévisualisation distingue créations, mises à jour, lignes identiques et rejets.
- [ ] `J7-VAL-03` Réimporter le même fichier et la même version ne duplique aucune ressource.
- [ ] `J7-VAL-04` Le bilan réconcilie exactement lignes lues, acceptées, ignorées et rejetées.
- [ ] `J7-VAL-05` Une ligne invalide n'est jamais supprimée silencieusement.
- [ ] `J7-VAL-06` Le JSON contient toutes les métadonnées exigées par le contrat.
- [ ] `J7-VAL-07` Le JSON est validé avant toute livraison.
- [ ] `J7-VAL-08` Une nouvelle tentative ne crée pas deux livraisons métier distinctes.
- [ ] `J7-VAL-09` Timeout, refus contractuel et indisponibilité sont distinguables.
- [ ] `J7-VAL-10` Une livraison échouée ne dépublie ni ne modifie le snapshot.
- [ ] `J7-VAL-11` Le jeu de référence est accepté par le validateur ou solveur de test.

## Scénario de démonstration

Prévisualiser puis importer le fichier pilote, corriger ses anomalies, publier le parc, simuler un timeout, relancer la livraison et obtenir un accusé de réception unique du solveur.

## Condition de sortie

Le contrat partagé passe sur des fixtures valides et invalides, et le solveur de test accepte la publication issue du parc pilote.

