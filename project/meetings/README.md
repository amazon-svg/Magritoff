# Comptes rendus et reports

Deux catégories de documents coexistent :

- les comptes rendus, conservés sans modification dans les dossiers annuels ;
- les reports de travail produits directement dans le projet, placés dans `reports/`.

Ces documents servent d'entrée aux artefacts canoniques. Ils ne remplacent ni une décision enregistrée, ni une story approuvée.

## Registre de pilotage

Le traitement est suivi dans [`tracking.yaml`](tracking.yaml), sans modifier le compte rendu. Le champ `processingStatus` prend trois valeurs :

- `draft` : document déposé, analyse non commencée ou incomplète ;
- `review` : document à relire et informations à intégrer dans le projet ;
- `done` : toutes les informations utiles ont été propagées ou explicitement écartées.

Un document `done` doit avoir un responsable, une date `reviewedAt` et aucun `openItems`. Pour les comptes rendus, `contentHash` garantit que le fichier déposé n'a pas été modifié.

Les éventuels champs `status` ou `propagationStatus` déjà présents dans un ancien compte rendu restent figés avec la source : seul le registre pilote désormais l'avancement.

## Processus obligatoire

1. déposer le compte rendu immuable ou créer le report ;
2. exécuter `pnpm project:refresh` pour enregistrer tout nouveau document en `draft` et régénérer le dashboard ;
3. désigner un responsable et passer le document en `review` ;
4. relever les décisions, actions, questions et contradictions dans `openItems` ;
5. mettre à jour les PRD, décisions, epics, fonctionnalités, stories et tests concernés ;
6. vider les points traités, renseigner `reviewedAt` et passer à `done`.

La CI exécute `pnpm project:validate`. Elle refuse un document non enregistré, un compte rendu modifié, un statut invalide ou un passage à `done` incomplet. Le dashboard expose la même file de traitement.
