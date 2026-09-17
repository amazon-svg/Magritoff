---
id: E1.WM2
epic: E1 — Clariprint
source: notion
notion_url: https://app.notion.com/p/35fd0131973c81a398ddf02b2f7b4956
---
# POC intégration HStudio dans Magrit via API Copilot

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [POC intégration HStudio dans Magrit via API Copilot](https://app.notion.com/p/35fd0131973c81a398ddf02b2f7b4956) · extrait le 17/09/2026 · page modifiée le 13/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E1 — Clariprint | Backlog | P0 | L | Pas commencé | Laurent | Technique | WM 12/05/2026 | — |

### Description fonctionnelle (Notion)

##### Description

Brancher le POC Magrit sur l'API HStudio Copilot (et non sur l'API Clariprint directement). Valider que les données nécessaires remontent correctement. Identifier les lacunes d'interface.

##### Critères d'acceptation

- Un devis complet généré dans le POC Magrit via l'API HStudio Copilot
- Données remontées : specs produit, prix calculé, patron de découpe
- Lacunes d'interface documentées et remontées à Xavier
- Zéro appel direct à l'API Clariprint depuis le code Magrit applicatif

##### Données de contexte — WM#120526

- Xavier : avantage d'intégrer ObStudio directement = bénéficier des patrons de découpe et vue 3D dès le POC
- Décision acté : « L'intégration directe d'OP Studio au POC est confirmée comme la meilleure méthode, écartant l'utilisation directe de l'API Clariprint »
- Ref. transcription : Doc4 01:00:27 / 01:01:39 / 01:04:19

##### Dépendances

- E1.WM1 (frontière technique documentée) — prérequis
- Disponibilité API HStudio Copilot de l'équipe Expert Solutions

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent E1.WM2

_Aucun fichier du dépôt ne cite cet identifiant._
