---
id: E4.4
epic: E4 — Mini-shop
source: notion
notion_url: https://app.notion.com/p/357d0131973c81e1849fc7284f1573a9
---
# E4.4 — Back-office imprimeur (validation commandes)

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [E4.4 — Back-office imprimeur (validation commandes)](https://app.notion.com/p/357d0131973c81e1849fc7284f1573a9) · extrait le 17/09/2026 · page modifiée le 05/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E4 — Mini-shop | Backlog | P2 | L | Pas commencé | Claude code | Pro+ | Vision Produit 15/04 | — |

### Description fonctionnelle (Notion)

**En tant qu'**utilisateur Pro, **je veux** un back-office de validation des commandes avant expédition, **afin de** garder la main sur la production.

##### Critères d'acceptation pressentis

- Vue consolidée des commandes en cours par statut.
- Filtres : client, date, montant, statut, typologie produit.
- Validation manuelle ou automatique selon règles configurables (ex : commande \> 5 k€ → validation N+1).
- Actions batch : marquer expédié, marquer livré, relancer.
- Export Excel des commandes pour comptabilité et MIS.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent E4.4

- `_bmad-output/planning-artifacts/epics.md`
- `_bmad-output/planning-artifacts/prd.md`
