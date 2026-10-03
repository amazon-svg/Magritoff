---
id: US-DEMO-01
title: Module JS pont API « prix réel Clariprint »
epic: EPIC-E5
feature: FEAT-E5-UNCLASSIFIED
specStatus: draft
deliveryStatus: not-started
owner: unassigned
source:
  system: notion
  pageId: 375d0131973c810eae6bed40bca66d67
  url: https://app.notion.com/375d0131973c810eae6bed40bca66d67
  originalStatus: "Pas commencé"
  originalSprint: "Backlog"
  originalPriority: "P1"
  originalEffort: ""
  originalAssignee: "Laurent"
  originalOffering: "Technique"
  originalOrder: ""
  originalSources: "WM 03/06/2026"
  createdAt: "2026-06-04 13:30:45Z"
  lastEditedAt: "2026-06-04T13:30:00.000Z"
  importedAt: 2026-10-03
  archive: _archives-notion/2026-10-03/pages/US-DEMO-01.md
decisions: []
dependencies: []
supersedes: []
implementationRecords:
  - _bmad-output/implementation-artifacts/story-US-DEMO-01.md
---

# US-DEMO-01 — Module JS pont API « prix réel Clariprint »

> Donne à une démonstration un prix fournisseur véritable plutôt qu'une estimation : le descriptif d'une carte produit part vers Studio, un prix revient.

## Valeur métier

En démonstration, un prix estimé se voit. L'interlocuteur est imprimeur : il sait ce que coûte ce qu'il regarde, et un chiffre approximatif discrédite tout le reste de la présentation. Montrer un prix réellement calculé par le fournisseur change la nature de la démonstration — on ne montre plus une maquette qui simule un chiffrage, on montre un produit qui chiffre. Le besoin était daté et tactique : disposer de ce pont pour une échéance précise, sans attendre l'intégration complète.

## Besoin utilisateur

**En tant que** présentateur d'une démonstration Magrit, **je veux** qu'un descriptif de carte produit rende un prix fournisseur réel, **afin de** montrer un chiffrage véritable et non une estimation.

_La source Notion formulait une description, pas un besoin utilisateur ; celui-ci la reformule sans y ajouter d'exigence et reste à confirmer en revue produit._

## Comportement attendu

1. Une carte produit porte un descriptif, formulé comme une demande en langage libre.
2. Ce descriptif est transmis à l'API Studio.
3. Studio rend un prix, sous une forme structurée exploitable par un programme.
4. Ce prix est affiché à la place de l'estimation, et il est exploitable tel quel pendant la démonstration.

## Expérience utilisateur

- **Le point de perception décisif est le délai.** Le chemin passe par un service tiers, qui lui-même interroge le fournisseur : l'attente se compte en dizaines de secondes. Une démonstration qui affiche un prix réel au bout de trente secondes de silence perd ce qu'elle gagne en crédibilité. Ce que l'écran montre pendant ce temps est traité par `US-DEMO-02`, mais c'est cette story qui crée l'attente.
- Un échec doit se voir immédiatement et se rattraper : le présentateur doit pouvoir retomber sur l'estimation plutôt que rester sans prix.
- Le prix affiché doit être reconnaissable comme un prix fournisseur réel, sinon la démonstration ne prouve rien.
- **La source est muette** sur le délai acceptable, sur le repli en cas d'échec, et sur ce qui distingue à l'écran un prix réel d'une estimation.

## Règles métier

- `RM-01` — L'entrée du pont est le descriptif d'une carte produit, exprimé en langage libre.
- `RM-02` — La sortie est un prix, rendu sous une forme structurée exploitable par un programme.
- `RM-03` — Le prix obtenu est un prix fournisseur réel, pas une estimation.
- `RM-04` — Le pont est un dispositif de démonstration. Il n'est pas, en l'état, une surface d'intégration contractuelle.

## Critères d'acceptation

- `AC-01` — Étant donné le descriptif d'une carte produit, quand il est transmis au pont, alors un prix est rendu sous forme structurée.
- `AC-02` — Étant donné ce prix, quand on en vérifie l'origine, alors il provient du fournisseur et non de l'estimation interne.
- `AC-03` — Étant donné une démonstration jouée de bout en bout, quand le prix est affiché, alors il est exploitable tel quel : aucune reprise manuelle n'est nécessaire.
- `AC-04` — Étant donné un appel qui échoue, quand l'échec survient, alors le présentateur dispose d'un repli et n'est pas laissé sans prix (**la source est muette : comportement à arbitrer**).

## Cas limites

- **Le pont décrit par la source existe, et il dépasse largement le cadre d'une démonstration.** Le dépôt porte un module d'intégration Studio complet : réglage par espace de l'adresse du serveur Studio et des identifiants fournisseur, relais de flux de travail, interception de l'assistant quand l'intégration est active, chiffrement des secrets en base, écran d'administration réservé au rôle administrateur. Ce n'est plus un « petit module JS » : c'est un second chemin de chiffrage, en service sur la surface atelier. La story doit être relue à la lumière de ce qui a été construit, pas de ce qui était demandé.
- **Ce second chemin est hors des garde-fous posés pour le premier.** Magrit n'appelle pas le fournisseur sur ce chemin : il relaie vers un serveur tiers, en lui transmettant les identifiants fournisseur de l'espace. Le relais est intercepté avant la façade applicative — donc avant le routage, l'idempotence et le limiteur de débit. Aucun plafond ne s'y applique, ni en nombre d'appels, ni en dépense, alors que le chemin de plateforme, lui, est plafonné. Ce que coûte un appel sur un compte d'espace, et à qui, n'est écrit nulle part.
- **La destination est réglable par l'utilisateur.** L'adresse du serveur Studio est un champ de configuration d'espace. Un espace peut donc faire de Magrit un relais sortant vers une destination de son choix, à laquelle Magrit transmet des identifiants. L'admission d'adresses non chiffrées pour un canal qui transporte un mot de passe est une question ouverte portée aux arbitrages.
- **L'adresse de référence est confirmée mais son statut ne l'est pas.** Le serveur retenu est une instance de test, sans identifiant ni mot de passe à régler côté fournisseur. Savoir s'il s'agit d'une instance facturée, et qui paie les appels qu'elle relaie, reste ouvert.
- **Ces portes ne sont pas au contrat.** Elles ne figurent pas dans `openapi/magrit-core.v1.yaml`, portent l'espace dans le chemin contre la règle en vigueur, rendent un corps brut sans enveloppe, et n'ont aucun test de contrat. Tant que `RM-04` tient — c'est un dispositif de démonstration — l'écart est assumable ; dès qu'un partenaire s'y branche, il ne l'est plus.
- **La réponse du tiers est rendue telle quelle au navigateur**, sans filtrage. Sur la surface atelier, où l'utilisateur consulte son propre compte, c'est le comportement voulu par le gabarit ; cela n'en fait pas un comportement transposable à une surface ouverte.
- **Un ordre de déploiement contraignant est attaché à ce chemin.** Tant que le réglage par espace n'est pas en place sur l'environnement visé, l'assistant de l'atelier tombe en erreur pour **tous** les espaces, que l'intégration soit activée ou non. Ce n'est pas un détail d'exploitation : c'est une condition de mise en service.
- **L'échéance de la source est passée.** La livraison était visée au 04/06/2026 pour une démonstration précise. La story reste ouverte six mois plus tard, alors que la capacité existe : son objet doit être requalifié ou la story close.

## Hors périmètre

- La contractualisation de l'intégration Studio et de la chaîne brief → carte → prix (`US-CONV-02`).
- Ce que l'écran montre pendant l'attente du prix (`US-DEMO-02`).
- Le chemin de chiffrage de plateforme et son limiteur de débit.
- La hiérarchie des sources de prix et le repli sur le prix marché.
- La politique de plafonnement des appels sur un compte fournisseur d'espace, qui contraint cette story sans lui appartenir.

## Dépendances et décisions

- La source ne déclare aucune dépendance. Les recoupements relevés avec `US-CONV-02` et `US-DEMO-02` ne sont pas reportés en frontmatter : la source ne les formule pas.
- `ADR-2026-10-01-C4` — contrat d'API unique. Le jour où ce pont cesse d'être un dispositif de démonstration, il relève de `openapi/magrit-core.v1.yaml` : c'est précisément l'objet de `RM-04`.
- `PD-2026-10-01-B4` — le concept de prix marché est conservé : c'est le prix de repli que ce pont est censé remplacer en démonstration.
- `ADR-2026-10-01-C1` — l'architecture cible n'utilise plus de fonctions Edge : les éléments de mise en œuvre serveur hérités de l'import sont périmés et ont été retirés.
- Origine : séance de travail du 03/06/2026, livraison visée au 04/06/2026.

## Vérification

_Aucun cahier de tests Notion ne référence cette story._

## Preuves relevées dans le dépôt

`deliveryStatus: not-started` — 1 story document BMAD sans signal d'implémentation.

Story documents BMAD (historique d'implémentation, non recopié) :

- `_bmad-output/implementation-artifacts/story-US-DEMO-01.md`

## Questions ouvertes

- La story est-elle close par ce qui a été construit, ou son périmètre est-il requalifié ? En l'état, elle décrit un prototype pour une démonstration passée, alors que le dépôt porte une intégration en service.
- Qui paie les appels passés sur un compte fournisseur d'espace, et faut-il un plafond par espace ? Sans plafond, tout membre d'un espace peut solliciter sans borne deux factures que Magrit ne mesure pas.
- Une adresse de serveur non chiffrée reste-t-elle admise pour un canal qui transporte un mot de passe ?
- L'instance de test retenue est-elle facturée, et par qui ? La réponse change la nature du dispositif.
- Ce chemin reste-t-il hors contrat, ou est-il décrit dans `openapi/magrit-core.v1.yaml` avec enveloppe et espace résolu depuis le jeton ? La réponse dépend de la décision prise sur `US-CONV-02`.
- Que voit le présentateur si l'appel échoue pendant la démonstration, et peut-il retomber sur l'estimation ?
- Critères d'acceptation absents de la source : ceux qui précèdent reformulent sa seule phrase d'exigence et restent à valider.
- Rattachement à une fonctionnalité produit à arbitrer (`FEAT-E5-UNCLASSIFIED` est un regroupement de migration).
- Relecture produit requise : contenu issu d'un import, non approuvé.
