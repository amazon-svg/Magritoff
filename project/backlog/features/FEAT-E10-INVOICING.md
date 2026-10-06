---
id: FEAT-E10-INVOICING
title: Fiscalité des lignes et facturation électronique
epic: EPIC-E10
specStatus: draft
lifecycleStatus: active
owner: unassigned
source: user-request
stories:
  - E10.23
decisions: []
---

# Fiscalité des lignes et facturation électronique

## Besoin

Conserver sur les devis puis les commandes les données fiscales nécessaires à
une facture structurée, calculer des totaux cohérents par catégorie et taux de
TVA, puis préparer l'émission par une plateforme agréée sans reconstruire la
fiscalité après coup.

## État actuel

Le produit applique un taux unique en pied de devis et le fige sur la commande.
Les lignes ne portent ni catégorie ni taux de TVA. Ce modèle ne représente pas
une facture mêlant plusieurs taux ou une ligne exonérée et ne fournit pas la
ventilation exigée par les formats structurés.

L'intégration à une plateforme agréée, les statuts de cycle de vie de facture,
les avoirs et l'e-reporting devront être découpés après l'assainissement du
modèle fiscal des lignes.
