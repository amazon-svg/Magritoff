---
id: T08.N1
epic: T-08 — AO & Catalogues
source: notion
notion_url: https://app.notion.com/p/373d0131973c814082f2f7329c469a01
---
# T08.N1 — Ingestion fidèle du fichier source (binaire, multi-feuilles, fusions)

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [T08.N1 — Ingestion fidèle du fichier source (binaire, multi-feuilles, fusions)](https://app.notion.com/p/373d0131973c814082f2f7329c469a01) · extrait le 17/09/2026 · page modifiée le 02/06/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| T-08 — AO & Catalogues | Backlog | P0 | S | Pas commencé | — | Toutes | — | — |

### Description fonctionnelle (Notion)

##### User story
En tant qu'imprimeur, je veux déposer un BPU (upload ou fichier Drive) et que Magrit lise le **classeur binaire réel** (toutes feuilles, toutes lignes, fusions incluses), afin de ne perdre aucune donnée.
##### Contexte (leçon fondatrice)
La lecture « représentation naturelle » du connecteur Drive a écrasé les cellules fusionnées et tronqué 7 catégories sur 11 du BPU ICI (57 déclinaisons vues au lieu de 234). **On n'ingère jamais un proxy texte ; toujours le binaire source.**
##### Critères d'acceptation
- Sur la fixture `bpu_ici_lot1.xlsx` : **255 lignes** et **233 plages fusionnées** chargées, zéro perte.
- Refus explicite de toute source non binaire (proxy texte), erreur tracée.
- Formats acceptés : `.xlsx`, `.xls` ; `.csv` accepté mais `merged_ranges=[]`.
- Source Drive : binaire récupéré via `download_file_content`, jamais `read_file_content`.
- Taille max paramétrable (défaut 25 Mo) → erreur 413 au-delà.
##### Specs API / Data
- `POST /api/ao/imports` `{source, drive_file_id?, file?, donneur_ordre?, lot?}` → `ao_import` (`status=uploaded`).
- `POST /api/ao/imports/{id}/parse` → peuple `ao_sheet` + `ao_raw_row` (cellules résolues), `status=parsed`.
- Lib `openpyxl` (`data_only=True`), multi-feuilles.
##### Dépendances
Connecteur Drive ; stockage objet tenant (binaire conservé pour la restitution AO-13/T08.N13).
**Effort : S (≈3 pts).**

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent T08.N1

_Aucun fichier du dépôt ne cite cet identifiant._
