# J0 — Découverte métier et contrat solveur

**Statut initial :** à préparer

**Spécifications préparées :** [modèle de domaine](../architecture/specifications/modules/clariprint-data/domain-model.md), [export solveur](../architecture/specifications/modules/clariprint-data/capabilities/solver-exports.md)

## Goal

Transformer les hypothèses du PRD en décisions métier suffisamment précises pour concevoir le modèle sans inventer de règles ou de données.

## Périmètre

- vocabulaire métier ;
- parc et flux d'impression pilotes ;
- paramètres techniques et économiques nécessaires ;
- droits et responsabilités ;
- règles bloquantes et avertissements ;
- format d'entrée et comportement du solveur ;
- unités, arrondis, dates d'effet et versionnement ;
- volumétrie de référence.

## Livrables

1. Glossaire métier validé.
2. Jeu de données représentatif et anonymisable.
3. Description d'un flux complet, de la ressource au résultat solveur attendu.
4. Matrice `capacité × ressources × paramètres requis`.
5. Matrice des rôles et droits.
6. Catalogue initial des règles bloquantes et avertissements.
7. Contrat JSON versionné ou exemple exécutable équivalent.
8. Jeu de résultats de référence du solveur.
9. Liste des décisions prises et questions reportées.

## Critères de validation

- [ ] `J0-VAL-01` Un expert métier a validé le glossaire.
- [ ] `J0-VAL-02` Le pilote nomme précisément les familles de machines, matières, transports et opérations couvertes.
- [ ] `J0-VAL-03` Chaque champ requis par le solveur possède une définition, une unité et une règle d'absence.
- [ ] `J0-VAL-04` Le contrat indique s'il transporte un snapshot complet, un différentiel ou les deux.
- [ ] `J0-VAL-05` Les règles d'arrondi et les dates d'effet sont documentées.
- [ ] `J0-VAL-06` La frontière entre coût industriel, marge et prix final est décidée.
- [ ] `J0-VAL-07` La profondeur de sous-traitance du MVP est décidée.
- [ ] `J0-VAL-08` Les règles nécessitant une seconde validation sont identifiées.
- [ ] `J0-VAL-09` Un JSON de référence peut être construit manuellement et soumis au validateur ou solveur de test.
- [ ] `J0-VAL-10` Les données de test ne contiennent aucun secret ni donnée confidentielle non autorisée.

## Preuves attendues

- compte rendu de validation métier ;
- fichiers de référence versionnés ou emplacement sécurisé documenté ;
- schéma JSON et exemples valides/invalides ;
- résultat du test de contrat ;
- décisions enregistrées dans le registre.

## Condition de sortie

J1 peut commencer lorsque `J0-VAL-01` à `J0-VAL-09` sont validés. Une question reportée doit avoir un propriétaire, une échéance et une solution temporaire explicitement non contractuelle.
