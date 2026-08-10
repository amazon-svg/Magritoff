# Story J1 — Adaptateurs identité et tenant

**Jalon :** J1 — Socle modulaire, identité et sécurité  
**Date :** 2026-08-10  
**Branche :** `feat/kernel-clariprint-data`

## Objectif

Encapsuler Supabase Auth et les memberships existants derrière les contrats plateforme, sans exposer de type fournisseur au module Clariprint Data.

## Livré

- `SupabaseIdentityService`, réservé à la composition serveur ;
- validation explicite d'un bearer token ;
- mapping vers `UserIdentity` sans type Supabase public ;
- refus des comptes bannis ;
- lookup serveur d'une identité tierce via l'API admin ;
- `SupabaseTenantService` sur `tenants` et `tenant_members` ;
- résolution et exigence d'un membership direct ;
- liste tenant-scoped des memberships visibles par RLS ;
- lecture de la hiérarchie parent/enfants ;
- erreurs stables sans détail interne de base de données.

## Sécurité

- un token vide est refusé avant tout appel fournisseur ;
- une identité authentifiée n'est jamais considérée automatiquement membre ;
- l'API admin Supabase reste réservée au serveur ;
- l'héritage parent vers sous-tenant n'accorde aucun accès implicite ;
- une panne RLS/réseau reste distincte d'une absence de membership.

## Limite historique

`tenant_members` ne conserve pas de champ de révocation : une révocation supprime la ligne. L'adaptateur refuse correctement l'accès, mais retourne `tenant.not_a_member` dans les deux cas « jamais membre » et « ancien membership révoqué ». Une distinction contractuelle nécessiterait une évolution du modèle ou un journal de révocation faisant autorité.

## API et migrations

- aucun contrat HTTP créé ou modifié ;
- aucune migration ;
- aucune donnée B5 modifiée ;
- aucun secret ou client service-role ajouté au frontend.

## Validation ciblée

- `pnpm typecheck` : vert ;
- tests kernel, architecture, plateforme et Clariprint Data : 32 tests verts ;
- `pnpm test` : 782 tests verts, 87 ignorés ;
- `pnpm build` : vert, avec l'avertissement historique de taille de bundle ;
- `git diff --check` : vert.

## Reste à traiter

- composition root serveur ;
- création de l'`ActorContext` après identité et membership ;
- première route protégée ;
- mapping des capabilities Clariprint Data dans les rôles pilotes ;
- activation de la feature pour un tenant pilote ;
- tests RLS réels à deux tenants.
