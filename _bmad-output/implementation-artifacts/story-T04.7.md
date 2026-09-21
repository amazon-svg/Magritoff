---
id: T04.7
epic: T-04 — Prompt Search
source: notion
notion_url: https://app.notion.com/p/357d0131973c8143a6f4dfd2ed32a185
---
# T04.7 — Analytics et métriques de performance prompt

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [T04.7 — Analytics et métriques de performance prompt](https://app.notion.com/p/357d0131973c8143a6f4dfd2ed32a185) · extrait le 17/09/2026 · page modifiée le 05/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| T-04 — Prompt Search | Sprint 4 | P1 | S | Pas commencé | Claude code | Pro+ | DesignO 21/04 | — |

### Description fonctionnelle (Notion)

**En tant qu'**imprimeur client de Magrit, **je veux** mesurer l'impact du plug-in prompt sur mon CA, **afin de** justifier son maintien et ajuster ma communication client.

##### Critères d'acceptation

- Tableau de bord dans l'admin Magrit : nb prompts/jour, taux de conversion prompt → commande, panier moyen via prompt vs search classique, produits les plus demandés via prompt.
- Heatmap des intentions non reconnues (pour enrichir le catalogue ou entraîner Marguerite).
- Export des sessions anonymisées pour analyse externe.

##### Critères de validation pre-prod

- Taux de conversion prompt → commande \> 12% sur 3 storefronts pilotes
- Taux d'intention non reconnue \< 8%
- Latence p95 \< 3 s
- Coût LLM moyen par prompt \< 0,03 €

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent T04.7

_Aucun fichier du dépôt ne cite cet identifiant._
