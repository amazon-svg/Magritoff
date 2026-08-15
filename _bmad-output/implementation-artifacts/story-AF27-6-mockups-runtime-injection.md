---
id: AF27.6
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF27.5]
---
# AF27.6 — Injecter la passerelle Mockups

## Résultat livré

- la passerelle Mockups est composée par le runtime navigateur ;
- `MockupImage` et `DashboardAdminMockups` consomment le contrat injecté ;
- l'UI ne connaît plus `browserMockupGateway` ni son protocole HTTP concret ;
- le garde-fou d'architecture est généralisé : aucun fichier de `src/app` ne
  peut importer directement un adaptateur `supabase` ou `http`.

## Jalon d'architecture

À l'issue de cette tranche, `src/app` ne contient plus aucun import d'adaptateur
concret. Les fournisseurs sont composés sous `src/platform/runtime`, puis
injectés sous forme de contrats métier. Le front peut encore instancier les
clients de modules `/api/v1` à partir du transport partagé ; il ne choisit plus
les implémentations fournisseur.
