---
id: T02.5
epic: T-02 — Franchise Module
source: notion
notion_url: https://app.notion.com/p/357d0131973c81f1b909d29dda6f27b5
---
# T02.5 — Gouvernance des commandes transversales (routage inter-sites)

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [T02.5 — Gouvernance des commandes transversales (routage inter-sites)](https://app.notion.com/p/357d0131973c81f1b909d29dda6f27b5) · extrait le 17/09/2026 · page modifiée le 05/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| T-02 — Franchise Module | Sprint 4 | P0 | L | Pas commencé | Claude code | Business+ | DesignO 21/04 | — |

### Description fonctionnelle (Notion)

**En tant que** Head of network, **je veux** router ou arbitrer des commandes qui ne peuvent pas être produites par le site demandeur, **afin de** faire circuler l'activité entre les sites selon leurs spécialités et leur charge.

##### Critères d'acceptation

- Règle de routage paramétrable par type de produit, volume, zone géographique.
- Arbitrage manuel possible (head of network réaffecte une commande à un autre site).
- Partage transparent du chiffre d'affaires selon règle définie (ex : site originateur 20%, site producteur 80%, si franchise).
- Audit trail du routage et de l'arbitrage.

##### Différenciateur vs DesignO

DesignO ne gère pas le routage/arbitrage inter-sites avec partage de CA. C'est une fonctionnalité demandée par Altavia et par les groupes print franchisés.

**IA pour arbitrage automatique** : Marguerite peut proposer un routage optimal basé sur charge, spécialité, géographie (différenciateur IA natif).

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent T02.5

_Aucun fichier du dépôt ne cite cet identifiant._
