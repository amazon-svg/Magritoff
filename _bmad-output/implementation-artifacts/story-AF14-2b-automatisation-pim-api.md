---
id: AF14.2b
epic: EPIC-8-API-FIRST
priority: P0
status: done
branch: refactor/api-first-foundation
depends_on: [AF14.2a]
---

# AF14.2b — Isoler l’automatisation du PIM derrière l’API

## Résultat livré

- contrats indépendants pour le compteur de candidats, l’ingestion et la
  génération éditoriale PIM ;
- routes `GET/POST /api/v1/catalog/pim/ingestion` et
  `POST /api/v1/catalog/pim/generation` ;
- port applicatif `CatalogAutomationGateway` et adaptateur serveur Supabase ;
- traduction explicite camelCase vers les payloads snake_case des pipelines
  historiques `pim-ingest` et `pim-generate` ;
- migration complète de `DashboardAdminPIM` vers `CatalogApiClient`.

## Invariants

- le navigateur ne connaît ni les Edge Functions ni `pim_candidates` ;
- le serveur vérifie super-admin ou `user_preferences.is_admin` avant chaque
  opération d’automatisation ;
- un rapport d’ingestion non conforme est rejeté par l’adaptateur ;
- une indisponibilité du pipeline est exposée en problème HTTP 502 corrélé ;
- les opérations longues restent séquentielles dans le batch UI afin de ne pas
  saturer le générateur.

## Mesures

- `DashboardAdminPIM` : **4 → 0** références Supabase ;
- baseline globale : **75 → 71** références ;
- fichiers UI important Supabase : **23 → 22**.

## Validation UX attendue

Depuis le dashboard PIM avec un compte administrateur : vérifier le compteur de
candidats, lancer une simulation d’ingestion, générer une définition puis un
batch. Avec un compte non administrateur, les mêmes appels forgés doivent être
refusés en 403, même si l’interface est manipulée.
