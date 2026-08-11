# Story AM1 — API de consultation `access-management`

**Date :** 2026-08-11  
**Statut :** implémenté localement, déploiement et preuve RLS à réaliser  
**Branche :** `feat/kernel-clariprint-data`

## Objectif

Fournir une première API métier de droits consommable par Clariprint Data sans appel direct à Supabase depuis l'UI.

## Modules touchés

- `modules/access-management` : domaine, queries, contrats, client et adaptateurs ;
- `server/access-management` : composition Supabase côté serveur ;
- `modules/clariprint-data` : manifest public et consommation du contrat d'accès ;
- dashboard : composition root de la route Clariprint Data ;
- Edge Functions : hébergement `access-management` ;
- Vite : reverse proxy `/api/v1` pour le développement.

## API implémentée

Lectures disponibles :

```text
GET /api/v1/tenants/{tenantId}/access/me
GET /api/v1/tenants/{tenantId}/access/capabilities
GET /api/v1/tenants/{tenantId}/access/roles
GET /api/v1/tenants/{tenantId}/access/roles/{roleId}
GET /api/v1/tenants/{tenantId}/access/members
GET /api/v1/tenants/{tenantId}/access/modules
```

Le client utilise l'URL relative `/api/v1`. L'Edge Function est un détail d'hébergement derrière la façade.

## Compatibilité legacy

- lecture de `tenant_role_definitions`, `tenant_role_assignments` et de la projection membres uniquement dans `infrastructure/legacy` ;
- usage des adaptateurs plateforme pour identité, membership et entitlements ;
- mapping explicite et testé des anciennes capabilities `can_*` ;
- suppression du spike public `clariprint-data-access`.

## Dérogations R5

L'adaptateur de lecture legacy reste une dérogation encadrée. Sa condition de retrait est la disponibilité d'un stockage propre aux rôles/affectations. Aucun accès historique ne traverse les contrats ou l'UI.

## Validation

- `pnpm typecheck` : vert ;
- `pnpm typecheck:all` : reste rouge sur la dette brownfield existante ; aucune erreur filtrée dans les nouveaux modules ;
- tests ciblés access-management, serveur et architecture : 15 tests verts ;
- `pnpm test` : 796 tests verts, 87 ignorés ;
- `pnpm build` : vert, avertissement historique de chunk principal supérieur à 600 kB ;
- syntaxe OpenAPI et liens documentaires : à revérifier en sortie finale ;
- preuve RLS réelle : non exécutée, credentials/environnement requis.

## Reste à traiter

- déployer l'Edge Function ;
- configurer la réécriture `/api/v1` sur l'hébergeur de production ;
- exécuter les tests réels à deux tenants ;
- implémenter AM2 pour les mutations atomiques et auditées ;
- livrer l'UX d'administration AM3.
