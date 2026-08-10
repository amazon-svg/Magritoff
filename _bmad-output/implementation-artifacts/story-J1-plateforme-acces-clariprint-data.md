# Story J1 — Contrats plateforme et accès Clariprint Data

**Jalon :** J1 — Socle modulaire, identité et sécurité  
**Date :** 2026-08-10  
**Branche :** `feat/kernel-clariprint-data`

## Objectif

Créer les contrats publics nécessaires au module Clariprint Data et prouver qu'un accès au module compose deux décisions indépendantes : activation commerciale du tenant et capability de l'acteur.

## Livré

- contrats plateforme `identity`, `tenant`, `access`, `entitlements` et `audit` ;
- point d'entrée public `src/platform/index.ts` ;
- squelette `domain/application` du module Clariprint Data ;
- feature `clariprint_data.enabled` et capabilities initiales ;
- cas d'usage `requireClariprintDataModuleAccess()` ;
- garde automatique des frontières plateforme, domaine et application ;
- typecheck modulaire strict couvrant kernel, plateforme et Clariprint Data.

## Comportement prouvé

1. Une feature absente interrompt l'évaluation avant la capability.
2. Une feature présente sans capability produit un refus explicite.
3. Une feature et une capability présentes autorisent l'accès applicatif.
4. React, Supabase, l'UI et l'infrastructure ne traversent pas les frontières internes.

## Validation

- `pnpm typecheck` : vert ;
- tests ciblés kernel, architecture et Clariprint Data : 13 tests verts ;
- `pnpm test` : 763 tests verts, 87 ignorés ;
- `pnpm build` : vert, avec l'avertissement historique de taille de bundle ;
- `git diff --check` : vert.

## API et migrations

- contrats TypeScript internes créés ;
- aucune route HTTP créée ou modifiée ;
- aucune migration de base de données ;
- aucun adaptateur Supabase ajouté.

## Reste à traiter

- valider les contrats candidats et les décisions J0/J1 encore ouvertes ;
- choisir le schéma ou préfixe SQL du module ;
- implémenter les adaptateurs plateforme vers l'existant ;
- exposer une première route protégée derrière la feature ;
- ajouter les migrations et tests RLS à deux tenants.
