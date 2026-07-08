# Story S2.12 — Badges d'état commercial sur ProductCard

**Epic** : 2 (extension e-commerce) · **FR** : FR-ECOM-02 · **Sprint** : E1 · **Effort** : S
**Branche** : `beta/v5` · **Statut** : partiel (framework livré, dérivation `Nouveau` gated audit)

## Objectif
Badges `Express 24h` / `Nouveau` / `Meilleure vente` / `Éco` **calculés** depuis les données (jamais saisis). Plafonnés à 2 visibles, priorité `Express > Nouveau > Meilleure vente > Éco` (UX §1 : le délai est l'info la plus actionnable en B2B). Aucun badge si rien → silence visuel.

## Contrainte DoD #4 — audit prod AVANT seuils
Le schéma (`ShopProduct`) porte `created_at` mais **pas** de champ eco/délai ; le volume de commandes vit dans `tenant_order_items`. Seuils à caler sur données réelles **avant** de figer :

```sql
-- (1) Récence : distribution de l'âge des produits boutique (fenêtre "Nouveau" ?)
select width_bucket(extract(day from now() - created_at), 0, 180, 6) as bucket_30j,
       count(*)
from shop_products
group by 1 order by 1;

-- (2) Best-seller : volume de commandes par produit (cutoff "Meilleure vente" ?)
select i.library_product_id, count(*) as nb_commandes
from tenant_order_items i
group by 1 order by 2 desc limit 30;

-- (3) Éco / Express : ces attributs existent-ils quelque part (PIM/Clariprint) ?
--     -> si absents, badges inactifs (data-driven) jusqu'à ajout d'un champ.
```
**Tant que (1) n'est pas confirmé** : `NEW_PRODUCT_WINDOW_DAYS` reste marqué `AUDIT-PENDING` (défaut prudent 30j, NON figé). **Tant que (2) n'a pas de data source** : badge `Meilleure vente` supporté mais non branché (relève de §4.14 / S2.17). Éco/Express idem.

## Tâches (TDD)
1. [x] Helper pur `src/app/utils/productCommercialBadges.ts` : `resolveCommercialBadges(flags)` (filtre + tri priorité + cap 2) + `BADGE_META` (label + tone sémantique neutre) + `isRecentlyAdded(createdAt, windowDays)` + `NEW_PRODUCT_WINDOW_DAYS` (AUDIT-PENDING). Tests `tests/utils/productCommercialBadges.test.ts`.
2. [x] testId `productCardCommercialBadge` dans `testIds.ts`.
3. [x] Câblage `ShopProductCard.tsx` : overlay badges top-right image ; `Nouveau` branché sur `created_at`+fenêtre ; autres badges rendus si flag (inactifs faute de data).
4. [x] build + test verts.
5. [x] **Audit prod fait 2026-07-07** (résultats ci-dessous). TF-S2.12 créé.

## Résultats audit prod 2026-07-07 (DoD #4)
- **(1) Récence** : `shop_products` ne contient qu **1 produit** (créé il y a 30-60 j). **Données insuffisantes pour calibrer** une fenêtre → `NEW_PRODUCT_WINDOW_DAYS = 30` conservé comme défaut prudent documenté (audit fait, à revisiter quand le catalogue grandit). Le badge Nouveau reste correct fonctionnellement.
- **(2) Best-seller** : `tenant_order_items.product_id` est **NULL** partout ; l identité produit = `product_label` (texte). Best-seller calculable par `product_label` (top = « Affiches A2 brillantes » ×7). **Branchement reporté** au mécanisme « Populaires » de S2.17 (même source), cf. addendum ADR §4.14.
- **(3) Éco / Express** : `shop_products.config` = `paper` + `format` seulement → **aucune source** → badges inactifs confirmés (conforme « aucun badge si rien »).

**Conclusion** : le framework S2.12 est correct et non modifié. Seuls « Meilleure vente » (source `product_label`) reste à brancher via S2.17 ; Nouveau/Éco/Express sont dans leur état attendu.

## Fichiers touchés
- `src/app/utils/productCommercialBadges.ts` (nouveau)
- `tests/utils/productCommercialBadges.test.ts` (nouveau, 9/9)
- `src/app/lib/testIds.ts` (+`productCardCommercialBadge`)
- `src/app/components/shop/ShopProductCard.tsx` (badges overlay top-right + label gamme déplacé bas-gauche)

## Statut : 🟡 framework livré (build + 640/640 tests verts, non commité). Reste : audit prod (fenêtre Nouveau + data source best-seller), TF Notion.

## Décisions
- Tones sémantiques NEUTRES (décision B) : Express=warn(orange), Nouveau=info(bleu), Meilleure vente=accent, Éco=ok(vert). Identiques inter-tenant.
- Priorité `express > new > bestseller > eco`, cap 2 (UX §1).
- `Éco`/`Express`/`Meilleure vente` = supportés mais **ne s'affichent pas** sans data (conforme UX « aucun badge si rien »).
