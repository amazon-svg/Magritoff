---
id: UM8.1
epic: EPIC-UM-STORE-IDENTITY
status: done-code
branch: feat/storefront-identity-um2
depends_on: [UM7.3]
---
# UM8.1 — Geler les écritures `shop_only`

## Objectif

Arrêter immédiatement la création de dette legacy sans supprimer les comptes
historiques avant leur contrôle sur la base distante.

## Résultat

- une invitation depuis « Utilisateurs Magrit » crée uniquement un membre
  `magrit_full` ;
- les contrats HTTP refusent les anciens champs `accessScope=shop_only` et
  `allowedShopIds` ;
- un ancien membre peut uniquement être converti vers un utilisateur Magrit ;
- un trigger PostgreSQL bloque les nouveaux membres et invitations
  `shop_only` provenant d'une session applicative ;
- les lignes existantes restent lisibles et la connexion postgres de migration
  peut encore exécuter les reprises UM7 ;
- aucune suppression de compte, invitation ou commande.

## Validation

- tests contrats client/serveur ;
- tests d'architecture UI et SQL ;
- typecheck et suite applicative.

L'application locale de la migration et les scénarios SQL doivent être rejoués
dès que Docker Desktop est disponible.
