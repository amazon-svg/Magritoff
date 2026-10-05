# Definition of Ready

Une story peut être planifiée lorsque :

- son identifiant est stable ;
- son frontmatter est du YAML valide et `pnpm project:validate` réussit ;
- son epic et sa fonctionnalité parentes sont connues ;
- son `specStatus` vaut `approved` ou une dérogation est explicitement enregistrée ;
- le besoin et le résultat attendu sont compréhensibles ;
- les critères d'acceptation sont observables ;
- les décisions applicables sont référencées ;
- les dépendances et questions bloquantes sont explicites ;
- les anciennes stories et tests potentiellement invalidés sont identifiés ;
- les contraintes de sécurité, de données et de contrat sont connues ;
- l'approbateur produit est identifié.
