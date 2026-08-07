# Capacités métier Clariprint Data

Chaque fiche spécifie une capacité interne au module Clariprint Data. Une capacité n'est pas nécessairement un package ou un microservice séparé.

## Index et ordre conseillé

1. [Environnements de production](./production-environments.md)
2. [Fournisseurs et sites](./suppliers.md)
3. [Ressources](./resources.md)
4. [Sous-traitance](./subcontracting.md)
5. [Aptitudes techniques](./technical-capabilities.md)
6. [Économie](./economics.md)
7. [Barèmes](./pricing-schedules.md)
8. [Référentiels matière](./material-references.md)
9. [Catalogues transport](./transport-catalogs.md)
10. [Publications](./publications.md)
11. [Sandboxes](./sandboxes.md)
12. [Imports](./imports.md)
13. [Exports solveur](./solver-exports.md)
14. [Projets de validation](./validation-projects.md)
15. [Profils clients et contrats d'accès calcul](./calculation-access-contracts.md)

## Contrat commun

Chaque commande :

- reçoit un `ActorContext` ;
- vérifie feature, membership et capability ;
- charge uniquement des objets du tenant ;
- applique les invariants dans le domaine ;
- persiste atomiquement si plusieurs objets changent ;
- audite les changements sensibles ;
- retourne un résultat ou une erreur typée ;
- ne retourne aucun type Supabase.
