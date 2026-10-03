---
id: FIX-GARDE
title: Correctif — La règle du panier d'Arnaud était neutralisable par un commentaire
epic: EPIC-E10
feature: FEAT-E10-UNCLASSIFIED
specStatus: contradictory
deliveryStatus: not-started
owner: unassigned
source:
  system: notion
  pageId: 3e1d0131973c81719f1be1344a341dd3
  url: https://app.notion.com/3e1d0131973c81719f1be1344a341dd3
  originalStatus: "Terminé"
  originalSprint: "Sprint 5 — Gestion commerciale"
  originalPriority: "P0"
  originalEffort: "S"
  originalAssignee: "Claude code"
  originalOffering: ""
  originalOrder: "28"
  originalSources: ""
  createdAt: "2026-09-20 07:41:30Z"
  lastEditedAt: "2026-09-20T07:41:00.000Z"
  importedAt: 2026-10-03
  archive: _archives-notion/2026-10-03/pages/FIX-GARDE.md
decisions: []
dependencies: []
supersedes: []
implementationRecords: []
---

# Correctif — La règle du panier d'Arnaud était neutralisable par un commentaire

## Provenance

Importée de Notion le 2026-10-03 depuis la base « 📋 Backlog Magrit — Sprint Board » ([page d'origine](https://app.notion.com/3e1d0131973c81719f1be1344a341dd3)). Le statut Notion `Terminé` est conservé comme provenance seule : il ne détermine pas `deliveryStatus`, établi plus bas à partir du dépôt. Le corps est repris de l'export sans reformulation.

## Besoin utilisateur

_Non formulé dans la source Notion._

## Un défaut vivant dans le code déjà fusionné

Le garde qui protège la règle d'Arnaud du 16/09 — « un produit non chiffré ne peut pas être ajouté tel quel » — était **contournable en ajoutant un commentaire**. Rejoué sur le code de la branche principale : la règle était neutralisée, **tout produit redevenait ajoutable au panier, chiffré ou non**, et les treize tests du garde restaient **verts**, compilateur silencieux.
L'origine était le durcissement posé par le coordinateur lui-même après la revue de Q14-a : il fermait la porte du code commenté en bloc et laissait celle du commentaire de fin de ligne.

## Six versions, cinq plus faibles que ce qu'elles annonçaient

Ce nettoyage de commentaires a été réécrit **six fois** dans le chantier. À chaque tour, la correction fermait la forme démontrée et en laissait une autre juste à côté. Deux de ces versions étaient du coordinateur.
La cinquième mérite d'être connue : passer du texte à une analyse du code était juste dans son principe, mais l'analyseur employé ne suivait pas le contexte des gabarits de chaîne. Sur un fichier réel, il a pris une fin de gabarit pour un début et **avalé 9 792 caractères** — tous les commentaires au-delà survivaient. **Ce défaut a été trouvé par le développeur de Q17-c**, qui a rejoué les vérifications au lieu de se fier au vert.
La réponse finale : le **parseur** TypeScript complet, pas le lexer.

## La vérification qui manquait

Tous les cas de test étaient **écrits à la main, donc courts**. La version fautive les passait **tous** et échouait sur un fichier de 50 ko. Le test exerce désormais **cinq vrais fichiers du dépôt**, avec un contrôle indépendant : une marque connue, injectée **à la fin**, doit disparaître — et la même marque hors commentaire doit survivre.

## Une cinquième copie, cassée aujourd'hui

Une copie oubliée **sur-nettoyait du code réel** : un chemin d'URL écrit dans un commentaire ouvrait un faux commentaire qui avalait treize lignes, invisibles pour une vérification d'architecture qui protège l'arbitrage d'Arnaud sur la table unique des libellés de statut.

## La limite, écrite et tenue par un test

Un garde textuel attrape la régression **accidentelle**, jamais l'évasion délibérée : la chaîne cherchée peut être replacée dans un attribut, où il n'y a rien à retirer.

## Critères d'acceptation

_Aucun critère d'acceptation explicite dans la source Notion au 2026-10-03. À écrire lors de la revue produit — rien n'a été déduit du code._

## Vérification

_Aucun cahier de tests Notion ne référence cette story._

## Preuves relevées dans le dépôt

`deliveryStatus: not-started` — aucune preuve trouvée après balayage du dépôt.

## Questions ouvertes

- Relecture produit requise : contenu importé, non approuvé.
- **Contradiction** : Notion déclare cette story « Terminé » alors que le balayage du dépôt ne trouve aucune preuve d'implémentation. Arbitrage attendu.
- Critères d'acceptation absents de la source.
- Rattachement à une fonctionnalité produit à arbitrer.
