# Plan de développement de `access-management`

**Statut :** proposition de travail  
**Spécification :** [`../architecture/specifications/modules/access-management/specification.md`](../architecture/specifications/modules/access-management/specification.md)  
**Contrat HTTP :** [`../architecture/specifications/modules/access-management/openapi.yaml`](../architecture/specifications/modules/access-management/openapi.yaml)  
**Déploiement :** [`06-deploiement-api.md`](./06-deploiement-api.md)

## Objectif

Créer un module autonome qui centralise les API et l'UX de gestion des droits, tout en réutilisant temporairement les tables et RPC historiques derrière des adaptateurs. Aucun nouveau code UI ne doit accéder directement à Supabase.

## Résultat attendu

À l'issue du plan :

- chaque surface consomme un client `AccessManagementApi` typé ;
- Clariprint Data connaît l'état de son module via `/api/v1`, pas via une Edge Function Supabase ;
- un administrateur tenant gère rôles et affectations dans une UX dédiée ;
- un opérateur plateforme active ou désactive les modules avec motif et audit ;
- le code historique continue de fonctionner pendant une migration progressive ;
- les nouveaux développements ne peuvent plus augmenter la dette Supabase côté UI.

## Découpage

| Sprint | Résultat | Effort indicatif | Dépend de |
|---|---|---:|---|
| AM0 | [Contrats, composition et garde-fous](./01-sprint-am0-contrats.md) | 2–3 j | — |
| AM1 | [API de consultation et adaptateur legacy](./02-sprint-am1-read-api.md) | 3–4 j | AM0 |
| AM2 | [Commandes rôles, affectations et entitlements](./03-sprint-am2-write-api.md) | 5–6 j | AM1 |
| AM3 | [UX de gestion et points d'accroche des surfaces](./04-sprint-am3-ux.md) | 4–5 j | AM2 |
| AM4 | [Migration du legacy et durcissement](./05-sprint-am4-migration.md) | 5–8 j, incrémental | AM3 |

Les efforts sont des ordres de grandeur, pas des dates d'engagement. Une story et sa preuve peuvent être livrées séparément à l'intérieur d'un sprint.

## Graphe de dépendances

```text
AM0 contrats + frontières
 |
 v
AM1 lectures + access/me + adaptateur legacy
 |
 v
AM2 écritures atomiques + audit + entitlements
 |
 v
AM3 UX + contributions de surfaces
 |
 v
AM4 migration progressive des écrans historiques
```

Clariprint Data peut reprendre son J1 dès la sortie d'AM1. Il n'a pas besoin d'attendre l'UX complète de gestion des droits.

## Principes de livraison

- une API est contractualisée avant son écran ;
- une Edge Function est un hébergement possible, pas le contrat public ;
- chaque dépendance au legacy passe par `infrastructure/legacy` ;
- chaque mutation est autorisée côté serveur, atomique et auditée ;
- les tests cross-tenant et d'escalade de privilèges sont bloquants ;
- les menus de modules sont déclarés par contribution et restent visibles selon la politique UX décidée ; l'accès métier est contrôlé après navigation et sur chaque commande ;
- aucune bascule globale du legacy n'est imposée : la migration se fait parcours par parcours.

## Suivi

| Sprint | Statut | Condition de sortie |
|---|---|---|
| AM0 | En validation | Contrats, frontières et tests d'architecture implémentés |
| AM1 | En validation | API de lecture et client Clariprint Data implémentés ; déploiement à réaliser |
| AM2 | À préparer | Mutations atomiques, auditées et sécurisées |
| AM3 | À préparer | Parcours administrateur et opérateur utilisables sans Supabase UI |
| AM4 | À préparer | Écrans historiques migrés par lots et dette mesurée en baisse |

## Hors périmètre du plan

- refonte complète de l'authentification ;
- facturation ou renouvellement des abonnements ;
- suppression immédiate de toutes les tables historiques ;
- migration de tous les accès Supabase de l'application ;
- gestion des invitations et du cycle de vie des membres, qui reste au module tenant/identity tant que son API n'est pas définie.
