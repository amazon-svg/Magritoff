---
id: AF19.1
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF18.3]
---
# AF19.1 — Isoler le CRUD des bibliothèques

## Résultat livré

- module `libraries` pour lister, créer, modifier et supprimer les bibliothèques ;
- auteur dérivé du bearer côté serveur, jamais accepté depuis le navigateur ;
- toutes les lectures et mutations sont bornées au tenant demandé ;
- `LibraryContext` consomme le contrat `/api/v1` pour le CRUD des bibliothèques ;
- les produits, les imports groupés et la génération PIM restent explicitement
  dans AF19.2.

La suppression conserve le comportement existant : les produits rattachés sont
retirés de l'état local et la base applique sa contrainte de suppression.

## Mesures

- `LibraryContext` : **12 → 8** références Supabase ;
- baseline globale : **32 → 28** références ;
- fichiers importeurs : **8**, inchangé jusqu'à AF19.2.

## Validation UX attendue

Créer une bibliothèque, modifier son nom et sa description, recharger la page,
puis la supprimer. Les produits existants et la génération PIM seront validés
séparément avec AF19.2.
