# Gouvernance produit, backlog et spécifications de Magrit

> **Statut : organisation adoptée, déploiement progressif.** L'atelier du 1er octobre 2026 (`MEET-2026-10-01-ATELIER`) a adopté Git comme source unique de gestion du projet et autorisé l'arborescence `project/`. Tout contenu produit par un agent reste néanmoins `draft` jusqu'à approbation humaine.

L'audit de correspondance disponible dans `docs/governance-audit/` constitue l'état initial de la migration. Il recense le corpus existant et empêche que `project/` devienne une source concurrente : les anciens artefacts restent historiques jusqu'à leur rapprochement explicite, tandis que toute nouvelle information de pilotage est créée dans `project/`.

## Objet du document

Ce document définit une organisation cible pour gérer dans Git la vision produit, les spécifications, le backlog, les user stories, les décisions, les sprints et les preuves de test de Magrit.

L'objectif est de supprimer Notion comme source de projet, de réduire les contradictions entre documents et de permettre à des personnes comme à des agents de travailler à partir d'un corpus explicite, versionné et vérifiable.

Cette organisation répond à la situation actuelle, dans laquelle les évolutions de Magrit proviennent de plusieurs modes de travail :

- spécifications saisies dans Notion, regroupées en sprints puis développées ;
- besoins et décisions décrits directement dans des conversations ;
- documents générés à partir de ces conversations, sans validation toujours explicite ;
- PRD, architecture, epics et stories produits selon une logique BMAD ;
- processus techniques sensibles pilotés avec un niveau de précision supérieur ;
- ajustements apportés directement pendant le développement et parfois décrits uniquement dans le code ou les tests.

Le but n'est pas de faire disparaître ces modes de travail. Il est de leur donner un circuit commun de validation et une destination canonique dans le dépôt.

## Décision directrice

Le dépôt Git devient la seule source officielle et durable du projet.

Une conversation, un compte rendu, un document généré ou une sortie BMAD peuvent préparer une décision ou une spécification, mais ne deviennent opposables qu'après relecture et intégration dans l'arborescence canonique du dépôt.

Le principe général est le suivant :

> Une information possède un emplacement canonique unique. Les autres documents la référencent par identifiant au lieu de la recopier.

Git apporte les propriétés nécessaires à cette organisation :

- historique des modifications ;
- identification de l'auteur et de la date ;
- comparaison entre deux versions ;
- revue par demande de fusion ;
- rattachement d'une décision au code et aux tests ;
- possibilité de retrouver l'état documentaire correspondant à une livraison ;
- lecture directe par les outils et les agents.

## Les trois vérités à distinguer

La documentation du projet doit distinguer trois natures d'information qui ne sont pas toujours identiques.

### Comportement actuel

Le comportement actuel correspond à ce que fait réellement le logiciel à une version donnée. Il peut être établi à partir :

- de l'application en fonctionnement ;
- du code ;
- du schéma de données et des migrations ;
- des tests exécutés ;
- des intégrations réelles ;
- de l'observation de parcours utilisateurs.

Ce comportement constitue une preuve de l'existant. Il ne prouve pas que le comportement est souhaité ou correctement spécifié.

### Intention produit

L'intention produit décrit ce que Magrit doit permettre, y compris lorsque le logiciel actuel est incomplet ou incorrect. Elle est portée par :

- la vision et le périmètre produit ;
- les principes fonctionnels ;
- les décisions métier validées ;
- les fonctionnalités et les spécifications approuvées ;
- les priorités de version.

L'intention produit ne doit pas être déduite automatiquement du code lorsqu'une décision humaine est nécessaire.

### Preuve de livraison

La preuve de livraison permet d'affirmer qu'une exigence a été réalisée et vérifiée. Elle peut prendre la forme :

- d'un test automatisé ;
- d'un scénario de recette manuelle ;
- d'une vérification par API ou en base ;
- d'une démonstration documentée ;
- d'une référence vers une demande de fusion et un commit.

Une fonctionnalité peut être développée sans être suffisamment vérifiée. Son statut doit alors l'indiquer explicitement.

## Arborescence cible

L'arborescence suivante est proposée comme destination canonique des artefacts de gestion de projet :

```text
project/
├── README.md
├── governance/
│   ├── source-of-truth.md
│   ├── workflow.md
│   ├── definition-of-ready.md
│   └── definition-of-done.md
│
├── prd/
│   ├── product-vision.md
│   ├── product-scope.md
│   ├── product-principles.md
│   └── domains/
│       ├── catalogue.md
│       ├── tarification.md
│       ├── devis-commandes.md
│       ├── boutiques.md
│       ├── utilisateurs-identites.md
│       └── studio.md
│
├── backlog/
│   ├── README.md
│   ├── epics/
│   ├── features/
│   └── stories/
│
├── meetings/
│   ├── README.md
│   ├── _template.md
│   └── 2026/
│       └── 2026-09-21-weekly-magrit.md
│
├── decisions/
│   ├── product/
│   └── architecture/
│
└── sprints/
    └── 2026-S05/
        ├── plan.md
        ├── scope.yaml
        ├── review.md
        └── retrospective.md

tests/
├── unit/
├── integration/
├── contract/
└── e2e/
```

Cette arborescence est active. Les sous-dossiers peuvent évoluer par décision enregistrée, mais la séparation de leurs responsabilités doit être conservée.

## Rôle des artefacts

### Gouvernance

Le dossier `project/governance` contient les règles de fonctionnement du corpus documentaire :

- la hiérarchie des sources ;
- le circuit de validation ;
- les statuts autorisés ;
- la règle de modification des spécifications ;
- les critères permettant de commencer une story ;
- les critères permettant de déclarer une story terminée ;
- les responsabilités de rédaction, de décision et de validation.

Les règles de gouvernance ne doivent pas être redéfinies dans chaque PRD ou chaque sprint.

### PRD

Le PRD décrit la raison d'être du produit, ses objectifs, ses utilisateurs, son périmètre et ses grands principes. Il répond principalement aux questions « pourquoi » et « quoi ».

Les documents de domaine peuvent préciser les principes structurants d'une famille de fonctionnalités. Par exemple, le domaine de la tarification peut expliquer le rôle de Clariprint, les règles générales de marge et les responsabilités respectives du catalogue, de la boutique et du commercial.

Le PRD ne doit pas devenir une accumulation de descriptions d'écrans, de tâches d'implémentation ou de cas de test détaillés.

### Epics

Une epic représente un grand résultat produit cohérent, par exemple la gestion commerciale, les boutiques ou Magrit Studio.

Elle contient :

- l'objectif recherché ;
- le périmètre ;
- les utilisateurs concernés ;
- les fonctionnalités associées ;
- les dépendances importantes ;
- les conditions générales de réussite.

### Fonctionnalités

Une fonctionnalité décrit une capacité reconnaissable du produit, par exemple créer un devis, rechercher un produit ou convertir un devis en commande.

Elle contient les règles communes aux stories qui la réalisent, sans entrer dans chaque détail d'implémentation.

Une fonctionnalité possède un identifiant stable et référence ses stories. Les stories référencent réciproquement leur fonctionnalité parente.

### User stories et spécifications

Une user story représente une évolution réalisable et vérifiable. Elle ne se limite pas à une phrase de type « En tant que ». Elle constitue l'unité de travail exploitable par un développeur ou un agent.

Une story contient au minimum :

- un identifiant stable ;
- un titre ;
- une epic et une fonctionnalité parentes ;
- le besoin utilisateur ;
- les règles métier applicables ;
- les critères d'acceptation ;
- les cas limites connus ;
- les dépendances ;
- les questions ouvertes ;
- les références vers les décisions ;
- les références vers les tests et les preuves d'exécution.

Le format existant dans `quality/specs` constitue une base pertinente. Il possède déjà des identifiants stables, des statuts documentaires, des critères d'acceptation, des méthodes de vérification et un mécanisme de validation automatique. Il devra être rapproché de l'arborescence cible plutôt que remplacé par un format concurrent.

`project/backlog` porte l'intention et le découpage de travail. `quality/specs` porte, lorsqu'elle est nécessaire, une représentation structurée et validable automatiquement. Une spécification de `quality/specs` référence donc la story canonique concernée ; elle n'en crée pas une seconde version fonctionnelle.

### Comptes rendus de réunion

Le dossier `project/meetings` conserve les comptes rendus des réunions de pilotage, ateliers, démonstrations, revues et arbitrages. Ces documents forment la mémoire chronologique du projet et constituent une matière d'entrée pour faire évoluer les autres artefacts.

Un compte rendu peut notamment conduire à :

- créer ou modifier un PRD ou un principe de domaine ;
- créer, modifier ou clôturer une epic ou une fonctionnalité ;
- créer ou réviser une story et ses critères d'acceptation ;
- enregistrer une décision produit ou une décision d'architecture ;
- créer ou modifier des tests ;
- modifier le périmètre d'un sprint ;
- ouvrir une action d'analyse lorsque la décision ne peut pas encore être prise.

Le compte rendu n'est toutefois pas une seconde spécification active. Il établit ce qui a été présenté, discuté ou décidé pendant la réunion. Les conséquences applicables doivent être reportées dans les documents canoniques concernés.

Une décision mentionnée uniquement dans un compte rendu reste en attente de propagation. Elle devient la règle applicable lorsque la décision et les spécifications affectées ont été mises à jour et fusionnées dans Git.

Chaque compte rendu contient au minimum :

- un identifiant stable ;
- la date et le type de réunion ;
- les participants et absents utiles ;
- le rédacteur et les personnes ayant validé le compte rendu ;
- l'objet et le contexte ;
- les informations présentées ;
- les décisions prises ;
- les questions ouvertes ;
- les actions, responsables et échéances ;
- les artefacts affectés ;
- l'état de propagation des décisions et actions.

Convention de nommage proposée :

```text
YYYY-MM-DD-type-sujet.md
```

Exemples :

```text
2026-09-21-weekly-magrit.md
2026-10-05-atelier-tarification.md
2026-10-12-revue-sprint-gestion-commerciale.md
```

Le statut de validation du compte rendu et l'état de propagation de ses conclusions sont suivis séparément :

```yaml
id: MEET-2026-09-21-WEEKLY
status: approved
propagationStatus: partial
date: 2026-09-21
type: weekly
participants:
  - Arnaud Mazon
  - Xavier Péchoultres
affectedArtifacts:
  - PD-014
  - FEAT-SEARCH-001
  - US-SEARCH-003
```

Statuts de propagation proposés :

- `pending` : aucune conséquence encore reportée ;
- `partial` : une partie des documents a été mise à jour ;
- `complete` : toutes les décisions et actions ont une destination ou une clôture explicite ;
- `not-applicable` : réunion d'information sans modification documentaire attendue.

Une matrice de propagation placée à la fin du compte rendu rend le suivi vérifiable :

| Élément | Nature | Artefacts affectés | Responsable | État | Référence de modification |
|---|---|---|---|---|---|
| D1 | Décision produit | `FEAT-SEARCH-001`, `US-SEARCH-003` | À attribuer | À reporter | — |
| A1 | Action | `SPEC-STUDIO-001` | À attribuer | En cours | — |

Une fois approuvé, le compte rendu reste un enregistrement historique. Une correction factuelle est réalisée par une nouvelle révision explicitement datée ; les évolutions ultérieures du produit modifient les artefacts canoniques, et non le récit de la réunion passée.

### Décisions

Le dossier `project/decisions` reçoit les arbitrages qui seraient autrement perdus dans les conversations ou les comptes rendus.

Deux catégories sont distinguées :

- décisions produit pour les règles métier, le périmètre et l'expérience attendue ;
- décisions d'architecture pour les choix techniques structurants.

Chaque décision contient au minimum :

- un identifiant ;
- un statut ;
- une date ;
- le décideur ;
- le contexte ;
- les options examinées ;
- la décision retenue ;
- sa justification ;
- ses conséquences ;
- les documents et composants affectés.

Une décision prise dans un chat ou enregistrée dans un compte rendu doit être reportée dans ce registre avant d'être considérée comme définitivement propagée au produit.

Les règles de ce document complètent `docs/REGLES_ARCHITECTURE.md`. Ce dernier reste opposable aux développements pour les contraintes techniques qu'il couvre. Une décision d'architecture plus récente doit identifier explicitement la règle qu'elle remplace ; en l'absence de cette mention, elle ne l'abroge pas.

### Sprints

Un sprint est une sélection temporelle de stories existantes. Il ne constitue pas une nouvelle source de spécification.

Le sprint décrit :

- son objectif ;
- les identifiants des stories sélectionnées ;
- les contraintes particulières de la période ;
- les responsabilités ;
- les résultats de la revue ;
- les éléments reportés ;
- la rétrospective.

Les exigences et critères d'acceptation ne sont pas recopiés dans le sprint. Le sprint les référence.

### Tests

Les tests restent proches du code dans les répertoires dédiés. Ils ne sont pas déplacés dans le dossier du sprint, car leur durée de vie dépasse généralement celle du sprint.

Chaque critère d'acceptation doit, lorsque cela est possible, référencer son moyen de vérification :

- test unitaire ;
- test d'intégration ;
- test de contrat ;
- test de bout en bout ;
- vérification SQL ;
- recette manuelle documentée.

Le sprint peut conserver un relevé des vérifications exécutées, mais ne doit pas dupliquer les tests.

## Hiérarchie des sources

La source de vérité dépend de la nature de l'information :

| Information | Source de référence |
|---|---|
| Vision et objectifs | PRD approuvé |
| Principe fonctionnel transversal | PRD de domaine approuvé |
| Arbitrage métier | Décision produit approuvée |
| Choix technique structurant | Décision d'architecture approuvée |
| Comportement attendu détaillé | Spécification ou story approuvée |
| Déroulement, échanges et conclusions d'une réunion | Compte rendu approuvé |
| Sélection du travail à court terme | Plan de sprint |
| Comportement réellement livré | Code et tests au commit considéré |
| Preuve de conformité | Tests et preuves d'exécution |
| Discussion ou exploration | Chat, sans autorité durable |
| Document généré automatiquement | Brouillon tant qu'il n'est pas approuvé |

À nature d'information identique, une décision datée et approuvée plus récente remplace la règle antérieure qu'elle désigne. Le fichier antérieur est alors mis à jour ou marqué `superseded` et référence son successeur. On ne se contente pas d'ajouter une note d'invalidation : la source canonique active doit rester lisible sans reconstituer toute la chronologie.

Les décisions A1 à A5 du 1er octobre 2026 précisent cette hiérarchie :

- Git est l'unique source active de gestion de projet ; aucune nouvelle saisie ni synchronisation courante n'est faite dans Notion ;
- le code livré et les tests exécutés décrivent le comportement actuel ;
- la décision de séance la plus récente l'emporte sur une story plus ancienne pour l'intention produit, après propagation ;
- toute nouvelle story recherche et met à jour les stories, spécifications et tests qu'elle remplace ;
- la cohérence est contrôlée par inventaire, validation et revue ciblée, sans régénération périodique complète du corpus par un LLM.

Un compte rendu approuvé fait foi sur le déroulement et les conclusions de la réunion, mais ne remplace pas les spécifications qu'il demande de modifier. Tant que la propagation n'est pas terminée, l'écart est visible et doit être traité comme une modification en attente.

En cas de contradiction, un agent ne choisit pas silencieusement une source. Il signale la contradiction et demande ou référence une décision.

## Statuts documentaires et statuts de livraison

Le statut d'une spécification doit être distinct du statut de son implémentation.

Statuts documentaires proposés :

- `draft` : contenu en préparation ;
- `review` : contenu soumis à validation ;
- `approved` : contenu officiel ;
- `superseded` : contenu remplacé par une autre spécification ;
- `deprecated` : contenu retiré sans être applicable aux nouveaux développements.

Statuts de livraison proposés :

- `not-started` ;
- `ready` ;
- `in-progress` ;
- `implemented` ;
- `verified` ;
- `released` ;
- `blocked` ;
- `cancelled`.

Exemple :

```yaml
id: US-QUOTE-014
specStatus: approved
deliveryStatus: verified
```

Cette séparation évite qu'une story développée soit automatiquement considérée comme correctement spécifiée ou complètement testée.

## Gestion d'une évolution qui modifie une spécification antérieure

Une nouvelle fonctionnalité peut modifier un comportement défini par une spécification précédente. Le dépôt ne doit pas conserver deux règles actives contradictoires.

Le principe applicable est le suivant :

> Une seule spécification active décrit le comportement actuellement attendu. Git et les documents de décision conservent l'historique du changement.

### Évolution additive

Lorsque la nouvelle fonctionnalité ajoute un comportement sans modifier l'existant :

- la spécification existante est conservée ;
- de nouveaux critères sont ajoutés ou une nouvelle spécification complémentaire est créée ;
- la nouvelle story référence les éléments ajoutés.

### Modification partielle

Lorsque la nouvelle fonctionnalité modifie une partie du comportement existant :

- la spécification initiale reste la spécification canonique ;
- sa révision est incrémentée ;
- les critères concernés sont modifiés ou dépréciés ;
- les nouveaux critères remplacent explicitement les anciens ;
- la modification référence la story et la décision à son origine ;
- les tests sont mis à jour dans la même évolution.

Exemple :

```yaml
id: SPEC-QUOTE-001
revision: 4
status: approved

changeHistory:
  - revision: 4
    date: 2026-10-05
    story: US-QUOTE-042
    decision: PD-014
    summary: Le devis envoyé peut désormais être révisé.

acceptanceCriteria:
  - id: AC-07
    status: deprecated
    description: Un devis envoyé ne peut plus être modifié.
    deprecatedBy: AC-12

  - id: AC-12
    status: active
    description: Un devis envoyé peut être révisé en créant une nouvelle version.
```

### Remplacement complet

Lorsque le modèle fonctionnel change entièrement, l'ancienne spécification est marquée comme remplacée et référence la nouvelle :

```yaml
id: SPEC-SEARCH-001
status: superseded
supersededBy: SPEC-SEARCH-004
```

La nouvelle spécification déclare réciproquement :

```yaml
id: SPEC-SEARCH-004
status: approved
supersedes:
  - SPEC-SEARCH-001
```

### Suppression d'une fonctionnalité

Lorsqu'une fonctionnalité disparaît sans remplacement, sa spécification est marquée `deprecated`. La décision de retrait, la version concernée et les effets sur les données ou les utilisateurs doivent être documentés.

### Règle de lisibilité

Après chaque évolution, un lecteur qui consulte uniquement les spécifications actives doit comprendre le comportement attendu sans devoir reconstituer toute l'histoire du projet.

Il faut donc éviter :

- de laisser deux spécifications approuvées se contredire ;
- de déclarer une spécification invalidée sans définir son remplacement ;
- d'effacer une règle sans expliquer le changement ;
- de multiplier les fichiers `v1`, `v2`, `final` et `final-2` ;
- de considérer la nouvelle story comme la seule description du comportement final.

Git conserve les versions historiques. Les tags et commits permettent de retrouver les spécifications correspondant à chaque livraison.

## Workflow d'une évolution

Le chemin normal d'une évolution est le suivant :

```text
Idée, besoin, réunion ou discussion
        ↓
Compte rendu ou brouillon de fonctionnalité, story ou décision
        ↓
Analyse d'impact sur les spécifications existantes
        ↓
Validation produit et, si nécessaire, technique
        ↓
Mise à jour de la spécification canonique
        ↓
Planification dans un sprint
        ↓
Code et tests
        ↓
Revue et vérification
        ↓
Livraison et preuves
```

La demande de fusion d'une évolution devrait idéalement contenir ou référencer :

1. la story décrivant le changement ;
2. la décision produit ou technique lorsqu'un arbitrage était nécessaire ;
3. la modification de la spécification canonique ;
4. la modification du code ;
5. la mise à jour des tests ;
6. la mise à jour des liens entre critères et preuves.

Pour les sujets complexes, la spécification et la décision peuvent être approuvées dans une demande de fusion préalable à l'implémentation.

### Workflow d'un compte rendu

Un compte rendu suit un cycle spécifique afin que les conclusions d'une réunion ne restent pas isolées :

```text
Réunion
        ↓
Rédaction du compte rendu en statut draft
        ↓
Relecture par les participants concernés
        ↓
Approbation du compte rendu
        ↓
Extraction des décisions, actions et impacts
        ↓
Création ou modification des artefacts canoniques
        ↓
Revue et fusion des modifications
        ↓
Mise à jour de propagationStatus à complete
```

Le passage du compte rendu au statut `approved` valide la fidélité du relevé. Il ne signifie pas encore que toutes ses conséquences ont été appliquées. Le champ `propagationStatus` rend cette différence visible.

La propagation est considérée comme complète lorsque chaque décision ou action possède l'une des issues suivantes :

- un document canonique créé ou mis à jour ;
- une décision explicitement enregistrée ;
- une story créée ;
- une action clôturée avec une preuve ;
- un classement sans suite accompagné d'une justification.

## Place des conversations et des documents générés

Les conversations restent utiles pour :

- explorer un besoin ;
- comparer des options ;
- préparer une décision ;
- rédiger un premier jet ;
- analyser un incident ou une contradiction.

Elles ne constituent pas une source officielle, car leur contenu peut être incomplet, difficile à retrouver ou dépendant du contexte de la session.

Toute sortie issue d'une conversation porte initialement le statut `draft`. Elle devient officielle uniquement après :

- intégration dans le bon emplacement ;
- attribution d'un identifiant stable ;
- relecture humaine ;
- passage au statut `approved` ;
- fusion dans la branche de référence.

## Place de BMAD

BMAD peut continuer à produire des PRD, architectures, epics, stories et plans. Ses sorties doivent cependant suivre le même circuit de validation que les autres documents.

Le dossier `_bmad-output` est considéré comme un espace de génération ou de préparation, et non comme la source officielle définitive.

```text
Processus BMAD
        ↓
_bmad-output
        ↓
Relecture et correction
        ↓
Demande de fusion
        ↓
project/prd, project/backlog ou project/decisions
```

Une configuration ultérieure pourra faire produire BMAD directement dans l'arborescence canonique lorsque les modèles, schémas et contrôles seront stabilisés.

## Niveau de confiance et vérifiabilité

Il n'est pas réaliste de supposer que toutes les fonctionnalités actuelles peuvent immédiatement être reproduites à partir des documents existants.

Chaque fonctionnalité peut recevoir un niveau de confiance :

- `specified-and-tested` : spécifiée et couverte par une preuve suffisante ;
- `specified-manually-verified` : spécifiée et vérifiée manuellement ;
- `specified-not-verified` : spécifiée mais non vérifiée ;
- `observed-not-specified` : comportement observé sans spécification fiable ;
- `contradictory` : sources incompatibles ;
- `unknown` : comportement ou intention non établi.

La priorité de consolidation doit être fondée sur le risque :

- critique : tarification, marges, TVA, sécurité, données clients, isolation des espaces, Clariprint ;
- importante : devis, catalogue, recherche, commandes, panier, documents et notifications ;
- secondaire : fonctions peu utilisées, présentation ou confort sans risque métier immédiat.

L'objectif initial n'est pas de déclarer tout le logiciel reproductible. Il est de savoir précisément quelles parties le sont, lesquelles restent incertaines et quelles décisions sont nécessaires.

## Migration depuis Notion

Notion est gelé comme source active. Sa sortie s'effectue par une migration unique et contrôlée :

1. geler les nouvelles saisies dans Notion ;
2. exporter une archive complète et datée ;
3. inventorier les pages et bases utiles ;
4. rapprocher chaque élément des fichiers Git existants ;
5. importer les informations avec le statut `draft` ;
6. conserver l'identifiant et l'URL d'origine à titre de traçabilité historique ;
7. détecter les doublons et contradictions ;
8. faire approuver progressivement les éléments prioritaires ;
9. conserver l'export final comme archive non active ;
10. conserver Notion ou son export uniquement comme archive datée non active.

L'import d'une page Notion conserve une information historique. Il ne valide pas automatiquement son contenu.

Le périmètre initial comprend toutes les stories de la base Magrit, dont les 146 stories au statut « Pas commencé ». Leur `deliveryStatus` est déterminé à partir du code et des tests, jamais recopié automatiquement depuis Notion.

## Migration du dépôt actuel

La restructuration ne doit pas commencer par le déplacement massif des centaines de documents existants. Elle doit être progressive.

### Étape 0 — Auditer la correspondance avec l'existant

L'audit de correspondance initial est disponible dans `docs/governance-audit/`. Il couvre `quality/specs`, `docs/spec`, `_bmad-output`, les PRD historiques, `docs/REGLES_ARCHITECTURE.md` et `SPRINT_HANDOFF.md`. Il doit être actualisé lorsque la migration Notion apporte de nouveaux éléments.

### Étape 1 — Définir les règles

- appliquer la présente organisation ;
- fixer les rôles de décision et de validation ;
- choisir les conventions d'identifiants ;
- stabiliser les schémas de fichiers ;
- préciser la Definition of Ready et la Definition of Done.

### Étape 2 — Créer le squelette

- maintenir l'arborescence `project` ;
- ajouter les modèles de PRD, fonctionnalité, story, compte rendu et décision ;
- mettre en place les contrôles automatiques de structure et de liens.

### Étape 3 — Migrer le backlog Notion une fois

- exporter l'archive datée ;
- importer les epics, fonctionnalités et stories au statut `draft` ;
- produire le rapport de migration et les contradictions ;
- ne plus effectuer de synchronisation bidirectionnelle ou périodique.

### Étape 4 — Réaliser un pilote

- choisir un parcours critique et limité ;
- rassembler le PRD, les décisions, fonctionnalités et stories correspondantes ;
- les relier au code et aux tests ;
- vérifier que le corpus permet réellement de comprendre et modifier ce parcours.

### Étape 5 — Consolider par domaine

- traiter les domaines par priorité métier et risque ;
- marquer les contradictions au lieu de les résoudre par supposition ;
- archiver les documents remplacés ;
- produire un rapport de couverture documentaire par domaine.

### Étape 6 — Assainir les anciens emplacements

- supprimer les duplications après validation de la migration ;
- transformer `_bmad-output` en espace non canonique ;
- remplacer le document global de handoff par des synthèses plus petites et structurées ;
- adapter les scripts et agents aux nouveaux chemins.

## Critères de réussite

La nouvelle organisation sera considérée comme opérationnelle lorsque :

- toute fonctionnalité active possède un identifiant stable ;
- une seule spécification active définit chaque comportement ;
- les réunions utiles possèdent un compte rendu versionné et validé ;
- les décisions issues des réunions et chats sont enregistrées dans Git ;
- chaque compte rendu indique si ses conclusions ont été complètement propagées ;
- les sprints référencent les stories sans en recopier le contenu ;
- les critères critiques possèdent une méthode de vérification ;
- les documents générés sont identifiables comme brouillons avant validation ;
- un agent signale les contradictions au lieu de les résoudre implicitement ;
- un tag Git permet de retrouver les spécifications correspondant à une livraison ;
- Notion n'est plus nécessaire pour comprendre ou piloter le produit.

## Conclusion

La suppression de Notion ne suffit pas à résoudre les difficultés actuelles. Le résultat dépend de la capacité à définir un emplacement canonique pour chaque information, un circuit explicite de validation et une traçabilité entre intention, décision, implémentation et preuve.

La chaîne cible est la suivante :

```text
Vision et principes produit
        ↓
Comptes rendus et décisions
        ↓
Epics et fonctionnalités
        ↓
Stories et critères d'acceptation
        ↓
Sprints
        ↓
Code et tests
        ↓
Preuves de vérification
```

Cette organisation permet de conserver un pilotage technique précis sans créer une deuxième source fonctionnelle. Elle permet également d'utiliser les conversations et BMAD comme outils de production, tout en réservant le statut de référence aux documents relus, approuvés et versionnés dans Git.
