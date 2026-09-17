---
id: T04.4
epic: T-04 — Prompt Search
source: notion
notion_url: https://app.notion.com/p/357d0131973c81fcae1ad6ea880bb6a8
---
# T04.4 — Dialogue de clarification (max 2 questions, choix visuels)

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [T04.4 — Dialogue de clarification (max 2 questions, choix visuels)](https://app.notion.com/p/357d0131973c81fcae1ad6ea880bb6a8) · extrait le 17/09/2026 · page modifiée le 05/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| T-04 — Prompt Search | Sprint 4 | P1 | M | Pas commencé | Claude code | Pro+ | DesignO 21/04 | — |

### Description fonctionnelle (Notion)

**En tant qu'**acheteur professionnel, **je veux** que Marguerite me pose des questions ciblées quand ma requête est ambiguë, **afin d'**éviter des cycles de reformulation inutiles.

##### Critères d'acceptation

- Si une dimension métier manque (grammage, finition, support), Marguerite propose les options pertinentes sous forme de choix visuels (boutons), pas de question ouverte.
- Maximum 2 questions successives avant proposition de produit.
- Contexte conservé entre les échanges (l'acheteur n'a pas à répéter sa requête initiale).
- Possibilité de skip une question avec valeurs par défaut.

##### Articulation avec E2.3

E2.3 (clarification dans le chat Magrit) et T-04.4 (clarification dans le storefront) partagent le même moteur. La différence : T-04.4 est embarqué dans un widget JS externe + UI épurée B2B.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent T04.4

_Aucun fichier du dépôt ne cite cet identifiant._
