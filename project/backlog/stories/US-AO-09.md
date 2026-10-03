---
id: US-AO-09
title: Parc machine de démonstration AO
epic: EPIC-T08
feature: FEAT-T08-UNCLASSIFIED
specStatus: draft
deliveryStatus: not-started
owner: unassigned
source:
  system: notion
  pageId: 375d0131973c81ada658d2b67ff281a7
  url: https://app.notion.com/375d0131973c81ada658d2b67ff281a7
  originalStatus: "Pas commencé"
  originalSprint: "Backlog"
  originalPriority: "P2"
  originalEffort: ""
  originalAssignee: "Xavier"
  originalOffering: "Toutes"
  originalOrder: ""
  originalSources: "WM 03/06/2026"
  createdAt: "2026-06-04 13:30:45Z"
  lastEditedAt: "2026-06-04T13:30:00.000Z"
  importedAt: 2026-10-03
  archive: _archives-notion/2026-10-03/pages/US-AO-09.md
decisions:
  - PD-2026-10-01-B3
dependencies: []
supersedes: []
implementationRecords:
  - _bmad-output/implementation-artifacts/story-US-AO-09.md
---

# US-AO-09 — Parc machine de démonstration AO

> Constitue un parc machines crédible, dédié à la démonstration, pour que Magrit affiche de vrais prix pendant une démo d'AO sans attendre qu'un client ait paramétré le sien.

## Valeur métier

Une démo de module AO sans prix ne démontre rien : c'est le chiffrage qui fait la preuve. Or un prix réel suppose un parc machines paramétré, ce qui prend deux à trois heures chez un imprimeur (`T06.1`) et n'existe chez aucun prospect le jour de la démo. Un parc de démonstration lève ce verrou : l'équipe commerciale montre le produit en fonctionnement au lieu d'en décrire la promesse.

La source pose une contrainte explicite et structurante : **sans télescoper la roadmap bêta**. Autrement dit, ce parc doit être un décor de démonstration, pas un chantier qui détourne l'effort du produit — et surtout pas une donnée qui finirait par se retrouver en production.

## Besoin utilisateur

_Non formulé dans la source Notion._ Le bénéficiaire est celui qui fait la démonstration. Formulation à écrire en revue produit.

## Comportement attendu

1. Un parc machines, réel ou vraisemblable, est constitué pour la démonstration.
2. Il permet de produire des prix pendant une démo.
3. Le scénario de démonstration se joue de bout en bout.
4. Sa constitution ne détourne pas l'effort de la roadmap bêta.

**La source est muette** sur la nature du parc : parc réel d'un imprimeur partenaire, parc fictif construit pour l'occasion, ou moyenne de marché. Les trois n'engagent ni la même crédibilité ni les mêmes autorisations.

## Expérience utilisateur

- En démonstration, un prix invraisemblable détruit la crédibilité plus sûrement qu'une absence de prix. Les valeurs doivent être défendables devant un professionnel du print.
- Le scénario doit se rejouer à l'identique autant de fois que nécessaire : une démo qui ne repart pas d'un état propre est une démo qui échoue au deuxième rendez-vous.
- Celui qui fait la démo doit savoir, à l'écran, qu'il est sur des données de démonstration, sans que le prospect ait le sentiment d'une maquette.
- La latence est un point sensible connu sur ce produit : `US-DEMO-02` chiffre une attente d'environ 30 s côté Studio. Un scénario de démo doit l'assumer explicitement.
- **La source est muette** sur l'environnement de la démo, sur le nombre de machines, et sur la remise à zéro entre deux démonstrations.

## Règles métier

- `RM-01` — Un parc machines de démonstration existe et permet de calculer des prix.
- `RM-02` — Le scénario de démonstration AO est jouable de bout en bout.
- `RM-03` — La constitution de ce parc ne doit pas empiéter sur la roadmap bêta.
- `RM-04` — Les données de démonstration ne sont pas des données de production et doivent rester identifiables comme telles. **Règle posée ici au titre de la prudence, pas écrite dans la source** : à confirmer.

## Critères d'acceptation

- `AC-01` — Étant donné l'environnement de démonstration, quand le scénario AO est joué de bout en bout, alors il aboutit sans intervention manuelle hors scénario et produit des prix.
- `AC-02` — Étant donné des prix produits pendant la démonstration, quand un professionnel du print les examine, alors il les juge vraisemblables (**la source dit « parc machine ou ressemblant » sans définir de critère de vraisemblance**).
- `AC-03` — Étant donné une démonstration achevée, quand on en relance une autre, alors l'environnement repart dans son état initial (**cas non traité par la source ; posé ici au titre de l'exploitabilité, à confirmer**).
- `AC-04` — Étant donné le parc de démonstration, quand on en observe la mise en place, alors elle ne requiert aucun développement inscrit à la roadmap bêta (**« sans télescoper la roadmap bêta » est une contrainte de la source ; sa vérification reste à définir**).

## Cas limites

- **Origine des données.** Si le parc reprend les coûts réels d'un imprimeur partenaire, ce sont des données commercialement sensibles : leur usage en démonstration suppose une autorisation. La source ne dit pas d'où viennent les chiffres.
- **Fuite vers la production.** Un jeu de données de démonstration créé dans l'urgence finit souvent dans l'environnement réel. Rien n'est prévu pour l'en empêcher.
- **Couverture du parc.** `T06.1` énumère sept catégories de production (feuille offset, rotative offset, numérique, grand format, façonnage, packaging, reliure). Un parc de démonstration partiel fera échouer le scénario dès que le prospect demandera un produit hors couverture.
- **Vieillissement.** Un parc figé donne des prix qui dérivent du marché au fil des mois. Aucune règle de mise à jour n'est prévue.
- **Démonstration hors scénario.** Un prospect qui demande « et pour mon produit à moi ? » sort du chemin prévu : la source ne traite que le scénario nominal.

## Hors périmètre

- Le paramétrage du parc machines par un client réel (`T06.1`).
- Le prix marché et son agrégat (`T06.2`, `T06.WM1`, `T08.WM3`).
- Les fonctionnalités du module AO (`T08.A1` à `T08.A5`, `T08.WM1`).
- La gestion de la latence en démonstration (`US-DEMO-02`) et la passerelle de prix de démonstration (`US-DEMO-01`).

## Dépendances et décisions

- Aucune dépendance déclarée par la source ; le frontmatter reste vide. `T06.1` (paramétrage du parc machines) définit pourtant la structure de données que ce parc de démonstration doit remplir : sans elle, il n'y a rien à peupler.
- **Recouvrement à signaler.** `T06.WM1` (prix marché instantané, parc d'environ 10 imprimeurs préqualifiés), `US-DEMO-01` (module de pont vers un prix Clariprint réel) et cette story répondent toutes à la même question — « comment affiche-t-on un prix crédible avant qu'un client n'ait paramétré son parc ? » — par trois moyens différents : un agrégat de marché, un appel direct à Clariprint, un parc fictif. **Trancher lequel sert la démonstration évite d'en construire trois.**
- `PD-2026-10-01-B3` (modèle de sous-traitance), déclarée en frontmatter : la décision pose que les données d'un parc machines restent chez l'entité exploitante et qu'un tiers n'y accède pour calcul que sur autorisation par jeton. **Un parc de démonstration construit à partir de données d'un imprimeur réel entre directement dans ce cadre** : il lui faut un propriétaire, une autorisation et une date de révocation. Ce point n'est pas traité par la source.
- État du dépôt : un module de parcs machines existe (`src/modules/machine-parks/`), mais aucun jeu de données de démonstration n'est fourni — `scripts/db/seed-development.mjs` ne crée qu'un utilisateur et un tenant de développement. Aucun module AO n'existe : le scénario de démonstration AO n'a, à ce jour, rien à démontrer.
- Référence de provenance conservée : WM#030626, réf. 00:56:44 / 00:57:41.

## Vérification

_Aucun cahier de tests Notion ne référence cette story._

## Preuves relevées dans le dépôt

`deliveryStatus: not-started` — 1 story document BMAD sans signal d'implémentation.

Story documents BMAD (historique d'implémentation, non recopié) :

- `_bmad-output/implementation-artifacts/story-US-AO-09.md`

## Questions ouvertes

- Le parc de démonstration est-il celui d'un imprimeur réel, un parc fictif, ou une moyenne de marché ? Si des données réelles sont utilisées, qui en autorise l'usage ?
- Quel est le scénario de démonstration AO, pas à pas ? Sans scénario écrit, `AC-01` n'est pas vérifiable.
- Quelles catégories de production le parc doit-il couvrir parmi les sept de `T06.1` ?
- Dans quel environnement la démonstration se joue-t-elle, et comment le remet-on à zéro ?
- Qu'est-ce qui empêche ces données de se retrouver en production ?
- Qui maintient le parc et à quelle fréquence, pour que les prix restent vraisemblables ?
- Entre `T06.WM1`, `US-DEMO-01` et ce parc, lequel alimente réellement la démonstration ?
- Un parc de démonstration relève-t-il du cadre d'autorisation de `PD-2026-10-01-B3` ?
- Cette story a-t-elle encore un objet tant qu'aucune fonctionnalité AO n'existe ?
- Rattachement à une fonctionnalité produit à arbitrer (`FEAT-T08-UNCLASSIFIED` est un regroupement de migration).
- Relecture produit requise : contenu issu d'un import, non approuvé.
