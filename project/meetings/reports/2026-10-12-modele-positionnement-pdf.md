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

## Préparation de la PR

Xavier demande de committer, publier la branche, ouvrir la PR et attendre les
contrôles ; il réalisera lui-même la fusion. La branche existante
`codex/correction-annexes-commandes` porte aussi les lots boutiques, prix fixes,
clients et annexes du 9 octobre. Ce périmètre complet doit figurer dans la PR.
La branche contient le dernier origin/main récupéré avant publication.

Vérifications finales exécutées : 3 168 tests réussis / 184 ignorés ; 12 tests
PostgreSQL/S3 de génération PDF et dépôt public réussis en base temporaire ;
22 parcours Chromium réussis. Typage, build, contrat OpenAPI (224 opérations),
alignement des types générés, gouvernance et contrôle des fichiers locaux passent.
Le workflow navigateur inclut désormais la recette de copie du positionnement.
Avertissement CheckoutPage préexistant conservé. La recette avec le gabarit réel
BC 2026 n’est pas revendiquée. Migrations 0095, 0096 et 0097 à appliquer sur
la cible avant déploiement des fonctionnalités concernées. Aucun déploiement ni
fusion autorisés par cette demande. La revue humaine reste distincte des tests.
