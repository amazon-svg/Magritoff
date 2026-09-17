---
id: E2.3
epic: E2 — Marguerite
source: notion
notion_url: https://app.notion.com/p/357d0131973c818eb105ffbfc8be6fcc
---
# E2.3 — Questions de clarification dialoguée

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [E2.3 — Questions de clarification dialoguée](https://app.notion.com/p/357d0131973c818eb105ffbfc8be6fcc) · extrait le 17/09/2026 · page modifiée le 05/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E2 — Marguerite | Sprint 3 | P1 | M | Pas commencé | Claude code | Pro+ | Vision Produit 15/04 | — |

### Description fonctionnelle (Notion)

**En tant qu'**utilisateur, **je veux** que l'IA me pose des questions de clarification pour affiner ma demande, **afin d'**éviter des réponses approximatives et des cycles de reformulation.

##### Critères d'acceptation

- Lorsqu'une requête est ambiguë ou qu'un paramètre critique manque, l'IA pose **une question ciblée à la fois**.
- Questions hiérarchisées par ordre d'impact sur le prix : quantité, format, papier avant finitions, couleurs avant façonnage.
- Après 3 questions max, l'IA propose une hypothèse complète et demande validation plutôt que de continuer à demander.
- L'utilisateur peut passer en mode « je sais ce que je veux » à tout moment.

### Cas de test fonctionnels rattachés (Notion)

| TF | Cas de test | Statut | Priorité | Parcours | Cible | Stories liées |
|---|---|---|---|---|---|---|
| [TF-26](https://app.notion.com/358d0131973c817d99fee3c10c7dc8bc) | Demande ambiguë en mode Strict déclenche une question de clarification ciblée | À jouer | P0 — Critique | P06 — Marguerite Mode Strict | B4 | E2.2, E2.3 |

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent E2.3

_Aucun fichier du dépôt ne cite cet identifiant._
