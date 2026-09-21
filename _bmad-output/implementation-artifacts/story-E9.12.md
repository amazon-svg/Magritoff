---
id: E9.12
epic: E9 — Multi-tenant & gouvernance
source: notion
notion_url: https://app.notion.com/p/357d0131973c8183a884ef0ee20d2581
---
# E9.12 — Migrer claude-3-haiku → claude-haiku-4-5 sur B1/B2 claude-proxy

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [E9.12 — Migrer claude-3-haiku → claude-haiku-4-5 sur B1/B2 claude-proxy](https://app.notion.com/p/357d0131973c8183a884ef0ee20d2581) · extrait le 17/09/2026 · page modifiée le 05/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E9 — Multi-tenant & gouvernance | Sprint 2 | P2 | S | Terminé | Claude code | Technique | Beta 3 livraison | — |

### Description fonctionnelle (Notion)

**En tant qu'**ops, **je veux** migrer la fonction `claude-proxy` de B1/B2 du modèle `claude-3-haiku-20240307` (déprécié) vers `claude-haiku-4-5-20251001` (utilisé sur B3), **afin de** harmoniser les performances et éviter une coupure quand l'ancien modèle sera retiré.

##### Critères d'acceptation

- Éditer `Magritoff/supabase/functions/claude-proxy/index.ts` : remplacer la chaîne modèle.
- Éditer idem `Magritoff-v2/supabase/functions/claude-proxy/index.ts`.
- Redéployer `supabase functions deploy claude-proxy --project-ref jynxrpzwgzrrfuooputw`.
- Vérifier qu'aucune régression sur les chats (output identique attendu, modèle plus puissant).
- Mettre à jour l'entrée dans `reference_magrit_infra.md` (mémoire).

##### Dépendances

Aucune. Story autonome de cleanup.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent E9.12

- `SPRINT_HANDOFF.md`
- `_bmad-output/planning-artifacts/prd.md`
