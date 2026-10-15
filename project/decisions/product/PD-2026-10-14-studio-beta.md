---
id: PD-2026-10-14-STUDIO-BETA
title: Priorité Studio pour la bêta avancée
date: 2026-10-14
documentStatus: draft
decisionStatus: proposed
source: MEET-CR-WM14102026-MAGRIT-IA
owners:
  - Xavier Péchoultres
  - Arnaud Mazon
supersedes: []
affectedArtifacts:
  - project/backlog/stories/E1.WM1.md
  - project/prd/product-scope.md
---

# Priorité Studio pour la bêta avancée

## Contexte

Orientations du [WM du 14 octobre](../../meetings/2026/CR_WM14102026_Magrit_IA.md), §3, préparées pour approbation. « Studio » désigne ici Clariprint Studio/HopeStudio, distinct du sujet de création de contenus « Magrit Studio ».

## Orientations à approuver

- Priorité à l’intégration de Studio jusqu’aux boutiques (chat, formulaires, prix), portée par Xavier Péchoultres et Laurent Rebière, cible semaine du 19 octobre 2026. La chaîne complète doit ensuite être testée par Arnaud Mazon et par les agents, avec recette humaine tant que la chaîne n’est pas éprouvée.
- Studio est une bibliothèque d’interface chargée dans Magrit et configurée par ses points de lecture et d’enregistrement. Studio porte description, formulaires, chat et calcul HT ; Magrit porte la gestion commerciale et la réception des lignes. Cette orientation ne modifie pas à elle seule les contrats techniques existants.
- Conserver l’usage du POC : rappel d’un résultat de prompt, historique visible et choix des produits rattachés à un projet. Un prompt peut produire plusieurs produits, dont une sélection seulement va au projet. Mettre l’existant à disposition pour test avant de conclure à une couverture ou de créer une story supplémentaire.
- La bêta vise la production de prix, y compris les prix de marché ou des parcs déjà décrits dans Clariprint, et la gestion commerciale. L’interface de description des parcs dans Magrit (Clariprint Data) constitue une seconde phase.

## Vérifications et questions restantes

Rapprocher E1.WM1, E1.WM2, E1.WM3, E4.1 et E4.2 ; les parcours validés le 5 octobre restent acquis. Les questions OQ-HS-PIM-FORM, OQ-HS-SHOP-CHAT et OQ-HS-MARGINS restent ouvertes pour les détails que la séance ne tranche pas. La cible de semaine et l’avancement déclaré ne constituent ni une preuve de livraison ni une sélection de sprint approuvée.
