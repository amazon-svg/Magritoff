---
id: PD-2026-10-05-UM
title: "Modèle de droits utilisateurs — consolidation UM et écarts de la stack portable"
date: 2026-10-05
documentStatus: draft
decisionStatus: proposed
source: REPORT-2026-10-04-NOTE-XAVIER
owners: []
supersedes: []
affectedArtifacts:
  - project/backlog/stories/E9.1.md
  - project/backlog/stories/E9.2.md
  - project/backlog/stories/E9.3.md
  - project/backlog/stories/E9.9.md
  - project/backlog/stories/E9.10.md
  - project/backlog/stories/E9.13.md
  - project/backlog/stories/E10.11.md
---

# Consolidation du modèle de droits utilisateurs

## Mandat et statut

Reprise demandée par Xavier le 5 octobre 2026 : formaliser le modèle actuel et actualiser les sept stories identifiées dans la note du 4 octobre. Ce document prépare la revue humaine. Il ne constitue pas une nouvelle approbation produit ni une autorisation de supprimer des comptes ou de modifier leurs droits.

## Précision du 5 octobre et source historique retrouvée

Xavier indique que les deux typologies d’utilisateurs ont déjà été décidées en réunion et mises en œuvre. La première démarche est de retrouver et formaliser cette décision, pas de demander à nouveau le choix d’un modèle.

Le document [`UM1 — Règles fonctionnelles de la gestion des utilisateurs`](../../../_bmad-output/planning-artifacts/um1-regles-fonctionnelles-gestion-utilisateurs.md), daté du 14 août 2026, porte `status: validated`, `decision_owner: Arnaud (produit)` et indique explicitement « Validé par Arnaud le 2026-08-14 ». Il distingue **deux populations**, utilisateurs Magrit et clients boutique. Au sein de Magrit, il définit les profils admin/utilisateur et les options Boutiques/Commandes. `shop_only` décrit un état legacy, pas une troisième population cible.

Ce document est une trace de validation dans le dépôt, pas le compte rendu original. Il renvoie à `SPEC-IDENTITY-STORE-01`, dont le fichier n’a pas été retrouvé par la recherche de noms dans le dépôt. Les comptes rendus ajoutés par Xavier complètent cette provenance, comme indiqué ci-dessous. Les écarts de la stack portable restent à analyser au regard de la décision historique ; ils ne démontrent pas que la décision produit manque.

## Compte rendu ajouté et séparation des populations

Le [RP du 28 août 2026](../../meetings/2026/CR_RP280826_Magrit_IA.md), §2 et §3, confirme la séparation entre utilisateurs internes Magrit (commerciaux et administrateurs) et clients finaux des boutiques. Il écarte la fusion de leurs comptes et distingue leurs accès. Le §8 traite l’étanchéité comme un prérequis de sécurité. La séparation des deux populations est donc une décision historique à reprendre ; les détails des options, droits et accès legacy restent à rapprocher de leurs sources propres et du code portable.

## Modèle décrit par le chantier UM historique

- Les utilisateurs internes Magrit et les clients boutique constituent deux populations distinctes. Les comptes et sessions storefront sont limités à leur boutique ; une session Magrit n'y donne pas automatiquement accès.
- `magrit_full` décrit le membre interne ; `shop_customer` décrit le client boutique. `shop_only` est un vestige de l'ancien modèle, dont la création est censée être fermée. Les « trois types » du document historique incluent donc un type legacy, pas trois choix à proposer à un nouvel utilisateur.
- La délégation « Se connecter à la boutique » est explicite et auditée. Le client boutique et l'opérateur Magrit restent identifiables séparément dans les commandes.
- Les membres ordinaires disposent des options Boutiques et Commandes. L'administration des utilisateurs et des paramètres métier reste réservée aux administrateurs selon la règle historique dite « admin unique ». Cette formule ne signifie pas qu'un espace ne peut avoir qu'une seule personne administratrice.
- Les comptes clients se gèrent depuis la boutique ou le parcours client, pas en attribuant `shop_only` à un membre interne.

Référence historique : `docs/SHOP_ACCESS_CONTROL.md`. Les mentions de `auth.users` et des triggers Supabase doivent être relues au regard du passage à `app_users` et Better Auth ; elles ne constituent pas une preuve du schéma portable actuel.

## État constaté dans le code portable

- Les sessions storefront et la délégation existent dans leurs modules distincts.
- `0027_role_catalog.sql` installe les options `option_shops` et `option_orders`.
- `src/adapters/postgres/roles-repository.ts` refuse, par son chemin d'assignation, les définitions autres que ces deux options.
- `src/adapters/postgres/members-repository.ts`, méthode `updateAccess`, écrit encore `access_scope`, `allowed_shop_ids` et `permissions` (`can_quote`, `can_order`, `can_invite`). Cela contredit une lecture selon laquelle l'ancien modèle aurait entièrement disparu.
- Le trigger historique nommé `restrict_magrit_assignments_to_options` n'est pas présent dans les migrations portables. Le contrôle d'assignation retrouvé dans `0027_role_catalog.sql` vérifie l'appartenance au tenant, pas cette restriction aux deux options. Il faut distinguer garantie du repository et garantie en base.
- La garde « administrateur » des fonctionnalités métier utilise les rôles `owner`/`admin`, les préférences de superadministration et les capacités attribuées. Toute promesse « admin uniquement » doit être vérifiée sur chaque chemin concerné, pas déduite du nom d'un écran.

Ces constats ne permettent pas de déclarer silencieusement l'un des modèles comme entièrement livré. Ils motivent le statut `contradictory` d'E9.3 et une vérification des tests et contrats avant toute évolution des droits.

## Consolidation de la décision historique

Reprendre la séparation des populations et les deux options UM décrites dans la source historique validée, puis compléter leur provenance dans la décision canonique. Interdire tout développement qui réintroduirait le choix d'un compte acheteur par `shop_only`. Avant mise en conformité, déterminer quels chemins legacy doivent être fermés et quelles garanties doivent être opposables en base.

Les six autres stories gardent leur objectif métier, avec un cadrage UM spécifique. E9.3 conserve son intention d'étanchéité mais son ancien comportement et ses anciens critères sont identifiés comme historiques ; aucun successeur approuvé n'est inventé.

## Vérifications nécessaires

1. Tester le refus de nouvelle attribution `shop_only` via les API réellement exposées, et le traitement des accès legacy existants.
2. Tester l'assignation d'une définition autre que les deux options via le repository et les primitives de base autorisées.
3. Vérifier séparément la gestion des utilisateurs, la tarification et l'audit : un membre ordinaire avec des options ne doit pas acquérir des capacités administratives incompatibles avec la cible validée.
4. Conserver les preuves d'isolation tenant et boutique, de révocation et de délégation.

## Questions à trancher

- Consolider la provenance UM : le RP du 28 août établit la séparation des populations ; compléter les sources de la matrice des options et droits, puis vérifier sa conformité technique.
- Le contrat d'édition des accès interne doit-il conserver des champs legacy en lecture seulement, ou les retirer ?
- Quelles restrictions doivent être garanties en base, en complément des services ?
- Le mappage SSO peut-il attribuer des droits administratifs, et avec quel contrôle explicite ?

Les réponses conditionnent les correctifs de sécurité et les critères définitifs. Aucun droit de production n'est modifié par cette consolidation.
