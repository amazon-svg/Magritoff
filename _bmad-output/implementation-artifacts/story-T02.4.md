---
id: T02.4
epic: T-02 — Franchise Module
source: notion
notion_url: https://app.notion.com/p/357d0131973c81a99a9ffc73cc5e4310
---
# T02.4 — Franchise Location Dashboard (isolation opérationnelle)

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [T02.4 — Franchise Location Dashboard (isolation opérationnelle)](https://app.notion.com/p/357d0131973c81a99a9ffc73cc5e4310) · extrait le 17/09/2026 · page modifiée le 05/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| T-02 — Franchise Module | Sprint 2 | P0 | M | Pas commencé | Claude code | Business+ | DesignO 21/04 | — |

### Description fonctionnelle (Notion)

**En tant que** patron d'un site local, **je veux** disposer d'un espace de travail isolé où je gère mes commandes, mes clients, mon équipe, sans voir les autres sites, **afin de** me concentrer sur mon opérationnel quotidien sans pollution visuelle.

##### Critères d'acceptation

- Tous les écrans opérationnels filtrés automatiquement par site de l'utilisateur.
- Client et commande d'un site ne sont jamais visibles pour un autre site, y compris via recherche globale.
- Statistiques locales complètes mais anonymisées par rapport aux autres sites (le site ne voit pas « le site X a fait 30% de plus que lui »).
- Notifications locales restent locales.
- Un utilisateur multi-sites (manager de zone) peut switcher entre sites via un sélecteur en header.

##### Articulation

Très proche du fonctionnement actuel des sous-tenants Beta 3. Cette story formalise le pattern et ajoute le selector multi-sites en header.

##### Dépendances

- E9.10 (tests RLS) pour valider l'isolation

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent T02.4

_Aucun fichier du dépôt ne cite cet identifiant._
