# Capacités métier Clariprint Data

Chaque fiche spécifie une capacité interne au module Clariprint Data. Une capacité n'est pas nécessairement un package ou un microservice séparé.

## Index et ordre conseillé

1. [Fournisseurs et sites](./suppliers.md)
2. [Ressources](./resources.md)
3. [Sous-traitance](./subcontracting.md)
4. [Aptitudes techniques](./technical-capabilities.md)
5. [Économie](./economics.md)
6. [Publications](./publications.md)
7. [Sandboxes](./sandboxes.md)
8. [Imports](./imports.md)
9. [Exports solveur](./solver-exports.md)

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

