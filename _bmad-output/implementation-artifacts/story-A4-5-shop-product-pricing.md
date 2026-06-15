# Story A4.5 — Tarif custom par boutique (négociation client)

> **Sprint** : A4 mini-sprint personnalisation (post-démo Magrit Core)
> **Statut** : in_progress
> **Branche** : `beta/v5`
> **Date démarrage** : 2026-06-15
> **Dev** : Amelia (BMAD)

## Contexte

Cartographie 2026-06-15 a identifié l'absence totale de tarif négocié
per-shop dans le modèle actuel : tous les acheteurs d'une boutique voient
le prix défini dans `product_library.price_ht` (cache résolu via la
hiérarchie `clariprint > library > prix_marche > zero`).

A4.5 introduit **un niveau au-dessus** de toute cette hiérarchie : un
**prix négocié** que l'admin tenant définit par boutique + produit. Use
case typique : « pour le client Groupe X, on a négocié -15% sur les
brochures. Quand un acheteur du Groupe X commande, il voit le prix
négocié, pas le tarif catalogue. »

## Architecture retenue (validée Arnaud 2026-06-15)

**Table dédiée `shop_product_pricing`** (pas colonne sur `shop_products`)
pour rester extensible (validity temporelle, notes, audit) sans
surcharger une table legacy.

MVP simple :
- 1 override par couple (shop, library_product). Unique partial index.
- Pas de validity temporelle (`valid_from`/`valid_until`) — V2 si besoin
  de contrats trimestriels.
- Pas de note métadonnée — V2.

## Acceptance criteria

- **AC1** — Migration `20260615000200_shop_product_pricing.sql` crée la
  table avec :
  - Colonnes : `id`, `shop_id` (FK shops on delete cascade),
    `library_product_id` (FK product_library on delete cascade),
    `price_ht_override` (numeric(12,2) not null), `tenant_id` (not null),
    timestamps.
  - Unique index sur `(shop_id, library_product_id)`.
  - RLS activée + 3 policies : tenant_select, tenant_write, public_read
    via `shops.active=true`.
- **AC2** — Hiérarchie de prix portail acheteur étendue :
  `shop_pricing > library_cached > zero` (Clariprint live et prix_marché
  restent pour le moteur de devis Clariprint — sur le portail acheteur
  le prix affiché est celui de la boutique).
- **AC3** — Helper pur `applyPricingOverrides(products, overrides)`
  qui remplace `price_ht` par l'override quand un match (product_id) est
  trouvé. Testable vitest.
- **AC4** — `PublicShop.refetchProducts` charge les overrides en
  parallèle de `product_library` puis applique via le helper.
- **AC5** — UI admin tenant dans `DashboardShopEditor` :
  - Sur chaque ligne `library`-source de `displayProducts`, un input
    inline « Prix négocié » à droite du prix biblio.
  - Vide = pas d'override (= prix biblio).
  - Saisie d'un nombre + blur = upsert immédiat (pas de bouton Save
    séparé — UX directe « négociation rapide »).
  - Badge visuel quand un override est actif.
- **AC6** — Suppression d'un override = passer le champ à 0 ou vide
  puis blur. Le helper supabase fait un `delete from shop_product_pricing
  where shop_id=? and library_product_id=?`.
- **AC7** — Tests vitest : helper `applyPricingOverrides` (5+ cas).
- **AC8** — Smoke E2E manuel : éditer 1 override sur ERAM, vérifier
  rendu portail avec le prix override.

## Tasks

### T1 — Migration `20260615000200_shop_product_pricing.sql`

CREATE TABLE + RLS + unique index. Idempotent.

### T2 — Helper `src/app/utils/applyPricingOverrides.ts`

Fonction pure :

```ts
export interface PricingOverride {
  library_product_id: string;
  price_ht_override: number;
}

export function applyPricingOverrides<P extends { product_id: string | null }>(
  products: P[],
  overrides: PricingOverride[],
): (P & { price_ht_override?: number | null })[] {
  const byId = new Map(overrides.map((o) => [o.library_product_id, o.price_ht_override]));
  return products.map((p) => {
    const o = p.product_id ? byId.get(p.product_id) : undefined;
    if (typeof o === 'number') return { ...p, price_ht_override: o };
    return { ...p, price_ht_override: null };
  });
}
```

### T3 — Hook `useShopPricingOverrides(shopId)` ou fetch direct

Pattern minimal : un fetch direct dans `PublicShop.refetchProducts` qui
charge les overrides du shop + applique avant `setProducts`. Pas de hook
séparé pour MVP (KISS).

Override appliqué : `price_ht` est remplacé par l'override quand présent.

### T4 — UI inline DashboardShopEditor

Pour chaque `DisplayProduct` source=`library`, afficher un input number
inline + badge. Upsert sur blur.

### T5 — Tests vitest

`applyPricingOverrides.test.ts` avec :
- override match → price_ht_override défini
- pas d'override → price_ht_override = null
- product_id null → ignoré
- overrides vides → tous null
- plusieurs produits + plusieurs overrides

### T6 — Push prod B5 + commit

## Lessons appliquées

- **2026-06-09** Migration sans `CREATE OR REPLACE FUNCTION` sur fonctions
  partagées → pas de risque de régression seed.
- **2026-05-25** Pas d'invention hors backlog : MVP simple (1 override
  par couple), pas de validity temporelle.
- **2026-05-22** Microcopy FR : « Prix négocié » (pas « custom price »).
- **2026-06-08** Pas de Clariprint live override dans cette story —
  l'override est appliqué AVANT toute négociation Clariprint, c'est le
  prix qu'on AFFICHE à l'acheteur. Le moteur Clariprint reste pour le
  cas devis sur mesure.
