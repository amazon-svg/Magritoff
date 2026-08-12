---
id: AF19.2
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF19.1]
---
# AF19.2 — Isoler les produits de bibliothèque

## Résultat livré

- sous-module `library-products` pour lecture, CRUD et création groupée ;
- remplacement et suppression des produits PIM exposés comme commandes métier ;
- auteur dérivé du bearer et tenant imposé par le dépôt serveur ;
- les champs d'identité et de rattachement tenant ne sont plus acceptés depuis
  le navigateur ;
- `LibraryContext` ne connaît plus Supabase.

La commande de remplacement PIM conserve le comportement historique : elle
supprime uniquement les lignes marquées `config.source = pim-generated`, sans
toucher aux produits manuels, puis insère la nouvelle génération.

## Mesures

- `LibraryContext` : **8 → 0** références Supabase ;
- baseline globale : **28 → 20** références ;
- fichiers importeurs : **8 → 7**.

## Validation UX attendue

Créer et modifier un produit manuel, importer plusieurs produits, lancer une
génération PIM deux fois, vérifier l'absence de doublons générés et la
conservation des produits manuels, puis vider uniquement la génération PIM.
