# Capacité `imports`

**Statut :** draft

## Responsabilité

Transformer un fichier contrôlé en propositions de création ou mise à jour, sans modifier de publication et sans perdre silencieusement de ligne.

## Concepts

- `ImportFile` ;
- `ImportTemplateVersion` ;
- `ImportPreview` ;
- `ImportRowResult` ;
- `ImportConfirmation` ;
- clé d'idempotence.

## Workflow

```text
Upload -> Analyse -> Prévisualisation -> Confirmation -> Brouillon -> Bilan
```

## Cas d'usage

- déposer un fichier autorisé ;
- analyser selon une version de modèle ;
- prévisualiser créations, modifications, identiques et rejets ;
- confirmer atomiquement vers un brouillon ;
- reprendre après interruption ;
- consulter le bilan.

## Invariants

- fichier original conservé selon la politique définie ;
- import vers brouillon uniquement ;
- chaque ligne possède un résultat ;
- aucune erreur silencieuse ;
- même fichier, version et cible : résultat idempotent ;
- une confirmation porte la version de preview approuvée ;
- formules actives, macros et contenus dangereux sont neutralisés ou refusés ;
- limites de taille et ressources explicites.

## Sécurité

- stockage tenant-scoped ;
- analyse côté serveur isolée ;
- noms de fichiers non utilisés comme chemins ;
- aucune formule exécutée ;
- allow-list de formats ;
- suppression selon la politique de conservation.

## Validation

- [ ] Le total lu égale acceptées + identiques + rejetées.
- [ ] Réimporter à l'identique ne crée aucun doublon.
- [ ] Une preview obsolète ne peut être confirmée.
- [ ] Une ligne invalide conserve son numéro et son motif.
- [ ] Un échec partiel n'applique pas la moitié des changements confirmés.
- [ ] L'import ne modifie aucune publication.
- [ ] Les fichiers malveillants représentatifs sont refusés.

## Décisions ouvertes

- XLSX/CSV exacts du MVP ;
- clés de rapprochement ;
- politique de conflit ;
- volumétrie et traitement synchrone/asynchrone.

