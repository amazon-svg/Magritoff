---
id: UM10.3
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM8.1, UM8.3]
---
# UM10.3 — Retirer l’ancienne UI de profil mixte

## Résultat

- suppression du formulaire mort `EditPermissionsModal` et de son sélecteur
  `magrit_full / shop_only` dans `DashboardUsers` ;
- suppression de la commande morte qui pouvait encore tenter d’écrire un
  `shop_only` depuis la surface utilisateurs Magrit ;
- conservation de la lecture des lignes historiques et de leur unique action
  autorisée : promotion vers `magrit_full` ;
- garde-fou d’architecture empêchant le retour du formulaire, de la valeur
  `shop_only` ou d’une branche d’écriture équivalente dans le dashboard.

## Validation

- typecheck modulaire ;
- 60 tests d’architecture ciblés.
