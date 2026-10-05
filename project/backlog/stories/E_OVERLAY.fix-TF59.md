---
id: E_OVERLAY.fix-TF59
title: E_OVERLAY.fix-TF59 — Réinitialisation overlay boutique + premier POST clariprint-quote
epic: EPIC-E1
feature: FEAT-E1-UNCLASSIFIED
specStatus: draft
deliveryStatus: not-started
owner: unassigned
source:
  system: notion
  pageId: 35dd0131973c8173b80ddae083c04f1c
  url: https://app.notion.com/35dd0131973c8173b80ddae083c04f1c
  originalStatus: "Pas commencé"
  originalSprint: "Sprint 4"
  originalPriority: "P0"
  originalEffort: "M"
  originalAssignee: "Claude code"
  originalOffering: "Toutes"
  originalOrder: ""
  originalSources: "Cas de test KO"
  createdAt: "2026-05-11 09:01:45Z"
  lastEditedAt: "2026-05-11T09:01:00.000Z"
  importedAt: 2026-10-03
  archive: _archives-notion/2026-10-03/pages/E_OVERLAY.fix-TF59.md
decisions:
  - PD-2026-10-01-B3
dependencies:
  - E_ROOT.fix-PublicShop-hooks
supersedes: []
implementationRecords:
  - _bmad-output/implementation-artifacts/story-E_OVERLAY.fix-TF59.md
---

# E_OVERLAY.fix-TF59 — Réinitialisation overlay boutique + premier POST clariprint-quote

> Fait que le panneau de configuration d'une boutique s'ouvre déjà rempli et déjà chiffré, au lieu de s'ouvrir vide avec une erreur réseau que rien n'a provoquée.

## Valeur métier

Le panneau de configuration est le dernier écran avant la mise au panier : c'est là que l'acheteur choisit son papier, sa finition, sa quantité, et qu'il voit ce que ça coûte. S'il s'ouvre à zéro euro avec un bandeau d'erreur, il ne se corrige pas tout seul — l'acheteur referme et s'en va. Le coût n'est pas celui d'un défaut d'affichage, c'est celui d'une commande perdue au point exact où elle allait se conclure. Et l'erreur affichée est fausse : aucun appel n'a échoué, parce qu'aucun appel n'a été fait. Afficher une panne inexistante entame la confiance dans tout ce que l'écran annonce par ailleurs, prix compris.

## Défaut constaté

Relevé lors de la campagne de tests fonctionnels du Sprint 3, le 11/05/2026, cas TF-59 marqué KO en priorité la plus haute.

Sur une boutique de pilote, vue Catalogue, l'acheteur ouvre le panneau de configuration d'un produit. La structure du panneau apparaît correctement, mais :

1. une option de finition verso attendue est absente de l'écran ;
2. aucune liste déroulante n'est positionnée : toutes sont vides, et chacune restitue l'ensemble de ses choix concaténés au lieu d'une valeur sélectionnée ;
3. le prix affiché est « 0,00 € HT / 0,00 € TTC » ;
4. un bandeau d'erreur « Erreur réseau — réessayez » est visible dès l'ouverture, avant toute action de l'acheteur ;
5. côté réseau, seule la requête préalable de vérification est émise ; **aucune demande de chiffrage ne suit**.

Le point 5 explique les points 3 et 4 : le prix est à zéro parce que rien n'a été demandé, et le bandeau d'erreur annonce une panne qui n'a pas eu lieu.

La cause racine identifiée à l'époque est une violation des règles d'appel des fonctions à état dans l'écran de boutique publique, traitée par la story prérequis déclarée en frontmatter. Un correctif intermédiaire pouvait suffire à la lever : rejouer TF-59 sur l'état courant du dépôt est la première action de cette story, avant toute écriture.

## Besoin utilisateur

**En tant qu'**acheteur d'une boutique, **je veux** que le panneau de configuration s'ouvre avec mes options déjà renseignées et un prix déjà calculé, **afin de** voir immédiatement ce que coûte le produit sans avoir à deviner ce qui s'est mal passé.

## Comportement attendu

1. À l'ouverture du panneau, chaque option est positionnée sur la valeur issue de la configuration du produit — pas vide, pas sur un choix arbitraire.
2. Dans la foulée de l'ouverture, une demande de chiffrage est émise automatiquement avec ces options, sans action de l'acheteur.
3. Le prix hors taxes et toutes taxes comprises s'affiche dès la réponse, strictement positif quand le chiffrage aboutit.
4. L'option de finition verso n'apparaît que lorsque l'impression choisie est recto verso. Elle est absente le reste du temps, et c'est normal.
5. Chaque modification d'option relance un chiffrage, sans en lancer un par frappe : les modifications rapprochées sont regroupées.
6. En cas d'échec réseau, un bandeau d'erreur et un bouton de nouvelle tentative apparaissent, **et le dernier prix connu reste affiché** — l'acheteur ne retombe pas à zéro.
7. Une nouvelle tentative réussie fait disparaître le bandeau et met le prix à jour.
8. Un bandeau d'erreur ne s'affiche jamais en l'absence d'échec réel.

## Expérience utilisateur

- Le panneau s'ouvre dans un état utilisable, pas dans un état à réparer. L'acheteur ne doit avoir rien à faire pour voir un prix.
- L'attente du premier chiffrage est signalée, mais elle ne remplace pas le contenu : le panneau reste lisible pendant le calcul, et n'affiche jamais un chargement sans fin.
- Perdre le prix pendant une coupure réseau est pire que l'afficher légèrement périmé : le dernier montant connu est conservé, le bandeau explique que la mise à jour n'a pas abouti.
- La disparition de l'option de finition verso en impression recto seul n'est pas une anomalie à masquer : c'est un choix qui simplifie l'écran et qui doit se lire comme tel.

## Règles métier

- `RM-01` — À l'ouverture, les options du panneau sont initialisées depuis la configuration du produit.
- `RM-02` — Un premier chiffrage est déclenché automatiquement à l'ouverture, sans action de l'acheteur.
- `RM-03` — L'option de finition verso n'est proposée que lorsque l'impression sélectionnée est recto verso.
- `RM-04` — Les modifications d'options rapprochées sont regroupées avant d'être chiffrées, et un chiffrage en cours rendu caduc par une modification plus récente est abandonné.
- `RM-05` — Tout chiffrage passe par le port `ClariprintAdapter`. Aucun appel réseau direct vers Clariprint depuis un composant d'interface.
- `RM-06` — Toute réponse est soumise à `validateClariprintResponse()` avant affichage : prix négatif, valeur non numérique et champ `undefined` sont écartés.
- `RM-07` — Le prix affiché est résolu par `resolvePrice()` selon la hiérarchie `clariprint > library_cached > prix_marche > zero`.
- `RM-08` — En cas d'échec, le dernier prix connu est conservé à l'écran, accompagné d'un bandeau et d'une possibilité de nouvelle tentative.
- `RM-09` — Un bandeau d'erreur n'est affiché que si un échec a réellement eu lieu.
- `RM-10` — Le recalcul en direct est gouverné par un interrupteur de fonctionnalité : quand il est fermé, ni le chiffrage d'ouverture ni le recalcul sur modification ne sont déclenchés.

## Critères d'acceptation

- `AC-01` — Étant donné un produit de boutique dont la configuration est renseignée, quand l'acheteur ouvre le panneau de configuration, alors chaque option affichée porte la valeur issue de cette configuration, et aucune n'est vide.
- `AC-02` — Étant donné le panneau qui vient de s'ouvrir, quand on observe les échanges réseau, alors une demande de chiffrage portant les options initiales est émise, et le délai entre l'ouverture et cette demande est inférieur à 300 ms.
- `AC-03` — Étant donné une réponse de chiffrage valide, quand le prix s'affiche, alors les montants hors taxes et toutes taxes comprises sont strictement positifs et cohérents avec la réponse validée.
- `AC-04` — Étant donné une impression réglée sur recto seul, quand l'acheteur bascule sur recto verso, alors l'option de finition verso apparaît ; quand il revient sur recto seul, elle disparaît.
- `AC-05` — Étant donné un prix affiché et un réseau devenu indisponible, quand l'acheteur modifie une option, alors un bandeau d'erreur et un bouton de nouvelle tentative apparaissent **et le prix précédent reste affiché**.
- `AC-06` — Étant donné ce bandeau et le réseau rétabli, quand l'acheteur relance la tentative et que le chiffrage aboutit, alors le bandeau disparaît et le prix est mis à jour.
- `AC-07` — Étant donné l'interrupteur de recalcul en direct fermé, quand le panneau s'ouvre, alors aucun chiffrage n'est déclenché, ni à l'ouverture ni sur modification d'option.
- `AC-08` — Étant donné le panneau ouvert sans qu'aucun échec ne soit survenu, quand on inspecte l'écran, alors aucun bandeau d'erreur n'est présent.
- `AC-09` — Étant donné le cas de test TF-59, quand il est rejoué, alors il passe au statut OK, et le cas équivalent côté atelier reste OK.

## Cas limites

- **Combien d'options exactement ?** Le relevé compte « 6 options présentes sur 7 attendues ». Le panneau en place documente **6 listes déroulantes** — format, papier, finition recto, finition verso, impression, dorure — plus une saisie de quantité qui n'est pas une liste déroulante. La septième option attendue par le cas de test est donc probablement la quantité, comptée avec les autres. L'écart de comptage est à lever avant de rejouer le cas, sans quoi il échouera pour une raison qui n'est pas un défaut.
- **L'absence de finition verso est aujourd'hui délibérée.** Le panneau ne rend cette option que lorsque l'impression vaut recto verso. La question posée par la source — conditionnel volontaire ou régression — est donc tranchée côté code : c'est un conditionnel assumé. Reste à confirmer que c'est bien le comportement produit voulu, et à corriger le cas de test en conséquence plutôt que le composant.
- **Point d'entrée périmé.** Le relevé décrit un appel vers une fonction serveur hébergée qui n'existe plus : l'architecture cible ne comporte plus de fonctions de ce type, et le chiffrage passe désormais par la route de chiffrage du projet. Le cas de test doit être réécrit sur le point d'entrée actuel, sans quoi il observera un échange qui ne se produira jamais.
- **Produit requis manquant.** Cette anomalie ne doit pas se replier sur un prix marché : un produit obligatoire absent rend le devis faux, pas imprécis. Le comportement en place bloque l'ajout au panier dans ce cas. La source de TF-59 ne traite pas ce cas.
- **Ouverture et fermeture rapides.** Un panneau ouvert puis refermé avant la réponse du chiffrage ne doit pas écrire dans un écran disparu. Le regroupement des demandes et l'abandon des chiffrages caducs couvrent ce cas, qui reste à vérifier.

## Hors périmètre

- La cause racine dans l'écran de boutique publique, portée par la story prérequis déclarée en frontmatter.
- Le panneau de configuration côté atelier, qui sert ici de référence de non-régression et n'est pas modifié.
- Le calcul du prix marché et la hiérarchie de résolution eux-mêmes.
- L'instrumentation pour l'automatisation des tests : les repères nécessaires existent déjà, aucun ajout n'est demandé.

## Dépendances et décisions

- `E_ROOT.fix-PublicShop-hooks` — **prérequis absolu**, déclaré en frontmatter. La source précise que si TF-59 passe au vert après ce seul correctif, la présente story se réduit à deux choses : couvrir par un test l'initialisation des options, et instruire la question de la finition verso.
- Aucune dépendance au moteur Clariprint : la voie de chiffrage était opérationnelle au moment du relevé, le cas équivalent côté atelier étant au vert.
- `PD-2026-10-01-B3` (sous-traitance) — déclarée en frontmatter.
- `PD-2026-10-01-B1` (recherche unifiée) — **cette story est touchée de façon indirecte**. La décision fait de l'origine de la donnée une métadonnée de la carte produit ; le panneau de configuration est l'écran qui affiche le prix issu de cette carte. L'articulation n'est pas tranchée ici et la propagation ne relève pas de cette passe.
- `ADR-2026-10-01-C1` — l'architecture cible n'utilise plus de fonctions Edge. Le point d'entrée décrit par le relevé d'origine est périmé et a été retiré ; les éléments de mise en œuvre serveur hérités de l'import ont été retirés avec lui.

## Vérification

_Aucun cahier de tests Notion ne référence cette story._

## Preuves relevées dans le dépôt

`deliveryStatus: not-started` — 1 story document BMAD sans signal d'implémentation.

Story documents BMAD (historique d'implémentation, non recopié) :

- `_bmad-output/implementation-artifacts/story-E_OVERLAY.fix-TF59.md`

## Questions ouvertes

- **Le défaut est-il encore là ?** Le dépôt comporte aujourd'hui l'initialisation des options depuis la configuration du produit, le chiffrage d'ouverture, le regroupement des modifications à 300 ms, l'abandon des chiffrages caducs, le repli sur prix marché avec bandeau et nouvelle tentative, et le conditionnement de la finition verso. L'interrupteur de recalcul en direct est ouvert. Rejouer TF-59 sur l'état courant est la première action : la story peut se révéler sans objet.
- Sept options ou six listes déroulantes plus une quantité ? Le cas de test et le composant ne comptent pas la même chose.
- Le conditionnement de la finition verso à l'impression recto verso est-il le comportement produit voulu ? Si oui, c'est le cas de test qu'il faut corriger, pas le composant.
- Les 300 ms de l'`AC-02` se mesurent-ils jusqu'à l'émission de la demande ou jusqu'à la réception de la réponse ? La source dit « après mount » sans le préciser.
- Que voit l'acheteur quand un produit requis manque : le panneau reste-t-il ouvert, et l'ajout au panier est-il bloqué avec une explication ?
- Le cas de test doit être réécrit sur le point d'entrée actuel. Qui le met à jour, et quand ?
- Rattachement à une fonctionnalité produit à arbitrer (`FEAT-E1-UNCLASSIFIED` est un regroupement de migration).
- Relecture produit requise : contenu issu d'un import, non approuvé.
