---
id: AF12.2
epic: EPIC-8-API-FIRST
priority: P0
status: done
branch: refactor/api-first-foundation
depends_on: [AF12.1]
---

# AF12.2 — Administrer le catalogue des rôles via l’API Magrit

## Résultat livré

- vue catalogue incluant rôles actifs/archivés, membres et assignations ;
- commandes contractuelles de création, modification et archivage ;
- validation serveur de la portée boutique et de l’appartenance au tenant ;
- refus serveur de l’archivage des rôles canoniques ;
- permutation atomique de deux positions par
  `api_swap_tenant_role_order`, exécutée avec le JWT utilisateur et la RLS ;
- migration de `RoleEditorDialog` et `OrderRoleAdminPage` vers
  `RolesApiClient` ;
- suppression du fallback de jointure `profiles` : les emails proviennent de
  la vue membres déjà contrôlée par le repository serveur.

## Invariants

1. L’identité de l’opérateur est dérivée de la session HTTP.
2. Un rôle et une boutique de portée doivent appartenir au tenant de la route.
3. Au moins une capability est exigée par le contrat.
4. Les rôles `Owner`, `Admin`, `Acheteur` et `Producteur` ne sont pas
   archivables.
5. Le réordonnancement n’effectue plus deux écritures concurrentes depuis le
   navigateur ; un seul `UPDATE ... CASE` permute les deux positions.

## Mesures et validation

- baseline UI : **32 → 30** fichiers importeurs Supabase ;
- références directes : **122 → 114** ;
- tests clients, routes, erreurs métier et garde-fou SQL atomique ;
- migration appliquée localement sans reset des données ;
- typecheck modulaire, suite complète et build de production.

## Dette produit conservée

Cette story migre les frontières techniques sans prétendre valider toute la
sémantique du module invitations/membres/rôles. La revue fonctionnelle demandée
reste un lot produit séparé : nomenclature des rôles, duplication, permissions
éditables, messages UX et parcours invitation → activation → accès boutique.
