---
id: T08.N3
epic: T-08 — AO & Catalogues
source: notion
notion_url: https://app.notion.com/p/373d0131973c81dab578e7d8bbf6f6b4
---
# T08.N3 — Résolution des fusions et report (fill-down) des attributs hérités

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [T08.N3 — Résolution des fusions et report (fill-down) des attributs hérités](https://app.notion.com/p/373d0131973c81dab578e7d8bbf6f6b4) · extrait le 17/09/2026 · page modifiée le 02/06/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| T-08 — AO & Catalogues | Backlog | P0 | S | Pas commencé | — | Toutes | — | — |

### Description fonctionnelle (Notion)

##### User story
En tant que système, je veux propager les attributs hérités (catégorie, et toute cellule fusionnée verticalement), afin que chaque ligne produit soit autoporteuse.
##### Contexte
La catégorie (col. A) est fusionnée sur des dizaines de lignes ; sans report, le rattachement produit↔catégorie est perdu — c'est ce qui avait faussé le premier comptage.
##### Critères d'acceptation
- Toute cellule d'une plage fusionnée prend la valeur du coin haut-gauche.
- Les champs hérités (catégorie/format/papier) d'une fusion verticale sont résolus sur chaque ligne produit.
- Contrôle : aucune ligne `product` de la fixture n'a de `category` nulle.
##### Specs API / Data
Étape interne de `parse`/`normalize` ; table `(row,col)→valeur` construite depuis `merged_ranges`.
##### Dépendances
T08.N1, T08.N2.
**Effort : S (≈3 pts).**

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent T08.N3

_Aucun fichier du dépôt ne cite cet identifiant._
