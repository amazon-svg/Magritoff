---
id: T08.N4
epic: T-08 — AO & Catalogues
source: notion
notion_url: https://app.notion.com/p/373d0131973c817b9afde38d9b7561fd
---
# T08.N4 — Mapping de colonnes sémantique (auto + profil par donneur d'ordre)

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [T08.N4 — Mapping de colonnes sémantique (auto + profil par donneur d'ordre)](https://app.notion.com/p/373d0131973c817b9afde38d9b7561fd) · extrait le 17/09/2026 · page modifiée le 02/06/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| T-08 — AO & Catalogues | Backlog | P0 | L | Pas commencé | — | Toutes | — | — |

### Description fonctionnelle (Notion)

##### User story
En tant qu'imprimeur recevant des BPU de mises en page variées, je veux que Magrit identifie automatiquement le rôle de chaque colonne, avec un profil mémorisable par donneur d'ordre, afin de ne pas reconfigurer à chaque AO.
##### Contexte (story la plus risquée)
Le BPU d'ICI est **un exemple répétable parmi d'autres** : même hiérarchie métier, particularités propres. Toute logique propre à un émetteur vit dans un **profil**, jamais dans le code. *Ajouter un émetteur = créer un profil, sans modifier le moteur.*
##### Critères d'acceptation
- Détection auto par (a) libellés d'en-tête et (b) motifs de contenu : `\d+\s?ex`→quantité ; `RESPECTA|Offset|vinyle|Dibond|Akilux|PVC|bâche`→support ; `pli|piqûre|rainage|œillet|découpe|lamination|vernis`→façonnage ; `\d+\s?[x×]\s?\d+|Diamètre|Format (fini|ouvert|fermé)`→format.
- Sur la fixture : mapping correct des 8 colonnes sans intervention (score ≥ 0,9).
- Cas non résolus (\< seuil) remontés pour arbitrage (T08.N14), sans arrêter le traitement.
- Profil validé persistable et réappliqué au même donneur d'ordre.
##### Specs API / Data
- `ao_mapping_profile.column_map` (rôle→colonne) ; `POST /api/ao/imports/{id}/normalize` `{profile_id?}`.
- LLM (Claude) en repli pour libellés exotiques, sortie JSON contrainte. CRUD `/api/ao/mapping-profiles`.
##### Dépendances
T08.N2, T08.N3.
**Effort : L (≈8 pts).**

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent T08.N4

_Aucun fichier du dépôt ne cite cet identifiant._
