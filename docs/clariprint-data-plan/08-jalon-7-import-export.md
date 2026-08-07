# J7 — Import, profils clients et accès solveur

**Statut initial :** à préparer  
**Dépendances :** J5 et J6

**Spécifications applicables :** [imports](../architecture/specifications/modules/clariprint-data/capabilities/imports.md), [référentiels matière](../architecture/specifications/modules/clariprint-data/capabilities/material-references.md), [catalogues transport](../architecture/specifications/modules/clariprint-data/capabilities/transport-catalogs.md), [exports solveur](../architecture/specifications/modules/clariprint-data/capabilities/solver-exports.md), [contrats d'accès calcul](../architecture/specifications/modules/clariprint-data/capabilities/calculation-access-contracts.md)

## Goal

Importer un parc pilote sans corruption silencieuse, administrer les profils clients et fournir au solveur un JSON complet dont Clariprint Data a déjà ajusté les tarifs.

## Périmètre import

- format tabulaire limité au pilote ;
- version du modèle d'import ;
- prévisualisation ;
- créations, mises à jour et rejets ;
- idempotence ;
- import vers un brouillon uniquement ;
- bilan réconcilié.

## Périmètre profils et accès calcul

- qualification explicite des montants source comme coûts de production ou tarifs commerciaux ;
- profils clients versionnés ;
- politiques de marge ou remise globales et par machine ;
- intervalles de validité et résolution à une date d'effet ;
- contrat liant profil, pool publié et filtres de ressources ;
- plusieurs clés API locales par contrat, avec rotation et révocation ;
- publication des profils exposables pour un mode d'accès externe authentifié.

## Périmètre projection solveur

- résolution du contrat et du profil depuis une clé API ou une liaison externe autorisée ;
- génération JSON complète avec tarifs ajustés par Clariprint Data ;
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
8. Administration des profils clients et politiques tarifaires datées.
9. Administration des contrats d'accès, filtres et credentials locaux.
10. Catalogue des profils publiés pour le résolveur d'accès externe.
11. Générateur de projection ajustée et preuve des règles appliquées.

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
- [ ] `J7-VAL-13` La nature des montants source est explicite et n'est jamais déduite d'un libellé.
- [ ] `J7-VAL-14` Une politique globale peut être remplacée par une règle propre à une machine selon la priorité décidée au J0.
- [ ] `J7-VAL-15` Deux demandes portant sur des dates différentes sélectionnent les politiques respectivement valides.
- [ ] `J7-VAL-16` Plusieurs clés API indépendantes peuvent désigner le même contrat sans partager leur cycle de vie.
- [ ] `J7-VAL-17` Une clé révoquée est refusée sans invalider les autres clés du contrat.
- [ ] `J7-VAL-18` Une référence de profil seule ne donne aucun accès ; le mode externe exige un principal authentifié et autorisé.
- [ ] `J7-VAL-19` Le JSON remis au solveur contient uniquement les ressources autorisées et leurs tarifs déjà ajustés.
- [ ] `J7-VAL-20` Le solveur de test obtient le même résultat contractuel sans réappliquer la politique du profil.
- [ ] `J7-VAL-21` Générer une projection ne modifie ni le pool, ni sa publication, ni ses montants source.
- [ ] `J7-VAL-22` Une même publication, un même contrat, une même politique et une même date produisent une projection déterministe.
- [ ] `J7-VAL-23` La preuve de génération identifie publication, profil, politique, date, mode d'accès et empreinte sans exposer de secret.

## Scénario de démonstration

Prévisualiser puis importer le parc pilote, qualifier ses montants source et le publier. Créer un profil avec une politique globale et une exception machine datée, l'associer à un contrat, créer deux clés puis générer le JSON ajusté accepté par le solveur. Révoquer une clé sans interrompre l'autre, résoudre aussi le profil par le mode externe authentifié, et vérifier que le pool publié est resté inchangé.

## Condition de sortie

Le contrat partagé passe sur des fixtures valides et invalides, et le solveur de test accepte la projection ajustée issue du parc pilote sans appliquer lui-même de marge ou remise.
