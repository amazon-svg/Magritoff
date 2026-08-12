---
id: AF17.4
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF17.3]
---

# AF17.4 — Isoler le diagnostic Clariprint

## Résultat livré

- contrat `ClariprintDiagnostic` partagé par le serveur et le navigateur ;
- route authentifiée `GET /api/v1/diagnostics/clariprint` ;
- port `ClariprintDiagnosticsGateway` et adaptateur HTTP serveur CheckAuth ;
- migration complète de `DiagnosticPanel` vers `DiagnosticsApiClient` ;
- suppression des données d’environnement et réponses brutes dans l’UI.

## Invariants

- login et mot de passe Clariprint restent exclusivement côté serveur ;
- une configuration absente ne déclenche aucun appel externe ;
- la réponse brute Clariprint, potentiellement sensible, n’est jamais renvoyée
  au navigateur ;
- connexion réseau et authentification sont distinguées dans le contrat ;
- l’échec reste explicite et borné par un timeout de quinze secondes.

## Mesures

- `DiagnosticPanel` : **0** dépendance directe ou indirecte à une URL Supabase ;
- baseline UI Supabase inchangée à **11 fichiers / 52 références**, le gain de
  ce lot portant sur une dépendance masquée derrière l’ancien adaptateur.

## Validation UX attendue

Connecté, ouvrir Diagnostics et lancer « Tester CheckAuth ». Sans identifiants,
le panneau doit signaler une configuration incomplète. Avec des identifiants
valides, il doit afficher le succès et le statut HTTP, sans login, mot de passe
ni réponse brute.
