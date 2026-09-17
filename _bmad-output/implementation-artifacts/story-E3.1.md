---
id: E3.1
epic: E3 — UX & streaming
source: notion
notion_url: https://app.notion.com/p/357d0131973c8164b71bdd19b07a1f0f
---
# E3.1 — Affichage progressif descriptif + prix

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [E3.1 — Affichage progressif descriptif + prix](https://app.notion.com/p/357d0131973c8164b71bdd19b07a1f0f) · extrait le 17/09/2026 · page modifiée le 05/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E3 — UX & streaming | Sprint 2 | P0 | L | Terminé | Claude code | Freemium+ | Vision Produit 15/04 | — |

### Description fonctionnelle (Notion)

**En tant qu'**utilisateur, **je veux** voir le descriptif produit s'afficher progressivement pendant que le prix est calculé, **afin de** ne pas attendre passivement la fin du traitement.

##### Critères d'acceptation

- Le descriptif produit s'affiche dès que les premiers tokens LLM sont disponibles (t \< 1,5 s).
- Le prix s'affiche dès que Clariprint a calculé, animation discrète de chargement pendant l'attente.
- Les deux blocs sont indépendants : si l'un est disponible avant l'autre, il s'affiche immédiatement.
- Aucun blocage d'interface : modification possible avant la fin du calcul, déclenche un recalcul.
- Indicateur visuel clair de l'état (en cours / terminé / erreur) pour chaque bloc.

##### Dépendances

- E3.2 (WebSocket)
- E1, E2

### Cas de test fonctionnels rattachés (Notion)

| TF | Cas de test | Statut | Priorité | Parcours | Cible | Stories liées |
|---|---|---|---|---|---|---|
| [TF-43](https://app.notion.com/358d0131973c81c4a423d867c232f417) | Premier token affiché en moins de 1.5s (TTFT) | Bloqué | P0 — Critique | P11 — Streaming progressif | B5 | E3.1, E3.2 |
| [TF-44](https://app.notion.com/358d0131973c81d8983bcd99e0db7df7) | Descriptif et prix Clariprint s'affichent indépendamment | À jouer | P0 — Critique | P11 — Streaming progressif | B5 | E3.1 |

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent E3.1

- `SPRINT_HANDOFF.md`
- `_bmad-output/implementation-artifacts/story-S1.5-refactor-llm-finalisation.md`
- `_bmad-output/planning-artifacts/epics.md`
- `_bmad-output/planning-artifacts/prd.md`
- `docs/project-context.md`
- `src/modules/conversations/ui/components/ChatInterface.tsx`
- `src/shared/config/featureFlags.ts`
- `supabase/functions/make-server-e3db71a4/index.ts`
