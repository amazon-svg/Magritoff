---
id: T06.WM2
epic: E3 — UX & streaming
source: notion
notion_url: https://app.notion.com/p/35fd0131973c8159ac17eb41ebbe965c
---
# Calcul Clariprint en arrière-plan + remontée progressive UI

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [Calcul Clariprint en arrière-plan + remontée progressive UI](https://app.notion.com/p/35fd0131973c8159ac17eb41ebbe965c) · extrait le 17/09/2026 · page modifiée le 13/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E3 — UX & streaming | Backlog | P0 | L | Pas commencé | Laurent | Freemium+ | WM 12/05/2026 | — |

### Description fonctionnelle (Notion)

##### Description

Afficher d'abord le prix marché pré-calculé (T06.WM1), puis déclencher le calcul Clariprint en arrière-plan dès la réponse. Mettre à jour l'UI progressivement à la réception des résultats. Ne jamais bloquer l'expérience utilisateur pendant la latence.

##### Critères d'acceptation

- Indicateur de chargement visible pendant le calcul
- Mise à jour silencieuse du prix sans rechargement de page
- Zéro timeout côté utilisateur (même si calcul \> 25s)
- Temps de calcul loggué (objectif \< 3s selon KPI roadmap)

##### Données de contexte — WM#120526

- Latence constatée : 10 à 25 secondes par calcul Clariprint
- Stratégie retenue : prix marché d'abord, affiner avec calcul dynamique
- Ref. transcription : Doc4 01:13:13 / 01:15:19

##### Dépendances

- T06.WM1 — prérequis
- E1.WM2 (POC HStudio API)

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent T06.WM2

_Aucun fichier du dépôt ne cite cet identifiant._
