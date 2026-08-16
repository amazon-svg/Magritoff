---
id: UM1.2
epic: EPIC-UM-STORE-IDENTITY
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [UM1.1]
---
# UM1.2 — Domaine et accès workspace des comptes boutique

## Résultat livré

- port repository et service `ShopCustomersService` sans dépendance Supabase ;
- création métier normalisée et détection de doublon limitée à une boutique ;
- capabilities `can_manage_shop_customers` et
  `can_impersonate_shop_customer` pour Owner/Admin ;
- conservation de ces capabilities lors de l’édition d’un rôle canonique ;
- policies RLS scopées par `shop_id → tenant_id` ;
- droits d’écriture limités aux colonnes métier, sans mutation possible du
  `shop_id` ni de l’identité Auth technique ;
- aucun accès `anon`, aucune suppression et aucun accès storefront direct.

Les routes HTTP et l’adaptateur Supabase ne sont pas encore activés. Ils feront
l’objet du prochain incrément avec tests de repository et erreurs HTTP.
