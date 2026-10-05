---
id: REPORT-2026-10-04-SYNTHESE
title: Synthèse pour relecture — migration du backlog et passe de qualité
date: 2026-10-04
status: draft
source: MEET-2026-10-01-ATELIER
---

# Synthèse pour relecture

> Actualisation du 5 octobre : [la synthèse de reprise du 5 octobre](2026-10-05-synthese-reprise-projet.md) corrige l’interprétation de US-CONV-02 et distingue l’intégration HopeStudio existante des sujets d’API pour tiers. Les questions ci-dessous ne doivent plus être prises comme prérequis automatiques de cette intégration.

**Pour Xavier Péchoultres.** Porte d'entrée unique de la demande de fusion `migration/notion-backlog-init`. Trois documents la détaillent ; celui-ci dit lequel ouvrir selon ce que tu cherches.

## Ce qui s'est passé, en trois temps

**1. La migration (3 octobre).** Les 206 lignes de la base Notion sont passées dans `project/backlog/`. Un export complet et daté a été produit avant toute transformation, et conservé hors dépôt. Le statut Notion n'a jamais été recopié : chaque statut de livraison a été établi depuis le dépôt.

**2. La passe de qualité (nuit du 3 au 4).** Les stories migrées portaient l'héritage de l'import — provenance verbeuse, tâches de mai 2026, chemins disparus, et des mentions de Supabase et de fonctions Edge présentées comme la solution technique. Quinze agents les ont réécrites pour un lecteur précis : un agent de développement qui doit produire du code juste. Un lot pilote a été relu avant d'engager les quatorze autres.

**3. Les arbitrages d'Arnaud (4 octobre).** Six décisions, dont le modèle d'entités d'une franchise, qui débloque l'epic `T-02`.

## Les chiffres

| | |
|---|---:|
| Lignes lues dans Notion | 206 — et non 197, le chiffre historique était périmé |
| Stories dans le backlog | **201** après retrait de quatre entrées qui n'étaient pas des stories |
| Epics · fonctionnalités | 18 · 24 |
| Statuts de livraison | `verified` 2 · `implemented` 47 · `in-progress` 8 · `not-started` 144 · `released` **0** |
| Contenus `approved` | **0** — les rôles d'approbation ne sont pas attribués |

Aucune story n'est `released` : le dépôt ne porte aucune preuve de déploiement rattachable à une story. Les mentions de déploiement vivent en prose dans les anciennes pages Notion, sans référence à un commit.

## Où regarder

| Ce que tu cherches | Document |
|---|---|
| Ce qui t'attend, toi — trois sujets d'architecture à trancher | [`2026-10-04-note-a-xavier-pechoultres.md`](2026-10-04-note-a-xavier-pechoultres.md) · 1 page |
| Comment la migration a été faite, et la table de correspondance Notion → Git story par story | [`2026-10-03-rapport-migration-notion.md`](2026-10-03-rapport-migration-notion.md) · annexe B |
| Les écarts entre ce que disent les stories et ce que fait le code | [`2026-10-03-rapport-passe-qualite-backlog.md`](2026-10-03-rapport-passe-qualite-backlog.md) · section 6 |
| Les doublons et recouvrements à arbitrer | même rapport · section 8 |
| Ce que la passe n'a volontairement pas fait | même rapport · section 12 |
| L'archive de l'export Notion, son emplacement et son empreinte | rapport de migration · section 1 |

## Les trois décisions qui te reviennent

1. **Une clé de service doit-elle pouvoir écrire ?** Sur tout le contrat, une seule opération l'accepte. Tant que ce n'est pas tranché, `E5.1`, `E5.2` et `US-CONV-02` se réduisent à de la lecture. Et `US-CONV-02`, la story P0 que tu attends, décrit le sens inverse de ce que le contrat publie aujourd'hui.
2. **Le chantier UM doit porter une décision écrite.** Il fait autorité par le code depuis août, sans fichier dans `project/decisions/`. Sept stories décrivent encore l'ancien modèle de droits — `E9.3` en totalité.
3. **Deux points d'hygiène** : `pnpm test` n'est joué par aucune chaîne d'intégration continue sur une fusion vers `main`, et 18 `data-testid` vivent hors du registre sans garde-fou.

Le détail de chacune est dans la note qui t'est adressée.

## Ce que nous n'avons pas touché

Par respect de la répartition arrêtée en séance, et des règles de gouvernance :

- **aucun statut n'est passé `approved`** — un agent ne s'attribue pas une approbation produit ;
- **aucune décision du 1er octobre n'a été propagée dans les stories** : les stories concernées sont relevées, la propagation t'appartient ;
- **aucune story n'a été fusionnée ni dépréciée** : les doublons et les caducités sont signalés, l'arbitrage appartient à l'autorité produit ;
- `T08.WM2` reste `draft` bien qu'elle se déclare remplacée dans son propre titre ;
- **aucun story document de `_bmad-output/` n'a été déplacé ni modifié** ; les stories les référencent en `implementationRecords` ;
- un seul fichier de code a été ajouté, un test de non-régression (voir ci-dessous). Aucun code applicatif n'a été modifié.

## Un défaut de notre côté, corrigé

Le balayage de migration comptait toute mention d'un identifiant dans le code comme une preuve d'implémentation. C'était faux dans les deux sens : `E10.8` portait `implemented` sur la foi de douze mentions dont dix écrivent « E10.8 gelée, aucun calcul de prix ici ». Les preuves sont désormais hiérarchisées — un test, un story document avec signal d'implémentation ou un cahier de tests exécuté OK valent livraison ; une mention en commentaire ne vaut rien. Douze statuts corrigés. La méthode révisée est en section 5 du rapport de migration.

Dans le même esprit, `TF-16` — « un utilisateur non admin n'accède ni à la page Utilisateurs ni à l'API d'invitation », KO depuis le 24 août et non rejouable depuis la sortie de Notion — a été vérifié : la garde existe aux deux niveaux. Ce qui manquait était la preuve. `tests/architecture/members-administration-guard.test.ts` la fige.

## Le point de départ

La branche part du commit de gouvernance `569ad31f`, qui n'est pas sur `main`. La demande de fusion vise donc `codex/governance-processes`.
