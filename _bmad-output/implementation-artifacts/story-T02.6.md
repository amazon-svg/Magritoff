---
id: T02.6
epic: T-02 — Franchise Module
source: notion
notion_url: https://app.notion.com/p/357d0131973c813cb535e4b00e9d0705
---
# T02.6 — Rapports consolidés avec drill-down (Network → Zone → Site → Équipe)

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [T02.6 — Rapports consolidés avec drill-down (Network → Zone → Site → Équipe)](https://app.notion.com/p/357d0131973c813cb535e4b00e9d0705) · extrait le 17/09/2026 · page modifiée le 05/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| T-02 — Franchise Module | Sprint 4 | P0 | M | Pas commencé | Claude code | Business+ | DesignO 21/04 | — |

### Description fonctionnelle (Notion)

**En tant que** Head of network, **je veux** accéder à des rapports consolidés avec possibilité de drill-down jusqu'à la commande individuelle, **afin d'**avoir à la fois la vue macro et la traçabilité fine.

##### Critères d'acceptation

- Agrégation Réseau → Zone géo → Site → Équipe → Commercial → Commande.
- Comparaisons inter-sites (benchmark interne).
- Taux de conformité aux standards master (respect des prix master, respect des templates master).
- Rapport « fuite d'offre » : commandes rejetées localement pour raison de capacité / spécialité.

##### Performance

Un tableau de bord master avec 50 sites / 500 000 commandes historiques s'affiche en \< 3 s avec cache Redis.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent T02.6

_Aucun fichier du dépôt ne cite cet identifiant._
