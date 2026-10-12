# Reprise du calage des gabarits PDF — 10 octobre 2026

Statut : brouillon.

Xavier confirme la poursuite des gabarits PDF et du bon de commande. Suite de
E4.ORDER-DOCUMENTS : bornes de déplacement des champs et du tableau, espacement
entre colonnes conservé aux bords, capacité de lignes ajustée au déplacement
vers le bas même sans panneau Tableau, saisies de colonnes bornées et message
accessible lors d’une saisie mm invalide. Placements existants conservés à la
lecture ; aucun gabarit métier reconfiguré implicitement.

Module touché : document-templates UI. Aucun contrat API, migration ou dérogation
R5. 269 tests ciblés, quatre parcours Chromium, typage modulaire et build passent.
Avertissement de build préexistant CheckoutPage. Aucun serveur lancé, push,
fusion ou déploiement. Le bon réel de Xavier n’a pas été généré durant cette
reprise ; les parcours navigateur utilisent des réponses API de recette.

Preuves détaillées :
[_bmad-output/implementation-artifacts/story-E4.ORDER-DOCUMENTS.md](../../../_bmad-output/implementation-artifacts/story-E4.ORDER-DOCUMENTS.md).
