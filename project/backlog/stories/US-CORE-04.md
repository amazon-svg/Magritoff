---
id: US-CORE-04
title: Reprise from scratch sur cahier des charges stack
epic: EPIC-E7
feature: FEAT-E7-UNCLASSIFIED
specStatus: draft
deliveryStatus: not-started
owner: unassigned
source:
  system: notion
  pageId: 375d0131973c81f09797e1002d35eadc
  url: https://app.notion.com/375d0131973c81f09797e1002d35eadc
  originalStatus: "Pas commencé"
  originalSprint: "Backlog"
  originalPriority: "P0"
  originalEffort: ""
  originalAssignee: "Laurent"
  originalOffering: "Technique"
  originalOrder: ""
  originalSources: "WM 03/06/2026"
  createdAt: "2026-06-04 13:30:45Z"
  lastEditedAt: "2026-06-04T13:30:00.000Z"
  importedAt: 2026-10-03
  archive: _archives-notion/2026-10-03/pages/US-CORE-04.md
decisions: []
dependencies: []
supersedes: []
implementationRecords:
  - _bmad-output/implementation-artifacts/story-US-CORE-04.md
---

# US-CORE-04 — Reprise from scratch sur cahier des charges stack

> Demandait de repartir d'une base technique durable, choisie après étude comparative et analyse contradictoire, en capitalisant sur les spécifications plutôt que sur le code de démonstration.

**Story largement dépassée par les faits — à passer en `deprecated`, avec un reste réel.** Ce qu'elle demandait a eu lieu, mais pas dans l'ordre qu'elle prescrivait.

- **La reprise technique est faite.** L'atelier du 1er octobre 2026 a acté — et constaté comme déjà réalisées — les décisions `ADR-2026-10-01-C1` (plus de fonctions Edge), `C2` (PostgreSQL, stockage objet compatible S3 et Mailpit en conteneurs posés par les scripts du dépôt), `C4` (contrat d'API unique) et `C5` (schéma regroupé et assaini, données historiques non reprises). La bascule hors de Supabase est effective dans le dépôt : plus de dossier `supabase/`, 85 migrations numérotées dans `infra/postgres/migrations/`, un serveur applicatif propre dans `src/server/`.
- **La capitalisation sur les spécifications est faite aussi.** La migration du 3 octobre 2026 a versé le backlog, les décisions et la gouvernance dans `project/`, et `project/governance/source-of-truth.md` établit Git comme source unique. C'est exactement ce que demandait la story : « capitaliser sur stories/epics/doc, pas sur le code POC ».
- **Ce qui n'a pas eu lieu, c'est la méthode.** La story demandait une **étude comparative de stack documentée** et une **stack validée en analyse contradictoire avant code**. Les décisions d'architecture tiennent chacune en une à trois phrases et ne portent ni comparaison d'options, ni critères, ni contre-arguments. La décision a été prise et exécutée ; sa justification n'est pas écrite.

**Ce qui survit.** Deux choses, qui ne sont pas la même : documenter après coup pourquoi ce socle a été retenu, pour que le choix soit défendable et révisable ; et instaurer la règle qu'un choix structurant passe par une analyse contradictoire avant d'être codé. La première est un travail borné, la seconde une règle de gouvernance.

## Valeur métier

Un choix de socle technique engage dix ans de maintenance et conditionne qui pourra reprendre le code. Quand il est pris sans trace écrite, deux choses se perdent : la capacité à le défendre devant un tiers — client, investisseur, nouveau développeur — et la capacité à le réviser, parce qu'on ne sait plus ce qu'on avait écarté ni pourquoi. Écrire la justification après coup coûte une journée ; ne pas l'écrire coûte chaque fois que la question reviendra.

## Besoin utilisateur

**En tant que** responsable du produit, **je veux** que le socle technique soit choisi sur critères documentés et confronté avant d'être codé, **afin de** tenir un engagement de maintenabilité à long terme et de pouvoir justifier le choix retenu.

## Comportement attendu

Sans objet sous forme de comportement logiciel : il s'agit d'une exigence de méthode. Déroulé attendu, en deux volets :

1. Une note compare les options de socle sur des critères explicites — robustesse, maintenabilité à dix ans, performance côté client et côté serveur, disponibilité des compétences, coût d'exploitation.
2. Chaque option est confrontée, arguments contre compris, avant toute décision.
3. La décision retenue est enregistrée avec ses motifs et ses options écartées.
4. Les spécifications sont la matière reprise ; le code de démonstration n'est pas réputé faire autorité.

## Expérience utilisateur

Story sans surface utilisateur. Son public est l'équipe technique et les tiers à qui le choix doit être expliqué.

## Règles métier

- `RM-01` — Un choix de socle technique structurant est documenté avant d'être engagé : options, critères, option retenue, options écartées et motifs.
- `RM-02` — La décision passe par une analyse contradictoire : les arguments contre sont écrits, pas seulement entendus.
- `RM-03` — Le critère de maintenabilité à long terme prime sur la vitesse de mise en œuvre immédiate.
- `RM-04` — Les spécifications font foi sur le code de démonstration. Un comportement présent dans le code de démonstration et absent des spécifications n'est pas une exigence.
- `RM-05` — Une décision d'architecture enregistrée porte ses motifs. Une décision réduite à son énoncé n'est pas révisable.

## Critères d'acceptation

_La source ne porte pas de critères formels : elle énonce deux exigences — « étude comparative de stack documentée » et « stack validée en analyse contradictoire avant code ». Les critères ci-dessous les déclinent, en tenant compte du fait que la bascule a déjà eu lieu._

- `AC-01` — Étant donné le socle technique en place, quand on cherche la note qui le justifie, alors elle existe, nomme les options examinées, les critères retenus et les motifs du choix. **Non tenu** : `project/decisions/architecture/` porte cinq décisions dont l'énoncé tient en une à trois phrases, sans comparaison ni motifs.
- `AC-02` — Étant donné cette note, quand on la lit, alors elle porte aussi les arguments contre l'option retenue. **Non tenu.**
- `AC-03` — Étant donné les spécifications migrées, quand on les confronte au code en place, alors les écarts sont identifiés et tranchés, le code de démonstration ne valant pas exigence. **Partiellement engagé** : c'est l'objet de la passe de qualité en cours sur le backlog.
- `AC-04` — Étant donné un futur choix structurant, quand il est engagé, alors la règle d'analyse contradictoire préalable lui est opposable et inscrite dans la gouvernance. **Non tenu** : rien dans `project/governance/` ne l'impose aujourd'hui.

## Cas limites

- **L'ordre a été inversé.** La story demandait l'étude avant le code ; le code est là, l'étude non. On ne peut donc plus « valider avant », seulement documenter après. C'est un objet différent, et il faut l'assumer comme tel plutôt que de prétendre que la story reste applicable.
- **Un retour en arrière n'est plus neutre.** `ADR-2026-10-01-C5` acte que les données historiques ne sont pas reprises. Une étude comparative qui conclurait à un autre socle se heurterait à un coût de bascule désormais payé une fois.
- **Un arbitrage est resté ouvert, et il porte précisément sur un choix de socle.** `ADR-2026-10-01-C6` reporte le retrait de MUI ; l'interface reste en Tailwind « jusqu'à un arbitrage ultérieur ». C'est l'occasion immédiate d'appliquer `RM-01` et `RM-02` à un cas concret, plutôt que de les énoncer dans l'abstrait.
- **Le périmètre du « from scratch » n'a jamais été borné.** La source dit « repartir from scratch » sans dire sur quoi : la base de données, le serveur, l'interface, les trois ? Le dépôt a refait les deux premiers et conservé le troisième. L'écart entre ce que la story demandait et ce qui a été fait n'est pas mesurable, faute de périmètre initial.
- **Le chiffre « dix ans » est une intention, pas un critère.** Aucun indicateur ne permet de dire si un socle tiendra dix ans. Transformer cette intention en critère vérifiable est une partie non triviale du travail.

## Hors périmètre

- Les décisions déjà prises et exécutées (`C1`, `C2`, `C4`, `C5`) : cette story ne les rouvre pas, elle demande qu'elles soient motivées.
- La mise en œuvre technique du socle, qui a eu lieu.
- La chaîne d'intégration continue et la traçabilité des travaux d'agents (`US-CORE-03`).
- La migration du backlog, réalisée le 3 octobre 2026.

## Dépendances et décisions

- `ADR-2026-10-01-C1`, `C2`, `C4`, `C5` — décisions adoptées et constatées comme réalisées lors de l'atelier du 1er octobre 2026. Elles recouvrent l'essentiel de ce que demandait la story.
- `ADR-2026-10-01-C6` — retrait de MUI reporté : seul choix de socle encore ouvert, donc seul terrain où la méthode demandée par cette story peut encore s'appliquer par anticipation.
- `project/governance/source-of-truth.md` — établit Git comme source unique et acte la sortie de Notion : répond au volet « capitaliser sur les spécifications ».
- `OQ-ARCH-C3` — l'inventaire des processus asynchrones reste ouvert ; c'est un reliquat du même mouvement de reprise.
- Aucune dépendance de story n'est citée par la source ; le frontmatter n'est pas modifié.

## Vérification

_Aucun cahier de tests Notion ne référence cette story._

## Preuves relevées dans le dépôt

`deliveryStatus: not-started` — 1 story document BMAD sans signal d'implémentation.

Story documents BMAD (historique d'implémentation, non recopié) :

- `_bmad-output/implementation-artifacts/story-US-CORE-04.md`

## Questions ouvertes

- **Question principale : cette story passe-t-elle en `deprecated`, les décisions `C1`, `C2`, `C4` et `C5` l'ayant consommée ?** Ou est-elle conservée, réduite à son reste — documenter la justification du socle retenu ? Le `specStatus` n'est pas modifié ici.
- Si elle est conservée : la note comparative porte-t-elle sur le socle déjà retenu, à justifier a posteriori, ou sur les choix encore ouverts ?
- Les décisions d'architecture du 1er octobre doivent-elles être enrichies de leurs motifs, ou une note séparée est-elle préférable ? Une décision sans motif n'est pas révisable.
- La règle « analyse contradictoire avant tout choix structurant » est-elle inscrite dans `project/governance/`, et qui en est le garant (`OQ-GOV-ROLES`) ?
- `ADR-2026-10-01-C6` (retrait de MUI) est le prochain choix structurant. Est-il le cas d'application de cette méthode ?
- Comment rend-on vérifiable l'exigence de « maintenabilité dix ans » ? Sans indicateur, elle n'est pas opposable.
- Critères d'acceptation absents de la source ; ceux proposés ici sont à valider.
- Rattachement à une fonctionnalité produit à arbitrer (`FEAT-E7-UNCLASSIFIED` est un regroupement de migration).
- Relecture produit requise : contenu issu d'un import, non approuvé.
