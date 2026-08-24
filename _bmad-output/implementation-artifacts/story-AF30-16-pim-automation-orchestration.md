---
id: AF30.16
epic: EPIC-8-API-FIRST
priority: P2
status: done
branch: feat/storefront-identity-um2
depends_on: [AF30.15]
---

# AF30.16 — Isoler l’automatisation du dashboard PIM

## Intention

`DashboardAdminPIM` pilotait directement le client Catalog pour compter la file,
lancer une ingestion et générer des définitions. La vue doit rester responsable
de l’arbre éditorial et des interactions, sans connaître le transport du module.

## Résultat

- `usePimAutomation` porte la file d’ingestion, ses états et les erreurs ;
- le hook rafraîchit le contexte PIM après une ingestion réelle ;
- les réponses tardives sont ignorées après démontage ou nouvelle opération ;
- génération individuelle et batch passent par une commande stable du hook ;
- `DashboardAdminPIM` ne connaît plus `CatalogApiClient` ni son fournisseur ;
- un garde-fou d’architecture verrouille cette frontière.

## Validation attendue

- tests ciblés du helper d’erreur et de la frontière ;
- typecheck modulaire ;
- suite Vitest complète ;
- build de production.
