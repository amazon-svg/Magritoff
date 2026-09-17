# Format d'extraction des stories Notion

> Utilisé par l'agent `scribe` avant `scripts/notion/sync_story_functional.py`. Règle : [`STORY_DOCUMENT_STANDARD.md`](STORY_DOCUMENT_STANDARD.md).

## Stories — base « 📋 Backlog Magrit — Sprint Board »

Data source : `collection://7d217854-c684-4981-b514-1b668d1dc983`.

Pour chaque story : `notion-fetch` sur la page (refaire l'appel si le résultat est tronqué), puis écrire `<dossier>/<ID_FICHIER>.md`, où `<ID_FICHIER>` est l'ID avec `/` remplacé par `_`.

Ligne 1 — commentaire HTML contenant un JSON sur une ligne :

```
<!-- props: {"ID": "...", "Story": "<titre exact>", "url": "https://app.notion.com/p/<page_id>", "Epic": ..., "Sprint": ..., "Priorité": ..., "Effort": ..., "Statut": ..., "Assigné à": ..., "Offre": ..., "Source": [...], "Ordre": ..., "Date": ..., "last_edited": "<page_last_edited_at>"} -->
```

Lignes suivantes — le corps de la page converti en Markdown GitHub :

- **texte strictement identique** : aucune reformulation, aucun résumé, aucune coupe, aucun ajout ;
- conversion de forme seulement : encadré Notion → citation `>`, bloc dépliable → titre + contenu, tableau → tableau Markdown, mention → lien `[titre](url)`, case à cocher → `- [ ]` / `- [x]` ;
- titres décalés : `#` → `####`, `##` → `#####`, `###` → `######` ;
- ni le titre ni les propriétés dans le corps ;
- corps vide → `_Page Notion sans description au JJ/MM/AAAA._`

## Cas de test — base « 🧪 Cahiers de tests fonctionnels Magrit »

Data source : `collection://9e8f5f5f-8143-4872-8720-b14cd543fc4e`.

Fichier TSV, en-tête `tf_id	titre	statut	priorite	parcours	cible	stories	url`, une ligne par cas (colonnes Notion : « TF ID », « Titre du cas », « Statut », « Priorité », « Parcours », « Cible Beta », « Stories liées », url). Tabulations et retours à la ligne internes remplacés par une espace.
