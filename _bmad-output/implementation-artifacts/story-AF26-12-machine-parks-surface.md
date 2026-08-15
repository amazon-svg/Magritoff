---
id: AF26.12
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF26.11]
---
# AF26.12 — Déclarer la sortie workspace de MachineParks

## Résultat livré

- nouveau manifeste métier `machine-parks` ;
- features et capabilities séparant consultation, constitution et paramétrage ;
- routes lazy de liste, wizard et détail fournies par le registre ;
- navigation Production « Parc machine » issue de la contribution ;
- conservation de la route de démonstration DEV hors workspace ;
- suppression des trois routes dashboard codées dans `routes.tsx`.

Le Parc machine reste une maquette fonctionnelle persistée localement par
tenant. Cette tranche formalise sa surface sans masquer la dette : contrats,
service serveur et persistance définitive devront rejoindre Clariprint Data
avant que le module puisse être considéré API-first de bout en bout.
