# Story J1 — Runtime Node et typecheck strict du kernel

**Jalon** : J1 — Socle modulaire, identité et sécurité  
**Date** : 2026-08-10  
**Branche** : `feat/kernel-clariprint-data`

## Objectif

Rendre l'environnement de développement reproductible et prouver au compile-time les frontières de types du kernel avant l'ajout des premiers modules Magrit.

## Décisions

- Node.js `22.14.0`, déclaré par `.nvmrc` et `.node-version` ;
- Node `>=22.13.0` exigé par `package.json`, conformément au minimum de pnpm 11 ;
- pnpm `11.15.1` conservé via le champ `packageManager` ;
- TypeScript `5.9.3` ajouté comme dépendance directe ;
- types React alignés sur React 18 ;
- gate `pnpm typecheck` strict sur le kernel et les futurs modules ;
- audit séparé `pnpm typecheck:all` pour rendre visible la dette brownfield sans l'introduire dans le nouveau socle.

## Fichiers principaux

| Fichier | Changement |
|---|---|
| `.nvmrc`, `.node-version` | Version Node reproductible |
| `package.json`, `pnpm-lock.yaml` | Runtime, scripts et dépendances TypeScript |
| `pnpm-workspace.yaml` | Overrides et scripts de build autorisés avec pnpm 11 |
| `tsconfig.json` | Audit TypeScript global |
| `tsconfig.kernel.json` | Contrôle strict du kernel |
| `tests/kernel/types.typecheck.ts` | Preuve de non-interchangeabilité des identifiants opaques |
| `src/kernel/money/index.ts` | Propagation d'erreur compatible avec le contrôle TypeScript |

## Validation

- `pnpm typecheck` : vert ;
- `pnpm test` : 759 tests verts, 87 ignorés ;
- `pnpm build` : vert ;
- `pnpm peers check` : aucun conflit ;
- `git diff --check` : vert.

## Dette brownfield constatée

`pnpm typecheck:all` expose 43 erreurs dans le code historique, principalement dans les composants panier/chat/PIM et leurs tests. Elles ne concernent pas le kernel. Leur correction est différée après la remontée de `beta/v5` dans `main` afin de ne pas modifier une version applicative périmée avant le rebase.

## API et migrations

- aucune API créée ou modifiée ;
- aucune migration de base de données ;
- aucune dérogation architecturale dans le kernel.
