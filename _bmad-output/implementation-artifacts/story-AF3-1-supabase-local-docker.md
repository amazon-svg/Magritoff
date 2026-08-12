---
id: AF3.1
epic: EPIC-8-API-FIRST
priority: P0
status: review
branch: refactor/api-first-foundation
depends_on: [AF3]
---

# AF3.1 — Runtime Supabase local Docker

## Objectif

Rendre le développement et la recette API-first indépendants du projet Supabase distant, avec une stack locale reproductible pilotée par la CLI Supabase et Docker.

## Critères d acceptation

1. La CLI Supabase est versionnée comme dépendance de développement.
2. `pnpm db:local:start`, `stop`, `status` et `reset` pilotent la stack Docker.
3. Les migrations du dépôt reconstruisent la base locale, y compris `tenant_gamme_subscriptions`.
4. Le front peut cibler l URL et la clé anonyme locales sans modifier le code source.
5. Le proxy `/api/v1` peut cibler la fonction locale `magrit-api`.
6. Auth accepte les redirections du front beta/v5 sur le port 5177.
7. Un guide couvre le démarrage, la génération de `.env.local`, le reset et les URLs Studio/Mailpit.
8. Le baseline B4 requis par les premiers deltas est injecté uniquement pour les commandes locales et ne pollue pas le tracking distant.

## Validation prévue

- tests architecture et typecheck ;
- `supabase start` puis `supabase db reset --local` ;
- présence de `tenant_gamme_subscriptions` ;
- création d un compte, d un espace et accès dashboard en local.

## Validation réalisée

- `supabase start` : stack Docker démarrée et 67 migrations appliquées ;
- `supabase db reset --local` : reconstruction complète réussie ;
- `tenant_gamme_subscriptions` : table présente après reset ;
- `GET /functions/v1/magrit-api/api/v1/health` : réponse `status=ok` ;
- génération de `.env.local` : réussie ;
- typecheck : réussi ;
- suite complète : 791 tests réussis, 87 ignorés ;
- build Vite de production : réussi ;
- smoke UX authentifié création espace → dashboard : prêt pour recette manuelle.
