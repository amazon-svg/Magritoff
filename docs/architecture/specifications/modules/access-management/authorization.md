# Autorisations de `access-management`

**Statut :** candidate  
**Version :** 0.1

## Matrice initiale

| Opération | Membership | Capability requise | Entitlement requis |
|---|---|---|---|
| Lire son accès | actif | aucune au-delà du membership | non |
| Lire le catalogue | actif | `access_management.roles.read` | non |
| Lire les rôles | actif | `access_management.roles.read` | non |
| Gérer les rôles | actif | `access_management.roles.manage` | non |
| Lire les affectations | actif | `access_management.assignments.read` | non |
| Remplacer les affectations | actif | `access_management.assignments.manage` | non |
| Lire l'audit d'accès | actif | `access_management.audit.read` | non |
| Lire les modules du tenant | actif | aucun pour la projection personnelle ; `platform.entitlements.read` pour le détail administratif | non |
| Modifier un entitlement | opérateur plateforme | `platform.entitlements.manage` | non |

Le service reconstruit toujours l'acteur depuis le bearer token et vérifie son membership dans le tenant du chemin.

## Ordre des contrôles

1. vérifier le token et l'identité active ;
2. valider la syntaxe de la requête ;
3. résoudre le membership ou le périmètre opérateur ;
4. vérifier la capability d'administration ;
5. charger les ressources sans traverser le tenant ;
6. vérifier les invariants métier et la concurrence ;
7. exécuter la transaction et son audit ;
8. laisser la RLS confirmer l'isolation au niveau base.

## Protection contre l'escalade

- le client ne transmet jamais ses propres capabilities effectives ;
- les capabilities inconnues ou `platform_only` sont refusées lors de l'édition d'un rôle tenant ;
- un utilisateur ne peut pas contourner les règles en s'affectant directement un rôle ;
- la protection du dernier administrateur est évaluée sur les capacités effectives, pas sur le nom d'un rôle ;
- l'activation d'un module ne crée aucune capability ;
- l'attribution d'une capability n'active aucun module ;
- les accès opérateur plateforme sont séparés des rôles administrables par le tenant.

## Codes de refus stables

- `identity.not_authenticated` → 401 ;
- `tenant.not_a_member` → 403 ;
- `access_management.forbidden` → 403 ;
- `access_management.not_found` → 404 non révélateur ;
- `access_management.last_administrator` → 409 ;
- `access_management.concurrent_modification` → 409 ;
- `access_management.platform_capability_forbidden` → 422.

## Tests de sécurité obligatoires

- utilisateur du tenant A contre chaque route du tenant B ;
- membre simple contre chaque commande d'administration ;
- administrateur tenant tentant d'attribuer `platform.entitlements.manage` ;
- administrateur tenant tentant d'activer `clariprint_data.enabled` ;
- opérateur autorisé avec et sans motif ;
- retrait de l'avant-dernier puis du dernier administrateur ;
- rôle archivé et affectation révoquée ;
- concurrence sur la version d'un rôle et d'un ensemble d'affectations ;
- panne du RPC historique vérifiée comme erreur fournisseur et non comme refus métier.

