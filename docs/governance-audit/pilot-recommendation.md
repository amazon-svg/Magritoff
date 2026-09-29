# Recommandation de pilote pour la consolidation des spécifications

## Choix du pilote

Le pilote recommandé est la fonctionnalité E10.15 relative aux notifications multicanal.

Ce périmètre est préférable à une migration complète d'E10 pour une première expérimentation. Il est suffisamment limité pour être relu, mais contient presque toutes les difficultés de gouvernance rencontrées dans le dépôt :

- une story fonctionnelle parente issue de Notion ;
- cinq lots techniques documentés : E10.15a, E10.15b, E10.15c, E10.15d-1 et E10.15d-2 ;
- une partie E10.15e différée et sans story document ;
- un statut Notion parent « Pas commencé » alors que plusieurs lots sont développés ;
- des décisions de produit et d'architecture ;
- un contrat OpenAPI ;
- des migrations SQL ;
- une interface utilisateur ;
- des traitements asynchrones ;
- des références nombreuses vers les tests ;
- des informations complémentaires dans `docs/api/CONVENTIONS.md` et `SPRINT_HANDOFF.md`.

Le pilote doit consolider l'information, pas modifier le comportement du logiciel.

## Question à laquelle le pilote doit répondre

Le pilote doit établir s'il est possible de produire une source Git unique qui permette à un lecteur ou à un agent de comprendre :

1. le comportement attendu de la fonctionnalité ;
2. les parties effectivement livrées ;
3. les parties différées ;
4. les décisions qui expliquent le découpage ;
5. les tests qui prouvent chaque critère ;
6. les réserves encore ouvertes ;
7. les documents techniques qui restent opposables.

Si cette consolidation exige de recopier intégralement les mêmes informations dans plusieurs fichiers, le modèle cible doit être corrigé avant toute extension.

## Sources du pilote

### Fonctionnel et livraison

- `_bmad-output/implementation-artifacts/story-E10.15.md` ;
- `_bmad-output/implementation-artifacts/story-E10.15a.md` ;
- `_bmad-output/implementation-artifacts/story-E10.15b.md` ;
- `_bmad-output/implementation-artifacts/story-E10.15c.md` ;
- `_bmad-output/implementation-artifacts/story-E10.15d-1.md` ;
- `_bmad-output/implementation-artifacts/story-E10.15d-2.md`.

### Architecture et contrat

- `docs/api/CONVENTIONS.md`, notamment le cadrage E10.15 ;
- `openapi/magrit-core.v1.yaml` ;
- `docs/REGLES_ARCHITECTURE.md` ;
- migrations et modules de notifications concernés.

### État, décisions et preuves

- `SPRINT_HANDOFF.md` ;
- tests des modules de notifications ;
- tests de contrat ;
- tests SQL ;
- tests de composition de l'outbox et de l'API.

Les story documents E10.15 citent 17 chemins de tests uniques. Cette liste contient à la fois des preuves directes et des tests mentionnés comme échecs extérieurs au périmètre. Le pilote doit les classifier au lieu de les considérer tous comme des preuves.

## Livrables proposés

Le pilote devrait produire, dans une demande de fusion distincte :

1. une spécification fonctionnelle E10.15 conforme à une version pilote du schéma `quality/specs` ;
2. une table de relation entre E10.15 et ses lots ;
3. une matrice entre critères d'acceptation et preuves ;
4. les décisions produit et techniques nécessaires à la compréhension du comportement courant ;
5. une liste des informations restant uniquement dans le handoff ou les chats ;
6. une proposition de simplification du story document ;
7. un rapport de retour d'expérience sur le schéma et le workflow.

Le chemin du fichier pilote n'est pas arrêté par cet audit. L'hypothèse la moins disruptive est :

```text
quality/specs/notifications/e10-15-notifications.spec.yaml
```

Ce chemin doit être confirmé seulement après vérification de la compatibilité du schéma.

## Modèle de relations à tester

La spécification parente doit décrire le comportement fonctionnel global. Les lots doivent décrire la livraison sans recopier l'intégralité du périmètre parent.

Exemple indicatif :

```yaml
id: E10.15
title: Notifications multicanal
specStatus: review
deliveryStatus: partial
children:
  - E10.15a
  - E10.15b
  - E10.15c
  - E10.15d-1
  - E10.15d-2
  - E10.15e
```

Pour un lot :

```yaml
id: E10.15c
parent: E10.15
specStatus: approved
deliveryStatus: verified
scopeSummary: Envoi sur l'événement order.step_changed
```

Ces champs sont des hypothèses du pilote, pas encore une extension approuvée du schéma.

## Matrice de tests attendue

Chaque critère fonctionnel doit être relié à une ou plusieurs preuves avec une nature explicite :

| Critère | Preuve | Nature | État |
|---|---|---|---|
| AC-01 | `tests/contract/notifications.contract.test.ts` | Contrat direct | À confirmer |
| AC-02 | `tests/modules/notifications/notification-event-catalog.test.ts` | Test unitaire direct | À confirmer |
| AC-03 | `tests/sql/gescom-e10-15c-notification-dispatch.sql` | Test d'intégration SQL | À confirmer |
| AC-04 | Recette de l'écran de paramétrage | Recette manuelle | À documenter |

Les identifiants AC ci-dessus sont illustratifs. Le pilote doit conserver ou attribuer des identifiants stables après rapprochement avec les critères réels.

Les catégories de preuves proposées sont :

- `direct` : vérifie explicitement le critère ;
- `transverse` : protège une règle partagée ;
- `manual` : recette humaine documentée ;
- `incidental` : mention dans le document, mais pas preuve du critère ;
- `missing` : aucune preuve disponible.

## Décisions à extraire

Le pilote doit identifier, sans les réinventer, les décisions relatives notamment :

- au catalogue d'événements ;
- au regroupement des notifications ;
- au rendu différé de certaines balises ;
- à l'ordre des consommateurs de l'outbox ;
- au journal et à sa rétention ;
- à l'activation opérationnelle des envois ;
- au report du canal SMS et du choix de fournisseur.

Une décision ne doit être extraite de `docs/api/CONVENTIONS.md` ou du handoff que si son contexte, son auteur ou approbateur et ses conséquences peuvent être établis. Dans le cas contraire, elle reste une question ouverte.

## Rôles requis pour le pilote

Avant le passage de la spécification au statut `approved`, les rôles suivants doivent être attribués :

- autorité produit pour valider le comportement fonctionnel ;
- autorité technique pour valider le contrat et les décisions d'architecture ;
- préparateur chargé de la consolidation ;
- relecteur chargé de vérifier la traçabilité vers le code et les tests.

Le préparateur peut être un agent. L'approbation produit ou technique doit rester attribuée à un rôle humain explicite.

## Étapes d'exécution

### Étape 1 — Extraction sans réécriture

- extraire le périmètre parent et les scopes propres aux lots ;
- recenser les décisions ;
- recenser les critères ;
- recenser les tests et migrations cités ;
- signaler les contradictions sans les résoudre.

### Étape 2 — Modélisation

- créer une spécification pilote ;
- représenter les relations parent-enfant ;
- séparer `specStatus`, `deliveryStatus` et l'état de revue ;
- marquer E10.15e comme différée, sans inventer son contenu.

### Étape 3 — Traçabilité

- relier chaque critère à une preuve ;
- exécuter les tests proportionnés au pilote si l'environnement le permet ;
- distinguer les références pertinentes des mentions incidentes ;
- consigner les absences de preuve.

### Étape 4 — Validation

- faire relire le contenu produit ;
- valider les décisions produit et techniques ;
- exécuter `pnpm specs:validate` ;
- vérifier qu'aucune règle active n'a été perdue.

### Étape 5 — Retour d'expérience

- mesurer le temps de consolidation ;
- relever les champs manquants dans le schéma ;
- identifier les duplications restantes ;
- décider si le modèle peut être appliqué à tout E10 ;
- décider si une nouvelle arborescence apporte une valeur.

## Critères de réussite

Le pilote est réussi si :

- une seule source Git permet de comprendre le comportement fonctionnel courant d'E10.15 ;
- le statut global et les statuts des lots ne se contredisent plus ;
- la partie différée est explicite ;
- chaque décision structurante possède une origine et un statut ;
- chaque critère critique possède une preuve ou une lacune déclarée ;
- les documents techniques opposables restent référencés sans être recopiés ;
- le validateur accepte la spécification ;
- le story document peut être simplifié sans perte d'information ;
- la maintenance normale ne demande pas de modifier plus de deux artefacts canoniques pour un même changement.

## Critères d'arrêt

Le pilote doit être suspendu et le modèle revu si :

- le schéma impose de perdre des informations nécessaires ;
- la source d'une règle fonctionnelle ne peut pas être établie ;
- plusieurs documents doivent rester simultanément autoritaires pour le même comportement ;
- les critères ne peuvent pas être reliés à des preuves sans interprétation excessive ;
- l'approbateur produit ou technique n'est pas identifié ;
- la consolidation exige une modification fonctionnelle du logiciel.

## Extension après réussite

Après validation d'E10.15, l'ordre recommandé est :

1. E10.17 à E10.20, qui partagent fichiers, commandes et parcours client ;
2. le reste d'E10 ;
3. un domaine hors E10 afin de vérifier que le modèle n'est pas spécifique à la gestion commerciale ;
4. seulement ensuite, migration industrielle des autres stories.
