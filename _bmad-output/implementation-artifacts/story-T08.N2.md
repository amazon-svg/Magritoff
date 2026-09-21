---
id: T08.N2
epic: T-08 — AO & Catalogues
source: notion
notion_url: https://app.notion.com/p/373d0131973c819cb634ca2b57891a50
---
# T08.N2 — Détection de structure (catégories, en-têtes, lignes produit, pied)

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [T08.N2 — Détection de structure (catégories, en-têtes, lignes produit, pied)](https://app.notion.com/p/373d0131973c819cb634ca2b57891a50) · extrait le 17/09/2026 · page modifiée le 02/06/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| T-08 — AO & Catalogues | Backlog | P0 | M | Pas commencé | — | Toutes | — | — |

### Description fonctionnelle (Notion)

##### User story
En tant que système, je veux classer chaque ligne (titre, bordereau, en-tête de colonnes, bandeau de catégorie, ligne produit, pied de signature, vide), afin d'isoler les lignes chiffrables.
##### Contexte
Sur ICI : 11 bandeaux de catégorie (lignes pleine largeur fusionnées), 1 en-tête, 2 lignes de pied (signature), à exclure des 234 produits. Voir **principe de structure canonique invariante** : `Gamme > Produit > Quantité > Format > Support > Déclinaisons`.
##### Critères d'acceptation
- Sur la fixture : exactement **11** lignes `section`, **1** `header`, **2** `footer`, **234** `product`.
- `section` = toutes colonnes utiles identiques (fusion pleine largeur), hors titre/bordereau.
- `product` = nom en colonne Objet **et** quantité non vide.
- La catégorie courante est propagée aux lignes produit suivantes jusqu'au prochain bandeau.
##### Specs API / Data
- Renseigne `ao_raw_row.row_type`. `GET /api/ao/imports/{id}/rows?type=product`.
- Heuristiques de typage surchargeables par `ao_mapping_profile.detection_rules`.
##### Dépendances
T08.N1.
**Effort : M (≈5 pts).**

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent T08.N2

_Aucun fichier du dépôt ne cite cet identifiant._
