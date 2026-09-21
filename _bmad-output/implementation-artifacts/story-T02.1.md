---
id: T02.1
epic: T-02 — Franchise Module
source: notion
notion_url: https://app.notion.com/p/357d0131973c815cac72f6b01652663c
---
# T02.1 — Master Owner Dashboard consolidé multi-sites

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [T02.1 — Master Owner Dashboard consolidé multi-sites](https://app.notion.com/p/357d0131973c815cac72f6b01652663c) · extrait le 17/09/2026 · page modifiée le 05/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| T-02 — Franchise Module | Sprint 2 | P0 | L | Pas commencé | Claude code | Business+ | DesignO 21/04 | — |

### Description fonctionnelle (Notion)

**En tant que** Head of network (siège, responsable réseau, directeur général groupe), **je veux** voir l'activité consolidée de tous les sites en temps réel depuis un tableau de bord unique, **afin de** piloter mon réseau, repérer les bons élèves et les sites en difficulté.

##### Critères d'acceptation

- Tableau de bord avec agrégation multi-sites configurable : volume de commandes, CA, marge (si communiqué), taux de conversion, NPS si capturé.
- Classement automatique des sites (top / bottom performers) sur période glissante.
- Drill-down d'un clic sur un site pour voir ses détails.
- Filtres globaux : période, catégorie produit, zone géographique.
- Export reporting consolidé CSV / XLSX / PDF planifiable (hebdo, mensuel).
- KPI cartographiés sur carte géographique si pertinent (réseau physique).

##### Modèle de données

Hiérarchie `Network` → `Site` → `User` / `Customer` / `Order`. Site = unité d'isolation. **Cette structure est déjà en place dans Beta 3** via les sous-tenants, T-02 ajoute la couche d'agrégation et de gouvernance.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent T02.1

_Aucun fichier du dépôt ne cite cet identifiant._
