---
id: PD-2026-10-07-GOUVERNANCE
title: Droit d'approbation permanent de Xavier Péchoultres et administration du dépôt
date: 2026-10-07
documentStatus: approved
decisionStatus: adopted
source: MEET-2026-10-07-WM
owners:
  - Arnaud Mazon
supersedes: []
affectedArtifacts:
  - project/governance/roles.md
  - project/decisions/open-questions.md
---

# Droit d'approbation permanent de Xavier Péchoultres et administration du dépôt

## Contexte

`OQ-GOV-ROLES` empêchait de passer les spécifications et les fonctionnalités
livrées au statut `approved` : l'outillage refusait cette approbation à Xavier
Péchoultres. Le WM du 1er octobre avait réparti l'approbation entre Arnaud
Mazon (fonctionnel) et Xavier Péchoultres (technique). Par ailleurs, Xavier ne
pouvait pas activer le contrôle obligatoire « branche à jour avec main » faute
de droits d'administration sur le dépôt.

## Décision

Décisions d'Arnaud Mazon au WM du 7 octobre 2026.

1. **Xavier Péchoultres dispose, de manière permanente, du droit d'approuver
   tout ce qui peut l'être dans le produit** : spécifications, stories et
   fonctionnalités livrées. Arnaud Mazon conserve le même droit. La règle est
   déclarée immuable.
2. **Xavier Péchoultres reçoit les droits d'administration du dépôt GitHub
   Magrit au même titre qu'Arnaud Mazon.**

## Précision technique

Vérifiée le 7 octobre 2026 dans la documentation GitHub
(<https://docs.github.com/en/account-and-profile/reference/permission-levels-for-a-personal-account-repository>).
Le dépôt `amazon-svg/Magritoff` appartient à un compte personnel. Un tel dépôt
n'a qu'un propriétaire ; un collaborateur y reçoit un accès en écriture, sans
possibilité de gérer les règles de protection de branche. La tentative faite
en séance par la gestion des collaborateurs ne pouvait donc pas aboutir.
GitHub recommande, pour des droits plus fins, de **transférer le dépôt dans une
organisation**, où Xavier pourra recevoir le rôle d'administrateur. À défaut,
Arnaud Mazon active lui-même le contrôle « branche à jour avec main ».

## Conséquences

- `project/governance/roles.md` est mis à jour.
- `OQ-GOV-ROLES` est fermée.
- La frontière entre points produit structurants et non structurants, ouverte
  le 5 octobre, n'a plus d'effet sur le droit d'approbation de Xavier.
- La revue distincte du code avant fusion reste requise (`workflow.md`).
