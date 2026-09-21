---
id: T02.2
epic: T-02 — Franchise Module
source: notion
notion_url: https://app.notion.com/p/357d0131973c81ba9166f35110f6ea33
---
# T02.2 — Gestion centrale catalogue, templates, règles de prix (héritage master → site)

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [T02.2 — Gestion centrale catalogue, templates, règles de prix (héritage master → site)](https://app.notion.com/p/357d0131973c81ba9166f35110f6ea33) · extrait le 17/09/2026 · page modifiée le 05/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| T-02 — Franchise Module | Sprint 2 | P0 | L | Pas commencé | Claude code | Business+ | DesignO 21/04 | — |

### Description fonctionnelle (Notion)

**En tant que** Head of network, **je veux** définir un catalogue produits master, des templates master et des règles de prix master que tous les sites héritent, **afin de** garantir une cohérence du réseau et ne pas redéployer individuellement à chaque site.

##### Critères d'acceptation

- Catalogue master éditable en central, propagé en mode « lecture » ou « lecture + override local autorisé » selon configuration.
- Templates master avec règles de modification locale paramétrables (verrouillage total / zones locales autorisées / libre).
- Règles de prix master avec dérogation locale dans un corridor paramétré (ex : marge plancher 12%, site libre de monter au-dessus).
- Historique des versions avec rollback global ou par site.
- Notification des sites quand une mise à jour master est poussée + fenêtre de transition.

##### Inheritance pattern

Chaque `Site` a un `parent_network_id`. Les entités config (`Catalog`, `Template`, `PricingRule`) ont un scope `network` ou `site`. Resolution : site override \> network.

##### Différenciateur vs DesignO

**Corridor de dérogation locale paramétrable** : DesignO 2.6 offre soit centralisation totale soit décentralisation totale. Magrit introduit un entre-deux qui colle mieux aux organisations réelles françaises.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent T02.2

_Aucun fichier du dépôt ne cite cet identifiant._
