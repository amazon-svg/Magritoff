---
id: AF18.1
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF17.4]
---

# AF18.1 — Isoler la création rapide des brouillons de devis

## Résultat livré

- nouveau module `quotes` avec un premier contrat de création étroit ;
- route `POST /api/v1/tenants/{tenantId}/quotes/drafts` ;
- repository Supabase confiné côté serveur sous la session RLS ;
- migration de `persistQuote`, `QuoteModal` et `CartButton` vers
  `QuotesApiClient` ;
- suppression de Supabase dans l’utilitaire qui porte aussi le rendu PDF.

## Invariants

- `user_id` est dérivé du bearer token et n’existe pas dans le payload ;
- le schéma refuse les propriétés supplémentaires et les montants négatifs ;
- le tenant reste explicite et son appartenance est contrôlée par la RLS ;
- les parcours d’impression restent tolérants : un échec de persistance est
  journalisé sans empêcher l’ouverture du devis imprimable ;
- ce lot ne modifie pas encore le CRUD des devis éditables de `QuotesContext`.

## Mesures

- `src/app/utils/quote.ts` : **1 → 0** référence Supabase ;
- baseline globale : **52 → 51** références directes ;
- fichiers UI important Supabase : **11 → 10**.

## Validation UX attendue

Depuis un produit ou le panier, imprimer un devis connecté : la fenêtre
d’impression doit s’ouvrir comme avant et le brouillon doit apparaître dans la
bibliothèque. Hors session ou hors tenant, l’impression reste disponible mais
aucun brouillon ne doit être créé au nom d’un autre utilisateur.
