---
id: E_PIM.audit-classification-ERAM
title: E_PIM.audit-classification-ERAM — Reclassification 5 produits ERAM + ajout gamme kakemono
epic: EPIC-E6
feature: FEAT-E6-UNCLASSIFIED
specStatus: draft
deliveryStatus: not-started
owner: unassigned
source:
  system: notion
  pageId: 35dd0131973c819faa72da51815d1a5a
  url: https://app.notion.com/35dd0131973c819faa72da51815d1a5a
  originalStatus: "Pas commencé"
  originalSprint: "Sprint 4"
  originalPriority: "P1"
  originalEffort: "M"
  originalAssignee: "Arnaud"
  originalOffering: "Toutes"
  originalOrder: ""
  originalSources: "Cas de test KO"
  createdAt: "2026-05-11 09:04:22Z"
  lastEditedAt: "2026-05-11T09:04:00.000Z"
  importedAt: 2026-10-03
  archive: _archives-notion/2026-10-03/pages/E_PIM.audit-classification-ERAM.md
decisions: []
dependencies: []
supersedes: []
implementationRecords:
  - _bmad-output/implementation-artifacts/story-E_PIM.audit-classification-ERAM.md
---

# E_PIM.audit-classification-ERAM — Reclassification 5 produits ERAM + ajout gamme kakémono

> Tâche d'audit de données sur le catalogue d'un client pilote : corriger la gamme de 5 produits mal classés et ajouter la gamme manquante. Ce n'est pas une évolution du produit.

## Valeur métier

Il faut dire ce que cette entrée est : une correction de données sur un espace client, née d'une campagne de tests, pas une fonctionnalité. Elle n'apporte rien aux autres clients et ne sera jamais rejouée telle quelle.

Deux effets distincts, qu'il ne faut pas confondre :

- **La reclassification des 5 produits** vaut pour le seul catalogue du client pilote. Sa valeur est celle d'une anomalie de recette que l'on ferme avant de montrer le catalogue à ce client.
- **L'ajout de la gamme kakémono au référentiel** dépasse ce client : une gamme manquante au référentiel produit se manifestera chez tout client qui vend des kakémonos. C'est la seule partie de cette tâche qui a une portée générique, et c'est pour cette raison qu'elle devrait probablement être extraite et traitée à part.

## Besoin utilisateur

**En tant qu'**acheteur sur une boutique, **je veux** voir un badge de gamme correct sur chaque produit, **afin de** filtrer le catalogue avec une classification cohérente.

Ce besoin est générique ; la tâche décrite ici ne l'adresse que sur un catalogue précis.

## Comportement attendu

La tâche vise un état de données, pas un comportement logiciel. L'état attendu à l'issue :

1. La gamme kakémono existe dans le référentiel des gammes produit, où elle était absente lors de la constitution du référentiel.
2. L'espace du client pilote est abonné à cette gamme.
3. Les 3 affiches de vitrine qui portaient un badge de carterie portent un badge d'affiche.
4. Les 2 kakémonos — un format 85 × 200 cm et un enrouleur — qui portaient un badge de flyer portent un badge de kakémono.
5. Le filtre par gamme de la boutique propose la gamme kakémono et ramène les 2 produits concernés.
6. Les 21 autres produits du catalogue conservent leur classification.
7. La correction est rejouable : elle est portée par un script ou une migration idempotente, pas par une modification manuelle en base.

## Expérience utilisateur

Le seul effet visible pour un utilisateur est le badge porté par une carte produit et le contenu des filtres par gamme. Il n'y a ni écran, ni parcours, ni message à concevoir.

La cause racine identifiée par la source se situe en amont de l'affichage : le rattachement d'un produit à une gamme. La source précise que la chaîne d'enrichissement elle-même fonctionnait correctement au moment du constat.

## Règles métier

- `RM-01` — Un produit porte le badge de la gamme à laquelle il appartient réellement. Une affiche ne porte pas un badge de carterie, un kakémono ne porte pas un badge de flyer.
- `RM-02` — Une gamme présente dans le catalogue d'un client doit exister dans le référentiel des gammes produit. Un produit vendu sans gamme correspondante est une lacune du référentiel, pas un cas particulier du client.
- `RM-03` — L'abonnement d'un espace à une gamme est la condition pour que cette gamme apparaisse dans ses filtres.
- `RM-04` — Une correction de classification ne modifie que les produits visés. Toute variation sur un autre produit est une régression.
- `RM-05` — Toute correction de données est portée par un script rejouable et idempotent, de sorte qu'une réexécution ne produise ni doublon ni écrasement.
- `RM-06` — La granularité de la gamme kakémono relève d'un arbitrage et non d'un choix d'implémentation : une gamme unique avec variation par taille, ou des gammes distinctes pour l'enrouleur et le format standard.

## Critères d'acceptation

- `AC-01` — Étant donné le référentiel des gammes produit, quand on y recherche la gamme kakémono, alors elle existe.
- `AC-02` — Étant donné la gamme kakémono créée, quand on consulte les abonnements aux gammes de l'espace du client pilote, alors la gamme y figure et est active.
- `AC-03` — Étant donné le catalogue de ce client affiché en boutique, quand on relève les badges des 26 produits, alors aucune affiche ne porte un badge de carterie, aucun kakémono ne porte un badge de flyer, les 3 affiches portent un badge d'affiche et les 2 kakémonos un badge de kakémono.
- `AC-04` — Étant donné cette distribution corrigée, quand on active le filtre de la gamme kakémono, alors il ramène exactement les 2 produits concernés.
- `AC-05` — Étant donné les 21 autres produits du catalogue, quand on compare leur gamme avant et après correction, alors aucune n'a changé.
- `AC-06` — Étant donné le script de correction déjà appliqué, quand on l'exécute une seconde fois, alors l'état final est identique et aucune erreur n'est levée.
- `AC-07` — Étant donné le cas de test à l'origine du constat, quand il est rejoué, alors il ne relève plus aucun écart de classification.

## Cas limites

- **La base cible de cette correction n'existe peut-être plus.** `ADR-2026-10-01-C5` acte que le schéma est regroupé et assaini sur une nouvelle base technique et que **les données historiques ne sont pas conservées dans cette transition**. Les 5 lignes à corriger, l'abonnement aux gammes du client pilote et l'identifiant de boutique cités par la source appartiennent à l'ancienne base. Avant toute exécution, il faut établir si cette tâche a encore un objet.
- **La correction d'affichage a déjà eu lieu, pas nécessairement celle des données.** Le dépôt porte, dans `src/modules/catalog/ui/helpers/productEnrichment.ts`, un correctif daté du jour même du constat qui vise exactement cette confusion : un commentaire mentionne les kakémonos qui fuient dans les flyers et les affiches dans la carterie, et une table de discriminants par nom de produit tranche entre gammes concurrentes, dont une règle dédiée au kakémono et à l'enrouleur. La même source de vérité porte par ailleurs une résolution rendue autoritaire par la catégorie explicite du produit. Le symptôme visible a donc été traité en aval ; le rattachement en amont, que la source désigne comme la cause racine, n'est pas pour autant corrigé.
- **La gamme kakémono est partiellement présente dans le dépôt.** Une identité visuelle de gamme kakémono existe (`src/modules/catalog/ui/helpers/productFamilyIdentity.ts`) ainsi qu'un gabarit de rendu dédié (`src/modules/mockups/application/rendering/templates/kakemono.ts`). Le constat de la source — gamme absente du référentiel — est donc à revérifier avant d'agir : il peut avoir été résolu depuis.
- **Les chemins techniques de la source n'existent plus.** La source visait une fonction serveur de génération et un fichier d'amorçage sous une arborescence qui a disparu du dépôt. Les migrations vivent désormais sous `infra/postgres/`. Toute exécution doit être recadrée sur l'arborescence actuelle.
- **Le cas de test d'origine n'est pas rattaché.** La source désigne un cas de test précis comme origine du constat et comme preuve de clôture, mais la section `Vérification` ci-dessous ne référence aucun cahier de tests pour cette entrée. `AC-07` n'est donc pas rattachable en l'état.
- **Granularité non tranchée.** Une gamme kakémono unique ou deux gammes distinctes ne produisent pas les mêmes filtres ni les mêmes badges. `AC-03` et `AC-04` sont écrits pour l'hypothèse d'une gamme unique, qui est le défaut proposé par la source, pas une décision.
- **Audit non reproductible.** Rien n'indique que le même défaut de rattachement ne touche que ce client. La source ne prévoit aucun contrôle équivalent sur les autres catalogues.

## Hors périmètre

- La correction du mécanisme de rattachement produit-gamme en amont, que la source désigne comme la cause racine sans la traiter.
- L'audit de classification des catalogues des autres clients.
- La chaîne d'enrichissement produit elle-même, que la source déclare conforme au moment du constat.
- Toute évolution de l'affichage des badges ou des filtres de gamme.
- La définition générale du référentiel des gammes produit.

## Dépendances et décisions

- `ADR-2026-10-01-C5` (schéma de base regroupé et assaini) — décision postérieure et déterminante : les données historiques ne sont pas reprises. Elle conditionne l'existence même de l'objet de cette tâche.
- `ADR-2026-10-01-C1` — l'architecture cible n'utilise plus de fonctions Edge : la fonction serveur de génération citée par la source n'existe plus et les éléments de mise en œuvre hérités de l'import ont été retirés.
- Arbitrage externe attendu sur la granularité de la gamme kakémono, que la source attribue au partenaire Expert Solutions, avec pour défaut une gamme unique à variation par taille.
- Aucun prérequis bloquant côté interface n'est identifié par la source.
- Aucune dépendance n'est reportée en frontmatter : la source ne cite aucun identifiant de story existant.

## Vérification

_Aucun cahier de tests Notion ne référence cette story._

## Preuves relevées dans le dépôt

`deliveryStatus: not-started` — 1 story document BMAD sans signal d'implémentation.

Story documents BMAD (historique d'implémentation, non recopié) :

- `_bmad-output/implementation-artifacts/story-E_PIM.audit-classification-ERAM.md`

## Questions ouvertes

- **Une tâche d'audit ponctuelle a-t-elle sa place dans un backlog de stories ?** Elle ne décrit pas un comportement du produit, elle ne vaut que pour un client et une date, elle ne sera jamais rejouée, et ses critères portent sur des lignes de données plutôt que sur une capacité. Un backlog qui l'accueille mélange deux natures d'objets : ce que le produit doit savoir faire, et ce qu'il a fallu réparer une fois. La question est à trancher avant de la planifier.
- Cette tâche a-t-elle encore un objet après `ADR-2026-10-01-C5` ? Si les données du client pilote ne sont pas reprises, la partie reclassification tombe et seule la lacune du référentiel subsiste.
- La gamme kakémono manque-t-elle toujours au référentiel ? Le dépôt en porte déjà une identité visuelle et un gabarit de rendu ; le constat de la source doit être revérifié avant toute action.
- La cause racine — le rattachement produit-gamme en amont — est-elle traitée quelque part ? Le correctif d'affichage présent dans le dépôt masque le symptôme sans que rien n'indique que la donnée soit juste.
- Granularité : une gamme kakémono unique avec variation par taille, ou des gammes distinctes pour l'enrouleur et le format standard ? Qui tranche, et sous quel délai ?
- Le même défaut de rattachement touche-t-il d'autres catalogues clients ? Si oui, c'est le contrôle qu'il faut outiller, pas les 5 lignes qu'il faut corriger.
- Le cas de test d'origine doit-il être rattaché à cette entrée pour que `AC-07` soit vérifiable, ou la clôture passe-t-elle par un nouveau cas ?
- Si cette entrée est conservée, qui en est responsable ? La source l'attribue à une personne, pas à une équipe, ce qui confirme sa nature de tâche.
- Rattachement à une fonctionnalité produit à arbitrer (`FEAT-E6-UNCLASSIFIED` est un regroupement de migration), étant entendu que le rattachement à l'epic « Données & qualité » est lui-même discutable pour une tâche d'audit.
- Relecture produit requise : contenu issu d'un import, non approuvé.
