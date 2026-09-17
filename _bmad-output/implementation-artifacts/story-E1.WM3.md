---
id: E1.WM3
epic: E1 — Clariprint
source: notion
notion_url: https://app.notion.com/p/35fd0131973c81fa905de05c22063460
---
# Refactoring POC Magrit post-stabilisation frontière HStudio

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [Refactoring POC Magrit post-stabilisation frontière HStudio](https://app.notion.com/p/35fd0131973c81fa905de05c22063460) · extrait le 17/09/2026 · page modifiée le 13/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E1 — Clariprint | Backlog | P0 | XL | Pas commencé | Laurent | Technique | WM 12/05/2026 | — |

### Description fonctionnelle (Notion)

##### Description

Une fois la frontière HStudio/Magrit documentée (E1.WM1) et l'API HStudio stabilisée (E1.WM2), refactoriser la partie POC Magrit pour éliminer tous les couplages directs sur Clariprint.

##### Critères d'acceptation

- Tests unitaires passés post-refactoring
- Zéro appel direct Clariprint depuis le code Magrit applicatif (grep vérifié)
- Architecture conforme au document de frontière (E1.WM1)
- CI/CD stable après refactoring

##### Données de contexte — WM#120526

- Xavier : « refactoriser la partie POC de Magrit une fois que la frontière technique sera établie et le côté Studio stabilisé »
- Ref. transcription : Doc4 01:06:09

##### Dépendances

- ⚠️ E1.WM1 validé — prérequis absolu
- ⚠️ E1.WM2 stable — prérequis absolu
- Ne pas démarrer avant validation conjointe des deux équipes

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent E1.WM3

_Aucun fichier du dépôt ne cite cet identifiant._
