---
id: T08.N5
epic: T-08 — AO & Catalogues
source: notion
notion_url: https://app.notion.com/p/373d0131973c8162a1a6ff18ef147589
---
# T08.N5 — Normaliseur Quantités

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [T08.N5 — Normaliseur Quantités](https://app.notion.com/p/373d0131973c8162a1a6ff18ef147589) · extrait le 17/09/2026 · page modifiée le 02/06/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| T-08 — AO & Catalogues | Backlog | P1 | S | Pas commencé | — | Toutes | — | — |

### Description fonctionnelle (Notion)

##### User story
En tant que système, je veux convertir toute expression de quantité en `{value, unit, packaging}`, afin d'alimenter le moteur de prix.
##### Contexte
Hétérogénéité réelle : `3000 ex.`, `250 ex`, `5 000 ex.`, `1ex`, `20500 ex.`, `6 rouleaux de 100 ex.`, qté supp. `100 ex. sup`, `100 ex.sup.`.
##### Critères d'acceptation
- Espaces de milliers / casse gérés ; `5 000 ex.` → `{value:5000,unit:"ex"}`.
- Conditionnement : `6 rouleaux de 100 ex.` → `{value:6,unit:"rouleau",packaging:{per:100,unit:"ex"}}`.
- 100 % des lignes quantité/qté-sup de la fixture parsées (0 `unit=unknown`), sinon flag `qty_unparsed`.
##### Specs API / Data
Parseur déterministe (regex + table d'unités) → champs `quantity`/`quantity_extra` de `ao_line`, confiance par champ.
##### Dépendances
T08.N4.
**Effort : S (≈3 pts).**

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent T08.N5

_Aucun fichier du dépôt ne cite cet identifiant._
