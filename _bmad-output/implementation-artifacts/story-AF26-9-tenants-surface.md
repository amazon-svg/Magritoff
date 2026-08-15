---
id: AF26.9
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF26.8]
---
# AF26.9 — Déclarer la sortie workspace de Tenants

## Résultat livré

- nouveau manifeste métier `tenants` pour les espaces Magrit ;
- features et capabilities distinctes pour les paramètres et les sous-espaces ;
- routes lazy « Paramètres de l'espace » et « Sous-espaces » fournies par le
  registre de surfaces ;
- navigation Paramètres alimentée par la contribution du module ;
- suppression des déclarations correspondantes dans `routes.tsx`.

Les deux écrans utilisent encore `SessionApiClient` pour leurs commandes. Ce
choix est explicitement transitoire : la composition de surface appartient à
`tenants`, tandis que l'extraction des contrats tenant hors du module technique
`session` reste une future tranche interne sans incidence sur les URLs ou l'UX.
