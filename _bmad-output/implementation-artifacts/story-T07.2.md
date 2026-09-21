---
id: T07.2
epic: T-07 — Canva
source: notion
notion_url: https://app.notion.com/p/357d0131973c8148894ac14764e6b78b
---
# T07.2 — Mapping gabarit Clariprint → design Canva (20 familles V1)

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [T07.2 — Mapping gabarit Clariprint → design Canva (20 familles V1)](https://app.notion.com/p/357d0131973c8148894ac14764e6b78b) · extrait le 17/09/2026 · page modifiée le 05/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| T-07 — Canva | Sprint 3 | P1 | M | Pas commencé | Laurent | Pro+ | DesignO 21/04 | — |

### Description fonctionnelle (Notion)

**En tant que** plateforme, **je veux** traduire les gabarits Clariprint en designs Canva pré-configurés, **afin que** l'utilisateur trouve un canevas correct (dimensions, bleed, marges) dès l'ouverture de Canva.

##### Critères d'acceptation

- Pour chaque famille produit, Clariprint fournit : dimensions, bleed, marges, zones sûres, profils colorimétriques, nombre de pages/faces, contraintes de façonnage.
- Magrit traduit ces paramètres en **design Canva pré-configuré** via l'API (dimensions custom, guides, calques réservés).
- Couverture V1 : 20 familles produits les plus courantes (cartes de visite, flyers A4/A5/A6, affiches standard, brochures pliées 2/3/4 volets, dépliants, stickers, roll-ups).
- Extension progressive du catalogue selon usage.

##### Dépendances

- E1 (moteur Clariprint avec API gabarits)
- E8.1 (catalogue 38 produits) pour la couverture V1

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent T07.2

_Aucun fichier du dépôt ne cite cet identifiant._
