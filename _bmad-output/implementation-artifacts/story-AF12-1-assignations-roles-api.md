---
id: AF12.1
epic: EPIC-8-API-FIRST
priority: P0
status: done
branch: refactor/api-first-foundation
depends_on: [AF10]
---

# AF12.1 — Lire et assigner les rôles via l’API Magrit

## Résultat livré

- module `roles` indépendant de Supabase avec contrats HTTP, service
  applicatif et port repository ;
- repository Supabase réservé au serveur et exécuté avec le JWT utilisateur,
  afin de conserver la RLS comme dernière barrière ;
- vue agrégée catalogue/membres/assignations pour la matrice des rôles ;
- vue ciblée rôles/boutiques/périmètre pour l’édition d’un membre ;
- commande idempotente d’assignation ou de révocation dont l’acteur est dérivé
  de la session côté serveur ;
- migration de `DashboardRolesSection` et `EditUserRolesModal` vers les clients
  `/api/v1` ;
- réutilisation de l’API Membres AF10 pour enregistrer le périmètre boutique.

## Frontières fonctionnelles

Ce lot couvre l’utilisation du catalogue existant : consultation et
assignation à un membre. La création, la modification, l’archivage et le
réordonnancement des définitions restent dans AF12.2. Le fonctionnement métier
global du module rôles devra faire l’objet d’une revue UX/fonctionnelle dédiée,
comme demandé, sans réintroduire de requêtes fournisseur dans React.

## Sécurité

- `tenantId`, `userId` et `roleId` sont validés à l’entrée HTTP ;
- l’identité de l’opérateur n’est jamais acceptée dans le corps de requête ;
- le repository vérifie que le rôle actif et le membre appartiennent au tenant ;
- les droits de lecture et `can_manage_roles` restent imposés par les policies
  RLS existantes.

## Mesures et validation

- baseline UI : **34 → 32** fichiers importeurs Supabase ;
- références directes : **134 → 122** ;
- tests de contrats client, routes HTTP et frontières d’architecture ;
- typecheck modulaire, suite complète et build de production.

## Suite

AF12.2 porte les commandes de définition des rôles et migre
`RoleEditorDialog` ainsi que `OrderRoleAdminPage`.
