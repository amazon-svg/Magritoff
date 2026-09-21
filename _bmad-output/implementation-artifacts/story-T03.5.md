---
id: T03.5
epic: T-03 — Sync eCommerce
source: notion
notion_url: https://app.notion.com/p/357d0131973c8135b745c1e64ef4577c
---
# T03.5 — Mapping des variants (multi-color/size/option → config Clariprint)

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [T03.5 — Mapping des variants (multi-color/size/option → config Clariprint)](https://app.notion.com/p/357d0131973c8135b745c1e64ef4577c) · extrait le 17/09/2026 · page modifiée le 05/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| T-03 — Sync eCommerce | Sprint 3 | P0 | M | Pas commencé | Claude code | Pro+ | DesignO 21/04 | — |

### Description fonctionnelle (Notion)

**En tant qu'**imprimeur, **je veux** que les variants Shopify/Woo (taille, couleur, option d'impression) soient correctement mappés aux configurations produit Clariprint, **afin que** le prix affiché sur mon storefront soit toujours exact après sélection du variant.

##### Critères d'acceptation

- Mapping multi-color, multi-size, multi-option résolu correctement (bug explicite corrigé dans DesignO 2.6 — à faire bien dès V1 côté Magrit).
- Prix live computed par Clariprint et poussé vers le variant Shopify.
- Configuration du mapping configurable via admin Magrit.
- Gestion des variants non mappés (warning, pas silencieux).

##### Dépendances

- E1 (moteur Clariprint), E5.1 (API publication CMS)

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent T03.5

_Aucun fichier du dépôt ne cite cet identifiant._
