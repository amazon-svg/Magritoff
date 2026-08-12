---
id: AF13.3a
epic: EPIC-8-API-FIRST
priority: P0
status: done
branch: refactor/api-first-foundation
depends_on: [AF13.2]
---

# AF13.3a — Isoler les prix négociés de l’éditeur de boutique

## Résultat livré

- contrats de lecture des overrides par boutique ;
- commande unique pour définir ou supprimer un prix négocié ;
- validation des identifiants tenant, boutique et produit bibliothèque ;
- tenant et horodatage dérivés côté serveur ;
- migration de `DashboardShopEditor` vers `ShopsApiClient` pour ce périmètre.

## Mesures

- références directes dans l’éditeur : **5 → 2** ;
- baseline globale : **95 → 92** références ;
- les deux références restantes concernent exclusivement Storage pour le logo
  et le hero.

## Suite

AF13.3b doit définir un transport binaire API adapté aux fichiers jusqu’à 5 Mo,
sans encoder les images en JSON ni exposer directement le fournisseur Storage.
