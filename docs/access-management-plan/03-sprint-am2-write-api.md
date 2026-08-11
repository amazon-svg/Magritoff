# Sprint AM2 — Commandes rôles, affectations et entitlements

**Statut :** à préparer  
**Effort indicatif :** 5–6 jours  
**Dépend de :** AM1

## Objectif

Centraliser toutes les mutations de droits derrière des commandes serveur atomiques, concurrentes et auditées.

## Stories

### AM2.1 — Gestion des rôles

- créer un rôle custom ;
- modifier nom, description et capabilities ;
- archiver un rôle selon la décision AM0 ;
- protéger les rôles système ;
- refuser les capabilities inconnues ou `platform_only`.

### AM2.2 — Affectations atomiques

- remplacer l'ensemble des rôles d'un membre ;
- valider tenant, membre, rôles actifs et autorisation ;
- calculer ajouts/révocations dans une transaction ;
- protéger le dernier administrateur effectif ;
- rendre la commande idempotente.

### AM2.3 — Administration des entitlements

- réserver la commande aux opérateurs plateforme ;
- activer/désactiver un module avec source, validité et motif ;
- prendre en charge `clariprint_data.enabled` ;
- empêcher toute auto-activation par un rôle tenant ;
- définir la condition de retrait de `tenants.settings.features`.

### AM2.4 — Audit et concurrence

- auditer before/after, acteur, motif et `requestId` ;
- rendre audit et écriture atomiques ;
- appliquer `ETag`/`If-Match` ;
- retourner des conflits stables ;
- exposer la consultation paginée des événements d'accès.

## Critères d'acceptation

- [ ] Toutes les mutations exigent une capability côté serveur.
- [ ] Un rôle d'un autre tenant ne peut jamais être affecté.
- [ ] Un administrateur tenant ne peut attribuer aucune capability plateforme.
- [ ] Le dernier administrateur ne peut être retiré par erreur.
- [ ] Une version obsolète retourne 409 sans écraser les changements.
- [ ] Une répétition avec la même clé d'idempotence ne duplique rien.
- [ ] Une écriture sans audit réussi est annulée.
- [ ] L'activation de Clariprint Data est immédiatement visible dans `access/me`.

## Tests

- tests unitaires des invariants ;
- tests transactionnels et de concurrence ;
- matrice 401/403/404/409/422 ;
- tests RLS avec tenant A, tenant B et opérateur plateforme ;
- tests de rollback d'audit ;
- tests d'idempotence.

## Condition de sortie

Les écrans peuvent administrer les droits sans aucune écriture directe dans les tables historiques.

