---
id: E_PIM.audit-classification-ERAM
epic: E6 — Données & qualité
source: notion
notion_url: https://app.notion.com/p/35dd0131973c819faa72da51815d1a5a
---
# E_PIM.audit-classification-ERAM — Reclassification 5 produits ERAM + ajout gamme kakemono

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [E_PIM.audit-classification-ERAM — Reclassification 5 produits ERAM + ajout gamme kakemono](https://app.notion.com/p/35dd0131973c819faa72da51815d1a5a) · extrait le 17/09/2026 · page modifiée le 11/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E6 — Données & qualité | Sprint 4 | P1 | M | Pas commencé | Arnaud | Toutes | Cas de test KO | — |

### Description fonctionnelle (Notion)

##### Origine

Campagne TF Sprint 3 du 11/05/2026 — cas TF-58 OK partiel, réserve P1 sur mismatchs PIM.

- Fiche TF : [TF-58](https://www.notion.so/35dd0131973c81e190eec6058f0f591a)
- CR campagne : [CR 11/05](https://www.notion.so/35dd0131973c8107bf9ad735ab8c5353)

##### Contexte

Sur 26 cards ERAM, 5 mismatchs : 3 affiches (vitrine A2/A3) portent badge `"Carterie"` au lieu d'affiche ; 2 kakémonos (85×200 cm + roll-up) portent `"Flyers"` au lieu de kakémono. Gamme `kakemono` absente des 22 gammes du backfill PIM 2026-05-10. Chaîne `enrichProduct()` OK, cause racine = mapping produit↔gamme ERAM en amont.

Périmètre : tables `tenant_gamme_subscriptions` + `product_definitions` + `shop_products` ERAM, endpoint `pim-generate`.

##### User story

En tant que Acheteur shop_only, je veux voir un badge gamme correct sur chaque produit ERAM, afin de filtrer le catalogue avec une classification cohérente.

##### Critères d'acceptation

1. **Given** `product_definitions`, **When** query `count(*) where gamme_slug like 'kakemono%'`, **Then** ≥ 1 row existe.
2. **Given** gamme `kakemono` générée + persistée, **When** query `tenant_gamme_subscriptions` ERAM, **Then** souscription `kakemono` active.
3. **Given** je navigue `/shop/xyfjjo-q6kekm`, **When** je liste les 26 cards + badges, **Then** : 0 affiche en `"Carterie"`, 0 kakémono en `"Flyers"`, 3 affiches en badge affiche, 2 kakémonos en badge `"Kakémono"`.
4. **Given** distribution corrigée, **When** toggle pills, **Then** pill `"Kakémono"` filtre les 2 cards.
5. **0 régression** sur les 21 autres produits ERAM.
6. **Re-test TF-58** confirme 0 mismatch.

##### Spécifications API / data

- Tables : `product_definitions` (ajout row `kakemono` via `pim-generate` LLM + extend seed `supabase/seeds/pim_backfill_2026-05-10.sql`) + `tenant_gamme_subscriptions` (souscription ERAM) + `shop_products` (UPDATE `gamme_slug` des 5 produits).
- Endpoint : [supabase/functions/pim-generate/index.ts](supabase/functions/pim-generate/index.ts).
- Helper [src/app/utils/productEnrichment.ts](src/app/utils/productEnrichment.ts) inchangé.
- Pas de featureFlag, pas de testid.

##### Dépendances

- **ExpertSolutions** (Laurent ou Xavier) : arbitrer granularité PIM `kakemono` vs `kakemono_roll_up` vs `kakemono_standard`. Défaut J2 = 1 gamme `kakemono` avec variation par taille.
- Pas de prérequis bloquant front.

##### Estimation

**M (1-2 j)**. Génération PIM kakemono LLM (1 h) + revue + audit SQL ERAM + UPDATE + re-test.

##### Plan de test

- TF à re-jouer : [TF-58](https://www.notion.so/35dd0131973c81e190eec6058f0f591a).
- TF nouveau : *"Catalogue ERAM — classification PIM granulaire affiche/kakémono"*, P09, Acheteur shop_only, P1, IA Chrome + SQL DB.
- Smoke SQL : `select gamme_slug, count(*) from shop_products where shop_id='bda70ec0-2341-4043-88bb-2d9818cf2a25' group by gamme_slug;`.

##### Définition de « terminé »

- Migration SQL ou seed re-runnable ON CONFLICT ajouté à `supabase/seeds/`.
- Distribution badges ERAM corrigée en prod.
- Re-test TF-58 OK.
- ExpertSolutions notifié de l'ajout gamme `kakemono` au PIM.
- CR campagne suivante mentionnant la résolution.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent E_PIM.audit-classification-ERAM

_Aucun fichier du dépôt ne cite cet identifiant._
