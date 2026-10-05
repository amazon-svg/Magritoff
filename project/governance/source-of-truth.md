# Sources de vérité du projet

## Règle générale

Git est l'unique source officielle du projet. La migration initiale depuis Notion a été réalisée le 3 octobre 2026 ; Notion est sorti du jeu et ne sert plus qu'à l'archive de provenance, conservée hors dépôt.

## Autorité par type d'information

| Information | Source canonique |
|---|---|
| Vision, objectifs et périmètre | PRD approuvé dans `project/prd` |
| Fonctionnalité et comportement attendu | Epic, feature ou story approuvée dans `project/backlog` |
| Décision produit | Fichier approuvé dans `project/decisions/product` |
| Décision technique | Fichier approuvé dans `project/decisions/architecture` |
| Contrat API | `openapi/magrit-core.v1.yaml` |
| Règles d'architecture | `docs/REGLES_ARCHITECTURE.md` et décisions techniques liées |
| Travail sélectionné | Dossier du sprint concerné dans `project/sprints` |
| Déroulement d'une réunion | Compte rendu approuvé dans `project/meetings` |
| Comportement effectivement livré | Code et tests au commit considéré |
| Preuve de conformité | Tests exécutés et preuves référencées |

## Départage des contradictions

1. Pour constater le déjà fait, le code livré et les tests exécutés font foi.
2. Pour l'intention, la décision humaine approuvée la plus récente l'emporte sur une story plus ancienne.
3. Une décision plus récente doit mettre à jour ou déprécier les exigences et tests qu'elle invalide.
4. En l'absence de décision permettant de départager, l'élément est marqué `contradictory` et soumis à arbitrage.
5. Un agent ne résout jamais silencieusement une contradiction.

## Sortie de Notion — état au 3 octobre 2026

La sortie est effective. Les règles suivantes sont permanentes :

- aucune information de projet n'est saisie, lue ni synchronisée dans Notion ;
- les identifiants de page et les URL Notion conservés en frontmatter `source:` sont une **provenance**, jamais une autorité ;
- le statut Notion d'origine (`originalStatus`) documente d'où vient la story ; il ne détermine aucun statut Git ;
- le statut de livraison est établi à partir du code, des tests et de l'historique du dépôt ;
- les sections `notion-functional` des story documents de `_bmad-output/` sont **remplacées** par la story canonique du même identifiant dans `project/backlog/stories/` ;
- `scripts/notion/sync_story_functional.py` est un outil retiré : il ne doit plus être exécuté.

L'export complet et daté de la base Notion est conservé hors dépôt. Son emplacement, sa date et son empreinte SHA-256 figurent dans `project/meetings/reports/2026-10-03-rapport-migration-notion.md`.
