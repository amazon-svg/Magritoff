---
id: T08.N12
epic: T-08 — AO & Catalogues
source: notion
notion_url: https://app.notion.com/p/373d0131973c81358106c6095f1ae0e3
---
# T08.N12 — Chiffrage en masse via Magrit Core

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [T08.N12 — Chiffrage en masse via Magrit Core](https://app.notion.com/p/373d0131973c81358106c6095f1ae0e3) · extrait le 17/09/2026 · page modifiée le 02/06/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| T-08 — AO & Catalogues | Backlog | P0 | M | Pas commencé | — | Toutes | — | — |

### Description fonctionnelle (Notion)

##### User story
En tant qu'imprimeur, je veux chiffrer toutes les lignes `mapped` (et variantes) en un seul run, afin d'obtenir P.U. HT et P.U. exemplaire supplémentaire HT.
##### Critères d'acceptation
- `POST /api/ao/imports/{id}/quote` chiffre toutes les lignes `mapped` ; remplit `price_ht` et `price_extra_ht`.
- Le P.U. ex. sup. utilise la quantité supplémentaire (`quantity_extra`).
- Lignes `manual`/`unmapped` résiduelles laissées vides avec motif.
- Exécution \< 60 s pour 234 lignes ; rapport de couverture (chiffrées / résiduelles / erreur), grand format inclus dans les chiffrées.
- Réutilise le moteur de prix Magrit Core existant (pas de moteur ad hoc).
##### Specs API / Data
Appels batch au service de pricing Magrit Core ; idempotent par `import_id`. `status=quoted`.
##### Dépendances
T08.N10, T08.N11 ; Magrit Core (moteur de prix temps réel).
**Effort : M (≈5 pts).**

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent T08.N12

_Aucun fichier du dépôt ne cite cet identifiant._
