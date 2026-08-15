---
id: AF24.2
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF24.1]
---
# AF24.2 — Masquer Storage et le générateur de mockups

## Résultat livré

- le navigateur utilise uniquement `/api/v1/mockups/public/*` et
  `/api/v1/mockups/render` ;
- suppression de la passerelle navigateur Supabase et de la clé anonyme dans le
  chemin des mockups ;
- relais binaire côté adaptateur serveur vers Storage et `mockup-generator` ;
- redirections du générateur suivies côté serveur afin de ne pas exposer l’URL
  fournisseur au composant ;
- validation des chemins, dimensions, couleur et liste fermée de paramètres
  avant tout appel fournisseur ;
- comportement cache-first, génération à la demande et fallback SVG conservés.

L’Edge Function `mockup-generator` reste le moteur de rendu transitoire. Elle
peut être remplacée derrière ces routes sans modifier l’UX.
