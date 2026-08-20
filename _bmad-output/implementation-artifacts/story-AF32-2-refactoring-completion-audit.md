---
id: AF32.2
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: feat/storefront-identity-um2
depends_on: [AF32.1]
---

# AF32.2 — Audit de clôture du refactoring

## Intention

La disparition des appels Supabase visibles ne suffit pas à prouver la fin du
chantier. La clôture doit vérifier les dépendances de couches, la consommation
des clients, la propriété des routes et la différence entre dette technique et
fonctionnalités futures.

## Critères de clôture

- `src/app` ne dépend directement ni de Supabase ni des adaptateurs ;
- aucun composant React n'appelle un client de module ;
- les clients et transports sont construits uniquement dans leurs roots ;
- chaque surface déclarée par un manifeste possède une contribution explicite ;
- les routes actives workspace/storefront/portail proviennent du registre ;
- les sorties backoffice non implémentées restent `planned` et invisibles ;
- les règles de séparation Magrit/boutique sont couvertes par les garde-fous ;
- documentation de reprise et contexte ne décrivent plus l'ancienne baseline.

## Résultat

- garde-fou global composants → hooks ajouté ;
- garde-fou global app → adaptateurs ajouté ;
- complétude manifeste → contributions vérifiée ;
- handoff remplacé par l'état réel et les limites volontaires du chantier ;
- aucun développement backoffice fictif n'est présenté comme livré.

## Validation

- tests d'architecture, surfaces et séparation d'identité ;
- audit mécanique des imports, appels fournisseurs et constructions de clients ;
- 177 fichiers et 1 260 tests passés ;
- 28 fichiers et 161 tests d'architecture passés ;
- typecheck modulaire et build de production passés ;
- recherches interdites sans résultat dans `src/app` et `src/app/components`.
