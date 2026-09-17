---
id: E3.3
epic: E3 — UX & streaming
source: notion
notion_url: https://app.notion.com/p/357d0131973c81039e76c286177d0095
---
# E3.3 — Bouton rafraîchissement prix

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [E3.3 — Bouton rafraîchissement prix](https://app.notion.com/p/357d0131973c81039e76c286177d0095) · extrait le 17/09/2026 · page modifiée le 05/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E3 — UX & streaming | Sprint 3 | P1 | S | Pas commencé | Claude code | Freemium+ | Vision Produit 15/04 | — |

### Description fonctionnelle (Notion)

**En tant qu'**utilisateur, **je veux** un bouton de rafraîchissement du prix quand le descriptif est affiché mais le prix en cours de calcul, **afin de** relancer le calcul sans recharger la session.

##### Critères d'acceptation

- Si le prix met \> 4 s après affichage du descriptif, bouton « Actualiser le prix » visible.
- Un clic relance uniquement le calcul prix (pas le LLM descriptif), économie token.
- Animation de chargement immédiate.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent E3.3

_Aucun fichier du dépôt ne cite cet identifiant._
