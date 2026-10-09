# E4.DEPOSIT-RECEIPTS — preuve d’implémentation

Source : [story canonique](../../project/backlog/stories/E4.DEPOSIT-RECEIPTS.md).
Branche codex/correction-annexes-commandes, dossier habituel, statut draft.

Module order-upload-links UI : reçus cumulés des réponses de confirmation,
dédupliqués par file_id, sans les effacer lorsqu’un autre fichier est envoyé.
Liste de noms/tailles/dates/confirmation, affichée également au plafond. Aucun
nouveau endpoint/DTO ou accès aux pièces des autres déposants. Aucun stockage
navigateur ; reçus de la visite seulement. Aucune dérogation R5.

Deux parcours Chromium 375/1280 : trois fichiers, échec de confirmation du
troisième, reprise, conservation des deux reçus puis ajout unique du troisième,
jeton upload sans Authorization, liste au quota. Captures relues.
282 tests ciblés modules/gouvernance architecture passent, types et build passent.
Suite ajoutée au workflow a11y ; CI non exécutée. Aucun serveur lancé, aucun
push/fusion, aucune donnée métier locale modifiée.
