# Registre des décisions Clariprint Data

Ce registre évite que les hypothèses du PRD deviennent silencieusement des contraintes techniques. Une décision structurante doit ensuite être détaillée dans un ADR si nécessaire.

## Statuts

- `ouverte` : réponse nécessaire ;
- `proposée` : solution formulée, validation attendue ;
- `acceptée` : décision applicable ;
- `reportée` : hors jalon actuel avec date de réexamen ;
- `remplacée` : une décision plus récente fait foi.

## Décisions métier et produit

| ID | Décision | Statut | Responsable | Jalon requis | Réponse / ADR |
|---|---|---|---|---|---|
| DEC-001 | Format actuel d'entrée du solveur | Ouverte | À nommer | J0 | — |
| DEC-002 | Snapshot complet, différentiel ou les deux | Ouverte | À nommer | J0 | — |
| DEC-003 | Familles de machines et flux pilote | Ouverte | À nommer | J0 | — |
| DEC-004 | Paramètres économiques consommés | Ouverte | À nommer | J0 | — |
| DEC-005 | Propriété de la marge commerciale | Ouverte | À nommer | J0 | — |
| DEC-006 | Erreurs bloquantes et avertissements | Ouverte | À nommer | J0 | — |
| DEC-007 | Seconde validation technique ou financière | Ouverte | À nommer | J0 | — |
| DEC-008 | Portée multi-sites du MVP | Ouverte | À nommer | J0 | — |
| DEC-009 | Profondeur de sous-traitance | Proposée : un niveau | À nommer | J0 | — |
| DEC-010 | Unités et conventions d'arrondi | Ouverte | À nommer | J0 | — |
| DEC-011 | Volumétrie cible | Ouverte | À nommer | J0 | — |
| DEC-012 | Politique de conservation | Ouverte | À nommer | J5 | — |
| DEC-013 | Destination des exports sandbox | Ouverte | À nommer | J6 | — |

## Décisions d'architecture

| ID | Décision | Statut | Responsable | Jalon requis | Réponse / ADR |
|---|---|---|---|---|---|
| ARCH-001 | Clariprint Data est un module du monolithe modulaire | Proposée | À nommer | J1 | — |
| ARCH-002 | Le kernel ne dépend ni de Supabase ni du legacy | Proposée | À nommer | J1 | — |
| ARCH-003 | Chaque module possède ses ports et repositories | Proposée | À nommer | J1 | — |
| ARCH-004 | Schéma PostgreSQL dédié ou préfixe de tables | Ouverte | À nommer | J1 | — |
| ARCH-005 | Publications stockées comme snapshot complet immuable | Proposée | À nommer | J5 | — |
| ARCH-006 | Séparation physique ou logique des champs financiers | Ouverte | À nommer | J4 | — |
| ARCH-007 | Protocole de livraison au solveur | Ouverte | À nommer | J7 | — |
| ARCH-008 | Stratégie d'idempotence import/export | Ouverte | À nommer | J7 | — |

## Modèle de décision

```text
ID :
Titre :
Statut :
Contexte :
Décision :
Alternatives considérées :
Conséquences :
Date :
Décideurs :
Lien ADR ou preuve :
```
