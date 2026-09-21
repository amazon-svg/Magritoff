---
id: T08.N8
epic: T-08 — AO & Catalogues
source: notion
notion_url: https://app.notion.com/p/373d0131973c81efb8e7cb7c33afb57e
---
# T08.N8 — Normaliseur Façonnage (vocabulaire métier → options)

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [T08.N8 — Normaliseur Façonnage (vocabulaire métier → options)](https://app.notion.com/p/373d0131973c81efb8e7cb7c33afb57e) · extrait le 17/09/2026 · page modifiée le 02/06/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| T-08 — AO & Catalogues | Backlog | P1 | L | Pas commencé | — | Toutes | — | — |

### Description fonctionnelle (Notion)

##### User story
En tant que système, je veux convertir le texte de façonnage en liste d'options métier structurées, afin d'alimenter le calcul et le mapping Clariprint.
##### Contexte
Vocabulaire riche : `2 piqûres à cheval`, `dos carré collé` (souvent en option), plis `croisés/roulés/accordéon`, `rainage`, `découpe (forme existante/à créer/mi-chair/pleine)`, `œillets (avec/sans)`, `lamination/vernis/plastification anti-UV`, `coins arrondis`, `numérotation`, `feuillets détachables`, `50 bons/carnet`, `24 poses/planche`, `20 modèles différents`.
##### Critères d'acceptation
- Sortie `finishing[]` = `{type, subtype?, count?, optional:bool, raw}`.
- `type` ∈ énum \{piqure_cheval, dos_carre_colle, pli, rainage, decoupe, oeillets, lamination, vernis, plastification, coins_arrondis, numerotation, feuillets, autre\}.
- Comptes extraits ; `optional=true` sur « option … » / « avec ou sans … » (→ expansion T08.N11).
- Façonnages non mappés → flag `finishing_low_confidence` + brut conservé.
- Couverture ≥ 95 % des lignes fixture sans flag.
##### Specs API / Data
Parseur déterministe (lexique métier) + LLM (Claude) en repli, JSON contraint. Champ `finishing`.
##### Dépendances
T08.N4.
**Effort : L (≈8 pts).**

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent T08.N8

_Aucun fichier du dépôt ne cite cet identifiant._
