# Sprint AM1 — API de consultation et adaptateur legacy

**Statut :** à préparer  
**Effort indicatif :** 3–4 jours  
**Dépend de :** AM0

## Objectif

Fournir les premières lectures métier stables à Clariprint Data et à la future UX, sans exposer Supabase.

## Stories

### AM1.1 — Adaptateur anti-corruption historique

- lire rôles et affectations historiques ;
- adapter `user_has_capability` derrière `platform/access` ;
- adapter `tenants.settings.features` derrière `platform/entitlements` ;
- traduire les capabilities `can_*` selon une table de mapping explicite ;
- distinguer refus métier, donnée incohérente et panne fournisseur.

### AM1.2 — Projection personnelle `access/me`

- reconstruire l'`ActorContext` depuis le token côté serveur ;
- vérifier le membership du tenant ;
- retourner capabilities effectives et disponibilité des modules ;
- représenter séparément `enabled`, `accessible` et `reason` ;
- couvrir `clariprint_data.enabled` et `clariprint_data.module.access`.

### AM1.3 — API de lecture administrative

- exposer le catalogue de capabilities ;
- exposer la liste et le détail des rôles ;
- exposer la projection paginée membres/affectations ;
- exposer les modules visibles selon le périmètre de l'acteur.

### AM1.4 — Client typé et intégration Clariprint Data

- créer `AccessManagementApi` et son client HTTP ;
- injecter le client depuis la composition root du dashboard ;
- remplacer le spike `clariprint-data-access` par `getMyTenantAccess` ;
- conserver le menu Clariprint Data systématiquement déclaré ;
- afficher dans la page l'état indisponible ou non autorisé sans appel Supabase direct.

## Critères d'acceptation

- [ ] `GET /access/me` retourne 401, 403, 200 ou 503 selon le contrat.
- [ ] Feature absente et capability absente sont distinguées.
- [ ] Une panne du RPC ne devient jamais `accessible: false` silencieux.
- [ ] Un membre du tenant A ne peut lire aucune projection du tenant B.
- [ ] Les réponses ne contiennent aucun nom de table ou détail Supabase.
- [ ] Clariprint Data ne connaît que le client typé et l'URL relative `/api/v1`.
- [ ] L'ancien endpoint technique Clariprint Data est supprimé ou marqué non déployable.

## Tests

- tests unitaires des mappings legacy ;
- tests de contrat handler/OpenAPI ;
- tests d'intégration avec deux tenants et plusieurs rôles ;
- tests des états entitlement/capability ;
- test de dépendance UI ;
- test composant Clariprint Data avec client simulé.

## Condition de sortie

Clariprint Data peut déterminer son état d'accès via une API métier stable, indépendamment de Supabase et de l'implémentation future des droits.

