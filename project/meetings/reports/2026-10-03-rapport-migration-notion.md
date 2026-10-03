---
id: REPORT-2026-10-03-MIGRATION-NOTION
title: Rapport de migration du backlog Notion vers Git
date: 2026-10-03
status: draft
source: MEET-2026-10-01-ATELIER
archive: _archives-notion/2026-10-03/ (hors dépôt)
---

# Rapport de migration du backlog Notion vers Git

Destinataire principal : Xavier Péchoultres (Expert Solutions), pour relecture de la demande de fusion. Rédigé le 3 octobre 2026 à 22 h 24 (heure de Paris).

Ce rapport rend compte de la migration unique décidée à l'atelier du 1er octobre 2026 (`MEET-2026-10-01-ATELIER`, décisions A1 à A4). Tout le contenu importé est au statut `draft` ou `contradictory` : **aucun élément n'a été approuvé**, l'approbation restant humaine.

## 1. Source et export

| Élément | Valeur |
|---|---|
| Base source | Notion — « 📋 Backlog Magrit — Sprint Board » |
| Identifiant de base | `4d2e2ea1-0691-4ce5-a697-28fdb67dfddd` |
| Base de tests source | Notion — « 🧪 Cahiers de tests fonctionnels Magrit » |
| Identifiant de base | `9e8f5f5f-8143-4872-8720-b14cd543fc4e` |
| Date de l'export | 3 octobre 2026 |
| Méthode | API REST Notion `2022-06-28`, intégration interne en lecture seule, script `export_notion.py` |
| Emplacement de l'archive | `~/Documents/Claude/BMAD/_archives-notion/2026-10-03/` — **hors dépôt**, non committée |
| Archive scellée | `~/Documents/Claude/BMAD/_archives-notion/export-notion-magrit-2026-10-03.tar.gz` (792 Ko) |
| Empreinte SHA-256 | `613eecdd9ec7a41c8949e44be7f33d1f2fd0a487bb5289617fa438cee3dd6d09` |

L'archive contient, pour chaque ligne de la base : la page convertie en Markdown (`pages/<ID>.md`), la charge utile brute de l'API (`raw/<ID>.json`, propriétés et blocs), la table des propriétés (`properties.psv`), la table des cahiers de tests (`tests.psv`), le balayage de preuves (`evidence.psv`) et les scripts qui ont produit la migration.

**Aucun jeton, secret ni cookie Notion n'a été écrit dans le dépôt ni dans ce rapport.** Le jeton d'intégration a été lu depuis un fichier local en dehors du dépôt. Il a transité par la conversation de pilotage : **sa révocation est recommandée maintenant que la migration est faite.**

## 2. Volumes lus dans Notion

| Indicateur | Valeur historique annoncée | **Valeur réelle constatée le 03/10/2026** |
|---|---:|---:|
| Lignes de la base backlog | 197 | **206** |
| Dont « Pas commencé » | 146 | **147** |
| Dont « Terminé » | 48 | **55** |
| Dont « En cours » | 3 | **3** |
| Dont sans statut ni identifiant | — | **1** |
| Cahiers de tests fonctionnels | 12 (TF-NOTION-*) | **238** |

Les chiffres de 197 lignes et 146 « Pas commencé » provenaient de `docs/governance-audit/summary.md` et du compte rendu du 1er octobre. Ils sont périmés : la base compte **206 lignes**, dont **147 « Pas commencé »**. L'écart tient aux lignes ajoutées après l'audit du 4 septembre (lot Q/BCP de la session des 19 et 20 septembre, notamment).

## 3. Volumes créés dans Git

| Type | Créés | Rapprochés sans recréation |
|---|---:|---|
| Epics | 17 | `EPIC-E10` conservée, non recréée |
| Fonctionnalités | 18 regroupements `UNCLASSIFIED` | les 6 `FEAT-E10-*` existantes conservées |
| Stories | 205 | — |
| **Total de fichiers ajoutés** | **240** | |

Aucun fichier de `_bmad-output/` n'a été déplacé, modifié ou supprimé. Aucun fichier de code, ni `CLAUDE.md`, ni `docs/spec/STORY_DOCUMENT_STANDARD.md` n'a été touché.

## 4. Répartition des statuts

### Statut documentaire (`specStatus`)

| Statut | Stories |
|---|---:|
| `draft` | 201 |
| `contradictory` | 4 |

Aucune story n'est `approved`, `review`, `superseded` ni `deprecated`.

### Statut de livraison (`deliveryStatus`), établi depuis le dépôt

| Statut | Stories |
|---|---:|
| `verified` | 2 |
| `implemented` | 47 |
| `in-progress` | 9 |
| `not-started` | 147 |

**Aucune story n'est `released`** : le dépôt ne porte aucune preuve de déploiement rattachable à une story individuelle. Les mentions de déploiement figurent dans les sections « QA Results » des pages Notion, en prose, sans référence vérifiable à un commit ou à une version. Les passer en `released` aurait supposé de croire la source Notion sur le fait livré, ce que la décision A3 interdit. `blocked` et `cancelled` ne sont employés nulle part : aucune source ne les énonce.

### Croisement statut Notion × statut de livraison établi

| Statut Notion | Statut Git établi | Stories |
|---|---|---:|
| En cours | `not-started` | 3 |
| Pas commencé | `implemented` | 6 |
| Pas commencé | `in-progress` | 1 |
| Pas commencé | `not-started` | 140 |
| Terminé | `implemented` | 41 |
| Terminé | `in-progress` | 8 |
| Terminé | `not-started` | 4 |
| Terminé | `verified` | 2 |

## 5. Méthode d'établissement du statut de livraison

Le statut Notion n'a **jamais** été recopié. Pour chacun des 205 identifiants, le dépôt a été balayé avec une frontière d'identifiant stricte — `E10.1` ne capture ni `E10.10` ni `E10.17`, `BCP-5` ne capture pas `BCP-5/6-fix` — sur :

- `src/` et `supabase/` (code et migrations) ;
- `tests/` ;
- `openapi/magrit-core.v1.yaml` ;
- `docs/spec/backlog.md` et `SPRINT_HANDOFF.md` ;
- `_bmad-output/implementation-artifacts/` (noms de fichiers à points **et** à tirets : `story-E10.12.md` comme `story-E10-12-conversion-commande.md`) ;
- l'historique Git complet (`git log --all`) ;
- la colonne « signal d'implémentation » de `docs/governance-audit/inventory.csv` ;
- le statut des cahiers de tests Notion liés.

Règles appliquées :

| Statut | Condition retenue |
|---|---|
| `verified` | code **et** fichiers de test **et** au moins un cahier de tests au statut OK, aucun KO ni Bloqué |
| `implemented` | code identifié, ou endpoint décrit dans le contrat OpenAPI, sans vérification suffisante |
| `in-progress` | signal d'implémentation dans un story document BMAD ou commits, sans code rattachable |
| `not-started` | aucune des preuves ci-dessus après balayage documenté |
| `released` | preuve explicite de déploiement rattachée à la story — **jamais rencontrée** |

## 6. Normalisations appliquées

Aucune description fonctionnelle n'a été résumée ni reformulée. Les transformations suivantes, toutes mécaniques, sont les seules appliquées.

| # | Normalisation | Portée |
|---|---|---|
| N1 | Quatre sections de journal d'exécution non recopiées dans la story Git : `## Statut`, `## Change Log`, `## Dev Agent Record`, `## QA Results`. Elles restent intégralement dans l'archive et dans les story documents BMAD référencés en `implementationRecords`. Chaque story indique explicitement les sections omises. | 31 pages |
| N2 | Titres normalisés : le niveau de titre le plus haut utilisé dans une page devient `##`, les niveaux inférieurs suivent. Aucun texte modifié. | toutes |
| N3 | Page sans section de critères d'acceptation : section créée **vide**, avec mention explicite. Rien n'a été déduit du code. | 43 pages |
| N4 | Libellé d'epic `T-0x — …` → identifiant `EPIC-T0x` (les identifiants Git ne portent pas le tiret interne). Table de correspondance en annexe A. | 8 epics |
| N5 | `deliveryStatus` établi depuis le dépôt, jamais depuis Notion. | toutes |
| N6 | Dépendances extraites mécaniquement de la section « Dépendances » des pages, restreintes aux identifiants existant réellement dans la base. | 94 liens |
| N7 | Intitulé de section de critères ramené à la forme canonique quand il en différait (accent manquant, suffixe) ; l'intitulé d'origine est conservé en tête de section. | 12 pages |

Tableaux Notion convertis en tableaux Markdown, encadrés en citations, cases à cocher en listes `- [ ]` : conversions de forme uniquement, sans altération du texte.

## 7. Correspondance avec les documents BMAD

- **199 stories sur 205** référencent au moins un story document BMAD dans `implementationRecords`.
- **6 stories** n'en référencent aucun.
- Aucun story document n'a été déplacé, modifié ni recopié : seul son chemin est référencé, conformément à la consigne « ne pas recopier leur contenu technique ».
- Les story documents dont le nom emploie la forme à tirets ont été rattachés explicitement (exemple : `story-E10-12-conversion-commande.md` → story `E10.12`).

## 8. Doublons

| Contrôle | Résultat |
|---|---:|
| Identifiants Notion en double | 0 |
| Identifiants Git en double (contrôle `project:validate`) | 0 |
| Titres identiques ou très proches (similarité ≥ 0,92) | 0 |
| Fichiers existant déjà dans `project/backlog` et écrasés | 0 |

Les six fonctionnalités `FEAT-E10-*` et l'epic `EPIC-E10` préexistantes ont été **conservées et complétées**, jamais réécrites. Aucun second epic E10 n'a été créé.

## 9. Contradictions relevées

### 9.1 — Stories déclarées « Terminé » dans Notion sans aucune preuve dans le dépôt (4)

Ces stories passent en `specStatus: contradictory`. La décision A3 fait du code livré la source pour le déjà fait ; Notion dit l'inverse ; aucune décision ne départage.

| Story | Statut Notion | Statut Git établi | Preuves trouvées |
|---|---|---|---|
| `BCP-5/6-fix` | Terminé | `not-started` | 1 story document BMAD sans signal d'implémentation |
| `E1.4` | Terminé | `not-started` | 1 story document BMAD sans signal d'implémentation |
| `E7.4` | Terminé | `not-started` | 1 story document BMAD sans signal d'implémentation |
| `FIX-GARDE` | Terminé | `not-started` | aucune preuve trouvée après balayage du dépôt |

### 9.2 — Stories « Pas commencé » dans Notion qui portent déjà une implémentation (7)

Conformément au mandat, l'état établi par le code l'emporte et la contradiction est signalée. L'audit du 4 septembre n'en annonçait que trois familles (E10.15, E10.19, E10.20) : il en manquait quatre.

| Story | Statut Notion | Statut Git établi | Preuves |
|---|---|---|---|
| `E10.10` | Pas commencé | `in-progress` | 7 story documents BMAD avec signal d'implémentation |
| `E10.15` | Pas commencé | `implemented` | 1 fichier de code · décrit dans openapi/magrit-core.v1.yaml · 2 commits git · 5 story documents BMAD avec signal d'implémentation |
| `E10.17` | Pas commencé | `implemented` | 4 fichiers de code · décrit dans openapi/magrit-core.v1.yaml · 1 commit git · 2 story documents BMAD avec signal d'implémentation |
| `E10.19` | Pas commencé | `implemented` | 3 fichiers de code · 1 fichier de test · décrit dans openapi/magrit-core.v1.yaml · 2 story documents BMAD avec signal d'implémentation |
| `E10.20` | Pas commencé | `implemented` | 6 fichiers de code · 2 fichiers de test · décrit dans openapi/magrit-core.v1.yaml · 2 story documents BMAD avec signal d'implémentation |
| `E10.8` | Pas commencé | `implemented` | 6 fichiers de code · décrit dans openapi/magrit-core.v1.yaml · 1 story document BMAD sans signal d'implémentation |
| `E8.3` | Pas commencé | `implemented` | 1 fichier de code · 1 story document BMAD sans signal d'implémentation |

### 9.3 — Deux taxonomies d'epics portent la même numérotation

Les epics Notion `E1` à `E9` (Clariprint, Marguerite, UX & streaming, Mini-shop, API & intégrations, Données & qualité, Perf & infra, Catalogue & visu, Multi-tenant) **ne sont pas** les epics BMAD 0 à 8 recensées dans `project/backlog/epics/README.md` (Démo Readiness, Stack Foundations, Boutique B2B socle, Commandes, Mockup Engine, Connecteurs design, Quotas et tiers, Boutique v2, Refactorisation API-first). Seule `E10 — Gestion commerciale` est commune aux deux. Chaque fichier d'epic importée porte l'avertissement. **Le renommage éventuel relève de l'autorité produit : aucun identifiant historique n'a été renommé ici.**

### 9.4 — Story déclarée supersédée par son propre titre

`T08.WM2` porte le titre « [SUPERSEDÉE → T08.N1–N14] Module AO — Import et traitement fichiers Excel de réponse ». La règle d'import impose `draft` à tout contenu importé ; la règle de workflow imposerait `superseded`. Le statut `draft` a été retenu et la question est portée ici : passer `T08.WM2` en `superseded` et renseigner `supersedes: [T08.WM2]` sur les quatorze stories `T08.N1` à `T08.N14` relève d'une décision humaine.

### 9.5 — Double rattachement de fonctionnalité

`E10.9` et `E10.10` figurent **simultanément** dans les listes `stories:` de `FEAT-E10-PRICING` et de `FEAT-E10-QUOTES`, préexistantes. La correspondance n'est donc pas explicite au sens du mandat : ces deux stories ont été placées dans `FEAT-E10-UNCLASSIFIED` plutôt que choisies silencieusement. Arbitrage attendu.

## 10. Regroupements UNCLASSIFIED

La base Notion n'a que deux niveaux, epic et story : **aucune fonctionnalité n'y est définie**. Aucune fonctionnalité produit n'a donc été inventée. Un regroupement technique `FEAT-<EPIC>-UNCLASSIFIED` a été créé par epic, au statut `draft`, pour que chaque story porte une fonctionnalité parente comme l'exige la structure du backlog.

- **18 regroupements** créés.
- **191 stories sur 205** y sont rattachées.
- **14 stories E10** sont rattachées à une fonctionnalité produit réelle, parce que les six `FEAT-E10-*` préexistantes les nomment explicitement.

| Regroupement | Stories |
|---|---:|
| `FEAT-E1-UNCLASSIFIED` | 10 |
| `FEAT-E10-UNCLASSIFIED` | 29 |
| `FEAT-E2-UNCLASSIFIED` | 5 |
| `FEAT-E3-UNCLASSIFIED` | 6 |
| `FEAT-E4-UNCLASSIFIED` | 12 |
| `FEAT-E5-UNCLASSIFIED` | 6 |
| `FEAT-E6-UNCLASSIFIED` | 5 |
| `FEAT-E7-UNCLASSIFIED` | 14 |
| `FEAT-E8-UNCLASSIFIED` | 5 |
| `FEAT-E9-UNCLASSIFIED` | 16 |
| `FEAT-T01-UNCLASSIFIED` | 6 |
| `FEAT-T02-UNCLASSIFIED` | 6 |
| `FEAT-T03-UNCLASSIFIED` | 9 |
| `FEAT-T04-UNCLASSIFIED` | 7 |
| `FEAT-T05-UNCLASSIFIED` | 6 |
| `FEAT-T06-UNCLASSIFIED` | 9 |
| `FEAT-T07-UNCLASSIFIED` | 7 |
| `FEAT-T08-UNCLASSIFIED` | 33 |

Rattachements E10 explicites conservés :

| Fonctionnalité | Stories |
|---|---|
| `FEAT-E10-CUSTOMERS` | `E10.4`, `E10.5` |
| `FEAT-E10-EXPORTS` | `E10.18` |
| `FEAT-E10-ORDERS` | `E10.12`, `E10.16`, `E10.19` |
| `FEAT-E10-PRICING` | `E10.11`, `E10.21`, `E10.6`, `E10.7`, `E10.8` |
| `FEAT-E10-PROJECTS` | `E10.1`, `E10.2` |
| `FEAT-E10-QUOTES` | `E10.3` |

## 11. Stories sans preuve de livraison

**147 stories sur 205** sortent du balayage sans aucune preuve d'implémentation. Elles sont à `deliveryStatus: not-started`. Ce n'est pas une déduction du statut Notion : c'est le résultat d'une recherche documentée qui n'a rien trouvé. Trois d'entre elles sont « En cours » dans Notion (`E1.1`, `E1.3`, `E8.1`) et quatre « Terminé » (section 9.1).

## 12. Cahiers de tests

Les 238 cas de la base « Cahiers de tests fonctionnels Magrit » ont été lus et rattachés aux stories par leur colonne « Stories liées ». **43 stories** portent au moins une référence, sous forme de tableau dans leur section « Vérification ».

| Statut du cas dans Notion | Cas |
|---|---:|
| À jouer | 132 |
| OK | 58 |
| Obsolète | 26 |
| KO | 11 |
| En cours | 6 |
| Bloqué | 5 |

Chaque tableau porte la mention : un cas décrit un test **prévu**, sa présence n'implique ni automatisation ni exécution récente. Aucun test n'a été déclaré automatisé sans fichier identifiable : les fichiers de test réels sont listés séparément, dans la section « Preuves relevées dans le dépôt ».

Correspondances ambiguës signalées : de nombreux cas pointent vers des identifiants qui **n'existent pas dans la base Notion** (`S0.1`, `S2.11`, `S7.x`, `UM1`, `R0` à `R9`, `S-ORDER-ROLES-*`, `S-PIM-VISUELS-*`…). Ces identifiants viennent de chantiers pilotés hors Notion. Ils n'ont pas été importés : aucune ligne de la base ne les porte. Leur rattachement relève de la revue produit.

## 13. Stories touchées par les décisions du 1er octobre

Relevées sans être réécrites : la propagation revient à l'agent de gestion de projet, conformément à la section 7.2 du compte rendu. Chaque story concernée porte la décision en frontmatter `decisions:` et une ligne en « Questions ouvertes ».

| Décision | Objet | Stories relevées |
|---|---|---:|
| `PD-2026-10-01-B1` | Recherche unifiée | 8 |
| `PD-2026-10-01-B3` | Modèle de sous-traitance | 20 |
| `PD-2026-10-01-B4` | Conservation du prix marché | 10 |
| `PD-2026-10-01-B5` | Création directe d'un devis | 0 |

- **PD-2026-10-01-B1** — `E10.2`, `E5.1`, `T04.1`, `T04.2`, `T04.3`, `T04.5`, `T05.2`, `T05.5`
- **PD-2026-10-01-B3** — `E1.1`, `E1.fix-TF51`, `E10.10b-4b`, `E10.11`, `E10.14`, `E10.15`, `E10.17`, `E10.18`, `E10.9`, `E_OVERLAY.fix-TF59`, `T02.4`, `T02.5`, `T06.1`, `T06.3`, `T06.4`, `T06.5`, `T06.WM3`, `T08.A1`, `T08.A2`, `US-AO-09`
- **PD-2026-10-01-B4** — `E1.fix-TF51`, `E4.fix-TF54`, `T06.1`, `T06.2`, `T06.4`, `T06.WM1`, `T06.WM2`, `T06.WM3`, `T08.WM1`, `T08.WM3`
- **PD-2026-10-01-B5** — aucune story de la base ne traite explicitement ce domaine ; la décision appelle une story nouvelle, qui n'est pas du ressort de cette migration.

**B2 (verrouillage des champs produit) et le rattachement sous-espace ↔ parc machines restent ouverts** (`OQ-B2`, `OQ-B3-PARC`). Conformément au mandat, aucune story approuvée n'a été créée sur ces deux sujets.

## 14. Éléments non importés

| Élément | Motif |
|---|---|
| Une ligne de la base sans identifiant, sans titre, sans statut et sans corps (`https://app.notion.com/364d0131973c80c59adffcedf5cde314`, créée le 18/05/2026) | Page vide. Aucun contenu à migrer, aucun identifiant métier à conserver. Archivée sous `pages/NOID.md` et `raw/NOID.json`. Suppression recommandée côté Notion. |
| Base « Backlog Magrit — Groupe ICI » (`b5f4e51c-c310-473f-8902-db04a8e42ef6`) | Hors périmètre du mandat, qui vise la base backlog du produit. À traiter séparément si elle doit entrer dans Git. |
| Base « Backlog Marketing Magrit » | Hors périmètre : backlog marketing, pas produit. |
| Sections `## Statut`, `## Change Log`, `## Dev Agent Record`, `## QA Results` | Journal d'exécution. Conservées intégralement dans l'archive et référencées ; non recopiées dans la story canonique, conformément à `project/backlog/stories/README.md`. |

**Aucune ligne de la base backlog n'a été silencieusement ignorée** : 205 lignes ont un fichier Git, la 206ᵉ est motivée ci-dessus.

## 15. Questions nécessitant une décision humaine

| # | Question |
|---|---|
| Q1 | Les epics Notion `E1` à `E9` et les epics BMAD 0 à 8 portent la même numérotation pour des découpages différents. Faut-il renommer l'une des deux séries ? |
| Q2 | Les 18 regroupements `FEAT-*-UNCLASSIFIED` doivent être éclatés en fonctionnalités produit. Qui le fait, et selon quel découpage ? |
| Q3 | 4 stories « Terminé » dans Notion sans aucune trace dans le dépôt (`BCP-5/6-fix`, `E1.4`, `E7.4`, `FIX-GARDE`). Travail réellement livré et non tracé, ou statut Notion erroné ? |
| Q4 | `E10.9` et `E10.10` appartiennent simultanément à `FEAT-E10-PRICING` et `FEAT-E10-QUOTES`. Quelle fonctionnalité les porte ? |
| Q5 | `T08.WM2` se déclare supersédée par `T08.N1` à `T08.N14`. Passer en `superseded` et renseigner `supersedes` sur les quatorze successeurs ? |
| Q6 | 43 stories n'ont aucun critère d'acceptation dans la source. Qui les écrit, et avant ou après arbitrage de périmètre ? |
| Q7 | Les cahiers de tests référencent des identifiants absents de Notion (`S0.1`, `S2.x`, `S7.x`, `UM*`, `R0`-`R9`, `S-*`). Faut-il créer les stories Git correspondantes à partir des story documents BMAD, ou les laisser en historique ? |
| Q8 | Aucune story n'est `released` faute de preuve de déploiement rattachable. Faut-il introduire une convention de traçabilité déploiement → story ? |
| Q9 | Les rôles d'approbateur produit et technique ne sont pas attribués (`OQ-GOV-ROLES`). Tant qu'ils ne le sont pas, aucun de ces 240 fichiers ne peut passer `approved`. |

## 16. Résultats des validations automatiques

| Contrôle | Résultat |
|---|---|
| `pnpm project:validate` | ✅ 265 artefacts, 265 identifiants uniques, 0 erreur |
| `pnpm specs:validate` | ✅ modèle conforme, 0 spécification importée dans `quality/specs` |
| `git diff --check` | ✅ aucun espace de fin, aucun conflit de marqueur |
| Unicité des identifiants | ✅ 250 identifiants dans `project/backlog`, aucun doublon |
| Aucun contenu `approved` | ✅ 246 `draft`, 4 `contradictory`, 0 `approved` |
| Aucun secret ajouté | ✅ aucune occurrence de jeton, clé ou certificat dans les fichiers ajoutés |
| Exhaustivité | ✅ 205 lignes Notion → 205 fichiers ; 1 ligne non importée, motivée |

`quality/specs` ne contient toujours aucune spécification métier : la migration n'y a rien écrit, le rapprochement entre `project/backlog` et `quality/specs` restant à arbitrer après pilote.

## Annexe A — Correspondance des epics

| Libellé Notion | Identifiant Git | Stories | Fichier |
|---|---|---:|---|
| E1 — Clariprint | `EPIC-E1` | 10 | [`EPIC-E1.md`](../../backlog/epics/EPIC-E1.md) |
| E10 — Gestion commerciale | `EPIC-E10` | 43 | [`EPIC-E10-gestion-commerciale.md`](../../backlog/epics/EPIC-E10-gestion-commerciale.md) |
| E2 — Marguerite | `EPIC-E2` | 5 | [`EPIC-E2.md`](../../backlog/epics/EPIC-E2.md) |
| E3 — UX & streaming | `EPIC-E3` | 6 | [`EPIC-E3.md`](../../backlog/epics/EPIC-E3.md) |
| E4 — Mini-shop | `EPIC-E4` | 12 | [`EPIC-E4.md`](../../backlog/epics/EPIC-E4.md) |
| E5 — API & intégrations | `EPIC-E5` | 6 | [`EPIC-E5.md`](../../backlog/epics/EPIC-E5.md) |
| E6 — Données & qualité | `EPIC-E6` | 5 | [`EPIC-E6.md`](../../backlog/epics/EPIC-E6.md) |
| E7 — Perf & infra | `EPIC-E7` | 14 | [`EPIC-E7.md`](../../backlog/epics/EPIC-E7.md) |
| E8 — Catalogue & visu | `EPIC-E8` | 5 | [`EPIC-E8.md`](../../backlog/epics/EPIC-E8.md) |
| E9 — Multi-tenant & gouvernance | `EPIC-E9` | 16 | [`EPIC-E9.md`](../../backlog/epics/EPIC-E9.md) |
| T-01 — Corporate Portal | `EPIC-T01` | 6 | [`EPIC-T01.md`](../../backlog/epics/EPIC-T01.md) |
| T-02 — Franchise Module | `EPIC-T02` | 6 | [`EPIC-T02.md`](../../backlog/epics/EPIC-T02.md) |
| T-03 — Sync eCommerce | `EPIC-T03` | 9 | [`EPIC-T03.md`](../../backlog/epics/EPIC-T03.md) |
| T-04 — Prompt Search | `EPIC-T04` | 7 | [`EPIC-T04.md`](../../backlog/epics/EPIC-T04.md) |
| T-05 — Help System | `EPIC-T05` | 6 | [`EPIC-T05.md`](../../backlog/epics/EPIC-T05.md) |
| T-06 — Parc & monétisation | `EPIC-T06` | 9 | [`EPIC-T06.md`](../../backlog/epics/EPIC-T06.md) |
| T-07 — Canva | `EPIC-T07` | 7 | [`EPIC-T07.md`](../../backlog/epics/EPIC-T07.md) |
| T-08 — AO & Catalogues | `EPIC-T08` | 33 | [`EPIC-T08.md`](../../backlog/epics/EPIC-T08.md) |

## Annexe B — Table de correspondance Notion → Git

Une ligne par story importée. `Notion` est le statut d'origine, conservé comme provenance seule ; `Livraison` est le statut établi depuis le dépôt.

| Identifiant | Epic | Fonctionnalité | Notion | Livraison | Spec | Doc. BMAD | TF | Fichier Git |
|---|---|---|---|---|---|---:|---:|---|
| `E1.1` | `EPIC-E1` | `FEAT-E1-UNCLASSIFIED` | En cours | `not-started` | `draft` | 1 | 6 | [`E1.1.md`](../../backlog/stories/E1.1.md) |
| `E1.2` | `EPIC-E1` | `FEAT-E1-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`E1.2.md`](../../backlog/stories/E1.2.md) |
| `E1.3` | `EPIC-E1` | `FEAT-E1-UNCLASSIFIED` | En cours | `not-started` | `draft` | 1 | 5 | [`E1.3.md`](../../backlog/stories/E1.3.md) |
| `E1.4` | `EPIC-E1` | `FEAT-E1-UNCLASSIFIED` | Terminé | `not-started` | `contradictory` | 1 | 0 | [`E1.4.md`](../../backlog/stories/E1.4.md) |
| `E1.5` | `EPIC-E1` | `FEAT-E1-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`E1.5.md`](../../backlog/stories/E1.5.md) |
| `E1.WM1` | `EPIC-E1` | `FEAT-E1-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`E1.WM1.md`](../../backlog/stories/E1.WM1.md) |
| `E1.WM2` | `EPIC-E1` | `FEAT-E1-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`E1.WM2.md`](../../backlog/stories/E1.WM2.md) |
| `E1.WM3` | `EPIC-E1` | `FEAT-E1-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`E1.WM3.md`](../../backlog/stories/E1.WM3.md) |
| `E1.fix-TF51` | `EPIC-E1` | `FEAT-E1-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`E1.fix-TF51.md`](../../backlog/stories/E1.fix-TF51.md) |
| `E_OVERLAY.fix-TF59` | `EPIC-E1` | `FEAT-E1-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`E_OVERLAY.fix-TF59.md`](../../backlog/stories/E_OVERLAY.fix-TF59.md) |
| `BCP-11` | `EPIC-E10` | `FEAT-E10-UNCLASSIFIED` | Terminé | `implemented` | `draft` | 1 | 0 | [`BCP-11.md`](../../backlog/stories/BCP-11.md) |
| `BCP-5` | `EPIC-E10` | `FEAT-E10-UNCLASSIFIED` | Terminé | `implemented` | `draft` | 1 | 0 | [`BCP-5.md`](../../backlog/stories/BCP-5.md) |
| `BCP-5/6-fix` | `EPIC-E10` | `FEAT-E10-UNCLASSIFIED` | Terminé | `not-started` | `contradictory` | 1 | 0 | [`BCP-5_6-fix.md`](../../backlog/stories/BCP-5_6-fix.md) |
| `BCP-6` | `EPIC-E10` | `FEAT-E10-UNCLASSIFIED` | Terminé | `implemented` | `draft` | 2 | 0 | [`BCP-6.md`](../../backlog/stories/BCP-6.md) |
| `BCP-6b` | `EPIC-E10` | `FEAT-E10-UNCLASSIFIED` | Terminé | `implemented` | `draft` | 1 | 0 | [`BCP-6b.md`](../../backlog/stories/BCP-6b.md) |
| `BCP-9` | `EPIC-E10` | `FEAT-E10-UNCLASSIFIED` | Terminé | `implemented` | `draft` | 1 | 0 | [`BCP-9.md`](../../backlog/stories/BCP-9.md) |
| `E10.0` | `EPIC-E10` | `FEAT-E10-UNCLASSIFIED` | Terminé | `implemented` | `draft` | 1 | 1 | [`E10.0.md`](../../backlog/stories/E10.0.md) |
| `E10.1` | `EPIC-E10` | `FEAT-E10-PROJECTS` | Terminé | `implemented` | `draft` | 1 | 3 | [`E10.1.md`](../../backlog/stories/E10.1.md) |
| `E10.10` | `EPIC-E10` | `FEAT-E10-UNCLASSIFIED` | Pas commencé | `in-progress` | `draft` | 8 | 1 | [`E10.10.md`](../../backlog/stories/E10.10.md) |
| `E10.10b-1` | `EPIC-E10` | `FEAT-E10-UNCLASSIFIED` | Terminé | `implemented` | `draft` | 1 | 0 | [`E10.10b-1.md`](../../backlog/stories/E10.10b-1.md) |
| `E10.10b-2` | `EPIC-E10` | `FEAT-E10-UNCLASSIFIED` | Terminé | `implemented` | `draft` | 1 | 0 | [`E10.10b-2.md`](../../backlog/stories/E10.10b-2.md) |
| `E10.10b-3` | `EPIC-E10` | `FEAT-E10-UNCLASSIFIED` | Terminé | `implemented` | `draft` | 1 | 0 | [`E10.10b-3.md`](../../backlog/stories/E10.10b-3.md) |
| `E10.10b-4a` | `EPIC-E10` | `FEAT-E10-UNCLASSIFIED` | Terminé | `implemented` | `draft` | 1 | 3 | [`E10.10b-4a.md`](../../backlog/stories/E10.10b-4a.md) |
| `E10.10b-4b` | `EPIC-E10` | `FEAT-E10-UNCLASSIFIED` | Terminé | `implemented` | `draft` | 1 | 7 | [`E10.10b-4b.md`](../../backlog/stories/E10.10b-4b.md) |
| `E10.10b-4c` | `EPIC-E10` | `FEAT-E10-UNCLASSIFIED` | Terminé | `implemented` | `draft` | 1 | 6 | [`E10.10b-4c.md`](../../backlog/stories/E10.10b-4c.md) |
| `E10.11` | `EPIC-E10` | `FEAT-E10-PRICING` | Terminé | `implemented` | `draft` | 1 | 2 | [`E10.11.md`](../../backlog/stories/E10.11.md) |
| `E10.12` | `EPIC-E10` | `FEAT-E10-ORDERS` | Terminé | `implemented` | `draft` | 1 | 3 | [`E10.12.md`](../../backlog/stories/E10.12.md) |
| `E10.13` | `EPIC-E10` | `FEAT-E10-UNCLASSIFIED` | Terminé | `implemented` | `draft` | 1 | 3 | [`E10.13.md`](../../backlog/stories/E10.13.md) |
| `E10.14` | `EPIC-E10` | `FEAT-E10-UNCLASSIFIED` | Terminé | `implemented` | `draft` | 1 | 5 | [`E10.14.md`](../../backlog/stories/E10.14.md) |
| `E10.15` | `EPIC-E10` | `FEAT-E10-UNCLASSIFIED` | Pas commencé | `implemented` | `draft` | 6 | 2 | [`E10.15.md`](../../backlog/stories/E10.15.md) |
| `E10.16` | `EPIC-E10` | `FEAT-E10-ORDERS` | Terminé | `verified` | `draft` | 1 | 4 | [`E10.16.md`](../../backlog/stories/E10.16.md) |
| `E10.17` | `EPIC-E10` | `FEAT-E10-UNCLASSIFIED` | Pas commencé | `implemented` | `draft` | 3 | 3 | [`E10.17.md`](../../backlog/stories/E10.17.md) |
| `E10.17a` | `EPIC-E10` | `FEAT-E10-UNCLASSIFIED` | Terminé | `implemented` | `draft` | 1 | 5 | [`E10.17a.md`](../../backlog/stories/E10.17a.md) |
| `E10.17b` | `EPIC-E10` | `FEAT-E10-UNCLASSIFIED` | Terminé | `implemented` | `draft` | 1 | 5 | [`E10.17b.md`](../../backlog/stories/E10.17b.md) |
| `E10.18` | `EPIC-E10` | `FEAT-E10-EXPORTS` | Terminé | `implemented` | `draft` | 7 | 2 | [`E10.18.md`](../../backlog/stories/E10.18.md) |
| `E10.19` | `EPIC-E10` | `FEAT-E10-ORDERS` | Pas commencé | `implemented` | `draft` | 3 | 1 | [`E10.19.md`](../../backlog/stories/E10.19.md) |
| `E10.2` | `EPIC-E10` | `FEAT-E10-PROJECTS` | Terminé | `implemented` | `draft` | 1 | 1 | [`E10.2.md`](../../backlog/stories/E10.2.md) |
| `E10.20` | `EPIC-E10` | `FEAT-E10-UNCLASSIFIED` | Pas commencé | `implemented` | `draft` | 3 | 3 | [`E10.20.md`](../../backlog/stories/E10.20.md) |
| `E10.21` | `EPIC-E10` | `FEAT-E10-PRICING` | Terminé | `implemented` | `draft` | 1 | 0 | [`E10.21.md`](../../backlog/stories/E10.21.md) |
| `E10.3` | `EPIC-E10` | `FEAT-E10-QUOTES` | Terminé | `implemented` | `draft` | 1 | 2 | [`E10.3.md`](../../backlog/stories/E10.3.md) |
| `E10.4` | `EPIC-E10` | `FEAT-E10-CUSTOMERS` | Terminé | `implemented` | `draft` | 1 | 5 | [`E10.4.md`](../../backlog/stories/E10.4.md) |
| `E10.5` | `EPIC-E10` | `FEAT-E10-CUSTOMERS` | Terminé | `implemented` | `draft` | 1 | 1 | [`E10.5.md`](../../backlog/stories/E10.5.md) |
| `E10.6` | `EPIC-E10` | `FEAT-E10-PRICING` | Terminé | `implemented` | `draft` | 1 | 5 | [`E10.6.md`](../../backlog/stories/E10.6.md) |
| `E10.7` | `EPIC-E10` | `FEAT-E10-PRICING` | Terminé | `implemented` | `draft` | 1 | 3 | [`E10.7.md`](../../backlog/stories/E10.7.md) |
| `E10.8` | `EPIC-E10` | `FEAT-E10-PRICING` | Pas commencé | `implemented` | `draft` | 1 | 2 | [`E10.8.md`](../../backlog/stories/E10.8.md) |
| `E10.9` | `EPIC-E10` | `FEAT-E10-UNCLASSIFIED` | Terminé | `implemented` | `draft` | 1 | 5 | [`E10.9.md`](../../backlog/stories/E10.9.md) |
| `FIX-GARDE` | `EPIC-E10` | `FEAT-E10-UNCLASSIFIED` | Terminé | `not-started` | `contradictory` | 0 | 0 | [`FIX-GARDE.md`](../../backlog/stories/FIX-GARDE.md) |
| `Q-ARBITRAGES` | `EPIC-E10` | `FEAT-E10-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 0 | 0 | [`Q-ARBITRAGES.md`](../../backlog/stories/Q-ARBITRAGES.md) |
| `Q14-a` | `EPIC-E10` | `FEAT-E10-UNCLASSIFIED` | Terminé | `implemented` | `draft` | 0 | 0 | [`Q14-a.md`](../../backlog/stories/Q14-a.md) |
| `Q17-a` | `EPIC-E10` | `FEAT-E10-UNCLASSIFIED` | Terminé | `implemented` | `draft` | 0 | 0 | [`Q17-a.md`](../../backlog/stories/Q17-a.md) |
| `Q17-c` | `EPIC-E10` | `FEAT-E10-UNCLASSIFIED` | Terminé | `implemented` | `draft` | 0 | 0 | [`Q17-c.md`](../../backlog/stories/Q17-c.md) |
| `Q18` | `EPIC-E10` | `FEAT-E10-UNCLASSIFIED` | Terminé | `implemented` | `draft` | 0 | 0 | [`Q18.md`](../../backlog/stories/Q18.md) |
| `Q20` | `EPIC-E10` | `FEAT-E10-UNCLASSIFIED` | Terminé | `implemented` | `draft` | 1 | 0 | [`Q20.md`](../../backlog/stories/Q20.md) |
| `E2.1` | `EPIC-E2` | `FEAT-E2-UNCLASSIFIED` | Terminé | `implemented` | `draft` | 1 | 4 | [`E2.1.md`](../../backlog/stories/E2.1.md) |
| `E2.2` | `EPIC-E2` | `FEAT-E2-UNCLASSIFIED` | Terminé | `implemented` | `draft` | 1 | 4 | [`E2.2.md`](../../backlog/stories/E2.2.md) |
| `E2.3` | `EPIC-E2` | `FEAT-E2-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 1 | [`E2.3.md`](../../backlog/stories/E2.3.md) |
| `E2.4` | `EPIC-E2` | `FEAT-E2-UNCLASSIFIED` | Terminé | `in-progress` | `draft` | 1 | 0 | [`E2.4.md`](../../backlog/stories/E2.4.md) |
| `US-CONV-01` | `EPIC-E2` | `FEAT-E2-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`US-CONV-01.md`](../../backlog/stories/US-CONV-01.md) |
| `E3.1` | `EPIC-E3` | `FEAT-E3-UNCLASSIFIED` | Terminé | `implemented` | `draft` | 1 | 2 | [`E3.1.md`](../../backlog/stories/E3.1.md) |
| `E3.2` | `EPIC-E3` | `FEAT-E3-UNCLASSIFIED` | Terminé | `implemented` | `draft` | 1 | 2 | [`E3.2.md`](../../backlog/stories/E3.2.md) |
| `E3.3` | `EPIC-E3` | `FEAT-E3-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`E3.3.md`](../../backlog/stories/E3.3.md) |
| `E3.4` | `EPIC-E3` | `FEAT-E3-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`E3.4.md`](../../backlog/stories/E3.4.md) |
| `T06.WM2` | `EPIC-E3` | `FEAT-E3-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`T06.WM2.md`](../../backlog/stories/T06.WM2.md) |
| `US-DEMO-02` | `EPIC-E3` | `FEAT-E3-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`US-DEMO-02.md`](../../backlog/stories/US-DEMO-02.md) |
| `E2.fix-TF55` | `EPIC-E4` | `FEAT-E4-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`E2.fix-TF55.md`](../../backlog/stories/E2.fix-TF55.md) |
| `E4.1` | `EPIC-E4` | `FEAT-E4-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`E4.1.md`](../../backlog/stories/E4.1.md) |
| `E4.2` | `EPIC-E4` | `FEAT-E4-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`E4.2.md`](../../backlog/stories/E4.2.md) |
| `E4.3` | `EPIC-E4` | `FEAT-E4-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`E4.3.md`](../../backlog/stories/E4.3.md) |
| `E4.4` | `EPIC-E4` | `FEAT-E4-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`E4.4.md`](../../backlog/stories/E4.4.md) |
| `E4.WM1` | `EPIC-E4` | `FEAT-E4-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`E4.WM1.md`](../../backlog/stories/E4.WM1.md) |
| `E4.WM2` | `EPIC-E4` | `FEAT-E4-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`E4.WM2.md`](../../backlog/stories/E4.WM2.md) |
| `E4.fix-TF54` | `EPIC-E4` | `FEAT-E4-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`E4.fix-TF54.md`](../../backlog/stories/E4.fix-TF54.md) |
| `E_A11Y.shop-pills-and-drawer` | `EPIC-E4` | `FEAT-E4-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`E_A11Y.shop-pills-and-drawer.md`](../../backlog/stories/E_A11Y.shop-pills-and-drawer.md) |
| `E_CART.persist-localstorage` | `EPIC-E4` | `FEAT-E4-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`E_CART.persist-localstorage.md`](../../backlog/stories/E_CART.persist-localstorage.md) |
| `E_DEVTOOLS.passer-commande-modal` | `EPIC-E4` | `FEAT-E4-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`E_DEVTOOLS.passer-commande-modal.md`](../../backlog/stories/E_DEVTOOLS.passer-commande-modal.md) |
| `E_ROOT.fix-PublicShop-hooks` | `EPIC-E4` | `FEAT-E4-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`E_ROOT.fix-PublicShop-hooks.md`](../../backlog/stories/E_ROOT.fix-PublicShop-hooks.md) |
| `E5.1` | `EPIC-E5` | `FEAT-E5-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`E5.1.md`](../../backlog/stories/E5.1.md) |
| `E5.2` | `EPIC-E5` | `FEAT-E5-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`E5.2.md`](../../backlog/stories/E5.2.md) |
| `E5.3` | `EPIC-E5` | `FEAT-E5-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`E5.3.md`](../../backlog/stories/E5.3.md) |
| `US-CONV-02` | `EPIC-E5` | `FEAT-E5-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`US-CONV-02.md`](../../backlog/stories/US-CONV-02.md) |
| `US-DEMO-01` | `EPIC-E5` | `FEAT-E5-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`US-DEMO-01.md`](../../backlog/stories/US-DEMO-01.md) |
| `US-INT-05` | `EPIC-E5` | `FEAT-E5-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`US-INT-05.md`](../../backlog/stories/US-INT-05.md) |
| `E6.1` | `EPIC-E6` | `FEAT-E6-UNCLASSIFIED` | Terminé | `verified` | `draft` | 1 | 4 | [`E6.1.md`](../../backlog/stories/E6.1.md) |
| `E6.2` | `EPIC-E6` | `FEAT-E6-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`E6.2.md`](../../backlog/stories/E6.2.md) |
| `E6.3` | `EPIC-E6` | `FEAT-E6-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`E6.3.md`](../../backlog/stories/E6.3.md) |
| `E6.4` | `EPIC-E6` | `FEAT-E6-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`E6.4.md`](../../backlog/stories/E6.4.md) |
| `E_PIM.audit-classification-ERAM` | `EPIC-E6` | `FEAT-E6-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`E_PIM.audit-classification-ERAM.md`](../../backlog/stories/E_PIM.audit-classification-ERAM.md) |
| `E7.1` | `EPIC-E7` | `FEAT-E7-UNCLASSIFIED` | Terminé | `in-progress` | `draft` | 1 | 3 | [`E7.1.md`](../../backlog/stories/E7.1.md) |
| `E7.2` | `EPIC-E7` | `FEAT-E7-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`E7.2.md`](../../backlog/stories/E7.2.md) |
| `E7.3` | `EPIC-E7` | `FEAT-E7-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`E7.3.md`](../../backlog/stories/E7.3.md) |
| `E7.4` | `EPIC-E7` | `FEAT-E7-UNCLASSIFIED` | Terminé | `not-started` | `contradictory` | 1 | 0 | [`E7.4.md`](../../backlog/stories/E7.4.md) |
| `E7.5` | `EPIC-E7` | `FEAT-E7-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`E7.5.md`](../../backlog/stories/E7.5.md) |
| `E7.6` | `EPIC-E7` | `FEAT-E7-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`E7.6.md`](../../backlog/stories/E7.6.md) |
| `E7.7` | `EPIC-E7` | `FEAT-E7-UNCLASSIFIED` | Terminé | `implemented` | `draft` | 1 | 0 | [`E7.7.md`](../../backlog/stories/E7.7.md) |
| `E7.8` | `EPIC-E7` | `FEAT-E7-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`E7.8.md`](../../backlog/stories/E7.8.md) |
| `E7.WM1` | `EPIC-E7` | `FEAT-E7-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`E7.WM1.md`](../../backlog/stories/E7.WM1.md) |
| `E7.WM2` | `EPIC-E7` | `FEAT-E7-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`E7.WM2.md`](../../backlog/stories/E7.WM2.md) |
| `E_DEVTOOLS.shop-only-account` | `EPIC-E7` | `FEAT-E7-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`E_DEVTOOLS.shop-only-account.md`](../../backlog/stories/E_DEVTOOLS.shop-only-account.md) |
| `E_OBS.mockup-cache-header` | `EPIC-E7` | `FEAT-E7-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`E_OBS.mockup-cache-header.md`](../../backlog/stories/E_OBS.mockup-cache-header.md) |
| `US-CORE-03` | `EPIC-E7` | `FEAT-E7-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`US-CORE-03.md`](../../backlog/stories/US-CORE-03.md) |
| `US-CORE-04` | `EPIC-E7` | `FEAT-E7-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`US-CORE-04.md`](../../backlog/stories/US-CORE-04.md) |
| `E8.1` | `EPIC-E8` | `FEAT-E8-UNCLASSIFIED` | En cours | `not-started` | `draft` | 1 | 0 | [`E8.1.md`](../../backlog/stories/E8.1.md) |
| `E8.2` | `EPIC-E8` | `FEAT-E8-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`E8.2.md`](../../backlog/stories/E8.2.md) |
| `E8.3` | `EPIC-E8` | `FEAT-E8-UNCLASSIFIED` | Pas commencé | `implemented` | `draft` | 1 | 0 | [`E8.3.md`](../../backlog/stories/E8.3.md) |
| `E8.4` | `EPIC-E8` | `FEAT-E8-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`E8.4.md`](../../backlog/stories/E8.4.md) |
| `US-INT-06` | `EPIC-E8` | `FEAT-E8-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`US-INT-06.md`](../../backlog/stories/US-INT-06.md) |
| `E9.1` | `EPIC-E9` | `FEAT-E9-UNCLASSIFIED` | Terminé | `in-progress` | `draft` | 1 | 4 | [`E9.1.md`](../../backlog/stories/E9.1.md) |
| `E9.10` | `EPIC-E9` | `FEAT-E9-UNCLASSIFIED` | Terminé | `in-progress` | `draft` | 1 | 4 | [`E9.10.md`](../../backlog/stories/E9.10.md) |
| `E9.11` | `EPIC-E9` | `FEAT-E9-UNCLASSIFIED` | Terminé | `implemented` | `draft` | 1 | 0 | [`E9.11.md`](../../backlog/stories/E9.11.md) |
| `E9.12` | `EPIC-E9` | `FEAT-E9-UNCLASSIFIED` | Terminé | `in-progress` | `draft` | 1 | 0 | [`E9.12.md`](../../backlog/stories/E9.12.md) |
| `E9.13` | `EPIC-E9` | `FEAT-E9-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 3 | [`E9.13.md`](../../backlog/stories/E9.13.md) |
| `E9.2` | `EPIC-E9` | `FEAT-E9-UNCLASSIFIED` | Terminé | `in-progress` | `draft` | 1 | 5 | [`E9.2.md`](../../backlog/stories/E9.2.md) |
| `E9.3` | `EPIC-E9` | `FEAT-E9-UNCLASSIFIED` | Terminé | `in-progress` | `draft` | 1 | 8 | [`E9.3.md`](../../backlog/stories/E9.3.md) |
| `E9.4` | `EPIC-E9` | `FEAT-E9-UNCLASSIFIED` | Terminé | `implemented` | `draft` | 1 | 3 | [`E9.4.md`](../../backlog/stories/E9.4.md) |
| `E9.5` | `EPIC-E9` | `FEAT-E9-UNCLASSIFIED` | Terminé | `in-progress` | `draft` | 1 | 3 | [`E9.5.md`](../../backlog/stories/E9.5.md) |
| `E9.6` | `EPIC-E9` | `FEAT-E9-UNCLASSIFIED` | Terminé | `implemented` | `draft` | 1 | 1 | [`E9.6.md`](../../backlog/stories/E9.6.md) |
| `E9.7` | `EPIC-E9` | `FEAT-E9-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`E9.7.md`](../../backlog/stories/E9.7.md) |
| `E9.8` | `EPIC-E9` | `FEAT-E9-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`E9.8.md`](../../backlog/stories/E9.8.md) |
| `E9.9` | `EPIC-E9` | `FEAT-E9-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`E9.9.md`](../../backlog/stories/E9.9.md) |
| `US-CORE-01` | `EPIC-E9` | `FEAT-E9-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`US-CORE-01.md`](../../backlog/stories/US-CORE-01.md) |
| `US-CORE-02` | `EPIC-E9` | `FEAT-E9-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`US-CORE-02.md`](../../backlog/stories/US-CORE-02.md) |
| `US-METH-01` | `EPIC-E9` | `FEAT-E9-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`US-METH-01.md`](../../backlog/stories/US-METH-01.md) |
| `T01.1` | `EPIC-T01` | `FEAT-T01-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`T01.1.md`](../../backlog/stories/T01.1.md) |
| `T01.2` | `EPIC-T01` | `FEAT-T01-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`T01.2.md`](../../backlog/stories/T01.2.md) |
| `T01.3` | `EPIC-T01` | `FEAT-T01-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`T01.3.md`](../../backlog/stories/T01.3.md) |
| `T01.4` | `EPIC-T01` | `FEAT-T01-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`T01.4.md`](../../backlog/stories/T01.4.md) |
| `T01.5` | `EPIC-T01` | `FEAT-T01-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`T01.5.md`](../../backlog/stories/T01.5.md) |
| `T01.6` | `EPIC-T01` | `FEAT-T01-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`T01.6.md`](../../backlog/stories/T01.6.md) |
| `T02.1` | `EPIC-T02` | `FEAT-T02-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`T02.1.md`](../../backlog/stories/T02.1.md) |
| `T02.2` | `EPIC-T02` | `FEAT-T02-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`T02.2.md`](../../backlog/stories/T02.2.md) |
| `T02.3` | `EPIC-T02` | `FEAT-T02-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`T02.3.md`](../../backlog/stories/T02.3.md) |
| `T02.4` | `EPIC-T02` | `FEAT-T02-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`T02.4.md`](../../backlog/stories/T02.4.md) |
| `T02.5` | `EPIC-T02` | `FEAT-T02-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`T02.5.md`](../../backlog/stories/T02.5.md) |
| `T02.6` | `EPIC-T02` | `FEAT-T02-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`T02.6.md`](../../backlog/stories/T02.6.md) |
| `T03.1` | `EPIC-T03` | `FEAT-T03-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`T03.1.md`](../../backlog/stories/T03.1.md) |
| `T03.2` | `EPIC-T03` | `FEAT-T03-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`T03.2.md`](../../backlog/stories/T03.2.md) |
| `T03.3` | `EPIC-T03` | `FEAT-T03-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`T03.3.md`](../../backlog/stories/T03.3.md) |
| `T03.4` | `EPIC-T03` | `FEAT-T03-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`T03.4.md`](../../backlog/stories/T03.4.md) |
| `T03.5` | `EPIC-T03` | `FEAT-T03-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`T03.5.md`](../../backlog/stories/T03.5.md) |
| `T03.6` | `EPIC-T03` | `FEAT-T03-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`T03.6.md`](../../backlog/stories/T03.6.md) |
| `T03.WM1` | `EPIC-T03` | `FEAT-T03-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`T03.WM1.md`](../../backlog/stories/T03.WM1.md) |
| `T03.WM2` | `EPIC-T03` | `FEAT-T03-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`T03.WM2.md`](../../backlog/stories/T03.WM2.md) |
| `T03.WM3` | `EPIC-T03` | `FEAT-T03-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`T03.WM3.md`](../../backlog/stories/T03.WM3.md) |
| `T04.1` | `EPIC-T04` | `FEAT-T04-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`T04.1.md`](../../backlog/stories/T04.1.md) |
| `T04.2` | `EPIC-T04` | `FEAT-T04-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`T04.2.md`](../../backlog/stories/T04.2.md) |
| `T04.3` | `EPIC-T04` | `FEAT-T04-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`T04.3.md`](../../backlog/stories/T04.3.md) |
| `T04.4` | `EPIC-T04` | `FEAT-T04-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`T04.4.md`](../../backlog/stories/T04.4.md) |
| `T04.5` | `EPIC-T04` | `FEAT-T04-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`T04.5.md`](../../backlog/stories/T04.5.md) |
| `T04.6` | `EPIC-T04` | `FEAT-T04-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`T04.6.md`](../../backlog/stories/T04.6.md) |
| `T04.7` | `EPIC-T04` | `FEAT-T04-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`T04.7.md`](../../backlog/stories/T04.7.md) |
| `T05.1` | `EPIC-T05` | `FEAT-T05-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`T05.1.md`](../../backlog/stories/T05.1.md) |
| `T05.2` | `EPIC-T05` | `FEAT-T05-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`T05.2.md`](../../backlog/stories/T05.2.md) |
| `T05.3` | `EPIC-T05` | `FEAT-T05-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`T05.3.md`](../../backlog/stories/T05.3.md) |
| `T05.4` | `EPIC-T05` | `FEAT-T05-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`T05.4.md`](../../backlog/stories/T05.4.md) |
| `T05.5` | `EPIC-T05` | `FEAT-T05-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`T05.5.md`](../../backlog/stories/T05.5.md) |
| `T05.6` | `EPIC-T05` | `FEAT-T05-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`T05.6.md`](../../backlog/stories/T05.6.md) |
| `T06.1` | `EPIC-T06` | `FEAT-T06-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`T06.1.md`](../../backlog/stories/T06.1.md) |
| `T06.2` | `EPIC-T06` | `FEAT-T06-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`T06.2.md`](../../backlog/stories/T06.2.md) |
| `T06.3` | `EPIC-T06` | `FEAT-T06-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`T06.3.md`](../../backlog/stories/T06.3.md) |
| `T06.4` | `EPIC-T06` | `FEAT-T06-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`T06.4.md`](../../backlog/stories/T06.4.md) |
| `T06.5` | `EPIC-T06` | `FEAT-T06-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`T06.5.md`](../../backlog/stories/T06.5.md) |
| `T06.6` | `EPIC-T06` | `FEAT-T06-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`T06.6.md`](../../backlog/stories/T06.6.md) |
| `T06.WM1` | `EPIC-T06` | `FEAT-T06-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`T06.WM1.md`](../../backlog/stories/T06.WM1.md) |
| `T06.WM3` | `EPIC-T06` | `FEAT-T06-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`T06.WM3.md`](../../backlog/stories/T06.WM3.md) |
| `T06.WM4` | `EPIC-T06` | `FEAT-T06-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`T06.WM4.md`](../../backlog/stories/T06.WM4.md) |
| `T07.1` | `EPIC-T07` | `FEAT-T07-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`T07.1.md`](../../backlog/stories/T07.1.md) |
| `T07.2` | `EPIC-T07` | `FEAT-T07-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`T07.2.md`](../../backlog/stories/T07.2.md) |
| `T07.3` | `EPIC-T07` | `FEAT-T07-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`T07.3.md`](../../backlog/stories/T07.3.md) |
| `T07.4` | `EPIC-T07` | `FEAT-T07-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`T07.4.md`](../../backlog/stories/T07.4.md) |
| `T07.5` | `EPIC-T07` | `FEAT-T07-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`T07.5.md`](../../backlog/stories/T07.5.md) |
| `T07.WM1` | `EPIC-T07` | `FEAT-T07-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`T07.WM1.md`](../../backlog/stories/T07.WM1.md) |
| `T07.WM2` | `EPIC-T07` | `FEAT-T07-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`T07.WM2.md`](../../backlog/stories/T07.WM2.md) |
| `T08.A1` | `EPIC-T08` | `FEAT-T08-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`T08.A1.md`](../../backlog/stories/T08.A1.md) |
| `T08.A2` | `EPIC-T08` | `FEAT-T08-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`T08.A2.md`](../../backlog/stories/T08.A2.md) |
| `T08.A3` | `EPIC-T08` | `FEAT-T08-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`T08.A3.md`](../../backlog/stories/T08.A3.md) |
| `T08.A4` | `EPIC-T08` | `FEAT-T08-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`T08.A4.md`](../../backlog/stories/T08.A4.md) |
| `T08.A5` | `EPIC-T08` | `FEAT-T08-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`T08.A5.md`](../../backlog/stories/T08.A5.md) |
| `T08.B1` | `EPIC-T08` | `FEAT-T08-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`T08.B1.md`](../../backlog/stories/T08.B1.md) |
| `T08.B2` | `EPIC-T08` | `FEAT-T08-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`T08.B2.md`](../../backlog/stories/T08.B2.md) |
| `T08.B3` | `EPIC-T08` | `FEAT-T08-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`T08.B3.md`](../../backlog/stories/T08.B3.md) |
| `T08.B4` | `EPIC-T08` | `FEAT-T08-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`T08.B4.md`](../../backlog/stories/T08.B4.md) |
| `T08.B5` | `EPIC-T08` | `FEAT-T08-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`T08.B5.md`](../../backlog/stories/T08.B5.md) |
| `T08.N1` | `EPIC-T08` | `FEAT-T08-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`T08.N1.md`](../../backlog/stories/T08.N1.md) |
| `T08.N10` | `EPIC-T08` | `FEAT-T08-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`T08.N10.md`](../../backlog/stories/T08.N10.md) |
| `T08.N11` | `EPIC-T08` | `FEAT-T08-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`T08.N11.md`](../../backlog/stories/T08.N11.md) |
| `T08.N12` | `EPIC-T08` | `FEAT-T08-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`T08.N12.md`](../../backlog/stories/T08.N12.md) |
| `T08.N13` | `EPIC-T08` | `FEAT-T08-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`T08.N13.md`](../../backlog/stories/T08.N13.md) |
| `T08.N14` | `EPIC-T08` | `FEAT-T08-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`T08.N14.md`](../../backlog/stories/T08.N14.md) |
| `T08.N2` | `EPIC-T08` | `FEAT-T08-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`T08.N2.md`](../../backlog/stories/T08.N2.md) |
| `T08.N3` | `EPIC-T08` | `FEAT-T08-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`T08.N3.md`](../../backlog/stories/T08.N3.md) |
| `T08.N4` | `EPIC-T08` | `FEAT-T08-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`T08.N4.md`](../../backlog/stories/T08.N4.md) |
| `T08.N5` | `EPIC-T08` | `FEAT-T08-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`T08.N5.md`](../../backlog/stories/T08.N5.md) |
| `T08.N6` | `EPIC-T08` | `FEAT-T08-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`T08.N6.md`](../../backlog/stories/T08.N6.md) |
| `T08.N7` | `EPIC-T08` | `FEAT-T08-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`T08.N7.md`](../../backlog/stories/T08.N7.md) |
| `T08.N8` | `EPIC-T08` | `FEAT-T08-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`T08.N8.md`](../../backlog/stories/T08.N8.md) |
| `T08.N9` | `EPIC-T08` | `FEAT-T08-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`T08.N9.md`](../../backlog/stories/T08.N9.md) |
| `T08.WM1` | `EPIC-T08` | `FEAT-T08-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`T08.WM1.md`](../../backlog/stories/T08.WM1.md) |
| `T08.WM2` | `EPIC-T08` | `FEAT-T08-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`T08.WM2.md`](../../backlog/stories/T08.WM2.md) |
| `T08.WM3` | `EPIC-T08` | `FEAT-T08-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`T08.WM3.md`](../../backlog/stories/T08.WM3.md) |
| `T08.WM4` | `EPIC-T08` | `FEAT-T08-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`T08.WM4.md`](../../backlog/stories/T08.WM4.md) |
| `US-AO-05` | `EPIC-T08` | `FEAT-T08-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`US-AO-05.md`](../../backlog/stories/US-AO-05.md) |
| `US-AO-06` | `EPIC-T08` | `FEAT-T08-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`US-AO-06.md`](../../backlog/stories/US-AO-06.md) |
| `US-AO-07` | `EPIC-T08` | `FEAT-T08-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`US-AO-07.md`](../../backlog/stories/US-AO-07.md) |
| `US-AO-08` | `EPIC-T08` | `FEAT-T08-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`US-AO-08.md`](../../backlog/stories/US-AO-08.md) |
| `US-AO-09` | `EPIC-T08` | `FEAT-T08-UNCLASSIFIED` | Pas commencé | `not-started` | `draft` | 1 | 0 | [`US-AO-09.md`](../../backlog/stories/US-AO-09.md) |

---

*Rapport produit par un agent. Il prépare une décision, il n'en prend aucune. Tout le contenu migré reste `draft` jusqu'à approbation humaine.*
