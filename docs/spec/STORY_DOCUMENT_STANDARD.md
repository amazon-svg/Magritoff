# Standard du story document — intention avant implémentation

> Règle mise à jour après l'atelier du 1er octobre 2026, complétée après la migration du 3 octobre 2026. Git est l'unique source du projet ; la migration depuis Notion est terminée et Notion n'est plus qu'une provenance archivée hors dépôt.

## Deux artefacts, deux responsabilités

La story fonctionnelle canonique est un fichier de `project/backlog/stories/`. Elle décrit le besoin, les règles métier, les critères d'acceptation, les décisions applicables et les liens vers les exigences remplacées.

Le story document `_bmad-output/implementation-artifacts/story-<ID>.md` est une preuve de travail : il décrit l'implémentation, les fichiers modifiés, les tests et les limites de livraison. Il référence la story canonique mais ne la redéfinit pas.

Cette séparation évite qu'une modification technique, une régénération BMAD ou un export ancien ne remplace silencieusement l'intention produit.

## Ordre de lecture

Avant tout développement ou revue :

1. lire la story canonique dans `project/backlog/stories/` ;
2. vérifier que son `specStatus` permet le travail et que ses questions bloquantes sont closes ;
3. lire les décisions et spécifications `quality/specs` référencées ;
4. examiner le story document d'implémentation et le comportement actuel du code ;
5. signaler toute contradiction au lieu de choisir implicitement une source.

Si la story canonique n'existe pas encore, elle est créée au statut `draft` à partir du modèle du backlog, ou le travail est suspendu si une décision produit est nécessaire. Un agent ne la passe jamais lui-même à `approved`.

## Contenu du story document d'implémentation

Le document contient au minimum :

- l'identifiant et un lien relatif vers la story canonique ;
- le commit ou la branche de travail ;
- les changements réalisés ;
- les écarts connus par rapport aux critères d'acceptation ;
- les tests ajoutés et les résultats d'exécution ;
- les migrations ou opérations nécessaires ;
- les risques et travaux restants.

Le périmètre fonctionnel n'est pas recopié. Il est référencé par identifiant afin de ne pas créer une seconde source modifiable.

## Évolution ou invalidation d'une story antérieure

Une nouvelle fonctionnalité qui modifie un comportement existant doit :

1. identifier les stories, spécifications, décisions et tests affectés ;
2. modifier la source canonique active pour refléter le nouveau comportement ;
3. marquer l'ancien artefact `superseded` ou `deprecated` lorsqu'il n'est plus actif ;
4. renseigner les liens `supersedes` et `supersededBy` ;
5. adapter ou supprimer explicitement les tests devenus invalides ;
6. conserver l'historique dans Git et dans la décision source.

Une simple mention « cette spec est invalidée » sans mise à jour de la source active n'est pas suffisante.

## Héritage Notion — migration close

La migration unique a eu lieu le 3 octobre 2026 : 205 stories, 18 epics et 19 fonctionnalités sont dans `project/backlog/`. Les sections encadrées par les marqueurs `notion-functional` dans les anciens story documents sont des instantanés figés. Elles sont conservées pour la traçabilité, mais :

- **elles sont remplacées par la story canonique du même identifiant** dans `project/backlog/stories/` ; en cas de divergence, c'est la story canonique qui s'applique ;
- elles ne sont plus régénérées, ni relues comme spécification ;
- le statut Notion d'origine ne détermine aucun statut Git ;
- toute contradiction est enregistrée dans le rapport de migration ou dans la story canonique, jamais résolue en silence.

`scripts/notion/sync_story_functional.py` et `docs/spec/notion-extraction-format.md` sont des outils de migration **retirés** : ils ne doivent plus être exécutés ni intégrés à un workflow. `_bmad-output/implementation-artifacts/INDEX-stories-notion.md` est un registre de migration figé, remplacé par l'annexe B du rapport de migration.

## Responsabilités

| Moment | Responsable | Geste |
|---|---|---|
| Cadrage | auteur produit ou agent mandaté | crée ou met à jour la story au statut `draft` |
| Approbation | approbateur produit nommé dans `project/governance/roles.md` | décide du passage à `approved` |
| Développement | développeur ou agent de développement | référence la story et produit le document d'implémentation |
| Revue | personne ou agent distinct | vérifie critères, code et preuves ; ne modifie pas l'intention par supposition |
| Clôture | responsable de livraison | met à jour le `deliveryStatus` à partir des preuves |
