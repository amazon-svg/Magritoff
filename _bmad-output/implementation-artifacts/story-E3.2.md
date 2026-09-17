---
id: E3.2
epic: E3 — UX & streaming
source: notion
notion_url: https://app.notion.com/p/357d0131973c814d9b7fca5c7fe26b1d
---
# E3.2 — Infrastructure WebSocket

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [E3.2 — Infrastructure WebSocket](https://app.notion.com/p/357d0131973c814d9b7fca5c7fe26b1d) · extrait le 17/09/2026 · page modifiée le 05/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E3 — UX & streaming | Sprint 2 | P0 | L | Terminé | Claude code | Technique | Vision Produit 15/04 | — |

### Description fonctionnelle (Notion)

**En tant que** développeur, **je veux** un flux WebSocket pour envoyer les résultats intermédiaires au client, **afin de** supporter le streaming progressif.

##### Architecture

- Connexion WebSocket à l'ouverture de session.
- Canal bidirectionnel : requête utilisateur → réponse streaming token par token.
- Événements : `quote.started`, `quote.description.token`, `quote.price.calculated`, `quote.completed`, `quote.error`.
- Fallback HTTP long-polling pour navigateurs / réseaux bloquant WebSocket.
- Reconnexion automatique avec reprise de la requête si déconnexion \< 5 s.

##### Critères d'acceptation

- Latence premier token \< 1,5 s (P95).
- Throughput : 500 connexions WebSocket simultanées sur instance V1.
- Métriques exposées : temps au premier token, durée moyenne stream, taux de reconnexion.

##### Red flags

- Réseaux d'entreprise bloquent fréquemment WebSocket → fallback HTTP indispensable, pas optionnel.
- Coût infra : connexions persistantes plus chères que REST stateless. Auto-scaling à prévoir.

### Cas de test fonctionnels rattachés (Notion)

| TF | Cas de test | Statut | Priorité | Parcours | Cible | Stories liées |
|---|---|---|---|---|---|---|
| [TF-43](https://app.notion.com/358d0131973c81c4a423d867c232f417) | Premier token affiché en moins de 1.5s (TTFT) | Bloqué | P0 — Critique | P11 — Streaming progressif | B5 | E3.1, E3.2 |
| [TF-45](https://app.notion.com/358d0131973c81a1b49cff7d6d94dd3d) | Reconnexion automatique en moins de 5s en cas de coupure réseau brève | À jouer | P1 — Importante | P11 — Streaming progressif | B5 | E3.2 |

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent E3.2

- `SPRINT_HANDOFF.md`
- `_bmad-output/implementation-artifacts/story-S1.5-refactor-llm-finalisation.md`
- `_bmad-output/planning-artifacts/epics.md`
- `_bmad-output/planning-artifacts/prd.md`
- `docs/project-context.md`
- `src/shared/config/featureFlags.ts`
- `supabase/functions/make-server-e3db71a4/index.ts`
