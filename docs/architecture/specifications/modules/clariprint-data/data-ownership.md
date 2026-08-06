# Propriété des données Clariprint Data

**Statut :** draft  
**Version :** 0.1

## Principe

Clariprint Data est propriétaire de ses fournisseurs industriels, sites, ressources, contrats, aptitudes, paramètres, datasets, publications, sandboxes, imports et états de livraison.

Les autres modules consomment des contrats publics ou des snapshots publiés. Ils ne lisent pas directement les tables privées.

## Données possédées

| Ensemble | Propriétaire | Mutabilité |
|---|---|---|
| Fournisseurs et sites | Clariprint Data | Modifiable et archivable |
| Capacités fournisseur | Clariprint Data | Versionnable |
| Machines et ressources | Clariprint Data | Modifiable avec historique |
| Aptitudes et performances | Clariprint Data | Versionnable |
| Paramètres économiques | Clariprint Data | Versionnable et protégé |
| Contrats de sous-traitance | Clariprint Data | Daté et archivable |
| Brouillons | Clariprint Data | Modifiable |
| Publications | Clariprint Data | Immuable |
| Sandboxes | Clariprint Data | Modifiable et isolé |
| Imports et bilans | Clariprint Data | Append-only après confirmation |
| Livraisons solveur | Clariprint Data | Historique append-only |

## Données consommées

| Donnée | Module source | Mode d'accès |
|---|---|---|
| Identité utilisateur | `identity` | Service public |
| Tenant et membership | `tenant` | Service public |
| Capabilities | `access` | Service public |
| Feature et quotas | `entitlements` | Service public |
| Audit transverse | `audit` | Service public |

## Publication vers les autres modules

Clariprint Data peut publier :

- une référence stable de publication ;
- un résumé non financier de capacités ;
- un snapshot solveur selon les droits ;
- des événements versionnés.

Les commandes ou devis conservent l'identifiant de publication utilisé. Ils ne recopient pas le modèle privé complet sauf snapshot nécessaire à leur propre audit contractuel.

## Stratégie SQL à décider

Deux options acceptables :

1. schéma PostgreSQL dédié exposé uniquement via RPC/adaptateurs maîtrisés ;
2. tables dans le schéma exposé avec préfixe cohérent et RLS stricte.

Le choix dépend du comportement Supabase/PostgREST, des migrations et de l'exploitation. Il doit faire l'objet d'un ADR avant J1.

## Règles de suppression

- pas de suppression physique d'un objet référencé par une publication ;
- archivage logique pour les ressources métier ;
- suppression éventuelle de brouillons ou sandboxes selon la politique de conservation ;
- fichiers d'import et journaux selon contraintes de confidentialité ;
- aucun `ON DELETE CASCADE` ne doit pouvoir détruire une publication historique complète.

## RLS

- toutes les lignes tenant-scoped portent ou permettent de dériver un `tenant_id` non ambigu ;
- les policies ont un test positif et négatif ;
- les RPC `security definer` vérifient explicitement l'acteur et utilisent un `search_path` sûr ;
- les requêtes financières ajoutent une vérification de capability côté serveur ;
- service role reste réservé aux adaptateurs serveur contrôlés.
