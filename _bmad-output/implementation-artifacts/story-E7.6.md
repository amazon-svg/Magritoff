---
id: E7.6
epic: E7 — Perf & infra
source: notion
notion_url: https://app.notion.com/p/358d0131973c81f98ba0f2da801efab5
---
# E7.6 — Dashboard ops consommation LLM + API publique usage

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [E7.6 — Dashboard ops consommation LLM + API publique usage](https://app.notion.com/p/358d0131973c81f98ba0f2da801efab5) · extrait le 17/09/2026 · page modifiée le 06/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E7 — Perf & infra | Sprint 3 | P1 | L | Pas commencé | Claude code | Technique | Demande 05/05 | — |

### Description fonctionnelle (Notion)

**En tant qu'**ops Magrit, **je veux** un dashboard interne de la consommation LLM agrégée par tier, par tenant, par utilisateur et par endpoint, **afin de** détecter les anomalies, surveiller la viabilité économique du Freemium et anticiper les évolutions de plafonds.

##### Contexte

La story mère E7.1 a livré le tracking brut + les RPC d'agrégation. Il reste à construire la couche d'observation : tableau de bord lisible pour l'équipe ops + API publique pour l'utilisateur final.

##### Critères d'acceptation

- Page `/admin/usage` réservée au superadmin Magrit.
- Cards : tokens consommés aujourd'hui / 7j / 30j ; coût estimé (€) ; top 10 tenants ; top 10 utilisateurs ; répartition par mode Marguerite (Ouvert / Strict).
- Graphique time-series : consommation par jour sur 90 jours, courbe par tier.
- Filtres : tier, période, endpoint, mode.
- Alertes : envoi Slack si conso quotidienne \> seuil configurable.
- API publique `GET /metrics/usage/{user_id}` retournant `{ used, limit, remaining, period }` consommable par l'utilisateur dans son propre dashboard.

##### Spécifications techniques

- Front : React + Recharts (déjà dispo dans la stack).
- Back : appels aux RPC `get_user_llm_usage` et `get_tenant_llm_usage` livrées par E7.1.
- API publique : edge function `metrics-usage` avec contrôle auth.

##### Dépendances

- **E7.1** (infra de tracking) — livrée B4.
- E7.5 si on veut afficher le compteur Freemium dans la sidebar utilisateur (l'API publique sert également là).

##### Red flag

Le coût LLM estimé dépend du tarif Anthropic en vigueur. Prévoir un fichier de config tarifaire externalisé plutôt que des constantes en dur — les prix Anthropic évoluent.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent E7.6

_Aucun fichier du dépôt ne cite cet identifiant._
