---
id: E7.WM2
epic: E7 — Perf & infra
source: notion
notion_url: https://app.notion.com/p/35fd0131973c81588ee1d4245799c178
---
# Dashboard monitoring coûts LLM par devis

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [Dashboard monitoring coûts LLM par devis](https://app.notion.com/p/35fd0131973c81588ee1d4245799c178) · extrait le 17/09/2026 · page modifiée le 13/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E7 — Perf & infra | Backlog | P1 | M | Pas commencé | Laurent | Technique | WM 12/05/2026 | — |

### Description fonctionnelle (Notion)

##### Description

Mesurer le coût réel d'une requête type (tokens entrants/sortants LLM + appels Clariprint). Objectif : valider l'estimation 0,50 €/devis et affiner la tarification. Tableau de bord back-office avec historique 30 jours et export CSV.

##### Critères d'acceptation

- Coût par requête visible dans le back-office administrateur
- Décomposition : tokens entrants / tokens sortants / appels Clariprint
- Historique 30 jours minimum avec agrégation journalière
- Export CSV des données de consommation
- Alerte configurable si coût moyen \> seuil

##### Données de contexte — WM#120526

- Estimation : 0,01 à 0,02 €/token, plusieurs appels par requête
- Coût moyen estimé \~0,50 €/devis — À VALIDER IMPÉRATIVEMENT avant de figer quotas et tarification
- Ref. transcription : Doc4 01:30:49 / 01:32:46

##### Dépendances

- E7.WM1 (quotas par tier) — à valider conjointement

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent E7.WM2

_Aucun fichier du dépôt ne cite cet identifiant._
