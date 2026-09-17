---
id: T04.1
epic: T-04 — Prompt Search
source: notion
notion_url: https://app.notion.com/p/357d0131973c814484c3fdd01d5adaad
---
# T04.1 — Installation plug-in Prompt Search en moins d'une heure

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [T04.1 — Installation plug-in Prompt Search en moins d'une heure](https://app.notion.com/p/357d0131973c814484c3fdd01d5adaad) · extrait le 17/09/2026 · page modifiée le 05/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| T-04 — Prompt Search | Sprint 3 | P1 | M | Pas commencé | Claude code | Pro+ | DesignO 21/04 | — |

### Description fonctionnelle (Notion)

**En tant qu'**administrateur d'un storefront Shopify/Woo/Magento/BigC, **je veux** installer le plug-in Magrit Prompt en moins d'une heure de configuration, **afin de** le tester sans engagement lourd.

##### Critères d'acceptation

- Installation via app store de la plateforme (quand disponible) ou via code snippet (Magento / Woo custom).
- Config initiale : clé API Magrit, position du champ dans le header, choix du placeholder.
- Active immédiatement si le connecteur T-03 est déjà opérationnel.
- Mode « prompt uniquement » ou « prompt + search fallback » configurable.
- CSS overrides possibles pour matcher le theme du storefront.

##### Dépendances

- T-03 (connecteurs eCommerce opérationnels)
- E5.1 (API publication) — socle d'auth

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent T04.1

_Aucun fichier du dépôt ne cite cet identifiant._
