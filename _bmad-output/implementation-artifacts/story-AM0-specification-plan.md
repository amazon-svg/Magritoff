# Story AM0 — Spécification et plan `access-management`

**Date :** 2026-08-11  
**Statut :** documentation candidate, à valider avant implémentation durable  
**Branche :** `feat/kernel-clariprint-data`

## Objectif

Définir un module autonome pour les API et l'UX de gestion des droits, capable de réutiliser l'historique derrière des adaptateurs sans introduire de nouveaux appels Supabase dans les surfaces.

## Livré

- spécification des responsabilités et frontières du module ;
- séparation entre moteur `platform/access` et administration `access-management` ;
- modèle de domaine rôles, affectations, catalogue de capabilities et modules ;
- matrice d'autorisation et scénarios de sécurité ;
- contrat OpenAPI 3.1 de 12 opérations ;
- plan de développement AM0 à AM4 ;
- stratégie d'adaptation et de retrait du legacy ;
- principe de contribution déclarative aux routes et menus des surfaces.

## API créée ou modifiée

Contrat documentaire candidat sous `/api/v1/tenants/{tenantId}/access` couvrant :

- accès personnel ;
- catalogue des capabilities ;
- rôles ;
- affectations des membres ;
- modules et entitlements ;
- audit des changements d'accès.

Aucune route n'est encore implémentée ou déployée.

## Dérogations

Aucune dérogation de nouveau code. Le plan autorise temporairement la lecture et l'écriture dans les structures historiques uniquement depuis `infrastructure/legacy`, avec mappings testés et condition de retrait.

## Validation

- parsing YAML du contrat OpenAPI : réussi ;
- 12 `operationId` uniques : vérifié ;
- présence des documents : vérifiée ;
- `git diff --check` : réussi ;
- aucun test applicatif exécuté, la livraison ne modifiant que la documentation.

