# Autorisations Clariprint Data

**Statut :** draft  
**Version :** 0.1

## Capabilities proposées

| Capability | Objet |
|---|---|
| `clariprint_data.module.access` | Accéder au module |
| `clariprint_data.supplier.read` | Consulter fournisseurs et sites |
| `clariprint_data.supplier.edit` | Modifier fournisseurs et sites |
| `clariprint_data.technical.read` | Consulter les données techniques |
| `clariprint_data.technical.edit` | Modifier ressources, aptitudes et performances |
| `clariprint_data.financial.read` | Consulter les données économiques protégées |
| `clariprint_data.financial.edit` | Modifier les données économiques |
| `clariprint_data.subcontracting.edit` | Gérer les contrats de sous-traitance |
| `clariprint_data.dataset.validate` | Valider un dataset |
| `clariprint_data.publication.publish` | Publier en production |
| `clariprint_data.sandbox.manage` | Créer, modifier et archiver un sandbox |
| `clariprint_data.sandbox.promote` | Promouvoir vers un brouillon |
| `clariprint_data.import.execute` | Prévisualiser et confirmer un import |
| `clariprint_data.solver.deliver` | Livrer ou relancer vers le solveur |
| `clariprint_data.audit.read` | Consulter l'audit du module |

## Presets MVP proposés

| Profil | Capacités principales |
|---|---|
| Consultation | module, lectures non financières |
| Éditeur technique | consultation, supplier edit, technical edit |
| Éditeur financier | consultation, financial read/edit |
| Publieur | toutes les lectures, validation, publication, livraison |
| Support auditeur | lectures autorisées et audit, sans modification par défaut |

Les presets facilitent l'administration. Ils ne remplacent pas la matrice de capabilities et ne sont pas codés dans le kernel.

## Composition d'une décision

```text
Identité valide
  + membership actif
  + feature clariprint_data.enabled
  + capability
  + ownership tenant de la ressource
  + invariant métier
  + RLS
= action autorisée
```

## Données financières

- les APIs de lecture non financière n'incluent aucun champ économique masqué ;
- le masquage UI seul est insuffisant ;
- les policies, vues ou RPC doivent imposer la séparation côté base ;
- l'audit financier est soumis aux mêmes règles ;
- les exports solveur financiers exigent une action serveur autorisée.

## Matrice initiale

| Action | Consultation | Technique | Financier | Publieur |
|---|---:|---:|---:|---:|
| Consulter fournisseurs | Oui | Oui | Oui | Oui |
| Modifier fournisseurs | Non | Oui | À décider | À décider |
| Consulter technique | Oui | Oui | Oui | Oui |
| Modifier technique | Non | Oui | Non | À décider |
| Consulter coûts | Non | Non | Oui | Oui proposé |
| Modifier coûts | Non | Non | Oui | À décider |
| Valider dataset | Non | Non | Non | Oui |
| Publier | Non | Non | Non | Oui |
| Gérer sandbox | À décider | Oui proposé | Oui proposé | Oui |
| Importer | Non | Oui proposé | À décider | Oui |
| Livrer au solveur | Non | Non | Non | Oui |

## Cas de test obligatoires

- deux tenants et une ressource portant le même libellé ;
- membership révoqué ;
- feature absente mais capability présente ;
- capability absente mais feature présente ;
- éditeur technique tentant une lecture financière ;
- publieur tentant de modifier une publication ;
- sandbox envoyé vers la destination de production ;
- support sans procédure d'élévation active.

