---
id: E_CART.persist-localstorage
epic: E4 — Mini-shop
source: notion
notion_url: https://app.notion.com/p/35dd0131973c81438b10d5db1db7a079
---
# E_CART.persist-localstorage — Persistance CartContext localStorage par shop_slug

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [E_CART.persist-localstorage — Persistance CartContext localStorage par shop_slug](https://app.notion.com/p/35dd0131973c81438b10d5db1db7a079) · extrait le 17/09/2026 · page modifiée le 11/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E4 — Mini-shop | Backlog | P2 | S | Pas commencé | Claude code | Toutes | Cas de test KO | — |

### Description fonctionnelle (Notion)

##### Origine

Story issue de la **Campagne TF Sprint 3 du 11/05/2026** — observation P2 sur TF-63 ✅ (drawer OK mais cart non persisté F5).

- Fiche TF source : [TF-63 — Drawer panier slide-right](https://www.notion.so/35dd0131973c81e78d5cdaff5bf4e993)
- CR campagne : [CR Campagne TF — Sprint 3 — 11/05/2026](https://www.notion.so/35dd0131973c8107bf9ad735ab8c5353)

##### Contexte

Après F5 sur la vue Catalogue avec 3 articles au panier, le `CartContext` est vidé : `aria-label="Panier (0 article)"`. TF-57 a pourtant montré que le state des filtres pills est persisté (`magrit_shop_expanded_gammes__<slug>`). La symétrie filtre/panier serait préférable UX B2B.

Périmètre : [src/app/contexts/CartContext.tsx](src/app/contexts/CartContext.tsx) (71 lignes, typé `product: any`, volatil — cf. audit refacto §4.3).

##### User story

En tant que **Acheteur shop_only**, je veux que mon panier soit persisté localement lorsque je rafraîchis ou ferme/réouvre l'onglet, afin de pouvoir reprendre une session d'achat sans tout reconstruire.

##### Critères d'acceptation

1. **Given** `/shop/<slug>` avec 3 articles, **When** je F5, **Then** `cart-icon-label` affiche `"Panier (3 articles)"` et le drawer contient ces 3 articles.
2. **Given** je suis sur `/shop/<slug-A>` avec 2 articles, **When** je navigue vers `/shop/<slug-B>`, **Then** le panier shop B est indépendant (clé par shop_slug `magrit_shop_cart__<slug>`).
3. **Given** un cart persisté \> **24 heures** (à arbitrer 24 h vs 7 j), **When** je rafraîchis, **Then** le cart est purgé (expiration soft).
4. **Given** je clic « Vider le panier », **When** vidé, **Then** la clé localStorage est purgée immédiatement.
5. **0 régression** : TF-57, TF-58, TF-59, TF-63 OK. Le typage `any` n'est PAS refactoré dans cette story (cf. audit refacto post-démo).
6. **TF nouveau couvrant la persistance** créé et OK sur prochaine campagne.

##### Spécifications API / data

- [src/app/contexts/CartContext.tsx](src/app/contexts/CartContext.tsx) : `useEffect` save sur `items[]` + `useEffect` restore au mount (slug en prop du provider ou param URL).
- **Clé localStorage** : `magrit_shop_cart__<slug>` (préfixe `magrit_` + tenant-suffixing, cf. project-context §3.4).
- **Format JSON** : `{ items: CartItem[], expires_at: ISO-8601 }` avec `expires_at = now + 24h` (à confirmer planning).
- Pas d'endpoint backend ajouté. Pas de SQL.
- Pas de testid nouveau.

##### Dépendances

- Aucun prérequis bloquant. Peut attendre Sprint 5 si capacité Sprint 4 saturée.
- **Décision produit à arbitrer** : 24 h vs 7 jours d'expiration. Recommandé 24 h (risque prix Clariprint périmé).

##### Estimation

**S (\< 1 j)**. 2 effets + helper save/load + tests vitest + 1 TF nouveau.

##### Plan de test

- **TF existant à re-jouer** : [TF-63](https://www.notion.so/35dd0131973c81e78d5cdaff5bf4e993).
- **TF nouveau à créer** : *"CartContext — persistance localStorage par shop_slug + expiration 24h"*, P09, Acheteur shop_only, P1, Manuel + IA Chrome.
- **Smoke vitest** : cas couvrant save + load + expiration + isolation par shop.

##### Définition de « terminé »

- Code mergé sur `beta/v5`.
- vitest 162/162+ verts.
- TF nouveau créé et OK.
- CR campagne suivante mentionnant la résolution.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent E_CART.persist-localstorage

_Aucun fichier du dépôt ne cite cet identifiant._
