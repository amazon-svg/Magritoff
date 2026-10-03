---
id: US-CONV-02
title: API copilote Studio (brief → product card → prix)
epic: EPIC-E5
feature: FEAT-E5-UNCLASSIFIED
specStatus: draft
deliveryStatus: not-started
owner: unassigned
source:
  system: notion
  pageId: 375d0131973c8118b58acb780b9bf04b
  url: https://app.notion.com/375d0131973c8118b58acb780b9bf04b
  originalStatus: "Pas commencé"
  originalSprint: "Backlog"
  originalPriority: "P0"
  originalEffort: ""
  originalAssignee: "Laurent"
  originalOffering: "Technique"
  originalOrder: ""
  originalSources: "WM 03/06/2026"
  createdAt: "2026-06-04 13:30:45Z"
  lastEditedAt: "2026-06-04T13:30:00.000Z"
  importedAt: 2026-10-03
  archive: _archives-notion/2026-10-03/pages/US-CONV-02.md
decisions: []
dependencies: []
supersedes: []
implementationRecords:
  - _bmad-output/implementation-artifacts/story-US-CONV-02.md
---

# US-CONV-02 — API copilote Studio (brief → product card → prix)

> Rend la chaîne « brief marketing → carte produit → prix » appelable comme une opération d'API, sans passer par la conversation, pour qu'un module tiers puisse s'y brancher.

## Valeur métier

Aujourd'hui, la capacité la plus différenciante de Magrit — transformer une intention commerciale en un produit print configuré et chiffré — n'est atteignable qu'en parlant à l'assistant dans son écran. Tant qu'elle reste enfermée là, elle n'est utilisable que par les utilisateurs de Magrit. Exposée comme opération d'API, elle devient un service que Studio, un CMS ou un ERP appelle depuis son propre parcours. C'est la différence entre vendre une application et vendre un moteur — et c'est ce que le partenaire attend pour brancher Studio. La story est marquée P0 par la source : elle conditionne l'intégration, pas une commodité.

## Besoin utilisateur

**En tant que** module tiers intégré à Magrit, **je veux** envoyer un brief et recevoir une carte produit tarifée en une seule opération, **afin de** ne pas avoir à reproduire la couche conversationnelle pour obtenir un chiffrage.

_La source Notion formulait une description, pas un besoin utilisateur ; celui-ci la reformule sans y ajouter d'exigence et reste à confirmer en revue produit._

## Comportement attendu

1. L'appelant envoie un brief exprimé en langage métier, sans vocabulaire d'atelier ni identifiants techniques.
2. Magrit en déduit une carte produit : un produit print identifié, assorti d'une configuration complète.
3. Cette carte est tarifée : elle porte un prix, et la nature de ce prix est indiquée.
4. Le tout revient en une seule réponse structurée, exploitable par un programme.
5. Aucune conversation n'est nécessaire : ni session de discussion, ni historique, ni échange de clarification.

## Expérience utilisateur

- L'utilisateur de cette story est un programme, mais l'expérience finale est celle de l'acheteur du module tiers : si l'opération met trente secondes, c'est son écran à lui qui attend. Le contrat doit donc dire ce que l'appelant peut afficher pendant ce temps, et sous quel délai il obtient au moins un accusé de prise en compte.
- Un brief qui ne permet pas de conclure doit produire une réponse exploitable — ce qui manque, ou ce qui a été supposé — et non un échec muet. Sans cela, l'intégrateur n'a d'autre choix que de rebasculer son utilisateur dans une conversation.
- La nature du prix rendu doit être lisible par le programme appelant, pas seulement par un humain : un prix estimé et un prix ferme n'autorisent pas les mêmes gestes en aval.
- **La source est muette** sur le délai attendu, sur le comportement en cas de brief insuffisant, et sur le format de la carte rendue.

## Règles métier

- `RM-01` — Une seule opération prend un brief en entrée et rend une carte produit tarifée en sortie.
- `RM-02` — L'opération fonctionne **hors de la couche conversationnelle** : elle n'exige ni session de discussion, ni historique, ni tour de clarification.
- `RM-03` — La carte rendue porte un produit identifié, une configuration complète et un prix.
- `RM-04` — La nature du prix rendu est portée explicitement par la réponse : un prix estimé et un prix issu d'un chiffrage réel ne se distinguent pas par leur valeur.
- `RM-05` — L'opération est décrite dans `openapi/magrit-core.v1.yaml` avant d'être ouverte, comme toute surface destinée à un tiers.

## Critères d'acceptation

- `AC-01` — Étant donné un brief exprimé en langage métier, quand il est envoyé à l'opération, alors la réponse porte un produit identifié, une configuration complète et un prix.
- `AC-02` — Étant donné ce même appel, quand on observe ce qu'il a exigé, alors aucune session de conversation n'a été ouverte et aucun historique n'a été transmis.
- `AC-03` — Étant donné une carte rendue, quand l'appelant lit le prix, alors il sait, par un champ de la réponse et non par interprétation, s'il s'agit d'une estimation ou d'un chiffrage réel.
- `AC-04` — Étant donné la configuration rendue, quand elle est soumise au chiffrage, alors elle est suffisante : aucune caractéristique obligatoire ne manque.
- `AC-05` — Étant donné un brief trop pauvre pour conclure, quand il est traité, alors la réponse dit ce qui manque ou ce qui a été supposé, et n'est pas un échec sans information (**la source est muette : comportement à arbitrer**).
- `AC-06` — Étant donné l'ouverture de cette opération, quand on consulte `openapi/magrit-core.v1.yaml`, alors elle y est décrite, avec son mode d'authentification et sa portée.

## Cas limites

- **Ce que le contrat couvre déjà, et dans quel sens.** `openapi/magrit-core.v1.yaml` publie une opération d'import d'un article Studio dans un projet Magrit, qui reçoit une carte produit complète : référence du produit, invite d'origine, configuration, et le prix obtenu (`POST /projects/{projectId}/hopstudio-items`). Autrement dit, **le sens Studio → Magrit est contractualisé ; le sens décrit par cette story, un brief envoyé à Magrit qui rend une carte tarifée, ne l'est pas.** Aucune opération du contrat ne prend un brief en entrée.
- **Le sens de la story n'est pas établi par la source.** « API dédiée au copilote Magrit Studio » peut se lire de deux façons : Magrit publie l'opération et Studio la consomme, ou Studio la publie et Magrit la consomme. Le dépôt contient les deux directions — l'import ci-dessus dans un sens, et des appels sortants de Magrit vers un serveur Studio dans l'autre. Tant que ce point n'est pas tranché, la story n'est pas implémentable, et c'est sa première question ouverte.
- **Les appels sortants existants ne sont pas au contrat.** Les deux portes par lesquelles Magrit s'adresse aujourd'hui à Studio — un relais de flux de travail et l'interception de l'assistant quand l'intégration est active pour un espace — ne figurent pas dans `openapi/magrit-core.v1.yaml`. Elles sont décrites dans le fichier déprécié, portent l'espace dans le chemin contre la règle en vigueur, rendent un corps brut sans enveloppe `{data, meta}`, et n'ont aucun test de contrat. `RM-05` n'est donc pas tenue pour l'existant.
- **Une clé de service ne peut rien faire de cette chaîne aujourd'hui.** L'import de carte est réservé aux jetons utilisateur. Les seules portées ouvertes à un module tiers sont des lectures, à une exception près. Un copilote Studio appelant avec sa propre clé ne peut donc ni créer de projet, ni y importer une carte, ni créer un devis.
- **Le vocabulaire du partenaire est entré dans la version 1 du contrat, et il ne pourra plus en sortir.** La commande d'import grave le format interne de Studio — noms de champs propres au fournisseur, objets ouverts sans schéma. La version 1 étant additive seulement, ces noms ne se retireront plus sans une version 2. L'architecte a recommandé de leur substituer une commande neutre **avant qu'un intégrateur ne les consomme** ; la décision n'est pas prise. Cette story est exactement l'occasion où elle se prend ou se perd.
- **Le prix transmis vient du navigateur.** Dans le sens déjà contractualisé, le prix de la carte importée est celui que le client transmet, non recalculé côté serveur. La question de savoir s'il peut faire foi est ouverte et portée aux arbitrages ; `RM-04` ne peut pas se définir sans elle.
- **Durée de l'opération.** L'interprétation d'une demande par le module tiers se compte en dizaines de secondes, avec un abandon à 50 secondes côté serveur. Une opération synchrone « brief → carte tarifée » hérite de cette durée. La source n'en dit rien.
- **Plusieurs produits pour un brief.** La source écrit « une carte », au singulier. Un brief large en produit plusieurs. Le comportement attendu n'est pas défini.

## Hors périmètre

- L'API de publication vers un CMS et son périmètre d'intégration généraliste (`E5.1`).
- Le module de pont utilisé en démonstration (`US-DEMO-01`), qui sollicite la même chaîne dans un cadre non contractuel.
- La couche conversationnelle elle-même et la qualité des propositions (epic `EPIC-E2`).
- Le moteur de chiffrage et la hiérarchie des sources de prix.
- La politique de plafonnement et la facturation des appels au fournisseur de chiffrage.

## Dépendances et décisions

- `ADR-2026-10-01-C4` — contrat d'API unique : cette opération, destinée à un tiers, relève de `openapi/magrit-core.v1.yaml` et de nulle part ailleurs.
- `PD-2026-10-01-B1` (recherche unifiée) — une seule barre combine recherche et prompt, avec une recherche vectorielle dans le référentiel produit, un rapprochement avec le catalogue fournisseur et un repli vers un modèle généraliste. C'est la même chaîne que celle décrite ici, vue depuis l'interface. Les deux doivent décrire le même comportement, ou dire pourquoi ils diffèrent.
- `PD-2026-10-01-B4` — le concept de prix marché est conservé : c'est lui qui donne son sens à `RM-04`.
- `ADR-2026-10-01-C1` — l'architecture cible n'utilise plus de fonctions Edge : les éléments de mise en œuvre serveur hérités de l'import sont périmés et ont été retirés.
- `E1.WM2` (POC d'intégration Studio par interface copilote) traite du même couplage. La source de cette story ne le cite pas : aucune dépendance n'a été déclarée en frontmatter.
- Origine : séance de travail du 03/06/2026.

## Vérification

_Aucun cahier de tests Notion ne référence cette story._

## Preuves relevées dans le dépôt

`deliveryStatus: not-started` — 1 story document BMAD sans signal d'implémentation.

Story documents BMAD (historique d'implémentation, non recopié) :

- `_bmad-output/implementation-artifacts/story-US-CONV-02.md`

## Questions ouvertes

- **Qui publie l'opération** : Magrit, pour que Studio l'appelle, ou Studio, pour que Magrit l'appelle ? Rien ne se décide tant que ce point n'est pas tranché, et c'est ce que le partenaire attend.
- Le vocabulaire de Studio déjà gravé dans la version 1 du contrat est-il remplacé par une commande neutre, maintenant qu'il est encore temps ? Après le premier intégrateur, il faudra une version 2.
- Une clé de service doit-elle pouvoir appeler cette chaîne, et avec quelle portée ? Aucune portée d'écriture n'est honorée aujourd'hui, hors changement d'étape de production.
- Le prix porté par une carte peut-il être celui que le client transmet, ou doit-il être recalculé par le serveur avant d'être opposable ?
- Un brief qui produit plusieurs produits rend-il plusieurs cartes, ou la meilleure ? La source parle d'une carte.
- Que rend l'opération quand le brief est insuffisant : un refus, des hypothèses déclarées, ou une demande de précision ?
- L'opération est-elle synchrone malgré une durée qui peut approcher la minute, ou rend-elle d'abord un accusé puis le résultat ?
- Critères d'acceptation absents de la source : ceux qui précèdent reformulent sa seule phrase d'exigence et restent à valider.
- Rattachement à une fonctionnalité produit à arbitrer (`FEAT-E5-UNCLASSIFIED` est un regroupement de migration).
- Relecture produit requise : contenu issu d'un import, non approuvé.
