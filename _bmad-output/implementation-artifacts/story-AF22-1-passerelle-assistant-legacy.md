---
id: AF22.1
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF21.2]
---
# AF22.1 — Encapsuler le protocole assistant legacy

## Résultat livré

- port `AssistantGateway` dans Diagnostics ;
- URL, clé publique et chemins Claude confinés à un adaptateur legacy ;
- chat et recherche boutique reçoivent une connexion SSE abstraite ;
- l'éditorial de catégorie passe par la même passerelle et conserve son timeout
  et son fallback déterministe.

Cette étape isole volontairement le legacy sans prétendre l'avoir modernisé :
la prochaine évolution pourra remplacer l'adaptateur par un backend multi-provider
OpenAI/Mistral/Anthropic sans modifier les composants ni le lecteur SSE.

## Mesures

- chat : **1 → 0** référence Supabase ;
- portail : **3 → 1** référence Supabase ;
- baseline globale : **4 → 1** référence ;
- fichiers importeurs : **2 → 1** ;
- URL Edge directes dans l'UI : **2 → 0**.

La dernière référence est la persistance RPC d'un produit IA, prévue dans
AF22.2 via Shops `/api/v1`.

## Validation UX attendue

Conversation IA en streaming et non-streaming, recherche Magrit depuis une
boutique, fallback texte en cas d'indisponibilité et chargement éditorial d'une
catégorie avec repli déterministe.
