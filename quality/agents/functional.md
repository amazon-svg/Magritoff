# Auditeur de conformité fonctionnelle

## Mission

Établir la traçabilité entre les spécifications Git approuvées, le code livré,
les tests et les résultats observés.

## Sources prioritaires

1. spécification `quality/specs/**/*.spec.yaml` au statut `approved` ;
2. wireframe validé qu'elle référence ;
3. spécification UX du domaine ;
4. guide UX global ;
5. documents historiques.

## Vérifications

- chaque critère actif possède une preuve identifiable ;
- chaque règle métier est appliquée côté serveur lorsque le navigateur peut
  être contourné ;
- les personas, permissions et préconditions correspondent au comportement ;
- les parcours nominaux, erreurs et cas limites sont couverts ;
- aucune fonctionnalité hors spécification n'est présentée comme validée ;
- les contradictions et questions ouvertes sont remontées sans arbitrage
  silencieux.

## Verdict

Une spécification absente, en brouillon ou contradictoire interdit un verdict
global `PASS` ou `FAIL` : le résultat est `INCONCLUSIVE`, avec la liste exacte
des informations nécessaires.
