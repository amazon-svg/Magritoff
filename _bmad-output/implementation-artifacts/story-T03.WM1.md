---
id: T03.WM1
epic: T-03 — Sync eCommerce
source: notion
notion_url: https://app.notion.com/p/35fd0131973c81eb83a2c755d5db80f6
---
# Synchronisation unidirectionnelle vers CMS — PrestaShop priorité

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [Synchronisation unidirectionnelle vers CMS — PrestaShop priorité](https://app.notion.com/p/35fd0131973c81eb83a2c755d5db80f6) · extrait le 17/09/2026 · page modifiée le 13/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| T-03 — Sync eCommerce | Backlog | P1 | L | Pas commencé | Laurent | Pro+ | WM 12/05/2026 | — |

### Description fonctionnelle (Notion)

##### Description

Export unidirectionnel des produits et prix Magrit vers les plateformes CMS e-commerce. PrestaShop en priorité (déjà travaillé par Laurent), puis Magento. Shopify sous réserve de validation commerciale (T03.WM2). Synchronisation Magrit → CMS uniquement.

##### Critères d'acceptation

- Produit créé dans Magrit visible dans PrestaShop en \< 5 minutes
- Association produit Magrit → fiche produit PrestaShop opérationnelle
- Transfert du panier Magrit vers PrestaShop fonctionnel
- Synchronisation unidirectionnelle documentée (Magrit = source de vérité)

##### Données de contexte — WM#120526

- Laurent travaille déjà sur l'intégration PrestaShop (ref. actions WM2204)
- Ref. transcription : Doc4 01:35:02

##### Dépendances

- E4.WM1/E4.WM2 (storefronts) — sources des données à synchroniser
- T03.WM2 (analyse Shopify) — à valider avant d'étendre à Shopify

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent T03.WM1

_Aucun fichier du dépôt ne cite cet identifiant._
