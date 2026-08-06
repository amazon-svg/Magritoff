# J1 — Socle modulaire, identité et sécurité

**Statut initial :** à préparer  
**Dépendance :** J0

## Goal

Créer un module Clariprint Data exécutable, isolé du frontend et de Supabase par des contrats, avec une première décision d'accès tenant-scoped.

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

- [ ] `J1-VAL-01` Le domaine Clariprint Data compile sans dépendance React ou Supabase.
- [ ] `J1-VAL-02` Le kernel ne contient aucune table, règle Clariprint, rôle métier ou plan commercial.
- [ ] `J1-VAL-03` Un utilisateur sans feature ou capability reçoit un refus explicable.
- [ ] `J1-VAL-04` Un utilisateur autorisé accède au module dans son organisation.
- [ ] `J1-VAL-05` Un utilisateur du tenant A ne peut lire aucune donnée du tenant B.
- [ ] `J1-VAL-06` Les contrôles applicatifs et la RLS sont tous deux actifs.
- [ ] `J1-VAL-07` React appelle un service applicatif et non une table.
- [ ] `J1-VAL-08` Les erreurs possèdent un code stable et un identifiant de corrélation.
- [ ] `J1-VAL-09` Les migrations sont reproductibles sur une base vide.
- [ ] `J1-VAL-10` Le build et les suites de tests existantes restent verts.

## Preuves attendues

- diagramme de dépendances ;
- tests d'architecture ou règles d'import ;
- tests RLS avec deux organisations ;
- démonstration accès autorisé/refusé ;
- logs de build et de migrations.

## Condition de sortie

Le module peut accueillir une première fonctionnalité métier sans ajouter d'accès Supabase direct dans l'UI ni étendre le kernel avec des règles de domaine.

