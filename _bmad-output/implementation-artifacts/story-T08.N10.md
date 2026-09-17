---
id: T08.N10
epic: T-08 — AO & Catalogues
source: notion
notion_url: https://app.notion.com/p/373d0131973c815c8de5cc7096cb5096
---
# T08.N10 — Mapping ligne normalisée → produit Clariprint chiffrable (grand format inclus)

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [T08.N10 — Mapping ligne normalisée → produit Clariprint chiffrable (grand format inclus)](https://app.notion.com/p/373d0131973c815c8de5cc7096cb5096) · extrait le 17/09/2026 · page modifiée le 02/06/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| T-08 — AO & Catalogues | Backlog | P0 | L | Pas commencé | — | Toutes | — | — |

### Description fonctionnelle (Notion)

##### User story
En tant que système, je veux associer chaque ligne normalisée à un produit Clariprint paramétré (gabarit + options), afin de router le chiffrage.
##### Contexte
**Clariprint traite l'essentiel des gammes, y compris le grand format / la signalétique** (Dibond, Akilux, carton plume, PVC, bâche, roll-up). Les statuts `manual`/`unmapped` ne sont **pas** une exclusion par gamme : ce sont des replis transitoires pour les seuls articles réellement absents du catalogue, sans faire échouer le lot.
##### Critères d'acceptation
- Chaque ligne reçoit `clariprint.status` ∈ \{`mapped`, `manual`, `unmapped`\}.
- Le mapping cible le catalogue Clariprint **complet** (offset ET grand format) ; aucune famille exclue a priori.
- `manual`/`unmapped` seulement si aucune correspondance catalogue, avec motif explicite — jamais selon le type de support.
- Couverture `mapped` ≥ 95 % sur la fixture une fois Clariprint connecté ; résidus listés et justifiés.
##### Specs API / Data
`POST /api/ao/imports/{id}/map-clariprint` ; table support/façonnage → `product_code` + `options[]` couvrant tout le catalogue. LLM en repli. Champ `clariprint`.
##### Dépendances
T08.N9 ; **connexion au catalogue Clariprint complet (Magrit Core), grand format inclus — prérequis bloquant.**
**Effort : L (≈8 pts).**

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent T08.N10

_Aucun fichier du dépôt ne cite cet identifiant._
