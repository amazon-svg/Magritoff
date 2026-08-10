# J1 — Socle modulaire, identité et sécurité

**Statut initial :** à préparer  
**Dépendance :** J0

**Spécifications applicables :** [kernel](../architecture/specifications/kernel/specification.md), [règles de dépendances](../architecture/specifications/kernel/dependency-rules.md), [modules plateforme](../architecture/specifications/README.md)

## Goal

Créer un module Clariprint Data exécutable, isolé du frontend et de Supabase par des contrats, avec une première décision d'accès tenant-scoped.

## Avancement technique

Le premier incrément du kernel est implémenté dans [`src/kernel`](../../src/kernel/index.ts). Il fournit identifiants opaques, contextes utilisateur et système, résultats et erreurs, horloge injectable, monnaie, quantités, pagination et événements. Ses tests unitaires, son premier garde de dépendances et son typecheck strict sont opérationnels sous Node 22.14.0.

Le second incrément implémente les contrats publics `identity`, `tenant`, `access`, `entitlements` et `audit`, ainsi que le premier cas d'usage Clariprint Data. Celui-ci compose explicitement la feature `clariprint_data.enabled` et la capability `clariprint_data.module.access`. Le typecheck strict couvre désormais le kernel, la plateforme et le nouveau module, tandis qu'un garde automatique interdit les dépendances React, Supabase et infrastructure dans les couches internes.

Le troisième incrément branche `AccessService` sur le RPC existant `user_has_capability` et fournit un adaptateur pilote d'entitlements sur `tenants.settings`. Les deux adaptateurs échouent fermés, conservent des erreurs stables et ne laissent aucun détail Supabase traverser leurs contrats publics.

Le quatrième incrément encapsule Supabase Auth côté serveur et les memberships directs existants. La validation d'identité reste séparée de l'appartenance tenant, les comptes bannis sont refusés et aucune identité authentifiée n'obtient implicitement un tenant.

Avant de considérer le socle terminé, il reste à créer la composition serveur, choisir la propriété SQL, exposer une première route protégée et prouver l'isolation RLS sur deux tenants. Le typecheck global du brownfield reste disponible via `pnpm typecheck:all` et sera traité progressivement sans bloquer le gate strict des nouveaux modules.

## Périmètre

- kernel technique minimal ;
- services plateforme `identity`, `tenant`, `access` et `audit` ;
- squelette `domain/application/infrastructure/ui` ;
- composition root ;
- conventions de base de données ;
- feature flag ;
- première route protégée ;
- harness de tests unitaires, intégration et RLS.

## Livrables

1. ADR sur les limites du kernel.
2. ADR sur la propriété des tables et le schéma ou préfixe SQL du module.
3. `ActorContext` et identifiants typés.
4. Interfaces `IdentityService`, `TenantService`, `AccessService` et `AuditService`.
5. Adaptateurs sur l'authentification, les memberships, rôles et RLS existants.
6. Capabilities initiales : consulter, éditer technique, éditer financier, publier.
7. Module chargeable derrière une route et un feature flag.
8. Pipeline de migration et tests documenté.

## Critères de validation

- [x] `J1-VAL-01` Le domaine Clariprint Data compile sans dépendance React ou Supabase.
- [x] `J1-VAL-02` Le kernel ne contient aucune table, règle Clariprint, rôle métier ou plan commercial.
- [x] `J1-VAL-03` Un utilisateur sans feature ou capability reçoit un refus explicable au niveau applicatif.
- [ ] `J1-VAL-04` Un utilisateur autorisé accède au module dans son organisation.
- [ ] `J1-VAL-05` Un utilisateur du tenant A ne peut lire aucune donnée du tenant B.
- [ ] `J1-VAL-06` Les contrôles applicatifs et la RLS sont tous deux actifs.
- [ ] `J1-VAL-07` React appelle un service applicatif et non une table.
- [ ] `J1-VAL-08` Les erreurs possèdent un code stable et un identifiant de corrélation.
- [ ] `J1-VAL-09` Les migrations sont reproductibles sur une base vide.
- [x] `J1-VAL-10` Le build et les suites de tests existantes restent verts.

## Preuves attendues

- diagramme de dépendances ;
- tests d'architecture ou règles d'import ;
- tests RLS avec deux organisations ;
- démonstration accès autorisé/refusé ;
- logs de build et de migrations.

## Condition de sortie

Le module peut accueillir une première fonctionnalité métier sans ajouter d'accès Supabase direct dans l'UI ni étendre le kernel avec des règles de domaine.
