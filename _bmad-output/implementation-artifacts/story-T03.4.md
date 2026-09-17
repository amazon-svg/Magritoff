---
id: T03.4
epic: T-03 — Sync eCommerce
source: notion
notion_url: https://app.notion.com/p/357d0131973c81ec921bf0403dac15c7
---
# T03.4 — Résilience et rattrapage après panne (Fetch Orders Utility)

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [T03.4 — Résilience et rattrapage après panne (Fetch Orders Utility)](https://app.notion.com/p/357d0131973c81ec921bf0403dac15c7) · extrait le 17/09/2026 · page modifiée le 05/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| T-03 — Sync eCommerce | Sprint 3 | P0 | M | Pas commencé | Claude code | Pro+ | DesignO 21/04 | — |

### Description fonctionnelle (Notion)

**En tant qu'**intégrateur ou support Magrit, **je veux** un utilitaire de Fetch Orders qui rattrape les commandes non synchronisées après une panne API, une coupure réseau ou un webhook perdu, **afin de** rebasculer rapidement sans faire de re-synchro complète coûteuse.

##### Critères d'acceptation

- Option de fetch par `order_id` unique.
- Option de fetch par date range.
- Option de fetch sur commandes avec « statut divergent » détecté automatiquement.
- Dry-run disponible (montre ce qui serait changé sans appliquer).
- Logs exportables CSV/JSON.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent T03.4

_Aucun fichier du dépôt ne cite cet identifiant._
