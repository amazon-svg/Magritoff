---
id: T02.3
epic: T-02 — Franchise Module
source: notion
notion_url: https://app.notion.com/p/357d0131973c81baacf0ccec66e481a3
---
# T02.3 — Onboarding d'un nouveau site par héritage de configuration

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [T02.3 — Onboarding d'un nouveau site par héritage de configuration](https://app.notion.com/p/357d0131973c81baacf0ccec66e481a3) · extrait le 17/09/2026 · page modifiée le 05/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| T-02 — Franchise Module | Sprint 2 | P0 | M | Pas commencé | Claude code | Business+ | DesignO 21/04 | — |

### Description fonctionnelle (Notion)

**En tant que** Head of network, **je veux** créer un nouveau site local qui hérite immédiatement de toute la configuration master, **afin de** réduire le time-to-operate d'un nouveau site à moins de 2 jours au lieu de semaines.

##### Critères d'acceptation

- Assistant de création d'un site en 5 écrans (nom, adresse, responsable, héritage oui/non, paramètres locaux).
- Héritage par défaut : catalogue, templates, règles de prix, workflows, connecteurs eCommerce.
- Possibilité de cloner un site existant comme template.
- Site activable en mode « pilote » (invisible client) avant mise en production.

##### Dépendances

- T02.2 (modèle master / inheritance) doit être opérationnel

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent T02.3

_Aucun fichier du dépôt ne cite cet identifiant._
