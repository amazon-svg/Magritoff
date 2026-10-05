---
id: US-AO-06
title: "Pipeline AO : ingestion → chiffrage → restitution"
epic: EPIC-T08
feature: FEAT-T08-UNCLASSIFIED
specStatus: draft
deliveryStatus: not-started
owner: unassigned
source:
  system: notion
  pageId: 375d0131973c81dba21dd1453edd601a
  url: https://app.notion.com/375d0131973c81dba21dd1453edd601a
  originalStatus: "Pas commencé"
  originalSprint: "Backlog"
  originalPriority: "P1"
  originalEffort: ""
  originalAssignee: "Xavier"
  originalOffering: "Toutes"
  originalOrder: ""
  originalSources: "WM 03/06/2026"
  createdAt: "2026-06-04 13:30:45Z"
  lastEditedAt: "2026-06-04T13:30:00.000Z"
  importedAt: 2026-10-03
  archive: _archives-notion/2026-10-03/pages/US-AO-06.md
decisions: []
dependencies: []
supersedes: []
implementationRecords:
  - _bmad-output/implementation-artifacts/story-US-AO-06.md
---

# US-AO-06 — Pipeline AO : ingestion → chiffrage → restitution

> Décrit la chaîne complète de traitement d'un fichier d'appel d'offres : du fichier brut reçu jusqu'au fichier chiffré rendu dans la structure où il est arrivé.

## Valeur métier

La valeur de ce chantier ne tient pas dans une étape mais dans leur enchaînement. Un acheteur envoie son bordereau dans **son** format ; il veut le récupérer chiffré dans **son** format. Tout ce qui se passe entre les deux — nettoyage, normalisation, mise en correspondance avec un référentiel, chiffrage — lui est indifférent, et c'est précisément le travail que l'imprimeur fait aujourd'hui à la main pendant des heures, parfois pour un AO qu'il ne gagnera pas. Rendre un fichier fidèle à l'original est ce qui rend la réponse acceptable par l'émetteur : un fichier reformaté est un fichier que l'acheteur devra retraiter, donc un gain annulé.

## Besoin utilisateur

_Non formulé dans la source Notion._ L'acteur implicite est celui qui répond à un AO reçu au format tableur. Formulation à écrire en revue produit.

## Comportement attendu

1. Un fichier source brut est fourni en entrée.
2. Il est nettoyé et normalisé, la source attribuant cette étape à un traitement par IA.
3. Les lignes normalisées sont mises en correspondance avec un format pivot.
4. Les lignes sont chiffrées via Clariprint.
5. Le résultat est restitué dans un fichier fidèle à la structure du fichier source.

**La source est muette** sur tout ce qui fait fonctionner une chaîne : déclenchement, durée, traitement des erreurs à chaque étape, reprise après échec, et ce que voit l'utilisateur pendant le traitement.

## Expérience utilisateur

- Une chaîne de ce type ne se vit pas comme une action mais comme une attente. L'utilisateur a besoin de savoir où en est son fichier, combien de lignes sont traitées, et ce qui coince — sinon il relance, ou il abandonne.
- Un résultat livré sans indication de fiabilité sera vérifié ligne à ligne, ce qui annule le gain. La notion de confiance par ligne existe dans `T08.N14` ; elle n'est pas reprise ici.
- « Restitution fidèle » est une promesse visuelle : l'émetteur doit reconnaître son fichier. C'est `T08.N13` qui porte cette exigence en détail.
- **La source est muette** sur l'écran, le point d'entrée, et la manière dont l'utilisateur récupère son fichier.

## Règles métier

- `RM-01` — La chaîne comporte cinq étapes ordonnées : fichier source brut, nettoyage et normalisation, mise en correspondance avec un format pivot, chiffrage Clariprint, restitution.
- `RM-02` — Le fichier restitué doit préserver la structure du fichier source et rester exploitable par son émetteur.
- `RM-03` — La normalisation s'appuie sur un traitement par IA ; la source ne dit pas ce qu'il advient des lignes qu'il ne sait pas traiter.

## Critères d'acceptation

- `AC-01` — Étant donné un fichier d'AO réel, quand il est soumis à la chaîne, alors un fichier chiffré est produit dont la structure est reconnaissable par l'émetteur du fichier d'origine (**« exploitable par l'émetteur » est la seule formulation de la source ; le critère de fidélité reste à définir et est détaillé par `T08.N13`**).
- `AC-02` — Étant donné un fichier traité de bout en bout, quand on compare entrée et sortie, alors chaque ligne du fichier source se retrouve dans le fichier restitué (**exigence d'exhaustivité portée par `US-AO-07` ; elle n'est pas écrite dans la source de cette story**).

Aucun autre critère n'est écrit ici : la source n'en comporte qu'un, et les critères détaillés de chaque étape appartiennent à `T08.N1` à `T08.N14`.

## Cas limites

- **Échec à une étape intermédiaire** : la chaîne s'arrête-t-elle, ou livre-t-elle un résultat partiel signalé comme tel ?
- **Ligne non chiffrable** : elle apparaît dans le fichier restitué sans prix, avec un motif, ou pas du tout ? Le choix change ce que l'émetteur reçoit.
- **Fichier source dégradé** (mise en forme tenant lieu de structure) : hypothèse de travail documentée dans la source de `T08.WM2`, non reprise ici.
- **Durée** : aucune cible de temps pour un fichier de plusieurs centaines ou milliers de lignes, alors que la viabilité du produit en dépend.
- **Reproductibilité** : rejouer la chaîne sur le même fichier doit-il donner le même résultat ? Une étape confiée à un modèle ne le garantit pas. `US-AO-07` cite le « traitement de la reproductibilité » sans le définir.

## Hors périmètre

- Le détail de chaque étape, porté par `T08.N1` à `T08.N14` : ingestion, détection de structure, fusions, mapping de colonnes, normaliseurs, modèle de ligne normalisée, mapping Clariprint, variantes, chiffrage en masse, restitution, revue humaine.
- Les contrôles d'exhaustivité et de fiabilité de l'ingestion (`US-AO-07`).
- La création et l'envoi d'un AO (`T08.WM1`, `T08.A1`, `T08.A2`).
- Le chiffrage lui-même et la hiérarchie des sources de prix.

## Dépendances et décisions

- Aucune dépendance déclarée par la source ; le frontmatter reste vide.
- **Recouvrement majeur à arbitrer.** Cette story décrit exactement la chaîne que `T08.N1` à `T08.N14` détaillent étape par étape, décomposition faite le 2 juin 2026 — la veille du weekly dont `US-AO-06` est issue (3 juin 2026). Deux lectures possibles : soit `US-AO-06` est une story-chapeau qui donne la vue d'ensemble et ne doit pas être développée pour elle-même, soit elle fait doublon avec le lot `T08.N*` et doit être retirée. **À trancher avant toute planification** — développer les deux produirait le même code deux fois.
- `US-AO-07` (fiabilisation de l'ingestion) porte les garanties d'exhaustivité de la première étape de cette chaîne.
- Aucune décision du 1er octobre 2026 n'est rattachée à cette story. Deux d'entre elles la contraignent pourtant : `ADR-2026-10-01-C1` (plus de fonctions Edge) retire le support d'exécution serveur envisagé historiquement, et `ADR-2026-10-01-C4` (contrat d'API unique) impose que tout traitement passe par ce contrat. Le lieu d'exécution d'une chaîne longue reste à définir.
- Rien dans le dépôt : aucune chaîne d'ingestion d'AO. Le dépôt sait produire et exporter des fichiers tableur pour un autre usage (`src/modules/order-exports/`) — précédent de conception, pas dépendance.
- Référence de provenance conservée : WM#030626, réf. 00:06:53.

## Vérification

_Aucun cahier de tests Notion ne référence cette story._

## Preuves relevées dans le dépôt

`deliveryStatus: not-started` — 1 story document BMAD sans signal d'implémentation.

Story documents BMAD (historique d'implémentation, non recopié) :

- `_bmad-output/implementation-artifacts/story-US-AO-06.md`

## Questions ouvertes

- `US-AO-06` est-elle une story-chapeau non développable, ou fait-elle doublon avec `T08.N1` à `T08.N14` ? Si elle est conservée, que porte-t-elle que les quatorze autres ne portent pas ?
- Que signifie « fidèle à la structure source » de façon vérifiable : mêmes feuilles, mêmes lignes, même mise en forme, mêmes formules ?
- Que devient une ligne non chiffrable dans le fichier restitué ?
- La chaîne est-elle reprenable après échec, et à partir de quelle étape ?
- Quelle durée maximale pour quel volume de lignes ?
- Le traitement doit-il être reproductible à l'identique, alors qu'une étape repose sur un modèle ?
- Où s'exécute la chaîne, compte tenu de `ADR-2026-10-01-C1` et de `ADR-2026-10-01-C4` ?
- Rattachement à une fonctionnalité produit à arbitrer (`FEAT-T08-UNCLASSIFIED` est un regroupement de migration).
- Relecture produit requise : contenu issu d'un import, non approuvé.
