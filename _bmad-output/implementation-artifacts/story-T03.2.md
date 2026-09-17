---
id: T03.2
epic: T-03 — Sync eCommerce
source: notion
notion_url: https://app.notion.com/p/357d0131973c81cdbd40c8c95674df3f
---
# T03.2 — Synchronisation initiale (import catalogue + historique)

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [T03.2 — Synchronisation initiale (import catalogue + historique)](https://app.notion.com/p/357d0131973c81cdbd40c8c95674df3f) · extrait le 17/09/2026 · page modifiée le 05/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| T-03 — Sync eCommerce | Sprint 3 | P0 | M | Pas commencé | Claude code | Pro+ | DesignO 21/04 | — |

### Description fonctionnelle (Notion)

**En tant qu'**intégrateur technique, **je veux** déclencher une synchronisation initiale qui importe dans Magrit les produits, clients et commandes historiques pertinentes, **afin que** Magrit démarre avec un état cohérent avec le storefront.

##### Critères d'acceptation

- Import catalogue complet avec option « ne synchroniser que les produits imprimables » (filtre par tag/collection).
- Import clients avec déduplication par email.
- Import commandes sur période configurable (ex : 12 derniers mois).
- Rapport de synchronisation détaillé avec warnings et erreurs.
- Possibilité de rejouer la synchronisation sur un sous-ensemble.

##### Spécifications techniques

- Queue Redis/Kafka pour traitement asynchrone.
- Retry exponentiel avec dead letter queue.
- Stockage brut : conservation du payload reçu (JSON), en plus de sa représentation interne — pour debug ultérieur.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent T03.2

_Aucun fichier du dépôt ne cite cet identifiant._
