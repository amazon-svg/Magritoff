---
id: US-INT-06
title: Dashboard de visualisation données ERP
epic: EPIC-E8
feature: FEAT-E8-UNCLASSIFIED
specStatus: draft
deliveryStatus: not-started
owner: unassigned
source:
  system: notion
  pageId: 375d0131973c815e9dfcfda8ce9bb622
  url: https://app.notion.com/375d0131973c815e9dfcfda8ce9bb622
  originalStatus: "Pas commencé"
  originalSprint: "Backlog"
  originalPriority: "P2"
  originalEffort: ""
  originalAssignee: "Xavier"
  originalOffering: "Technique"
  originalOrder: ""
  originalSources: "WM 03/06/2026"
  createdAt: "2026-06-04 13:30:45Z"
  lastEditedAt: "2026-06-04T13:30:00.000Z"
  importedAt: 2026-10-03
  archive: _archives-notion/2026-10-03/pages/US-INT-06.md
decisions: []
dependencies: []
supersedes: []
implementationRecords:
  - _bmad-output/implementation-artifacts/story-US-INT-06.md
---

# US-INT-06 — Dashboard de visualisation données ERP

> Restitue dans un tableau de bord lisible les données extraites d'un ERP client. La source rattache ce besoin à une prestation de services et le déclare hors du produit Magrit.

## Valeur métier

Il faut commencer par ce que la source dit d'elle-même : « Projet hors Magrit (AGE Services) ». Cette entrée ne décrit donc pas une capacité du produit, mais un livrable de prestation pour un client donné — la source cite un suivi de production chez un client nommé.

La valeur, telle que la source la laisse entendre, est celle d'une restitution : des données sont déjà extraites de l'ERP du client, et elles ne servent à rien tant qu'elles restent des exports. Le tableau de bord est le dernier maillon qui les rend exploitables par le client.

Aucune valeur pour le produit Magrit n'est formulée par la source, et il n'en est pas inventé ici.

## Besoin utilisateur

**La source ne formule pas de besoin utilisateur.** Elle livre une description et un critère, sans désigner ni le rôle qui utilise le tableau de bord, ni la décision qu'il y prend.

Ce que la source écrit : « Restituer les données extraites dans un dashboard propre (ex. suivi de production ICI) ».

La formulation du besoin est à produire en revue, et elle suppose d'abord d'identifier qui s'en sert.

## Comportement attendu

1. Des données sont extraites de l'ERP du client par un mécanisme antérieur, que cette entrée ne décrit pas.
2. Ces données alimentent un tableau de bord, construit à partir des exports et non d'une connexion directe à l'ERP.
3. Le tableau de bord est présentable au client — la source en reste là.

C'est tout ce que la source permet d'affirmer. Ni les indicateurs restitués, ni la périodicité, ni le destinataire ne sont précisés.

## Expérience utilisateur

**La source est muette sur l'intégralité de l'expérience** : aucun écran, aucun parcours, aucun indicateur, aucun public n'est décrit. Le seul qualificatif donné est « propre », et le seul critère « présentable » — deux jugements, pas des exigences.

Rien n'est posé ici à la place de la source.

## Règles métier

- `RM-01` — Le tableau de bord se construit à partir des données déjà extraites, pas d'une connexion directe à l'ERP du client.
- `RM-02` — La source rattache ce besoin à une prestation de services et le déclare explicitement hors du produit Magrit.
- `RM-03` — Le cas cité en exemple est un suivi de production chez un client nommé. Rien n'indique que le besoin soit généralisable à d'autres clients.

## Critères d'acceptation

**La source ne porte qu'un seul critère, et il n'est pas observable** : « Tableau de bord présentable à partir des exports ». « Présentable » est une appréciation, pas une condition vérifiable. Le critère est repris tel quel pour ne rien perdre, et son défaut est signalé.

- `AC-01` — Étant donné les données extraites de l'ERP du client, quand le tableau de bord est construit, alors il est jugé présentable au client (**non observable : la source ne définit ni le juge, ni les indicateurs attendus, ni le seuil d'acceptation**).

Aucun autre critère n'est dérivable de la source sans inventer des exigences.

## Cas limites

- **L'entrée se déclare hors périmètre.** Une entrée du backlog Magrit qui affirme relever d'un autre projet ne peut être ni planifiée, ni livrée, ni testée dans ce backlog. C'est son principal problème, avant toute considération fonctionnelle.
- **Recouvrement possible avec une capacité existante.** Le dépôt porte un module de suivi des étapes de production (`src/modules/production-steps/`). Le cas cité par la source est précisément un suivi de production chez un client. Rien n'établit si ce besoin recouvre cette capacité, s'en distingue, ou devrait s'y adosser.
- **Aucun élément ERP dans le dépôt.** La recherche dans `src/` ne retourne aucune notion d'ERP. L'état non commencé est confirmé.
- **Mécanisme d'extraction non décrit.** La source parle de « données extraites » comme d'un acquis. Ni la source de ces exports, ni leur format, ni leur fraîcheur ne sont documentés — or ce sont eux qui déterminent ce qu'un tableau de bord peut montrer.
- **Client unique.** Le besoin est formulé à partir d'un cas client. Aucun élément ne permet de savoir si le tableau de bord est spécifique à cet ERP et à ce client, ou s'il vise un modèle réutilisable.

## Hors périmètre

- L'extraction des données depuis l'ERP du client, que la source considère comme déjà réalisée.
- Toute connexion directe à un ERP tiers.
- Le suivi de production interne à Magrit.
- Par déclaration de la source elle-même : le produit Magrit, dont ce besoin est dit ne pas relever.

## Dépendances et décisions

- La source est une réunion de travail du 3 juin 2026, avec un horodatage de référence. Le contenu complet n'est pas versé dans le dépôt : seules la description et le critère cités ci-dessus sont disponibles.
- Un module de suivi des étapes de production existe dans le dépôt. L'articulation avec ce besoin n'est pas établie et doit l'être avant toute décision de conserver ou non cette entrée.
- Aucune dépendance n'est reportée en frontmatter : la source ne cite aucun identifiant de story existant.
- `ADR-2026-10-01-C1` — l'architecture cible n'utilise plus de fonctions Edge : aucun élément de mise en œuvre serveur hérité de l'import n'est conservé ici.

## Vérification

_Aucun cahier de tests Notion ne référence cette story._

## Preuves relevées dans le dépôt

`deliveryStatus: not-started` — 1 story document BMAD sans signal d'implémentation.

Story documents BMAD (historique d'implémentation, non recopié) :

- `_bmad-output/implementation-artifacts/story-US-INT-06.md`

## Questions ouvertes

- **Cette entrée a-t-elle sa place dans le backlog Magrit ?** Elle s'en exclut elle-même. Soit elle est sortie vers le suivi de la prestation concernée, soit elle est reformulée comme un besoin produit, auquel cas presque tout reste à écrire.
- Qui utilise ce tableau de bord, et quelle décision y prend-il ? Sans réponse, aucun indicateur ne peut être choisi.
- Quels indicateurs restitue-t-il ? La source n'en cite aucun.
- De quel ERP viennent les données, sous quel format, et à quelle fréquence sont-elles rafraîchies ?
- Que signifie « présentable », et qui en juge ? En l'état, `AC-01` ne peut pas être vérifié.
- Ce besoin recouvre-t-il le suivi des étapes de production déjà porté par le produit, ou s'agit-il d'un objet distinct ?
- Le tableau de bord est-il spécifique à un client, ou vise-t-il un modèle réutilisable ?
- Le compte rendu de la réunion du 3 juin 2026 peut-il être versé au dépôt ? La source actuelle est trop maigre pour spécifier quoi que ce soit.
- Rattachement à une fonctionnalité produit à arbitrer (`FEAT-E8-UNCLASSIFIED` est un regroupement de migration), étant entendu que le rattachement à l'epic « Catalogue & visu » est lui-même douteux pour un tableau de bord ERP.
- Besoin utilisateur absent de la source : il reste à formuler.
- Relecture produit requise : contenu issu d'un import, non approuvé.
