# Sprint AM4 — Migration du legacy et durcissement

**Statut :** à préparer  
**Effort indicatif :** 5–8 jours, réalisable par lots  
**Dépend de :** AM3

## Objectif

Remplacer progressivement les accès directs historiques liés aux droits sans imposer un refactor global risqué.

## Lots de migration

### AM4.1 — Rôles et affectations dashboard

Migrer en premier :

- `DashboardRolesSection` ;
- `RoleEditorDialog` ;
- `EditUserRolesModal` ;
- `OrderRoleAdminPage` pour les parties génériques de rôle.

Les règles spécifiques au workflow de commande restent dans le module commandes et consomment seulement les contrats publics d'accès.

### AM4.2 — Invitations et membres

- extraire de `DashboardUsers` la projection des droits ;
- conserver temporairement `invite-member` derrière un port du futur module membership ;
- empêcher `access-management` de devenir propriétaire des invitations ;
- supprimer les écritures directes d'affectations depuis les modales.

### AM4.3 — Consommateurs de capabilities

- remplacer progressivement `useUserCapability` par le client/cache `access/me` ;
- éviter un appel réseau par capability ;
- conserver les contrôles serveur et RLS même lorsque l'UI connaît la projection ;
- documenter chaque dérogation R5 restante.

### AM4.4 — Durcissement et mesure de dette

- diminuer l'allowlist des imports Supabase historiques ;
- interdire toute hausse du nombre de références directes ;
- tester charge, pagination et cache ;
- tester révocation immédiate et sessions longues ;
- documenter le runbook opérateur et la récupération du dernier administrateur.

## Ordre recommandé

1. lectures de rôles ;
2. écritures de rôles ;
3. affectations ;
4. projection des membres ;
5. consumers `useUserCapability` ;
6. séparation finale invitations/membership.

Chaque lot doit être déployable et réversible indépendamment. Il retire ses entrées de baseline seulement après validation du parcours correspondant.

## Critères d'acceptation

- [ ] Les écrans migrés ne contiennent plus de requêtes Supabase directes.
- [ ] La baseline de dette diminue à chaque lot et ne peut pas remonter en CI.
- [ ] Aucun comportement historique n'est supprimé sans test d'invariance.
- [ ] Les droits prennent effet sans incohérence durable de cache.
- [ ] Les parcours cross-tenant, révocation et dernier administrateur sont verts.
- [ ] Les dépendances legacy restantes ont une condition de retrait explicite.

## Condition de sortie

Le module est le seul point d'entrée du nouveau code pour la consultation et l'administration des droits. Le legacy résiduel est encapsulé, mesuré et planifié, jamais pris comme modèle.

