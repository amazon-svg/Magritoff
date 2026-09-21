---
id: E7.3
epic: E7 — Perf & infra
source: notion
notion_url: https://app.notion.com/p/357d0131973c8145be8acaaed2f01038
---
# E7.3 — Monitoring usage, quotas, coûts

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [E7.3 — Monitoring usage, quotas, coûts](https://app.notion.com/p/357d0131973c8145be8acaaed2f01038) · extrait le 17/09/2026 · page modifiée le 05/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E7 — Perf & infra | Sprint 2 | P1 | M | Pas commencé | Claude code | Technique | Vision Produit 15/04 | — |

### Description fonctionnelle (Notion)

**En tant qu'**ops, **je veux** monitorer l'usage, gérer les quotas et amortir les coûts GPU/IA, **afin de** garantir la stabilité financière et technique de la plateforme.

##### Critères d'acceptation

- Stack observabilité : Grafana + Prometheus (ou équivalent managed).
- Métriques clés : latence P50/P95/P99 par endpoint, taux d'erreur, throughput, coût LLM journalier.
- Alertes Slack / PagerDuty sur anomalie (pic de coût, dégradation P95, erreurs \> seuil).
- Rétention métriques : 30 j temps réel, 1 an agrégé.
- Dashboards séparés : technique ops, métier finance (coût LLM / revenu MRR).

##### Red flags

- Coûts LLM imprévisibles : viralité soudaine sur le freemium peut exploser les coûts. Plafonds stricts au niveau plateforme (kill switch) indispensables.
- Vendor lock-in LLM : architecture de routage multi-fournisseurs à prévoir dès V1 (Anthropic + OpenAI + option self-hosted).

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent E7.3

- `SPRINT_HANDOFF.md`
- `_bmad-output/planning-artifacts/prd.md`
- `docs/project-context.md`
