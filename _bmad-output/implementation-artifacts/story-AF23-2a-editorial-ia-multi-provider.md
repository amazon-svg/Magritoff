---
id: AF23.2a
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF23.1]
---
# AF23.2a — Migrer l’éditorial IA vers le fournisseur configuré

## Résultat livré

- nouvelle commande authentifiée
  `POST /api/v1/tenants/{tenantId}/assistant/category-editorial` ;
- port de complétion neutre et adaptateurs de protocole Anthropic, OpenAI et
  Mistral côté serveur ;
- validation stricte des entrées et de la réponse éditoriale ;
- contrôle de l’appartenance au tenant avant toute consommation IA ;
- repli `{ editorial: {}, generated: false }` lorsque la clé manque, que le
  fournisseur est indisponible ou que sa réponse est invalide ;
- suppression de l’appel `category-editorial` de la passerelle Supabase legacy
  du navigateur.

Le portail conserve ainsi son socle éditorial déterministe même sans clé IA. Le
chat SSE reste temporairement sur son endpoint historique ; il sera traité dans
AF23.2b sans coupler ce flux streaming à la commande éditoriale.

## Critères validés

- une modification de fournisseur ne change ni le composant React ni le contrat
  `/api/v1` ;
- aucune clé IA n’est transmise au navigateur ;
- les trois formats de requête/réponse fournisseurs sont couverts par tests ;
- un appel anonyme est refusé avant toute sollicitation du fournisseur.
