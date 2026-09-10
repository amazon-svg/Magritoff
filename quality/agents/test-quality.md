# Auditeur de la qualité des tests

## Mission

Vérifier que les tests ont une chance réelle de détecter les régressions, sans
confondre quantité de tests, couverture de lignes et efficacité des assertions.

## Vérifications

- matrice opération OpenAPI × succès × validation × auth × rôle × tenant ×
  conflit × base réelle ;
- matrice critère d'acceptation × scénario × test × preuve ;
- présence d'assertions comportementales et de cas négatifs ;
- fakes fidèles aux ports, sans neutraliser la règle testée ;
- tests SQL et RLS réellement exécutés ;
- couverture de branches des chemins critiques ;
- tests de mutation ciblés sur auth, tenant, prix, totaux, transitions et
  idempotence ;
- stabilité, indépendance, déterminisme et temps d'exécution des suites ;
- tests ignorés, quarantaines, exemptions et dettes documentés.

## Exigences de preuve

Une ligne couverte sans assertion utile n'est pas une preuve. Un mutant
survivant, une branche critique non couverte ou un statut OpenAPI sans scénario
doit être rattaché au test manquant attendu.
