# Goals, principes et validation globale

## Goals produit

### G1 — Décrire un parc réel

Un utilisateur métier autorisé peut maintenir fournisseurs, établissements, machines, matières, transports, sous-traitants, aptitudes et paramètres économiques sans intervention directe en base.

### G2 — Fiabiliser les données du solveur

Toute donnée exportée est structurellement valide, versionnée, traçable et rattachée à une organisation. L'absence d'une valeur reste distincte de zéro ou de « non applicable ».

### G3 — Protéger la production

Les modifications sont préparées dans un brouillon. Une publication de production est immuable. Un bac à sable ne peut jamais modifier ou alimenter silencieusement la production.

### G4 — Protéger les données sensibles

L'isolation entre organisations est garantie par la base. Les droits de consultation, édition technique, édition financière et publication sont distincts et testés.

### G5 — Rendre chaque résultat explicable

Une valeur sensible conserve sa provenance, ses dates d'effet et son historique. Une publication et sa livraison au solveur sont auditables.

### G6 — Construire un module réutilisable

React, API et MCP doivent pouvoir invoquer les mêmes services applicatifs. Le module ne dépend pas des composants, contexts ou tables privées des autres domaines.

## Non-goals du MVP

- calculer le prix final ou le plan de production optimal ;
- ordonnancer l'atelier en temps réel ;
- piloter les machines ou collecter de la télémétrie IoT ;
- gérer la comptabilité, la facturation ou la paie ;
- couvrir toutes les familles de machines ;
- proposer des chaînes de sous-traitance transitives ;
- fournir un éditeur visuel de règles arbitraires ;
- intégrer immédiatement des ERP ou MIS.

## Architecture imposée

```text
UI / API / MCP
      |
      v
Services applicatifs Clariprint Data
      |
      +-- domaine pur
      +-- ports repositories
      +-- ports solveur/import
      |
      v
Adaptateurs Supabase / solveur / fichiers
```

Le kernel contient uniquement les concepts techniques communs : identifiants, `ActorContext`, erreurs, résultats, argent, unités, horloge et événements. Il ne connaît ni Supabase, ni les tables, ni les règles Clariprint.

## Definition of Done globale

Une tranche fonctionnelle est terminée lorsque :

- [ ] le parcours utilisateur est utilisable de bout en bout ;
- [ ] React n'accède pas directement aux tables du module ;
- [ ] les entrées et sorties externes sont validées ;
- [ ] les règles métier sont couvertes par des tests unitaires ;
- [ ] les repositories sont couverts par des tests d'intégration ;
- [ ] chaque table tenant-scoped possède une politique RLS testée positivement et négativement ;
- [ ] les écritures multi-objets critiques sont atomiques ;
- [ ] les changements sensibles génèrent une trace d'audit ;
- [ ] les erreurs sont compréhensibles, corrélables et ne produisent pas de faux succès ;
- [ ] les tests, le build TypeScript et les migrations passent dans l'environnement documenté ;
- [ ] les décisions structurantes sont consignées dans le registre ;
- [ ] les dépendances temporaires au legacy ont un propriétaire et une condition de retrait ;
- [ ] les critères d'accessibilité applicables au parcours sont vérifiés.

## Gates globaux du MVP

### Gate métier

Le jeu de référence représente au moins un flux d'impression complet validé par un expert Clariprint.

### Gate solveur

Le JSON publié est accepté par un test de contrat ou un environnement de calcul de test.

### Gate sécurité

Les scénarios cross-tenant, séparation technique/financier, publication et sandbox sont tous verts.

### Gate intégrité

Aucune publication historique ne peut être modifiée et chaque calcul peut référencer la version du parc utilisée.

### Gate exploitation

Une erreur d'import, de validation ou de livraison au solveur est observable, retentable lorsque nécessaire et ne compromet pas la publication.

### Gate utilisateur

Un utilisateur pilote réalise le scénario complet sans intervention directe en base.

