---
id: UM1.1
epic: EPIC-UM-STORE-IDENTITY
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [UM0.1]
---
# UM1.1 — Créer le schéma des comptes clients boutique

## Résultat livré

- table additive `shop_customer_accounts` liée à `shops` ;
- email normalisé calculé par PostgreSQL et unicité
  `(shop_id, normalized_email)` ;
- états `delegated_only`, `invited`, `active`, `suspended` ;
- références Auth technique et acteur Magrit séparées ;
- contraintes de cohérence activation/suspension ;
- RLS activée et accès navigateur révoqué par défaut ;
- aucun changement sur `tenant_members`, `shop_only`, commandes ou invitations.

Les policies workspace et le BFF storefront seront livrés avec leurs
capabilities et contrats respectifs. Cette story ne rend donc pas encore la
table accessible à l’interface.
