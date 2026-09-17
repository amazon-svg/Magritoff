---
id: E2.4
epic: E2 — Marguerite
source: notion
notion_url: https://app.notion.com/p/357d0131973c8186b2b7ec8365ad1be1
---
# E2.4 — Limite à 25 paramètres par prompt

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [E2.4 — Limite à 25 paramètres par prompt](https://app.notion.com/p/357d0131973c8186b2b7ec8365ad1be1) · extrait le 17/09/2026 · page modifiée le 06/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E2 — Marguerite | Sprint 1 | P0 | S | Terminé | Claude code | Technique | Vision Produit 15/04 | — |

### Description fonctionnelle (Notion)

**En tant que** système, **je veux** limiter les prompts à 25 paramètres, **afin d'**éviter les hallucinations et garantir la stabilité.

##### Critères d'acceptation

- Les prompts envoyés au LLM comportent au maximum 25 paramètres extraits du contexte utilisateur.
- Si le contexte dépasse 25 paramètres pertinents, logique de priorisation (récence, proximité sémantique avec la requête) sélectionne les 25 les plus utiles.
- Les paramètres rejetés sont loggés pour audit.
- Taux d'hallucination cible ≤ 1% (mesuré par échantillonnage hebdomadaire).

##### Red flags

- Coût LLM Freemium : volume d'interactions peut faire exploser les coûts. Plafonds + caching indispensables (cf. E7).
- Fidélité métier FR : valider terminologie print française (grammage, laize, dorure, pelliculage).

##### Avancement Sprint 1 / B4 (livré 05/05/2026)

**Livré :**

- Plafond mis en place à **25 messages les plus récents** envoyés à Claude (antérieurs tronqués avec log serveur). C'est une mise en œuvre mécanique complémentaire à la priorisation sémantique des 25 paramètres prévue dans la story initiale — elle prévient les hallucinations sur conversations longues et maîtrise le coût LLM.
- Le nombre de messages tronqués est tracé dans `llm_usage_events` (cf. E7.1).
- ✅ Edge function déployée sur B4 le 06/05/2026 — plafond et tracking des troncatures pleinement actifs côté serveur.

##### Reste à livrer

- Couche sémantique de priorisation des 25 paramètres extraits (au-delà du simple plafond mécanique sur les messages).

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent E2.4

- `SPRINT_HANDOFF.md`
- `supabase/functions/make-server-e3db71a4/index.ts`
