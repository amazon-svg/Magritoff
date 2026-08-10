# Story J1 — Adaptateurs accès et entitlements

**Jalon :** J1 — Socle modulaire, identité et sécurité  
**Date :** 2026-08-10  
**Branche :** `feat/kernel-clariprint-data`

## Objectif

Brancher le premier cas d'usage Clariprint Data sur les mécanismes existants sans exposer Supabase dans les contrats plateforme ou dans le module métier.

## Livré

- `SupabaseAccessService` utilisant le RPC existant `user_has_capability` ;
- fusion et déduplication des capabilities issues des rôles actifs ;
- refus local d'une ressource appartenant à un autre tenant avant toute requête ;
- `SupabaseTenantSettingsEntitlementService` pour le pilote ;
- lecture des features dans `tenants.settings.features` ;
- lecture non transactionnelle des limites dans `tenants.settings.quotas` ;
- refus explicite de la consommation de quota tant qu'aucun contrat atomique n'existe ;
- raison `provider_unavailable` ajoutée aux décisions d'accès en lecture.

## Sécurité et erreurs

- toute feature absente ou mal formée est refusée par défaut ;
- une erreur Supabase n'est jamais confondue avec une feature absente ;
- les messages internes de base de données ne traversent pas les erreurs publiques ;
- une indisponibilité du RPC produit `access.provider_unavailable`, retentable ;
- les adaptateurs Supabase restent dans la couche infrastructure.

## Dérogation temporaire

`tenants.settings` est utilisé comme source pilote d'entitlements faute de modèle commercial validé. L'adaptateur est nommé explicitement et doit être retiré lorsqu'un service transactionnel de features et quotas est disponible. Aucun quota n'est consommé par cet adaptateur.

## API et migrations

- contrats TypeScript internes inchangés, sauf la raison explicite `provider_unavailable` ;
- aucune route HTTP créée ou modifiée ;
- aucune migration de base de données ;
- aucune donnée B5 modifiée.

## Validation ciblée

- `pnpm typecheck` : vert ;
- tests kernel, architecture, plateforme et Clariprint Data : 22 tests verts ;
- `pnpm test` : 772 tests verts, 87 ignorés ;
- `pnpm build` : vert, avec l'avertissement historique de taille de bundle ;
- `git diff --check` : vert.

## Reste à traiter

- adaptateurs `identity` et `tenant` ;
- composition root serveur ;
- première route protégée ;
- mapping ou seed des capabilities Clariprint Data dans les rôles pilotes ;
- activation explicite de `clariprint_data.enabled` pour un tenant pilote ;
- tests RLS réels à deux tenants.
