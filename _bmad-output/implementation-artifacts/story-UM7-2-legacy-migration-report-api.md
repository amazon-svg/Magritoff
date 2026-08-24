---
id: UM7.2
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM7.1]
---
# UM7.2 — Exposer le rapport de migration via l’API Magrit

## Objectif

Permettre au backoffice de contrôler la migration des anciens utilisateurs
`shop_only` sans lecture directe de Supabase depuis React et sans exposer les
tables d’audit privées.

## Résultat

- contrat partagé et strict pour chaque ligne du rapport ;
- méthode du module `shop-customers` et adaptation Supabase confinée au
  repository ;
- route authentifiée
  `GET /api/v1/tenants/{tenantId}/shop-customer-migration-report` ;
- contrôle serveur `can_manage_shop_customers` conservé dans la RPC ;
- client API disponible pour une future surface de contrôle UM7.3 ;
- aucun déclenchement de migration depuis le navigateur : le rapport reste une
  lecture d’exploitation.

## Validation

- mapping SQL vers contrat camelCase ;
- test serveur/client sur une ligne auditée ;
- scénario SQL du rapport avec capability explicite ;
- typecheck et tests de frontières API.
