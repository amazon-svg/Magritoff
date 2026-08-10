# Propriété des données Clariprint Data

**Statut :** draft  
**Version :** 0.2

## Principe

Clariprint Data est propriétaire de ses fournisseurs industriels, sites, ressources, contrats, aptitudes, paramètres, datasets, publications, sandboxes, imports et états de livraison.

Les autres modules consomment des contrats publics ou des snapshots publiés. Ils ne lisent pas directement les tables privées.

## Données possédées

| Ensemble | Propriétaire | Mutabilité |
|---|---|---|
| Fournisseurs et sites | Clariprint Data | Modifiable et archivable |
| Environnements de production | Clariprint Data | Modifiable, activable et archivable |
| Capacités fournisseur | Clariprint Data | Versionnable |
| Machines et ressources | Clariprint Data | Modifiable avec historique |
| Aptitudes et performances | Clariprint Data | Versionnable |
| Paramètres économiques | Clariprint Data | Versionnable et protégé |
| Barèmes et cas unitaires | Clariprint Data | Versionnables |
| Contrats d'accès calcul | Clariprint Data | Versionnables, suspendables et archivables |
| Métadonnées de credentials locaux | Clariprint Data | Rotatives et révocables ; secret jamais relisible |
| Projections solveur et preuves | Clariprint Data | Immuables ou régénérables selon ADR |
| Référentiels matière/transport BU | Clariprint Data, sous réserve de l'ownership BU | Versionnables |
| Contrats de sous-traitance | Clariprint Data | Daté et archivable |
| Brouillons | Clariprint Data | Modifiable |
| Publications | Clariprint Data | Immuable |
| Sandboxes | Clariprint Data | Modifiable et isolé |
| Imports et bilans | Clariprint Data | Append-only après confirmation |
| Livraisons solveur | Clariprint Data | Historique append-only |
| Délégations d'environnement | `access` ou Clariprint Data selon ADR | Datées, révocables et auditées |
| Projets de test | À décider | Références ou données selon module propriétaire |

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

Un environnement qui consomme un catalogue BU doit conserver la version exacte du catalogue ou embarquer les entrées résolues dans sa publication. Une référence flottante vers « le catalogue courant » est interdite dans un snapshot.

Le système d'accès externe éventuel reste propriétaire de ses identités et credentials. Clariprint Data publie les références de profils autorisées et conserve le binding ou la preuve d'autorisation nécessaire ; il ne copie pas les secrets externes.

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
