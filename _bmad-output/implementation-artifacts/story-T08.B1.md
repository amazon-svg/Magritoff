---
id: T08.B1
epic: T-08 — AO & Catalogues
source: notion
notion_url: https://app.notion.com/p/357d0131973c8129b6d3db84394ef79c
---
# T08.B1 — Import Excel massif (XLSX/XLS/CSV, 50k lignes)

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [T08.B1 — Import Excel massif (XLSX/XLS/CSV, 50k lignes)](https://app.notion.com/p/357d0131973c8129b6d3db84394ef79c) · extrait le 17/09/2026 · page modifiée le 05/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| T-08 — AO & Catalogues | Sprint 4 | P0 | M | Pas commencé | Claude code | Enterprise | DesignO 21/04 | — |

### Description fonctionnelle (Notion)

**En tant que** direction marketing/achats grand compte, **je veux** importer un catalogue Excel massif dans Magrit, **afin de** ne pas resaisir 3 500 références print à la main.
##### Critères d'acceptation
- Support **XLSX, XLS, CSV** ; fichiers jusqu'à 50 000 lignes.
- Performance : import 10 000 lignes en \< 60 s.
- Robustesse : tolérance aux fichiers mal formés (lignes vides, headers multiples, cellules fusionnées).
- Trace : chaque ligne importée conserve l'origine (fichier, ligne, utilisateur, date).
##### Cible commerciale
Priorité P0 sur sous-module B (Catalogues Excel) car POC livrable Q4 2026 — condition d'entrée Altavia + retailers ETI.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent T08.B1

_Aucun fichier du dépôt ne cite cet identifiant._
