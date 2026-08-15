---
id: AF27.1
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF26.15]
---
# AF27.1 — Exécuter les chemins host du portail

## Résultat livré

- racine `/shop/:slug/*` dérivée de la contribution storefront de Shops ;
- chemin checkout dérivé de la contribution storefront de Orders ;
- chemins commandes, devis et profil dérivés des contributions customer portal ;
- `shopUrl` et `parsePortalPath` utilisent les mêmes chemins déclaratifs ;
- tests de résolution runtime et garde-fou contre le retour des littéraux.

## Écart fonctionnel conservé

`quotes.storefront.create` déclare encore le chemin `quote`, mais `PublicShop`
ne possède aucune vue de création de devis correspondant à cette route. AF27.3
classe désormais explicitement cette contribution comme `planned` : elle reste
un contrat cible, mais ne peut plus être consommée par le runtime.
