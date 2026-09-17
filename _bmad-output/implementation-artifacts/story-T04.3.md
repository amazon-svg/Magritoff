---
id: T04.3
epic: T-04 — Prompt Search
source: notion
notion_url: https://app.notion.com/p/357d0131973c815e9241f388231ada68
---
# T04.3 — Compréhension d'une intention composée (kit / campagne)

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [T04.3 — Compréhension d'une intention composée (kit / campagne)](https://app.notion.com/p/357d0131973c815e9241f388231ada68) · extrait le 17/09/2026 · page modifiée le 05/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| T-04 — Prompt Search | Sprint 3 | P1 | L | Pas commencé | Claude code | Pro+ | DesignO 21/04 | — |

### Description fonctionnelle (Notion)

**En tant que** chef de projet marketing, **je veux** décrire en langage naturel une opération complète (« ouverture d'un magasin de 200m² le 15 juin, je veux un kit complet : PLV intérieure, kakemonos, tracts de distribution, signalétique vitrine »), **afin que** Marguerite me propose un kit cohérent avec les produits du catalogue.

##### Critères d'acceptation

- Marguerite identifie les éléments du kit.
- Cartographie chaque élément sur un produit catalogue.
- Propose des quantités cohérentes (ex : 500 tracts pour une surface commerciale d'environ 200 m² suggère une zone de chalandise X).
- Affiche le kit avec prix ligne par ligne + total.
- Permet l'édition du kit (retirer un élément, modifier une quantité) avant ajout panier.
- Un clic « Ajouter le kit au panier » ajoute tous les éléments.

##### Différenciateur blue-ocean

Aucun concurrent web-to-print n'offre aujourd'hui une expérience conversationnelle composée. C'est là que Magrit se démarque de DesignO 2.6.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent T04.3

_Aucun fichier du dépôt ne cite cet identifiant._
