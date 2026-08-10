# J7 — Import et accès solveur

**Statut initial :** à préparer  
**Dépendances :** J5 et J6

**Spécifications applicables :** [imports](../architecture/specifications/modules/clariprint-data/capabilities/imports.md), [référentiels matière](../architecture/specifications/modules/clariprint-data/capabilities/material-references.md), [catalogues transport](../architecture/specifications/modules/clariprint-data/capabilities/transport-catalogs.md), [exports solveur](../architecture/specifications/modules/clariprint-data/capabilities/solver-exports.md), [contrats d'accès calcul](../architecture/specifications/modules/clariprint-data/capabilities/calculation-access-contracts.md)

## Goal

Importer un parc pilote sans corruption silencieuse et fournir au solveur un JSON complet de données techniques et de coûts de production.

## Périmètre import

- format tabulaire limité au pilote ;
- version du modèle d'import ;
- prévisualisation ;
- créations, mises à jour et rejets ;
- idempotence ;
- import vers un brouillon uniquement ;
- bilan réconcilié.

## Périmètre accès calcul

- qualification explicite des catégories de coûts de production ;
- contrat liant consommateur technique, pool publié et filtres de ressources ;
- plusieurs clés API locales par contrat, avec rotation et révocation ;
- publication des contrats exposables pour un mode d'accès externe authentifié.

## Périmètre projection solveur

- résolution du contrat depuis une clé API ou une liaison externe autorisée ;
- génération JSON complète sans ajustement commercial ;
- conservation des montants du pool source sans modification ;
- validation par schéma ;
- fichier et/ou endpoint décidé au J0 ;
- timeout et erreurs typées ;
- identifiant de corrélation ;
- accusé de réception ;
- nouvelle tentative idempotente ;
- historique des générations et livraisons ;
- versions des référentiels matière et transport utilisées dans l'export.

## Livrables

1. Format d'import versionné et fichier exemple.
2. Pipeline prévisualiser, valider, confirmer et réconcilier.
3. `SolverDatasetPublisher` et son adaptateur.
4. Schéma JSON et fixtures contractuelles.
5. Tableau des statuts de livraison.
6. Procédure de reprise après échec.
7. Imports complet et tarifaire distincts si les catalogues BU font partie du pilote.
8. Administration des contrats d'accès, filtres et credentials locaux.
9. Catalogue des contrats publiés pour le résolveur d'accès externe.
10. Générateur de projection solveur et preuve des filtres appliqués.

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
- [ ] `J7-VAL-12` Une mise à jour d'un catalogue BU n'altère aucune publication antérieure.
- [ ] `J7-VAL-13` Les catégories de coûts de production sont explicites et ne sont jamais déduites d'un libellé.
- [ ] `J7-VAL-14` Aucun champ commercial n'est accepté dans l'import ou la projection.
- [ ] `J7-VAL-15` Deux demandes portant sur des dates différentes sélectionnent les coûts respectivement valides.
- [ ] `J7-VAL-16` Plusieurs clés API indépendantes peuvent désigner le même contrat sans partager leur cycle de vie.
- [ ] `J7-VAL-17` Une clé révoquée est refusée sans invalider les autres clés du contrat.
- [ ] `J7-VAL-18` Une référence de contrat seule ne donne aucun accès ; le mode externe exige un principal authentifié et autorisé.
- [ ] `J7-VAL-19` Le JSON remis au solveur contient uniquement les ressources autorisées et leurs coûts de production.
- [ ] `J7-VAL-20` Le solveur de test obtient un dataset ne contenant aucun ajustement commercial.
- [ ] `J7-VAL-21` Générer une projection ne modifie ni le pool, ni sa publication, ni ses montants source.
- [ ] `J7-VAL-22` Une même publication, un même contrat et une même date produisent une projection déterministe.
- [ ] `J7-VAL-23` La preuve de génération identifie publication, contrat, date, mode d'accès et empreinte sans exposer de secret.

## Scénario de démonstration

Prévisualiser puis importer le parc pilote, qualifier ses coûts de production et le publier. Créer un contrat filtré, créer deux clés puis générer le JSON accepté par le solveur. Révoquer une clé sans interrompre l'autre, résoudre aussi le contrat par le mode externe authentifié, et vérifier que le pool publié est resté inchangé.

## Condition de sortie

Le contrat partagé passe sur des fixtures valides et invalides, et le solveur de test accepte la projection issue du parc pilote, composée exclusivement de données techniques et de coûts de production.
