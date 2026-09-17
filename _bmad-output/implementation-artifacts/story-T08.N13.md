---
id: T08.N13
epic: T-08 — AO & Catalogues
source: notion
notion_url: https://app.notion.com/p/373d0131973c8136bf2ed8f17b8002e6
---
# T08.N13 — Restitution d'un fichier de structure comparable à l'origine

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [T08.N13 — Restitution d'un fichier de structure comparable à l'origine](https://app.notion.com/p/373d0131973c8136bf2ed8f17b8002e6) · extrait le 17/09/2026 · page modifiée le 02/06/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| T-08 — AO & Catalogues | Backlog | P0 | M | Pas commencé | — | Toutes | — | — |

### Description fonctionnelle (Notion)

##### User story
En tant qu'imprimeur, je veux restituer un fichier dont la **structure est comparable au BPU d'origine** (même disposition, colonnes, intitulés), P.U. remplis, afin que le donneur d'ordre puisse le **retraiter avec ses propres outils** sans ressaisie.
##### Contexte
Le livrable final d'un AO est le bordereau de l'émetteur rendu dans une forme qu'il sait ingérer. Toute dérive de structure le rend inexploitable et peut disqualifier la réponse.
##### Critères d'acceptation
- Le fichier restitué **conserve la structure source** : ordre/intitulés des colonnes, bandeaux de catégorie, fusions, styles, pied — seules les colonnes P.U. sont remplies.
- Stratégie par défaut : écriture sur **copie du binaire source** (T08.N1) → isomorphisme garanti ; pas de reconstruction « from scratch ».
- `GET /api/ao/imports/{id}/export?format=bpu_xlsx` ; `manual` résiduel annoté en commentaire de cellule, sans colonne ajoutée.
- Contrôle fixture : rouvre sans erreur, **255 lignes / 233 fusions / 11 catégories intactes**, diff structurel nul hors colonnes P.U.
- Fonctionne quel que soit le gabarit d'entrée (principe de structure canonique).
##### Specs API / Data
`openpyxl` en écriture sur copie du binaire source. `status=exported`. Export `referentiel_md`/`json` en complément, jamais en remplacement du fichier émetteur.
##### Dépendances
T08.N1 (binaire conservé — prérequis dur), T08.N9, T08.N12.
**Effort : M (≈5 pts).**

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent T08.N13

_Aucun fichier du dépôt ne cite cet identifiant._
