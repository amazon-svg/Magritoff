---
id: E7.1
epic: E7 — Perf & infra
source: notion
notion_url: https://app.notion.com/p/357d0131973c8133b646d58eb56b1782
---
# E7.1 — Suivi consommation tokens par utilisateur

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [E7.1 — Suivi consommation tokens par utilisateur](https://app.notion.com/p/357d0131973c8133b646d58eb56b1782) · extrait le 17/09/2026 · page modifiée le 06/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E7 — Perf & infra | Sprint 1 | P0 | M | Terminé | Claude code | Technique | Vision Produit 15/04, Demande 05/05 | — |

### Description fonctionnelle (Notion)

**En tant qu'**ops, **je veux** un suivi de la consommation en tokens par utilisateur, **afin de** gérer les quotas freemium/payant et garantir la viabilité économique du Freemium.

##### Contexte

Les coûts LLM sont proportionnels aux tokens consommés. Sans suivi fin, un utilisateur freemium intensif peut coûter plus cher qu'un Pro. Le freemium ne tient économiquement que si les quotas sont respectés et le revenu publicitaire couvre les coûts (cf. T-06).

##### Critères d'acceptation

- Chaque requête LLM (entrée + sortie) est comptée en tokens par utilisateur et horodatée.
- Stockage dans une table time-series (Postgres + TimescaleDB ou ClickHouse).
- Agrégations exposées : par utilisateur, par jour/mois, par tier, par endpoint.
- **Quotas paramétrables par tier :**
  - Freemium : 10 devis/mois (\~50 k tokens/mois max estimés)
  - Découverte : devis illimités mais plafond tokens si dépassement anormal
  - Starter, Pro, Business, Enterprise : pas de plafond, monitoring pour alerte anomalie
- Blocage Freemium au dépassement avec message clair + lien upgrade.
- Dashboard interne ops avec top consommateurs, tendances, alertes.
- API interne `GET /metrics/usage/{user_id}` pour feedback utilisateur.
- Intégration avec T-06 : les imprimeurs sponsors payés au CPL ou % conversion sont aussi tracés par cette infra.

##### Avancement Sprint 1 / B4 (livré 05/05/2026)

**Livré :**

- Table `llm_usage_events` créée : qui (user_id, tenant_id), combien (input + output tokens, request count), endpoint (claude-proxy, pim-generate…), mode Marguerite (open/strict), nb messages tronqués.
- Logging best-effort : si l'écriture échoue, l'utilisateur n'est pas bloqué.
- 2 fonctions SQL agrégées :
  - `get_user_llm_usage(user_id, period)` → tokens consommés par un utilisateur sur une période.
  - `get_tenant_llm_usage(tenant_id, period)` → top consommateurs au sein d'un espace.
- RLS appliquée : un user voit sa propre conso, un admin voit son tenant, le superadmin voit tout.
- ✅ Edge function déployée sur B4 le 06/05/2026 — le tracking serveur tourne pleinement (front + back actifs).

##### Sous-livrables extraits dans des stories sœurs

La story de tracking est livrée. Les exploitations de cette infra ont été isolées :

- **E7.5** — Blocage Freemium au dépassement de quota (Sprint 2).
- **E7.6** — Dashboard ops consommation LLM (Sprint 2 ou 3).
- API publique `GET /metrics/usage/{user_id}` rattachée à E7.6.

##### Reste à livrer (cible Sprint 2)

- Dashboard UI ops (top consommateurs, tendances, alertes).
- **Blocage Freemium au dépassement** (l'infra de tracking est prête, il reste à câbler le quota mensuel + message d'upgrade).
- API publique `GET /metrics/usage/{user_id}` côté utilisateur.

### Cas de test fonctionnels rattachés (Notion)

| TF | Cas de test | Statut | Priorité | Parcours | Cible | Stories liées |
|---|---|---|---|---|---|---|
| [TF-29](https://app.notion.com/358d0131973c81949f95faf24cd79d7c) | Compteur Freemium s'incrémente après envoi d'un devis | Bloqué | P0 — Critique | P07 — Tracking consommation IA | B4 | E7.1 |
| [TF-30](https://app.notion.com/358d0131973c81cf9a8df5733c5b0e5e) | Vérification SQL des events llm_usage_events et des RPC d'agrégation | À jouer | P1 — Importante | P07 — Tracking consommation IA | B4 | E7.1 |
| [TF-31](https://app.notion.com/358d0131973c810c8a55f56b398f365c) | Admin tenant peut consulter la consommation agrégée de tous ses users | À jouer | P1 — Importante | P07 — Tracking consommation IA | B4 | E7.1 |

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent E7.1

- `SPRINT_HANDOFF.md`
- `_bmad-output/implementation-artifacts/story-S1.5-refactor-llm-finalisation.md`
- `_bmad-output/implementation-artifacts/story-S4.1c-edge-function-mockup-generator.md`
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/epics.md`
- `_bmad-output/planning-artifacts/prd.md`
- `docs/project-context.md`
- `supabase/functions/_shared/llm_usage.ts`
- `supabase/functions/make-server-e3db71a4/index.ts`
- `supabase/migrations/20260506000100_e7_llm_usage_tracking.sql`
