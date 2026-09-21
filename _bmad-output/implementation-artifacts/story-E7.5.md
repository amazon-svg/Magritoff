---
id: E7.5
epic: E7 — Perf & infra
source: notion
notion_url: https://app.notion.com/p/358d0131973c8194bd8fe9c49179361b
---
# E7.5 — Blocage Freemium au dépassement de quota

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [E7.5 — Blocage Freemium au dépassement de quota](https://app.notion.com/p/358d0131973c8194bd8fe9c49179361b) · extrait le 17/09/2026 · page modifiée le 06/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E7 — Perf & infra | Sprint 2 | P0 | M | Pas commencé | Claude code | Freemium+ | Demande 05/05 | — |

### Description fonctionnelle (Notion)

**En tant qu'**ops, **je veux** que les utilisateurs Freemium soient bloqués au-dessus du plafond mensuel de devis avec un message d'upgrade clair, **afin d'**empêcher l'abus du tier gratuit et de canaliser la conversion vers les tiers payants.

##### Contexte

La story mère E7.1 a livré l'infra de tracking `llm_usage_events` + RPC d'agrégation. Il reste à câbler le contrôle de quota lors de chaque appel et l'UX de blocage / upgrade. Sans cette story, le Freemium est techniquement illimité — risque de coût LLM non maîtrisé.

##### Critères d'acceptation

- Plafond Freemium : **10 devis/mois** (cf. Pricing V1) calculé sur fenêtre glissante 30 jours.
- Avant chaque appel Claude initié par un user Freemium, vérification synchrone via `get_user_llm_usage(user_id, period='30d')`.
- Si plafond atteint : refus de l'appel + retour d'un message structuré (code `quota_exceeded`).
- Côté UI : modale de blocage avec compteur restant, date de remise à zéro, et 2 CTA — « Voir les offres » (vers pricing) et « Continuer en lecture » (accès aux devis passés, pas d'écriture).
- Compteur visible en permanence dans la sidebar Freemium (« 7/10 devis utilisés ce mois »).
- Notification à 80% du plafond (8 devis) : bandeau d'alerte non-bloquant + suggestion d'upgrade.
- Logs des refus dans `llm_usage_events` avec `blocked=true` pour permettre le suivi des tentatives bloquées (KPI conversion).

##### Spécifications techniques

- Middleware Edge function : vérification quota avant proxy vers Claude.
- Hook React `useQuotaStatus()` : retourne `{ used, limit, remaining, blocked }` consommé par sidebar + modale.
- Configuration plafonds par tier dans `lib/pricingTiers.ts` (extensible aux paliers Pro / Business si nécessaire).

##### Dépendances

- **E7.1** (infra de tracking) — livrée B4.
- E9.8 ou séparable : si l'utilisateur clique « Voir les offres » depuis la modale, le routing vers le checkout Stripe (E9.8) doit être opérationnel pour matérialiser la conversion.

##### Red flag

Un faux blocage (compteur surestimé ou bug RPC) crispe immédiatement l'utilisateur. Prévoir un mode « grace » : en cas d'erreur RPC, autoriser l'appel + log d'incident plutôt que bloquer.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent E7.5

_Aucun fichier du dépôt ne cite cet identifiant._
