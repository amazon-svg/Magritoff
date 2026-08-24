---
id: UM1.4
epic: EPIC-UM-STORE-IDENTITY
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [UM1.3]
---
# UM1.4 — Séparer les comptes boutique dans l’interface workspace

## Résultat livré

- section « Comptes clients de cette boutique » dans l’éditeur de boutique ;
- liste chargée par `ShopCustomersApiClient`, sans accès Supabase depuis React ;
- création d’un compte métier `delegated_only` propre à la boutique ;
- texte explicite distinguant ces comptes des utilisateurs Magrit ;
- aucune fausse promesse d’email, de mot de passe ou de session storefront ;
- tests d’architecture UI sur cette frontière.

La création manuelle ne remplace ni UM3 (invitation boutique), ni UM4 (compte
miroir), ni UM5 (délégation). Elle rend seulement le nouveau modèle observable et
administrable depuis la boutique concernée.
