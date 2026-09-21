---
id: T04.5
epic: T-04 — Prompt Search
source: notion
notion_url: https://app.notion.com/p/357d0131973c8175b511c22288dd595b
---
# T04.5 — Recherche hybride prompt + catalogue (mot-clé vs phrase)

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [T04.5 — Recherche hybride prompt + catalogue (mot-clé vs phrase)](https://app.notion.com/p/357d0131973c8175b511c22288dd595b) · extrait le 17/09/2026 · page modifiée le 05/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| T-04 — Prompt Search | Sprint 4 | P1 | M | Pas commencé | Claude code | Pro+ | DesignO 21/04 | — |

### Description fonctionnelle (Notion)

**En tant qu'**acheteur, **je veux** que si je tape juste un mot (« carte de visite »), Marguerite me montre rapidement les produits du catalogue correspondants, **afin de** ne pas sur-ingénierer pour une recherche simple.

##### Critères d'acceptation

- Détection automatique intention simple (mot-clé) vs intention composée (phrase).
- Pour intention simple : résultats de recherche catalogue classique mais triés par pertinence métier (produits les plus commandés sur le storefront).
- Pour intention composée : activation du mode Marguerite complet.
- Transition fluide si l'acheteur clique sur un résultat simple et veut le customiser (« configurer cette carte de visite avec Marguerite »).

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent T04.5

_Aucun fichier du dépôt ne cite cet identifiant._
