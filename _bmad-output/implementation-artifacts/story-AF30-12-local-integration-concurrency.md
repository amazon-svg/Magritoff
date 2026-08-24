---
id: AF30.12
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: feat/storefront-identity-um2
depends_on: [AF30.3, AF30.11]
---
# AF30.12 — Stabiliser la concurrence des intégrations locales

## Problème

La concurrence automatique de Vitest lance simultanément les suites Auth, RLS
et Storage. Sur la stack Docker locale, PostgreSQL finit par annuler les
requêtes (`statement timeout`) et provoque des échecs en cascade alors que les
mêmes scénarios passent isolément.

## Résultat livré

- `pnpm test` borne désormais Vitest à deux workers ;
- toutes les suites restent exécutées, sans `skip` ni exclusion ;
- la contrainte d'exploitation est documentée avec `.env.test`.

## Validation

- les suites RLS commandes et Storage passent isolément : 10 tests ;
- la suite complète bornée passe : 167 fichiers, 1 227 tests, 0 ignoré ;
- les passages non bornés reproduisent les timeouts PostgreSQL, ce qui confirme
  une saturation du runtime local et non une régression applicative.
