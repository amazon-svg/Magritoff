---
id: AF27.7
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF27.5]
---
# AF27.7 — Confiner le protocole SSE dans la passerelle assistant

## Résultat livré

- `AssistantGateway.send` porte le contrat d'envoi streaming ou JSON ;
- l'adaptateur navigateur possède l'endpoint `/api/v1/assistant/chat`, les
  en-têtes HTTP, le décodage des événements `delta` et `done`, ainsi que la
  classification billing/réseau/protocole/annulation ;
- `useClaudeSseStream` ne fait plus de `fetch` et ne parse plus le protocole ;
- le hook conserve uniquement l'`AbortController` lié au cycle de vie React ;
- le chat Magrit et le catalogue boutique ne manipulent plus d'endpoint ni de
  structure de connexion ; ils fournissent seulement jeton, payload et callback
  de progression ;
- les tests de l'heuristique billing suivent désormais l'adaptateur concret ;
- un garde-fou vérifie que le protocole ne revient pas dans `src/app`.
