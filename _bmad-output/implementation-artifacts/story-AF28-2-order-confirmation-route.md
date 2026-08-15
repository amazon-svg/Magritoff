---
id: AF28.2
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF28.1]
---
# AF28.2 — Composer la confirmation de commande depuis Orders

## Résultat livré

- Orders déclare la route storefront existante `thank-you` ;
- `portalRuntimePaths` résout ce chemin depuis la contribution ;
- parsing et génération d'URL ne contiennent plus le littéral métier ;
- le comportement défensif reste inchangé : un chemin trop profond est
  remplacé par la confirmation canonique, et un accès direct sans identifiant
  de commande reste redirigé vers le catalogue par `PublicShop` ;
- registre, round-trip portail et garde-fou d'architecture sont testés.
