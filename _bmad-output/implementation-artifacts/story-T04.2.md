---
id: T04.2
epic: T-04 — Prompt Search
source: notion
notion_url: https://app.notion.com/p/357d0131973c81dcb518d42acad9e209
---
# T04.2 — Compréhension d'une intention simple

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [T04.2 — Compréhension d'une intention simple](https://app.notion.com/p/357d0131973c81dcb518d42acad9e209) · extrait le 17/09/2026 · page modifiée le 05/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| T-04 — Prompt Search | Sprint 3 | P1 | M | Pas commencé | Claude code | Pro+ | DesignO 21/04 | — |

### Description fonctionnelle (Notion)

**En tant qu'**acheteur professionnel sur un storefront imprimeur, **je veux** taper une requête métier directe (« 500 flyers A4 quadri recto-verso 135g pour lundi »), **afin d'**obtenir un produit configuré prêt à commander.

##### Critères d'acceptation

- Marguerite extrait : type de produit, quantité, format, impression, grammage, délai.
- Identifie le produit catalogue correspondant.
- Pré-remplit les options du produit avec les valeurs extraites.
- Affiche prix, délai, référence produit.
- Un clic « Ajouter au panier » pour passer à la commande.
- Temps de réponse \< 3 s en P95.

##### Architecture

- Endpoint Magrit `/api/v1/prompt-search`
- RAG vectoriel sur catalogue storefront (indexé via T-03)
- Cache aggressif (réduction coûts LLM 40-60%)

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent T04.2

_Aucun fichier du dépôt ne cite cet identifiant._
