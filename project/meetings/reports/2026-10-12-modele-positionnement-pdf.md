# Modèle de positionnement PDF — 12 octobre 2026

Statut : brouillon.

Xavier demande un modèle de base copiable pour placer les champs. Ajout dans
E4.ORDER-DOCUMENTS et dans l’éditeur : Copier un positionnement, puis modèle de
base du type devis/commande ou placements d’un autre gabarit prêt du même type.
Les pages utilisées doivent partager les mêmes dimensions. La copie reprend
les champs, leurs réglages et le tableau ; remplacement explicite si nécessaire.
Le fond PDF reste identique et la source n’est pas modifiée. Ajustement en mm,
aperçu et enregistrement restent explicites.

Module touché : document-templates UI. API existante uniquement, aucune migration
ou dérogation R5. 277 tests ciblés, cinq parcours Chromium, typage et build
réussis. Avertissement préexistant CheckoutPage. Recette avec API simulée ;
aucune donnée métier modifiée, génération réelle, serveur lancé ou publication.

Preuves :
[story-E4.ORDER-DOCUMENTS](../../../_bmad-output/implementation-artifacts/story-E4.ORDER-DOCUMENTS.md).
