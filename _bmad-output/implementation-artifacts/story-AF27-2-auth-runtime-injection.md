---
id: AF27.2
epic: EPIC-8-API-FIRST
priority: P0
status: done
branch: refactor/api-first-foundation
depends_on: [AF27.1]
---
# AF27.2 — Injecter le fournisseur Auth depuis le runtime navigateur

## Résultat livré

- `AuthProvider` dépend uniquement du contrat `AuthenticationGateway` ;
- passerelle injectée explicitement par `App` ;
- nouveau composition root `platform/runtime/browser-runtime` ;
- adaptateur Supabase instancié uniquement derrière ce runtime ;
- garde-fou d'architecture interdisant désormais toute importation d'un
  adaptateur Supabase depuis `src/app`.

Cette tranche supprime la dernière dépendance fournisseur de l'UI. Supabase
reste une implémentation d'authentification interchangeable dans les
adaptateurs ; remplacer ce fournisseur ne demande plus de modifier un contexte
React ou un écran.
