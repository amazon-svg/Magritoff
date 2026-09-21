---
id: T08.N9
epic: T-08 — AO & Catalogues
source: notion
notion_url: https://app.notion.com/p/373d0131973c81588365fc836b1b9228
---
# T08.N9 — Modèle « ligne AO normalisée » + export référentiel

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [T08.N9 — Modèle « ligne AO normalisée » + export référentiel](https://app.notion.com/p/373d0131973c81588365fc836b1b9228) · extrait le 17/09/2026 · page modifiée le 02/06/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| T-08 — AO & Catalogues | Backlog | P0 | M | Pas commencé | — | Toutes | — | — |

### Description fonctionnelle (Notion)

##### User story
En tant qu'imprimeur, je veux obtenir le référentiel normalisé (JSON, CSV, Markdown) avec un identifiant traçable par ligne, afin de relire/transmettre et d'alimenter le chiffrage.
##### Contexte
Sortie machine du référentiel produit à la main lors du cas ICI (`Referentiel_AO_GroupeICI_LOT1.md`).
##### Critères d'acceptation
- `GET /api/ao/imports/{id}/lines?format=json|csv|md`.
- Chaque ligne porte `ref` (préfixe catégorie : MAG, BRO, PAP, FLY, DEP, AFF, ADH, PAN, ROL, POC, TOU…) et `source_row_index`.
- Le rendu MD reproduit la structure validée sur la fixture (**234 lignes, 11 sections**).
- Idempotence : deux exécutions sur la fixture → diff nul.
##### Specs API / Data
Sérialiseurs JSON/CSV/MD depuis `ao_line`. Préfixes dérivés de la catégorie (slug 3 lettres, collision → suffixe).
##### Dépendances
T08.N5, T08.N6, T08.N7, T08.N8.
**Effort : M (≈5 pts).**

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent T08.N9

_Aucun fichier du dépôt ne cite cet identifiant._
