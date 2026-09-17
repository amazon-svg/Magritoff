---
id: T08.N7
epic: T-08 — AO & Catalogues
source: notion
notion_url: https://app.notion.com/p/373d0131973c8148a352e4b05b36b8a8
---
# T08.N7 — Normaliseur Support / Papier

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [T08.N7 — Normaliseur Support / Papier](https://app.notion.com/p/373d0131973c8148a352e4b05b36b8a8) · extrait le 17/09/2026 · page modifiée le 02/06/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| T-08 — AO & Catalogues | Backlog | P1 | M | Pas commencé | — | Toutes | — | — |

### Description fonctionnelle (Notion)

##### User story
En tant que système, je veux décomposer le support en `{family, recycled, gsm|thickness_mm, finish, composite[]}`, afin de mapper sur les supports Clariprint.
##### Contexte
Réel : `RESPECTA … 115g`, `Offset laser recyclé 350g`, `vinyle 140 g/m²`, `Polypro blanc`, `Dibond 3 mm`, `Akilux 3 mm`, `Carton plume 5/10 mm`, `PVC blanc 760µ`, `Bâche 270 g/m²`, et composites brochure (couverture + intérieur).
##### Critères d'acceptation
- `family` ∈ table extensible \{RESPECTA, Offset, Polypro, Vinyle, Dibond, Akilux, Carton plume, PVC, Bâche…\}.
- Grammage `g/m²`→`gsm` ; épaisseur `mm`/`µ`→`thickness_mm` ; `recycled` déduit.
- Composite couverture/intérieur capté dans `support.composite[]` avec rôles.
- Libellés non reconnus → flag `support_unknown` (sans blocage).
##### Specs API / Data
Parseur + table familles/finitions ; LLM en repli pour libellés non catalogués. Champ `support`.
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

### Fichiers du dépôt qui citent T08.N7

_Aucun fichier du dépôt ne cite cet identifiant._
