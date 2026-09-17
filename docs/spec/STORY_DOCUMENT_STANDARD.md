# Standard du story document — périmètre fonctionnel d'abord

> Règle permanente posée par Arnaud Mazon le 17/09/2026. Elle s'applique à **toute story développée**, quel que soit le chantier ou l'agent.

## La règle

Chaque story document `_bmad-output/implementation-artifacts/story-<ID>.md` s'ouvre sur le **périmètre fonctionnel de la story tel qu'il est décrit dans Notion**. L'implémentation vient ensuite.

Le but : toute personne ou tout agent qui intervient sur une story (développement, QA, revue, reprise) doit trouver, dans le dépôt et au même endroit, **d'abord ce que la story doit faire**, puis ce qui a été fait. Sans la partie fonctionnelle, on vérifie du code sans la référence qu'il est censé respecter.

## Ce que contient la section fonctionnelle

Elle est placée juste sous le titre du document, entre deux marqueurs :

```
<!-- notion-functional:begin — … -->
…
<!-- notion-functional:end -->
```

1. **Lien vers la page Notion**, date d'extraction et date de dernière modification de la page.
2. **Propriétés** de la story : Epic, Sprint, Priorité, Effort, Statut Notion, Assigné à, Offre, Source, Ordre.
3. **Description fonctionnelle** : le corps complet de la page Notion (énoncé, contexte produit, critères d'acceptation, règles de gestion, contrat d'API, notes), recopié **sans reformulation**.
4. **Cas de test rattachés** : liste des cas de la base Notion « 🧪 Cahiers de tests fonctionnels Magrit » dont le champ *Stories liées* cite la story (lien, statut, priorité, parcours, cible).

Trois situations :

| Situation | Contenu de la section |
|---|---|
| Le story document porte l'ID d'une story Notion | Le périmètre de cette story |
| Le story document est un **lot** d'une story Notion (ex. `E10.15a` pour `E10.15`) | Le périmètre de la story entière, avec la mention du lot |
| Aucune story Notion n'est rattachée (refonte technique, lot d'architecture, correctif né dans le dépôt) | Un avertissement qui le dit, et les cas de test éventuels |

Une story Notion sans story document reçoit un fichier `story-<ID>.md` créé depuis Notion, avec en seconde partie les fichiers du dépôt qui citent son identifiant.

## Qui fait foi

**Notion fait foi** pour le fonctionnel. La section est une copie datée : en cas d'écart, on corrige Notion, puis on régénère. On ne modifie jamais la section à la main — elle est remplacée à chaque synchronisation.

Le **statut Notion** peut retarder sur la livraison réelle ; l'état de l'implémentation se lit dans la seconde partie du document.

## Qui fait quoi

| Moment | Agent | Geste |
|---|---|---|
| Avant de coder | `dev-story` | Lit la story Notion **et** vérifie que la section fonctionnelle du story document existe et est à jour ; sinon demande au `scribe` de la générer |
| Création du story document | `dev-story` | Crée le document sous la section fonctionnelle, jamais au-dessus, sans la modifier |
| Revue | `qa-review`, `test-engineer`, `code-reviewer` | Partent de la section fonctionnelle : chaque critère d'acceptation et chaque cas de test rattaché est vérifié contre le code livré |
| Fin de story, et après toute modification d'une story dans Notion | `scribe` | Régénère la section (procédure ci-dessous) |

## Procédure de synchronisation

1. **Extraction** (agent `scribe`, outils Notion) : pour chaque story concernée, un fichier au format décrit dans [`notion-extraction-format.md`](notion-extraction-format.md), plus l'export des cas de test en TSV.
2. **Assemblage** : 

   ```
   python3 scripts/notion/sync_story_functional.py --repo . \
     --stories <dossier d'extraction> --tf <export des cas de test>.tsv --date JJ/MM/AAAA
   ```

   Le script est idempotent : il remplace la section entre marqueurs, crée les fichiers manquants et régénère [`INDEX-stories-notion.md`](../../_bmad-output/implementation-artifacts/INDEX-stories-notion.md).
3. **Contrôle** : `git diff` — seules les sections entre marqueurs, les fichiers créés depuis Notion et l'index doivent bouger.

Les fichiers d'extraction sont des fichiers de travail : ils ne se versionnent pas.

## Limites connues

- Certaines cellules de tableau Notion arrivent coupées à l’extraction par les outils Notion (4 cas au 17/09/2026 : E9.3, E10.4, E10.7, E10.18 ; cause non établie). Elles sont marquées « ⚠️ cellule arrivée tronquée » : lire la page Notion.
- Le rattachement d'un story document à une story Notion se fait par l'identifiant (champ `id` du frontmatter, sinon nom de fichier). Un story document qui implémente une story Notion sous un autre identifiant doit porter l'ID Notion dans son frontmatter pour être rattaché.
