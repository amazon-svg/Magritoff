---
id: E9.11
epic: E9 — Multi-tenant & gouvernance
source: notion
notion_url: https://app.notion.com/p/357d0131973c818aa67bc74c10a970a9
---
# E9.11 — Réintégrer un produit exclu de boutique (one-way → two-way)

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [E9.11 — Réintégrer un produit exclu de boutique (one-way → two-way)](https://app.notion.com/p/357d0131973c818aa67bc74c10a970a9) · extrait le 17/09/2026 · page modifiée le 05/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E9 — Multi-tenant & gouvernance | Sprint 2 | P1 | S | Terminé | Claude code | Pro+ | Beta 3 livraison | — |

### Description fonctionnelle (Notion)

**En tant qu'**admin d'espace, **je veux** réintégrer un produit que j'ai exclu d'une boutique, **afin de** corriger une exclusion par erreur sans avoir à toucher la base.

##### Contexte

Dans Beta 3, l'exclusion ajoute un id à `shops.excluded_product_ids[]`. Aucun bouton UI pour retirer un id de cette liste — il faut l'enlever en SQL.

##### Critères d'acceptation

- Section repliable `<details>` « Produits exclus de cette boutique » dans `DashboardShopEditor`.
- Liste des produits exclus avec bouton « Réintégrer » par ligne.
- Au clic : retire l'id de `excluded_product_ids[]`, le produit réapparaît dans la liste agrégée.
- Toast de confirmation.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent E9.11

- `SPRINT_HANDOFF.md`
- `_bmad-output/planning-artifacts/prd.md`
- `src/modules/shops/ui/workspace/ShopEditorPage.tsx`
