---
id: AF17.3
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF17.2]
---

# AF17.3 — Isoler le diagnostic du fournisseur IA

## Résultat livré

- nouveau module `diagnostics` et contrat fournisseur neutre ;
- route authentifiée `GET /api/v1/diagnostics/ai` documentée dans OpenAPI ;
- port `AiDiagnosticsGateway` et premier adaptateur Anthropic côté serveur ;
- migration de `DiagnosticPanel` vers `DiagnosticsApiClient` ;
- suppression de l’appel direct à la fonction Edge legacy `claude-test` ;
- suppression de l’aperçu de clé API dans la réponse navigateur.

## Invariants

- aucune clé ni information secrète ne sort du serveur API ;
- l’interface dépend d’un fournisseur IA générique, pas d’Anthropic ;
- l’adaptateur Anthropic conserve le modèle et le test fonctionnel existants ;
- une clé absente ou un fournisseur indisponible produit un diagnostic métier
  normalisé, sans spinner infini ;
- l’ajout futur d’OpenAI ou Mistral se fait par un nouvel adaptateur et la
  composition serveur, sans modifier le composant React ni le contrat HTTP.

## Mesures

- `DiagnosticPanel` : **1 → 0** référence Supabase ;
- baseline globale : **53 → 52** références directes ;
- fichiers UI important Supabase : **12 → 11**.

## Validation UX attendue

Connecté, ouvrir le diagnostic depuis l’en-tête et lancer « Tester l’IA ».
Sans clé locale, l’écran doit indiquer une configuration absente. Avec une clé
valide, il doit afficher le fournisseur actif et la réussite, sans afficher la
clé. Une session absente doit être refusée par la route avec une erreur claire.
