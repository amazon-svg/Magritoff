---
id: T01.3
epic: T-01 — Corporate Portal
source: notion
notion_url: https://app.notion.com/p/357d0131973c81da9174c8a9777ee5a5
---
# T01.3 — Budgets par département et engagement temps réel

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [T01.3 — Budgets par département et engagement temps réel](https://app.notion.com/p/357d0131973c81da9174c8a9777ee5a5) · extrait le 17/09/2026 · page modifiée le 05/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| T-01 — Corporate Portal | Sprint 2 | P0 | XL | Pas commencé | Claude code | Corporate | DesignO 21/04 | — |

### Description fonctionnelle (Notion)

**En tant que** responsable d'un département, **je veux** voir le budget alloué, le budget engagé (commandes en cours de validation), le budget consommé (commandes validées ou produites), et le reste à engager, **afin de** piloter en temps réel ma consommation et arbitrer les commandes en attente.

##### Critères d'acceptation

- Tableau de bord département visible dès la connexion.
- Budgets paramétrables par période (mensuel, trimestriel, annuel, exercice fiscal personnalisé).
- Allocation possible par catégorie de produit (print, packaging, merchandising) au sein d'un même département.
- Alerte configurable à 50% / 75% / 90% de consommation.
- Report du budget non consommé sur la période suivante : paramétrable on/off par département.
- Export comptable des engagements (compatible intégration SAP, Sage, Cegid).

##### Modèle de données

- `Department`, `Budget`, `BudgetAllocation`, `OrderApproval`.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent T01.3

_Aucun fichier du dépôt ne cite cet identifiant._
