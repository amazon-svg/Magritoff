---
id: AF15.2
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF15.1]
---

# AF15.2 — Isoler la gestion des sous-espaces

## Résultat livré

- lecture contractuelle `GET /api/v1/tenants/{tenantId}/subtenants` regroupant
  la liste et les KPI mensuels ;
- création `POST /api/v1/tenants/{tenantId}/subtenants` avec validation du nom
  et du slug ;
- suppression `DELETE /api/v1/tenants/{tenantId}/subtenants/{subTenantId}` ;
- migration de `DashboardTenantSpaces` vers `SessionApiClient` ;
- retrait de `createSubTenant` du contexte tenant et de son appel à
  l’adaptateur legacy.

## Invariants

- le parent vient exclusivement de la route authentifiée ;
- la suppression exige que le sous-espace soit un enfant direct du parent ;
- les RPC et politiques RLS existantes restent la barrière d’autorisation ;
- aucun type PostgreSQL ni nom de colonne n’est exposé dans le contrat HTTP ;
- un conflit de slug vaut HTTP 409, un enfant absent du parent HTTP 404 et un
  refus d’autorisation HTTP 403.

## Mesures

- `DashboardTenantSpaces` : **3 → 0** références Supabase ;
- baseline globale : **70 → 67** références ;
- fichiers UI important Supabase : **21 → 20**.

## Validation UX attendue

Depuis un tenant racine avec un rôle owner/admin : ouvrir « Sous-espaces »,
créer un espace, vérifier son apparition et ses KPI, l’ouvrir, puis le
supprimer. Un membre standard et un administrateur placé dans un sous-espace
ne doivent pas pouvoir créer ou supprimer un niveau supplémentaire.
