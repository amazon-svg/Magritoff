---
id: E7.WM1
epic: E7 — Perf & infra
source: notion
notion_url: https://app.notion.com/p/35fd0131973c81cb8ee9cb2c42432783
---
# Quotas journaliers par tier — Freemium et Découverte

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [Quotas journaliers par tier — Freemium et Découverte](https://app.notion.com/p/35fd0131973c81cb8ee9cb2c42432783) · extrait le 17/09/2026 · page modifiée le 13/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E7 — Perf & infra | Backlog | P0 | S | Pas commencé | Laurent | Freemium+ | WM 12/05/2026 | — |

### Description fonctionnelle (Notion)

##### Description

Mettre en place des quotas journaliers par tier tarifaire. Freemium : 5 devis/jour. Découverte : 10 devis/jour. Compteur visible dans l'interface. Blocage propre à l'atteinte du quota avec message d'upsell.

##### Critères d'acceptation

- Compteur visible en temps réel (sidebar ou interface)
- Blocage clair à l'atteinte du quota + message upsell
- Quotas configurables par tier sans redéploiement
- Réinitialisation à minuit UTC

##### Données de contexte — WM#120526

- Freemium : 5 devis/jour proposés
- Découverte (90 €/mois) : 10 devis/jour proposés
- À valider vs coût estimé \~0,50 €/devis avant finalisation
- Ref. transcription : Doc4 01:30:12

##### Dépendances

- E7.WM2 (dashboard monitoring coûts LLM) — à réaliser en parallèle pour valider les quotas

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent E7.WM1

_Aucun fichier du dépôt ne cite cet identifiant._
