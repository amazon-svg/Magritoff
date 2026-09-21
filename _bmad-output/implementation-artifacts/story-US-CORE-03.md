---
id: US-CORE-03
epic: E7 — Perf & infra
source: notion
notion_url: https://app.notion.com/p/375d0131973c8106b12dea8e890862af
---
# CI/CD GitHub Actions & traçabilité des agent runs

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [CI/CD GitHub Actions & traçabilité des agent runs](https://app.notion.com/p/375d0131973c8106b12dea8e890862af) · extrait le 17/09/2026 · page modifiée le 04/06/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E7 — Perf & infra | Backlog | P1 | — | Pas commencé | Laurent | Technique | WM 03/06/2026 | — |

### Description fonctionnelle (Notion)

**Description.** GitHub Actions, tests à chaque push, avancement itératif (story N+1 non démarrée tant que N non clean). « Agent runs » historisés (demande initiale + rapport).

**Critères d'acceptation.**

- Pipeline vert obligatoire avant merge.
- Chaque agent run tracé dans Git.

*Source : WM#030626 — réf. 00:14:19.*

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent US-CORE-03

_Aucun fichier du dépôt ne cite cet identifiant._
