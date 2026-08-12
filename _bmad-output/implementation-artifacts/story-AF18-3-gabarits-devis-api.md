---
id: AF18.3
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF18.2]
---
# AF18.3 — Isoler les gabarits de devis

## Résultat livré

- module `quote-templates` pour lecture, création, modification, suppression et choix par défaut ;
- lecture agrégée des customs et de la préférence utilisateur ;
- auteur dérivé du bearer et contrôles tenant conservés par RLS ;
- validation serveur d’un gabarit custom avant de le définir par défaut ;
- `QuoteTemplatesContext` ne connaît plus Supabase.

## Mesures

- `QuoteTemplatesContext` : **6 → 0** références Supabase ;
- baseline globale : **38 → 32** références ;
- fichiers importeurs : **9 → 8**.

## Validation UX attendue

Créer un gabarit depuis un builtin, le modifier, le définir par défaut, recharger
la page puis le supprimer. Le défaut doit être effacé si le custom supprimé
était sélectionné.
