---
id: T08.N6
epic: T-08 — AO & Catalogues
source: notion
notion_url: https://app.notion.com/p/373d0131973c8187885acf6474e6f956
---
# T08.N6 — Normaliseur Formats

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [T08.N6 — Normaliseur Formats](https://app.notion.com/p/373d0131973c8187885acf6474e6f956) · extrait le 17/09/2026 · page modifiée le 02/06/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| T-08 — AO & Catalogues | Backlog | P1 | M | Pas commencé | — | Toutes | — | — |

### Description fonctionnelle (Notion)

##### User story
En tant que système, je veux normaliser les formats en `{width_mm, height_mm, shape, closed_format, open_format, diameter_mm}`, afin de gérer plis, formes et multi-formats.
##### Contexte
Réel : `210×297`, `85×54`, `Diamètre : 40`, `Format fermé : 297×210 / ouvert : 594×420`, `Format fini : A5 148×210 / ouvert : 740×210`, `1185×1750` (abribus), `2400×1600` (4 m²).
##### Critères d'acceptation
- `L×H` extraits en mm ; séparateurs `x`, `×`, `*` tolérés.
- Formes : rectangle (défaut), rond (`Diamètre`→`shape=disc`,`diameter_mm`).
- Pliés : `closed_format` et `open_format` distingués si présents.
- Séries A0–A6 reconnues et converties en mm.
- 100 % des lignes fixture avec au moins `closed_format` ; multi-format conservé en `raw`.
##### Specs API / Data
Parseur déterministe + table A-séries → champ `format` de `ao_line`.
##### Dépendances
T08.N4.
**Effort : M (≈5 pts).**

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent T08.N6

_Aucun fichier du dépôt ne cite cet identifiant._
