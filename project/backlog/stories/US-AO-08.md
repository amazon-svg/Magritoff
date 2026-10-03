---
id: US-AO-08
title: Plugin Excel AO sur le store Microsoft
epic: EPIC-T08
feature: FEAT-T08-UNCLASSIFIED
specStatus: draft
deliveryStatus: not-started
owner: unassigned
source:
  system: notion
  pageId: 375d0131973c81aa968ce2bbdb36da2e
  url: https://app.notion.com/375d0131973c81aa968ce2bbdb36da2e
  originalStatus: "Pas commencé"
  originalSprint: "Backlog"
  originalPriority: "P1"
  originalEffort: ""
  originalAssignee: "Xavier"
  originalOffering: "Toutes"
  originalOrder: ""
  originalSources: "WM 03/06/2026"
  createdAt: "2026-06-04 13:30:45Z"
  lastEditedAt: "2026-06-04T13:30:00.000Z"
  importedAt: 2026-10-03
  archive: _archives-notion/2026-10-03/pages/US-AO-08.md
decisions: []
dependencies: []
supersedes: []
implementationRecords:
  - _bmad-output/implementation-artifacts/story-US-AO-08.md
---

# US-AO-08 — Plugin Excel AO sur le store Microsoft

> Publie le module Excel existant sur le store Microsoft, pour que l'utilisateur obtienne un prix Clariprint sans quitter son tableur.

## Valeur métier

Les appels d'offres print vivent dans Excel et continueront d'y vivre. Demander à l'utilisateur de quitter son fichier pour obtenir un prix est un frein à chaque ligne ; le lui donner dans sa feuille supprime le frein. La source décrit un module déjà existant — « clé → calcul serveur Clariprint » : il ne s'agit pas de le construire mais de le **distribuer**. Passer par le store Microsoft change la nature de la distribution : installation en un clic, mise à jour automatique, présence dans un catalogue où les acheteurs cherchent, et une légitimité que n'a pas un fichier envoyé par email.

La source signale que **des prérequis administratifs Microsoft restent à lever** : c'est le vrai travail, et il n'est pas technique.

## Besoin utilisateur

_Non formulé dans la source Notion._ L'utilisateur visé est celui qui travaille son AO dans un tableur et veut un prix sur place. Formulation à écrire en revue produit.

## Comportement attendu

1. Le module Excel AO existant — saisie d'une clé, calcul par le serveur Clariprint — est publié sur le store Microsoft.
2. Il s'installe depuis le store.
3. Une fois installé, il calcule des prix.
4. Il fonctionne sur les plateformes citées par la source : Mac, PC, web, Microsoft 365, tablette.

**La source est muette** sur l'authentification de l'utilisateur, sur le rattachement de son usage à un compte Magrit, sur la gestion des versions, et sur ce qui est calculé exactement (prix unitaire, prix de ligne, chiffrage complet).

## Expérience utilisateur

- L'intérêt du complément tient à une chose : ne pas sortir du fichier. Chaque aller-retour vers le navigateur annule le bénéfice.
- L'utilisateur du complément n'est pas nécessairement un utilisateur de Magrit : la première ouverture doit expliquer à quoi il a affaire et ce qu'il lui faut pour s'en servir.
- Un calcul distant dans un tableur est une attente invisible : une cellule qui ne se remplit pas est lue comme une erreur. L'état d'attente et l'erreur doivent être explicites dans la feuille.
- Cinq plateformes, c'est cinq rendus et cinq jeux de contraintes. Un complément lisible sur PC peut être inutilisable sur tablette.
- **La source est muette** sur l'ergonomie du complément, sur la gestion de la clé et sur l'accessibilité.

## Règles métier

- `RM-01` — Le complément est publié sur le store Microsoft et installable depuis celui-ci.
- `RM-02` — Une fois installé, il produit un calcul de prix opérationnel adossé au serveur Clariprint.
- `RM-03` — Il fonctionne sur Mac, PC, web, Microsoft 365 et tablette.
- `RM-04` — L'accès au calcul est conditionné à une clé, mécanisme déjà en place dans le module existant.

## Critères d'acceptation

- `AC-01` — Étant donné le store Microsoft, quand un utilisateur y recherche le complément et l'installe, alors le complément apparaît dans son tableur.
- `AC-02` — Étant donné le complément installé et une clé valide, quand l'utilisateur demande un prix, alors un prix issu du serveur Clariprint est restitué dans la feuille.
- `AC-03` — Étant donné les cinq plateformes citées, quand le complément y est installé, alors le calcul de prix fonctionne sur chacune (**la source énumère les plateformes sans fixer de versions minimales**).
- `AC-04` — Étant donné une clé absente, expirée ou invalide, quand l'utilisateur demande un prix, alors il reçoit un message explicite et aucun prix n'est calculé (**cas non traité par la source ; posé ici au titre de l'exploitabilité, à confirmer**).

## Cas limites

- **Prérequis administratifs Microsoft** : compte éditeur, validation de l'éditeur, revue de publication, conformité des politiques du store. La source les signale sans les détailler. Ils conditionnent la date de livraison bien plus que le code.
- **Clé partagée ou diffusée** : le module repose sur une clé. Rien n'est dit de sa révocation, ni du plafond d'usage associé.
- **Hors ligne** : un complément qui appelle un serveur ne fonctionne pas sans réseau. Le comportement attendu n'est pas défini.
- **Volume** : un utilisateur qui étire une formule sur 500 lignes déclenche 500 appels. Aucun plafond, aucun traitement par lot n'est prévu.
- **Version du module existant** : la source dit « module Excel AO existant » sans dire où il est, ni dans quel état. Il n'est pas dans ce dépôt.
- **Politique du store** : un complément qui envoie des données à un serveur tiers est soumis à des exigences de confidentialité et de mentions légales que la source n'évoque pas.

## Hors périmètre

- La chaîne d'ingestion, de normalisation et de restitution des fichiers AO (`US-AO-06`, `US-AO-07`, `T08.N1` à `T08.N14`).
- Le module AO dans l'application Magrit (`T08.A1` à `T08.A5`, `T08.WM1`).
- La commercialisation et les paliers (`T08.WM4`).
- Le développement du module Excel lui-même : la source le dit existant, cette story porte sa publication.

## Dépendances et décisions

- Aucune dépendance déclarée par la source ; le frontmatter reste vide.
- **Le module Excel cité comme existant n'est pas dans ce dépôt.** Aucun complément Office, aucun manifeste de complément, aucun code de passerelle Excel n'y figure. Sa localisation, son auteur et son état de fonctionnement sont un préalable : sans lui, cette story n'a pas d'objet.
- `US-DEMO-01` (module JS pont API « prix réel Clariprint ») décrit un dispositif voisin : un petit module qui appelle une API et renvoie un prix. Savoir si les deux partagent la même passerelle de calcul est à vérifier.
- `ADR-2026-10-01-C4` (contrat d'API unique) s'applique : si le complément appelle un service de calcul, il doit passer par ce contrat et non par un chemin dédié.
- Les prérequis administratifs Microsoft ne sont pas un sujet de développement et n'ont pas de responsable identifié dans la source.
- Référence de provenance conservée : WM#030626, réf. 00:54:49.

## Vérification

_Aucun cahier de tests Notion ne référence cette story._

## Preuves relevées dans le dépôt

`deliveryStatus: not-started` — 1 story document BMAD sans signal d'implémentation.

Story documents BMAD (historique d'implémentation, non recopié) :

- `_bmad-output/implementation-artifacts/story-US-AO-08.md`

## Questions ouvertes

- Où se trouve le module Excel « existant », qui le maintient, et dans quel état est-il ?
- Quels sont précisément les prérequis administratifs Microsoft, qui les porte, et dans quel délai ?
- Comment l'utilisateur s'authentifie-t-il : clé saisie, compte Magrit, ou les deux ? Comment une clé est-elle révoquée ?
- L'usage depuis le complément est-il décompté sur l'abonnement du client, et avec quel plafond ?
- Que calcule exactement le complément : un prix unitaire, une ligne, un chiffrage complet ?
- Quel comportement hors ligne, et quel comportement sur un grand nombre de cellules ?
- Quelles versions minimales d'Excel sont supportées sur chacune des cinq plateformes ?
- Quelles mentions de confidentialité le store exige-t-il pour un complément qui transmet des données à un serveur tiers ?
- Le complément utilise-t-il la même passerelle de calcul que `US-DEMO-01` ?
- Rattachement à une fonctionnalité produit à arbitrer (`FEAT-T08-UNCLASSIFIED` est un regroupement de migration).
- Relecture produit requise : contenu issu d'un import, non approuvé.
