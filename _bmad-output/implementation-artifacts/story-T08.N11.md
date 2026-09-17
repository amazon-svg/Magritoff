---
id: T08.N11
epic: T-08 — AO & Catalogues
source: notion
notion_url: https://app.notion.com/p/373d0131973c81a88856e4278fd340b1
---
# T08.N11 — Génération des variantes & arbitrage des ambiguïtés

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [T08.N11 — Génération des variantes & arbitrage des ambiguïtés](https://app.notion.com/p/373d0131973c81a88856e4278fd340b1) · extrait le 17/09/2026 · page modifiée le 02/06/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| T-08 — AO & Catalogues | Backlog | P1 | M | Pas commencé | — | Toutes | — | — |

### Description fonctionnelle (Notion)

##### User story
En tant qu'imprimeur, je veux que les options combinatoires et optionnelles génèrent les variantes à chiffrer (ou une demande d'arbitrage), afin de rendre tous les prix attendus.
##### Contexte
Réel : `72 pages … avec option dos carré collé` (2 prix), `Avec ou sans lamination / avec ou sans œillets` (jusqu'à 4 combinaisons), `20 modèles différents`.
##### Critères d'acceptation
- Une option `optional=true` ou « avec ou sans » génère N variantes liées (`parent_line_id`).
- Explosion combinatoire plafonnée (défaut 8/ligne) ; au-delà → arbitrage humain (T08.N14).
- Les variantes héritent de tous les attributs de la mère sauf l'option variée.
##### Specs API / Data
`POST /api/ao/imports/{id}/expand-variants` ; `ao_line.parent_line_id`, `ao_line.variant_of_option`.
##### Dépendances
T08.N8, T08.N10.
**Effort : M (≈5 pts).**

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent T08.N11

_Aucun fichier du dépôt ne cite cet identifiant._
