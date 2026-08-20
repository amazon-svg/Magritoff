---
id: AF31.4
epic: EPIC-8-API-FIRST
priority: P2
status: done
branch: feat/storefront-identity-um2
depends_on: [AF31.3]
---

# AF31.4 — Isoler les assignations de rôles Magrit

## Intention

La matrice globale des rôles et la modale d'un utilisateur orchestraient encore
directement les clients Roles et Members. Cette logique associait chargement,
adaptation des contrats, mutations et règles de séparation des identités à la
présentation React.

## Résultat

- `useRoleAssignmentMatrix` porte la vue globale et ses toggles d'assignation ;
- `useUserRoleManagement` porte l'édition ciblée, les états concurrents et le
  rafraîchissement du parent ;
- les réponses tardives sont ignorées après changement de cible ou fermeture ;
- la conversion legacy reste exclusivement `shop_only` vers `magrit_full` ;
- aucun composant de rôles ne dépend désormais des clients Roles ou Members ;
- les comptes boutique séparés ne sont ni assignés ni recréés par ce parcours.

## Validation

- tests unitaires des adaptations overview et détail utilisateur ;
- garde-fous API-first et séparation des identités Magrit/boutique ;
- 175 fichiers et 1 254 tests passés ;
- typecheck modulaire et build de production passés.
