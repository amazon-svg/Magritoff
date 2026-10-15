---
id: PD-2026-10-14-LOTS-LIVRAISON
title: Lots issus d’un calcul Studio et livraison des devis
date: 2026-10-14
documentStatus: draft
decisionStatus: proposed
source: MEET-CR-WM14102026-MAGRIT-IA
owners:
  - Arnaud Mazon
  - Xavier Péchoultres
supersedes: []
affectedArtifacts:
  - project/backlog/stories/E10.23.md
  - project/backlog/stories/E10.25.md
  - project/backlog/stories/E10.26.md
  - project/decisions/open-questions.md
  - project/prd/domains/gestion-commerciale.md
---

# Lots issus d’un calcul Studio et livraison des devis

## Contexte et statut

Transcription pour approbation des orientations du [WM du 14 octobre](../../meetings/2026/CR_WM14102026_Magrit_IA.md), §§4.1–4.4 et 6.2. Ce brouillon complète PD-2026-10-07-TVA-LIGNE et les arbitrages du 8 octobre ; il ne remplace pas une décision déjà approuvée. Les précisions fiscales du compte rendu sont des éléments à faire qualifier par le responsable fiscal/comptable, encore à nommer.

## Orientations à approuver

1. Un calcul Studio peut alimenter plusieurs lignes commerciales : une par point de livraison. Ces lignes appartiennent à un même groupe indivisible ; leur suppression porte sur le groupe entier. Le calcul économique reste celui de la quantité globale, pas une somme de nouveaux calculs indépendants.
2. Studio fournit les quantités par destination. Magrit reçoit les données et porte la qualification fiscale par lot ; le seul pays du client ou le seul taux du pays de destination ne détermine pas le régime. Le contrat, la ventilation des bases, les remises et les arrondis restent à définir avec Clariprint.
3. Sans livraison connue, le devis présente les prix HT sans coût de livraison et la mention « TVA applicable selon le lieu de livraison ». L’absence de qualification n’est pas une exonération. Les points de livraison sont connus au plus tard à la commande.
4. Une livraison précisée après envoi produit un nouveau devis lié au précédent. L’opérateur peut compléter les livraisons d’une ligne Studio ou ajouter une ligne libre de frais forfaitaires, dans les droits et états à préciser.
5. Le référentiel des taux couvre les pays concernés et doit être tenu à jour ; son alimentation, son responsable et sa maintenance sont à définir dans E10.23.
6. Bons de transport et suivi de colis restent reportés conformément à PD-2026-10-07-EXPEDITIONS-REPORTEES. Les agrégateurs de tarifs de transport constituent une piste ultérieure, sans engagement de livraison.

## Arbitrages et frontières

- Le verrou transitoire « un seul pays de livraison par devis » est une proposition non adoptée : OQ-LIVRAISON-PAYS-UNIQUE. Il ne doit pas faire disparaître le besoin de destinations multiples déjà décidé le 8 octobre.
- La formule « commande qui devient la facture » du compte rendu ne vaut pas décision d’émettre une facture électronique ni définition d’un cycle de facturation. Clarifier sa portée dans OQ-TVA-LIGNE ; E10.23 garde son périmètre initial.
- Les quantités conservées en stock ne sont pas déclarées comme livrées. La facturation du stock reste hors périmètre ; la validation d’une commande comportant une quantité sans destination doit être précisée avant développement.
- Le détail papier/impression/façonnage/livraison est un bénéfice futur de la structure ; E10.8 reste gelée.

## Vérifications attendues

Les scénarios de E10.25 et E10.26 complètent ceux de E10.23. Aucun test exécuté ni contrat API modifié n’est revendiqué par cette propagation documentaire.
