# Sources de vérité du projet

## Règle générale

Git est l'unique source officielle du projet. Notion est gelé et sert uniquement à la migration initiale et à l'archive historique.

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

## Transition Notion

- Aucune nouvelle information de projet n'est saisie dans Notion.
- Les exports et URL Notion sont conservés uniquement comme provenance historique.
- Une importation arrive au statut `draft`.
- Le statut de livraison est établi à partir du dépôt, pas du statut Notion.
- Les anciennes sections `notion-functional` sont des instantanés historiques jusqu'à leur remplacement par un fichier canonique du backlog.
