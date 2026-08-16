---
id: UM1.3
epic: EPIC-UM-STORE-IDENTITY
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [UM1.2]
---
# UM1.3 — Exposer l’API workspace des comptes boutique

## Résultat livré

- adaptateur `SupabaseShopCustomersRepository` ;
- vérification systématique du couple tenant/boutique ;
- routes authentifiées `GET/POST .../shops/{shopId}/customers` ;
- client HTTP partagé `ShopCustomersApiClient` composé par le runtime ;
- erreur `duplicate_email` traduite en Problem Details 409 ;
- câblage dans l’Edge Function Magrit ;
- types de base de données et tests client/serveur synchronisés.

Cette API est réservée aux utilisateurs workspace autorisés par RLS. Elle ne
crée aucune session storefront et n’expose aucune délégation.
