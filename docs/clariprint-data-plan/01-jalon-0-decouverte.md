# J0 — Découverte métier et contrat solveur

**Statut initial :** à préparer

**Spécifications préparées :** [modèle de domaine](../architecture/specifications/modules/clariprint-data/domain-model.md), [export solveur](../architecture/specifications/modules/clariprint-data/capabilities/solver-exports.md), [contrats d'accès calcul](../architecture/specifications/modules/clariprint-data/capabilities/calculation-access-contracts.md)

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
- volumétrie de référence ;
- nature et granularité des coûts de production ;
- exclusion contractuelle des marges, majorations, remises et prix de vente ;
- modes d'accès locaux et protocole de confiance externe.

## Livrables

1. [Glossaire candidat](./12-glossaire-candidat.md) complété et validé.
2. Jeu de données représentatif et anonymisable.
3. Description d'un flux complet, de la ressource au résultat solveur attendu.
4. Matrice `capacité × ressources × paramètres requis`.
5. Matrice des rôles et droits.
6. Catalogue initial des règles bloquantes et avertissements.
7. Contrat JSON versionné ou exemple exécutable équivalent.
8. Jeu de résultats de référence du solveur.
9. Liste des décisions prises et questions reportées.
10. Correspondance validée entre tenant, BU, fournisseur, site et environnement PrintMaster.
11. Référentiels normalisés du pilote issus des listes machines, supports, prestations et certifications PrintMaster.
12. Schéma candidat des barèmes et corpus de tests unitaires.
13. Revue des formules, paramètres et entités candidates du PRD initial PrintFlow Pro.
14. Corpus chiffré de référence pour chaque catégorie de coût de production.
15. Contrat de résolution d'un contrat d'accès par clé locale ou principal externe authentifié.

## Critères de validation

- [ ] `J0-VAL-01` Un expert métier a validé le glossaire.
- [ ] `J0-VAL-02` Le pilote nomme précisément les familles de machines, matières, transports et opérations couvertes.
- [ ] `J0-VAL-03` Chaque champ requis par le solveur possède une définition, une unité et une règle d'absence.
- [ ] `J0-VAL-04` Le contrat indique s'il transporte un snapshot complet, un différentiel ou les deux.
- [ ] `J0-VAL-05` Les règles d'arrondi et les dates d'effet sont documentées.
- [x] `J0-VAL-06` Clariprint Data contient exclusivement les coûts de production ; marges, majorations, remises et prix de vente sont hors module.
- [ ] `J0-VAL-07` La profondeur de sous-traitance du MVP est décidée.
- [ ] `J0-VAL-08` Les règles nécessitant une seconde validation sont identifiées.
- [ ] `J0-VAL-09` Un JSON de référence peut être construit manuellement et soumis au validateur ou solveur de test.
- [ ] `J0-VAL-10` Les données de test ne contiennent aucun secret ni donnée confidentielle non autorisée.
- [ ] `J0-VAL-11` Les concepts PrintMaster retenus, remplacés ou écartés sont explicitement tracés.
- [ ] `J0-VAL-12` Les listes historiques ont été dédupliquées et validées avant de devenir des référentiels.
- [ ] `J0-VAL-13` La frontière fournisseur/site/environnement et la portée BU sont décidées.
- [ ] `J0-VAL-14` Le moteur officiel des tests de barèmes est identifié.
- [ ] `J0-VAL-15` Les formules du PRD initial sont classées comme entrées solveur, cas de test, responsabilité d'un autre module ou élément écarté.
- [ ] `J0-VAL-16` Les catégories de coûts de production et leur granularité sont décidées sans ambiguïté.
- [x] `J0-VAL-17` Aucun DTO, schéma ou service Clariprint Data n'accepte de marge, majoration, remise ou prix de vente.
- [ ] `J0-VAL-18` Les bornes temporelles, le fuseau et le comportement en cas de chevauchement des coûts datés sont spécifiés.
- [ ] `J0-VAL-19` Une référence de contrat externe ne vaut pas autorisation et le protocole fournissant le principal de confiance est défini.
- [ ] `J0-VAL-20` Un JSON de référence prouve que Clariprint Data transmet exclusivement des données techniques et des coûts de production.

## Preuves attendues

- compte rendu de validation métier ;
- fichiers de référence versionnés ou emplacement sécurisé documenté ;
- schéma JSON et exemples valides/invalides ;
- résultat du test de contrat ;
- décisions enregistrées dans le registre.

## Condition de sortie

J1 peut commencer lorsque `J0-VAL-01` à `J0-VAL-20` sont validés. Une question reportée doit avoir un propriétaire, une échéance et une solution temporaire explicitement non contractuelle.
