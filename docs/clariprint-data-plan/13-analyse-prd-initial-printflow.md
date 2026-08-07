# Analyse du PRD initial PrintFlow Pro

**Source :** [`../../prd/clariprint_data_prd_inital.md`](../../prd/clariprint_data_prd_inital.md)  
**Date d'analyse :** 2026-08-07  
**Statut :** référence historique dérivée du corpus PrintMaster/Base44

## Positionnement

Le PRD initial décrit **PrintFlow Pro comme une application autonome tout-en-un**. Le PRD courant décrit **Clariprint Data comme un module de Magrit**, utilisant le kernel et les services plateforme communs, et publiant des données vers un solveur externe.

Le document initial est donc une source de découverte détaillée, particulièrement utile pour les rôles, flux, paramètres et données candidates. Il ne constitue pas l'architecture cible et son dictionnaire d'entités n'est pas un schéma SQL à implémenter directement.

## Ordre d'autorité documentaire proposé

1. décisions validées avec les experts métier et contrat réel du solveur ;
2. PRD Clariprint Data courant et ADR acceptés ;
3. PRD initial PrintFlow Pro pour les besoins et exemples détaillés ;
4. prompts Base44 bruts pour la traçabilité et les variantes historiques.

En cas de contradiction, une décision doit être ajoutée au registre. Le document initial ne remplace pas silencieusement le PRD courant.

## Apports confirmant le PRD courant

### Gouvernance et accès

- hiérarchie tenant, BU et environnements ;
- rôles cumulables et grants à portée fine ;
- invitations expirables et révocables ;
- scopes tenant, BU et environnement ;
- actions sensibles auditables ;
- partage externe limité dans le temps.

Ces éléments confortent la séparation `identity`, `tenant`, `access`, `entitlements` et `audit`. Les rôles nommés du PRD initial doivent être traités comme presets de capabilities, pas comme enums du kernel.

### Environnement imprimeur

- devise, système d'unités et zones géographiques ;
- certifications ;
- préférences de papier, livraison, fonds perdus, gâches et rainage ;
- coûts de main-d'œuvre, frais généraux et énergie ;
- machines, aptitudes et barèmes ;
- snapshots de publication datés.

Les champs détaillés sont des paramètres candidats. Leur présence dans le snapshot dépend de leur consommation réelle par le solveur.

### Barèmes

- conditions sur prestation, support, dimensions, surface, pages, passes et exemplaires ;
- coûts fixes, au millier, horaires et surfaciques ;
- cadence, variations et gâches ;
- besoin d'une sélection déterministe ;
- besoin d'audit et de sauvegarde groupée.

Le document signale lui-même le risque de chevauchement. La règle historique « premier match gagne » ne doit pas être retenue sans ordre explicite et validation métier.

### Matières et transport

- qualification des fournisseurs et marques ;
- SKU avec unités, conditionnement, minimums, prix et paliers ;
- catalogues datés ;
- grilles de transport avec contraintes, frais et tranches ;
- associations BU avec priorité et valeur par défaut.

Ces éléments enrichissent les spécifications `material-references` et `transport-catalogs`.

### Publication et audit

- snapshot complet ;
- période de validité ;
- statuts validation, production et archivage ;
- journal avant/après ;
- traçabilité des invitations et délégations.

Le modèle courant conserve l'immuabilité et sépare le statut de publication de la livraison solveur.

## Divergences à ne pas intégrer automatiquement

### Moteur de coûts embarqué

Le PRD initial calcule lui-même prix de revient, gâches, overhead, énergie, marges et prix de vente. Le PRD courant fixe une autre frontière :

- Clariprint Data structure, versionne et publie les paramètres et montants source ;
- Clariprint Data possède les profils clients et applique leurs politiques datées pour produire un JSON complet aux tarifs ajustés ;
- le solveur officiel consomme ce JSON et calcule les solutions de production ;
- Clariprint Data peut afficher un résultat solveur et préparer des cas de validation ;
- aucune formule historique de résolution de production ne devient une seconde implémentation du solveur.

Les formules du PRD initial deviennent des **cas de référence candidats** pour clarifier le contrat solveur, pas du code à copier.

### Profils, marges et projets

Les profils clients, politiques datées de marge ou remise, contrats d'accès et clés API appartiennent désormais au cœur de Clariprint Data. Ils servent à générer la projection ajustée avant l'appel du solveur.

`ProjectEnvironment` et la gestion générale des projets restent séparés. Clariprint Data ne devient pas pour autant le moteur d'optimisation : il prépare les tarifs applicables au profil, puis le solveur calcule le scénario.

### Modèle RBAC autonome

`TenantMembership`, `RoleGrant`, `PermissionMatrix` et `Invitation` existent déjà conceptuellement dans la plateforme Magrit. Clariprint Data consomme leurs services publics ; il ne recrée pas ses propres tables d'identité et d'accès.

### Partage par token

Le `ShareLog` historique apporte expiration, révocation et scopes. Dans la cible :

- le token peut amorcer une invitation ou une authentification ;
- le bénéficiaire doit être identifié ;
- le grant ressource/capabilities reste la source d'autorisation ;
- l'URL ou le token seul ne confère pas l'accès.

### Dictionnaire de données

Les objets imbriqués et champs combinés du document initial sont descriptifs. Ils ne doivent pas conduire directement à :

- des colonnes `min/max` combinées ;
- des tableaux JSON non validés pour les machines et barèmes ;
- des enums codés en dur pour toutes les taxonomies ;
- la duplication de `tenantId` et `buId` sans contrainte d'intégrité ;
- le stockage de tokens ou clés dans les entités métier.

Le modèle SQL doit être dérivé des agrégats, transactions, requêtes, RLS et exigences de versionnement.

### Choix d'interface

Debounce, édition inline, noms d'écrans et composants sont des indications UX. Le prompt PrintMaster demandait aussi une sauvegarde explicite plutôt qu'un update live ; ce dernier besoin de contrôle utilisateur est retenu, sans imposer le mécanisme React historique.

## Données candidates nouvelles ou précisées

| Domaine | Paramètres candidats |
|---|---|
| BU | pays ISO, devise ISO, système d'unités |
| Environnement | main-d'œuvre horaire, frais généraux surfaciques, coût énergie, préférences de gâche et rainage |
| Barème | ordre/priorité, conditions, coûts atomiques, cadence, variations, gâches |
| Matière | forme de support, dimensions, conditionnement, minimum, unité tarifaire, paliers |
| Transport | service, délai, contraintes, frais, gasoil, hayon, matrice de tranches |
| Accès | grant cumulable, scope, expiration, révocation, 2FA éventuelle |
| Audit | action, acteur, ressource, avant/après filtré, request ID |

Chaque paramètre doit être relié à un champ du contrat solveur ou à une règle opérationnelle validée avant d'entrer dans le MVP.

## Décisions supplémentaires requises

1. Les coûts de main-d'œuvre, frais généraux et énergie sont-ils des entrées officielles du solveur ?
2. Quelles formules distinguent marge sur coût, majoration et remise, et sur quelle nature de montant sont-elles autorisées ?
3. Comment ordonner les barèmes lorsqu'ils se chevauchent : priorité explicite, spécificité ou refus de publication ?
4. Le 2FA est-il requis pour publication, données financières et grants externes ?
5. BU et environnements possèdent-ils une devise/unité propre, avec quelle règle d'héritage ?
6. Quels champs d'audit avant/après peuvent contenir des données financières ou personnelles ?
7. Les associations BU-fournisseur avec priorité et défaut sont-elles requises au MVP ?
8. Comment un système d'accès externe authentifié associe-t-il ses credentials aux profils publiés ?

## Conclusion

Le PRD initial est une excellente **annexe métier et corpus de scénarios**. Sa meilleure utilisation est d'alimenter le glossaire, les fixtures, le contrat solveur et les décisions J0. Il ne doit pas redevenir un second PRD actif ni imposer une application séparée de Magrit.
