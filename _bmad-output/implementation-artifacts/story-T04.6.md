---
id: T04.6
epic: T-04 — Prompt Search
source: notion
notion_url: https://app.notion.com/p/357d0131973c8105a113dbcd5c81f5c2
---
# T04.6 — Contexte client et mémoire (commandes passées, préférences)

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [T04.6 — Contexte client et mémoire (commandes passées, préférences)](https://app.notion.com/p/357d0131973c8105a113dbcd5c81f5c2) · extrait le 17/09/2026 · page modifiée le 05/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| T-04 — Prompt Search | Sprint 4 | P1 | M | Pas commencé | Claude code | Pro+ | DesignO 21/04 | — |

### Description fonctionnelle (Notion)

**En tant qu'**acheteur récurrent sur le storefront, **je veux** que Marguerite tienne compte de mes commandes précédentes et préférences, **afin de** ne pas redécrire les mêmes spécifications à chaque commande.

##### Critères d'acceptation

- Si connecté, Marguerite accède à l'historique de commandes (via T-03).
- Suggestions personnalisées : « Vous avez l'habitude de commander des flyers en 135g couché brillant, on continue ? »
- Reprise de commandes passées avec paramètres pré-remplis.
- **Respect strict RGPD** : aucune donnée client n'est stockée par le LLM au-delà du contexte de session. Mémorisation côté Magrit uniquement.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent T04.6

_Aucun fichier du dépôt ne cite cet identifiant._
