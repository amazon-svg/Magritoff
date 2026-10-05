---
id: BCP-5
title: BCP-5 — Libellés de statut des commandes unifiés
epic: EPIC-E10
feature: FEAT-E10-UNCLASSIFIED
specStatus: draft
deliveryStatus: implemented
owner: unassigned
source:
  system: notion
  pageId: 3ddd0131973c814eb8c7cfd3fef80635
  url: https://app.notion.com/3ddd0131973c814eb8c7cfd3fef80635
  originalStatus: "Terminé"
  originalSprint: "Sprint 5 — Gestion commerciale"
  originalPriority: "P1"
  originalEffort: "M"
  originalAssignee: "Claude code"
  originalOffering: ""
  originalOrder: ""
  originalSources: ""
  createdAt: "2026-09-16 06:01:58Z"
  lastEditedAt: "2026-09-16T06:01:00.000Z"
  importedAt: 2026-10-03
  archive: _archives-notion/2026-10-03/pages/BCP-5.md
decisions: []
dependencies: []
supersedes: []
implementationRecords:
  - _bmad-output/implementation-artifacts/story-BCP-5.md
---

# BCP-5 — Libellés de statut des commandes unifiés

> Donne un seul mot à un seul état de commande, boutique et atelier confondus, pour qu'un acheteur qui vient de commander ne lise plus « Brouillon ».

## Valeur métier

Un acheteur qui voit « Brouillon » sur la commande qu'il vient de passer en conclut qu'elle n'est pas partie : il la repasse, ou il appelle. L'atelier, de son côté, lit un autre mot pour le même état et ne sait pas de quoi parle l'acheteur au téléphone. Le coût du défaut est là : des doublons, des appels, et une boutique qui n'inspire pas confiance au premier achat. Unifier les libellés ne change aucun comportement, seulement ce que les deux parties comprennent du même objet.

## Défaut constaté

Les libellés de statut étaient recopiés à plusieurs endroits de l'interface boutique et atelier. Le statut `draft` d'une commande passée par un acheteur s'affichait « Brouillon » — un mot qui désigne ailleurs un devis non envoyé. Deux écrans pouvaient donc nommer différemment le même état, et rien n'empêchait un nouvel écran d'en inventer un troisième.

## Besoin utilisateur

**En tant qu'**acheteur de boutique comme membre de l'atelier, **je veux** que chaque état de commande porte partout le même nom, **afin de** savoir sans ambiguïté où en est une commande.

## Comportement attendu

1. Une table unique donne, pour chaque statut de commande, le libellé affiché à l'écran.
2. L'état d'une commande qui attend la décision de l'atelier s'affiche **« En attente de validation »**, dans la boutique comme dans l'atelier.
3. Le mot « Brouillon » ne désigne plus une commande : il reste réservé au devis.
4. Les badges, les filtres, les fenêtres de validation et d'annulation, l'écran de remerciement, l'historique de commandes et le bandeau de reprise tirent tous leur texte de cette table, sans recopie.
5. Un message d'erreur qui mentionne un état reprend le libellé de la table, jamais une chaîne écrite à la main.

## Expérience utilisateur

- Le libellé est explicite sur l'attente : l'acheteur comprend que la balle est dans le camp de l'atelier, pas dans le sien.
- Les couleurs de badge distinguent l'attente de l'acquis, de façon cohérente entre les deux espaces.
- **La source est muette** sur la formulation retenue pour les autres états et sur la manière dont un acheteur apprend la durée d'attente attendue.

## Règles métier

- `RM-01` — Il existe une table unique des libellés de statut de commande ; aucun écran ne définit le sien.
- `RM-02` — Le statut d'une commande déposée et non encore tranchée par l'atelier s'affiche « En attente de validation ».
- `RM-03` — « Brouillon » ne qualifie plus une commande, quel que soit l'écran. Le terme reste disponible pour le devis.
- `RM-04` — Un message d'erreur qui nomme un état lit ce nom dans la table, il ne le recopie pas.
- `RM-05` — L'unicité de la table est tenue par une vérification automatique, pas par la discipline des relecteurs.

## Critères d'acceptation

- `AC-01` — Étant donné une commande déposée par un acheteur et non encore tranchée, quand l'acheteur consulte son historique, alors le statut affiché est « En attente de validation ».
- `AC-02` — Étant donné la même commande, quand un membre de l'atelier ouvre la liste des commandes, alors le statut affiché est le même mot, à l'identique.
- `AC-03` — Étant donné l'ensemble des écrans de commande de la boutique et de l'atelier, quand on les parcourt, alors le mot « Brouillon » n'y apparaît sur aucune commande.
- `AC-04` — Étant donné un refus de validation parce que la commande a changé d'état ailleurs, quand le message s'affiche, alors il reprend le libellé de la table et non une chaîne distincte.
- `AC-05` — Étant donné un développeur qui écrit un libellé de statut en dur dans un écran de commande, quand la vérification automatique s'exécute, alors elle échoue.

## Cas limites

- **Cohorte historique.** Le dépôt conserve deux familles de statuts : les statuts canoniques de commande et une cohorte plus ancienne figée. Dans `src/modules/orders/ui/helpers/orderStatus.ts`, le statut historique `pending` porte le libellé **« En attente »**, distinct de « En attente de validation » appliqué au statut canonique `draft`. Deux mots proches coexistent donc encore pour une attente. **La source ne dit pas** si cette cohorte doit être alignée, laissée telle quelle, ou si elle disparaît avec l'assainissement du schéma (`ADR-2026-10-01-C5`).
- **Nouveaux états à venir.** La table est organisée par groupes pour accueillir des états d'approbation hiérarchique. Chaque ajout devra décider d'un libellé : la règle `RM-01` s'applique, le libellé lui-même n'est pas spécifié.
- **La garde est textuelle.** `tests/architecture/order-status-single-source.test.ts` protège l'unicité en lisant le **texte du code source**, après l'avoir fait nettoyer de ses commentaires. C'est exactement la famille de garde que `FIX-GARDE` a mise en défaut : elle attrape la régression accidentelle, pas le contournement délibéré.

## Hors périmètre

- La création, la suppression ou la redéfinition d'un état de commande : seuls les libellés changent.
- Le circuit d'approbation hiérarchique et ses états propres.
- Les libellés de statut de devis.
- Les couleurs et le dessin des badges au-delà de la cohérence entre les deux espaces.

## Dépendances et décisions

- Arbitrage d'Arnaud du 2026-09-15 (« Q1 » du cadrage boutique, `docs/api/CONVENTIONS.md` §8.25 point 5.1) : le statut technique reste inchangé, **seul le libellé change**. La conformité au PRD n'est donc pas affectée.
- `ADR-2026-10-01-C5` — le schéma de base est regroupé et assaini, les données historiques ne sont pas reprises. Le sort de la cohorte de statuts figée dépend de cette décision.
- `FIX-GARDE` — la vérification d'unicité repose sur le nettoyage de commentaires corrigé par ce correctif.

## Vérification

_Aucun cahier de tests Notion ne référence cette story._

## Preuves relevées dans le dépôt

`deliveryStatus: implemented` — 6 fichiers de code · 6 fichiers de test · 10 commits git · 1 story document BMAD avec signal d'implémentation.

Story documents BMAD (historique d'implémentation, non recopié) :

- `_bmad-output/implementation-artifacts/story-BCP-5.md`

Fichiers de code :

- `src/modules/orders/ui/helpers/orderStatus.ts`
- `src/modules/orders/ui/hooks/useDashboardOrderManagement.ts`
- `src/modules/orders/ui/hooks/useStorefrontOrderList.ts`
- `src/modules/orders/ui/storefront/PortalCart.tsx`
- `src/modules/orders/ui/storefront/PortalOrders.helpers.ts`
- `src/modules/orders/ui/storefront/PortalThankYou.tsx`

Fichiers de test :

- `tests/architecture/order-status-single-source.test.ts`
- `tests/components/shop/portal/OrderHistoryTable.text.test.ts`
- `tests/components/shop/portal/PortalCart.text.test.ts`
- `tests/components/shop/portal/PortalOrderEditor.text.test.ts`
- `tests/components/shop/portal/PortalThankYou.test.ts`
- `tests/components/shop/portal/ValidateOrderConfirmDialog.text.test.ts`

Commits : `baac0a30`, `1218e74d`, `0d74bf86`, `e825562d`, `952783a7`

## Questions ouvertes

- La cohorte de statuts historique doit-elle être alignée sur « En attente de validation », conservée telle quelle, ou retirée avec l'assainissement du schéma ?
- Quels libellés s'appliquent aux autres états (production, expédition, livraison, facturation) : la source ne les énonce pas, le dépôt les porte sans qu'ils aient été arbitrés.
- Les libellés affichés à l'acheteur et à l'atelier doivent-ils rester identiques quand les circuits d'approbation ajouteront des états internes à l'atelier ?
- Rattachement à une fonctionnalité produit à arbitrer (`FEAT-E10-UNCLASSIFIED` est un regroupement de migration).
- Relecture produit requise : contenu issu d'un import, non approuvé.
