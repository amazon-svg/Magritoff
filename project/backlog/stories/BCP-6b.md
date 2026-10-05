---
id: BCP-6b
title: BCP-6b — Fin de la boucle d'appels session et catalogue
epic: EPIC-E10
feature: FEAT-E10-UNCLASSIFIED
specStatus: draft
deliveryStatus: implemented
owner: unassigned
source:
  system: notion
  pageId: 3ddd0131973c8192adedd3721eb8562b
  url: https://app.notion.com/3ddd0131973c8192adedd3721eb8562b
  originalStatus: "Terminé"
  originalSprint: "Sprint 5 — Gestion commerciale"
  originalPriority: "P0"
  originalEffort: "L"
  originalAssignee: "Claude code"
  originalOffering: ""
  originalOrder: ""
  originalSources: ""
  createdAt: "2026-09-16 06:01:58Z"
  lastEditedAt: "2026-09-16T06:01:00.000Z"
  importedAt: 2026-10-03
  archive: _archives-notion/2026-10-03/pages/BCP-6b.md
decisions: []
dependencies: []
supersedes: []
implementationRecords:
  - _bmad-output/implementation-artifacts/story-BCP-6b.md
---

# BCP-6b — Fin de la boucle d'appels session et catalogue

> Arrête les appels périodiques qu'une page de boutique laissée ouverte envoyait sans fin, et renvoie vers l'écran de connexion quand la session a expiré.

## Valeur métier

Une boutique laissée ouverte sur un poste d'accueil émettait deux appels toutes les cinq secondes, dont un rechargement complet du catalogue. Multiplié par le nombre d'onglets ouverts chez un client, c'est une charge serveur et une facture d'infrastructure payées pour rien, et une boutique qui chauffe sans que personne ne lui demande rien. Le second volet touche la confiance : un en-tête qui continue d'afficher « connecté » après l'expiration de la session laisse l'acheteur agir sur une session morte, et chacun de ses gestes échoue sans qu'il comprenne pourquoi.

## Défaut constaté

Une page de boutique laissée ouverte déclenchait **deux appels toutes les cinq secondes**, dont le rechargement complet du catalogue. Mesuré en navigateur, non détecté par les tests. Par ailleurs, une session expirée laissait l'en-tête afficher l'état « connecté » indéfiniment.

## Besoin utilisateur

**En tant qu'**acheteur ayant laissé la boutique ouverte, **je veux** que la page cesse d'interroger le serveur quand je ne m'en sers pas, et qu'elle me renvoie à la connexion quand ma session a expiré, **afin de** ne jamais agir sur un état qui n'existe plus.

## Comportement attendu

1. La boutique n'émet plus aucun appel périodique : au repos, elle n'interroge pas le serveur.
2. Elle se remet à jour au **retour sur l'onglet**, et seulement à ce moment-là, avec un délai minimal entre deux remises à jour.
3. Le simple retour de focus de la fenêtre ne déclenche rien ; seul le retour de visibilité de l'onglet compte.
4. Quand la session a expiré, l'écran de connexion est présenté : l'en-tête cesse d'afficher l'état « connecté ».
5. Une seule revalidation est en cours à la fois : une revalidation en échec n'en déclenche pas une autre.

## Expérience utilisateur

- L'acheteur qui revient sur son onglet retrouve un écran à jour, sans avoir rien demandé.
- L'acheteur dont la session a expiré est renvoyé à la connexion plutôt que laissé devant un en-tête qui ment.
- **La source est muette** sur ce que l'acheteur lit au moment où sa session expire, et sur le sort de son panier en cours à ce moment-là.

## Règles métier

- `RM-01` — Aucun appel périodique n'est émis par la boutique. Au repos, le nombre d'appels est nul.
- `RM-02` — La remise à jour se déclenche au retour de visibilité de l'onglet, jamais au simple focus de la fenêtre.
- `RM-03` — Un délai minimal sépare deux remises à jour successives, distinct pour la session et pour le catalogue. Dans le dépôt : une minute pour la session, dix minutes pour le catalogue. **Ces valeurs ne figurent pas dans la source** et restent à confirmer.
- `RM-04` — Une session expirée conduit à l'écran de connexion ; l'interface ne présente jamais un état connecté qui ne l'est plus.
- `RM-05` — Une seule revalidation est en vol à la fois ; un échec de revalidation n'en relance pas une autre.
- `RM-06` — Une expiration de session déclenche la revalidation sans attendre le délai minimal.

## Critères d'acceptation

- `AC-01` — Étant donné une boutique ouverte et inactive pendant deux minutes et demie, quand on observe le trafic réseau, alors aucun appel n'est émis.
- `AC-02` — Étant donné un onglet de boutique quitté puis repris après le délai minimal, quand il redevient visible, alors une seule remise à jour est déclenchée.
- `AC-03` — Étant donné un onglet repris avant l'expiration du délai minimal, quand il redevient visible, alors aucune remise à jour n'est déclenchée.
- `AC-04` — Étant donné une fenêtre qui reprend le focus sans que l'onglet ait changé de visibilité, quand l'événement survient, alors aucun appel n'est déclenché.
- `AC-05` — Étant donné une session expirée, quand l'acheteur revient sur l'onglet, alors une seule revalidation est émise et l'écran de connexion est présenté.
- `AC-06` — Étant donné une revalidation qui échoue elle-même sur une session invalide, quand elle se termine, alors aucune nouvelle revalidation n'est déclenchée en chaîne.

## Cas limites

- **Rafale à la reconnexion, connue et non traitée.** La source la nomme explicitement : à la reconnexion, la liste des commandes est demandée **quatre fois, dont une annulée**. Déclarée non bloquante, non corrigée par ce lot.
- **Valeurs des délais non spécifiées.** La source dit « avec des délais » sans les chiffrer. Le dépôt en porte deux (une minute, dix minutes), qui n'ont pas été arbitrées.
- **Onglet jamais quitté.** Un écran d'accueil laissé visible en permanence ne se remettra jamais à jour : le catalogue affiché peut vieillir indéfiniment. La source ne dit pas si c'est acceptable.
- **Navigateur sans événement de visibilité** : la source est muette.
- **Preuve de la garde anti-emballement.** La revue a refusé comme preuve un test qui « échouait » en saturant le processeur. L'exigence est donc qu'un test démontre la garde sans dépendre d'une saturation.

## Hors périmètre

- La rafale de quatre appels à la reconnexion, nommée et laissée ouverte.
- Les avertissements de console, traités par `BCP-6`.
- Le renouvellement silencieux de session : le comportement attendu est le retour à l'écran de connexion, pas la prolongation.
- Le comportement équivalent côté atelier.

## Dépendances et décisions

- Mesure de recette du 16/09 : zéro appel au repos sur deux minutes et demie, une seule revalidation à l'expiration de session, reproduit deux fois. C'est la méthode de vérification attendue — le défaut n'était pas détectable par les tests.
- Ce lot illustre la limite nommée dans `Q-ARBITRAGES` : sans bibliothèque de test de rendu, un comportement de ce type ne se constate qu'en navigateur.

## Vérification

_Aucun cahier de tests Notion ne référence cette story._

## Preuves relevées dans le dépôt

`deliveryStatus: implemented` — 3 fichiers de code · 6 fichiers de test · 12 commits git · 1 story document BMAD avec signal d'implémentation.

Story documents BMAD (historique d'implémentation, non recopié) :

- `_bmad-output/implementation-artifacts/story-BCP-6b.md`

Fichiers de code :

- `src/modules/shop-customers/ui/hooks/useStorefrontSession.ts`
- `src/modules/shops/ui/hooks/usePublicShopCatalog.ts`
- `src/platform/api/fetch-api-client.ts`

Fichiers de test :

- `tests/architecture/storefront-catalog-access.test.ts`
- `tests/architecture/storefront-refresh-scheduling.test.ts`
- `tests/components/shop/StorefrontDelegationBanner.test.ts`
- `tests/hooks/usePublicShopCatalog.test.ts`
- `tests/hooks/useStorefrontSession.test.ts`
- `tests/platform/api/fetch-api-client.test.ts`

Commits : `8cb3ebf8`, `0e54e804`, `c165e751`, `ebee4eb1`, `6731d1fb`

## Questions ouvertes

- Les délais minimaux (une minute pour la session, dix minutes pour le catalogue) sont-ils les bonnes valeurs, et qui les arbitre ?
- La rafale de quatre appels à la reconnexion doit-elle faire l'objet d'une story, ou rester une dette acceptée ?
- Un écran d'accueil laissé visible en permanence ne se remet jamais à jour : faut-il un rafraîchissement au premier geste de l'acheteur, ou accepter un catalogue vieillissant ?
- Que lit l'acheteur au moment où sa session expire, et que devient son panier en cours ?
- Rattachement à une fonctionnalité produit à arbitrer (`FEAT-E10-UNCLASSIFIED` est un regroupement de migration).
- Relecture produit requise : contenu issu d'un import, non approuvé.
