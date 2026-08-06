# Plan de développement de Clariprint Data

**Statut :** proposition de travail  
**Produit :** Clariprint Data  
**PRD de référence :** [`../../prd/clariprint-data-prd.md`](../../prd/clariprint-data-prd.md)  
**Architecture de référence :** [`../ARCHITECTURE_KERNEL_MODULES_SERVICES.md`](../ARCHITECTURE_KERNEL_MODULES_SERVICES.md)

## Objet

Ce dossier transforme le PRD Clariprint Data en plan de développement vérifiable. Il décrit les objectifs, les jalons, les livrables, les critères de validation et les preuves attendues.

Clariprint Data est développé comme un module autonome. Il utilise un kernel technique minimal et les services plateforme communs, sans dépendre directement de React, de Supabase ou du code historique.

## Résultat MVP attendu

Un utilisateur pilote doit pouvoir décrire un parc industriel réel, en contrôler la cohérence, publier un instantané immuable, expérimenter dans un bac à sable et produire un JSON versionné accepté par le solveur de test.

## Jalons

| ID | Jalon | Résultat principal | Dépend de |
|---|---|---|---|
| J0 | [Découverte métier et contrat solveur](./01-jalon-0-decouverte.md) | Périmètre pilote et contrat d'échange validés | — |
| J1 | [Socle modulaire et sécurité](./02-jalon-1-socle.md) | Module accessible avec isolation tenant et droits | J0 |
| J2 | [Fournisseurs, sites et capacités](./03-jalon-2-fournisseurs.md) | Réseau de fournisseurs multi-capacités | J1 |
| J3 | [Ressources et sous-traitance](./04-jalon-3-ressources.md) | Parc industriel accessible et contractualisé | J2 |
| J4 | [Aptitudes et paramètres économiques](./05-jalon-4-aptitudes-economie.md) | Flux pilote descriptible et contrôlable | J3 |
| J5 | [Validation et publication](./06-jalon-5-publication.md) | Publication immuable et versionnée | J4 |
| J6 | [Bacs à sable et comparaison](./07-jalon-6-sandbox.md) | Expérimentation isolée de la production | J5 |
| J7 | [Import et export solveur](./08-jalon-7-import-export.md) | Parc importé et accepté par le solveur | J5, J6 |
| J8 | [Sécurisation et pilote](./09-jalon-8-pilote.md) | MVP validé sur un cas réel | J0 à J7 |

## Règles de passage

- Un jalon ne commence que lorsque ses dépendances sont validées ou qu'une dérogation est consignée.
- Un jalon n'est pas terminé par la seule présence de code : toutes ses preuves de validation doivent être disponibles.
- Une exigence métier non tranchée ne doit pas être masquée par une valeur technique arbitraire.
- Chaque dépendance temporaire au code historique doit être portée par un adaptateur nommé et assortie d'une condition de retrait.
- L'absence de données de production autorise une bascule franche du schéma, mais pas l'abandon des tests d'intégrité et de sécurité.

## Suivi

Statuts autorisés : `à préparer`, `prêt`, `en cours`, `en validation`, `validé`, `bloqué`.

| Jalon | Statut | Responsable | Date cible | Preuve de validation |
|---|---|---|---|---|
| J0 | À préparer | À nommer | À planifier | — |
| J1 | À préparer | À nommer | À planifier | — |
| J2 | À préparer | À nommer | À planifier | — |
| J3 | À préparer | À nommer | À planifier | — |
| J4 | À préparer | À nommer | À planifier | — |
| J5 | À préparer | À nommer | À planifier | — |
| J6 | À préparer | À nommer | À planifier | — |
| J7 | À préparer | À nommer | À planifier | — |
| J8 | À préparer | À nommer | À planifier | — |

## Documents transversaux

- [Goals, principes et Definition of Done](./00-goals-principes-validation.md)
- [Registre des décisions](./10-registre-decisions.md)
- [Spécifications d'architecture modulaires](../architecture/specifications/README.md)
- [Spécification du kernel](../architecture/specifications/kernel/specification.md)
- [Spécification du module Clariprint Data](../architecture/specifications/modules/clariprint-data/specification.md)
