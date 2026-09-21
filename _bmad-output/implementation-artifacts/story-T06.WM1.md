---
id: T06.WM1
epic: T-06 — Parc & monétisation
source: notion
notion_url: https://app.notion.com/p/35fd0131973c81f7b345f6ac447c5fda
---
# Prix marché instantané — parc ~10 imprimeurs préqualifiés

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [Prix marché instantané — parc ~10 imprimeurs préqualifiés](https://app.notion.com/p/35fd0131973c81f7b345f6ac447c5fda) · extrait le 17/09/2026 · page modifiée le 13/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| T-06 — Parc & monétisation | Backlog | P0 | M | Pas commencé | Laurent | Freemium+ | WM 12/05/2026 | — |

### Description fonctionnelle (Notion)

##### Description

Constituer un parc de ~10 imprimeurs préqualifiés (La Rochelaise, FIROPA, Nouvelle Erre). Calculer et stocker un prix marché par combinaison produit type. Afficher ce prix instantanément à la réponse conversationnelle.

##### Critères d'acceptation

- Prix marché affiché en < 1 seconde
- Parc d'au moins 10 imprimeurs actifs et paramétrés
- Politique d'invalidation/mise à jour du cache documentée et implémentée
- Badge visuel « Prix marché » présent sur le résultat

##### Données de contexte — WM#120526

- Parc trop large = calcul plus lent sans gain de précision (Xavier Péchoultres)
- Imprimeurs mentionnés : La Rochelaise, FIROPA, Nouvelle Erre
- Ref. transcription : Doc4 00:48:24 / 00:49:13

##### Dépendances

- E1.WM2 (POC HStudio) — le prix marché s'appuie sur les calculs Clariprint
- T06.WM2 — doit s'enchaîner avec le calcul dynamique

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent T06.WM1

_Aucun fichier du dépôt ne cite cet identifiant._
