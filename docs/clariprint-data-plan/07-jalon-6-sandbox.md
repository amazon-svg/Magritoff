# J6 — Bacs à sable et comparaison

**Statut initial :** à préparer  
**Dépendance :** J5

## Goal

Permettre l'expérimentation sur une copie isolée d'une publication sans aucun effet sur les données ou calculs de production.

## Périmètre

- création depuis une publication ;
- modifications isolées ;
- contrôles identiques au brouillon ;
- comparaison avec la source ;
- export explicitement marqué sandbox ;
- destination solveur de test ;
- promotion vers un nouveau brouillon ;
- archivage.

## Livrables

1. Modèle `Sandbox` rattaché à une publication source.
2. Cas d'usage créer, modifier, contrôler, comparer, promouvoir et archiver.
3. Protection technique des destinations de production.
4. Interface de comparaison.
5. Audit des promotions.

## Critères de validation

- [ ] `J6-VAL-01` Un sandbox possède une publication source immuable.
- [ ] `J6-VAL-02` Une modification du sandbox ne change ni le brouillon courant ni la publication active.
- [ ] `J6-VAL-03` Le JSON sandbox porte un marqueur d'environnement non ambigu.
- [ ] `J6-VAL-04` Le backend refuse toute livraison d'un sandbox vers le solveur de production.
- [ ] `J6-VAL-05` La comparaison montre ajouts, suppressions et modifications significatives.
- [ ] `J6-VAL-06` Une promotion crée un nouveau brouillon et ne modifie pas directement la publication.
- [ ] `J6-VAL-07` L'archivage d'un sandbox n'affecte aucune publication.
- [ ] `J6-VAL-08` Les droits de création, modification et promotion sont contrôlés côté serveur.

## Scénario de démonstration

Créer un sandbox depuis V1, modifier une cadence et un coût, générer son JSON, démontrer que le JSON de production est inchangé, puis promouvoir l'expérience vers un nouveau brouillon.

## Condition de sortie

Un test automatique démontre l'impossibilité d'envoyer un identifiant de sandbox vers la destination de production.

