---
id: AF15.1
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF14.2b]
---

# AF15.1 — Isoler la modification des paramètres tenant

## Résultat livré

- commande contractuelle `PATCH /api/v1/tenants/{tenantId}` ;
- validation du nom et du slug avant l’adaptateur ;
- écriture tenant exécutée avec la session RLS de l’acteur ;
- conflit de slug traduit en HTTP 409 et refus d’accès en HTTP 403 ;
- migration de `DashboardTenantSettings` vers `SessionApiClient`.

## Invariants

- l’identifiant tenant vient exclusivement de la route ;
- seuls le nom et le slug sont modifiables par cette commande ;
- le trigger SQL existant reste autoritaire pour réserver le changement de
  slug aux super-administrateurs ;
- l’historique de slug et sa fenêtre de redirection restent inchangés.

## Mesures

- `DashboardTenantSettings` : **1 → 0** référence Supabase ;
- baseline globale : **71 → 70** références ;
- fichiers UI important Supabase : **22 → 21**.

## Validation UX attendue

Renommer un espace avec un owner/admin, puis vérifier le rechargement du nom.
Avec un super-administrateur, changer le slug et vérifier la redirection de
l’ancien slug. Un membre standard et un slug déjà utilisé doivent afficher une
erreur sans modifier l’espace.
