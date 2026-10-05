# Story E4.4a — Lecture back-office unifiée des commandes

Story canonique : [E4.4a](../../project/backlog/stories/E4.4a.md)  
Branche : `codex/fiche-commande-backoffice`  
Date : 2026-10-05

## Changements réalisés

- ajout de la route workspace canonique `/t/:tenantSlug/dashboard/orders/:orderId` et d'une action « Ouvrir » dans la liste des commandes ;
- agrégation dans `/dashboard/orders` des commandes boutique et des commandes issues d'un devis ;
- retrait de l'entrée de navigation « Commandes atelier » ; l'ancienne liste redirige vers « Commandes » et l'ancienne fiche monte le même point d'entrée ;
- ajout de `GET /api/v1/orders/{orderId}` au contrat OpenAPI et au module `orders` ;
- lecture PostgreSQL tenant-aware de la commande, de la boutique, du client, des dates, de la devise, des notes, des lignes, des configurations techniques et de l'origine des prix ;
- calcul du TTC selon le régime fiscal du tenant, à partir du montant HT enregistré ;
- écran en lecture seule avec gestion explicite des données absentes, totaux HT/TTC, historique et transitions existantes selon les droits déjà exposés ;
- convergence physique dans `tenant_orders` / `tenant_order_items`, sans mutation ni recalcul des lignes ou des prix engagés ;
- restauration du numéro `CDE-AAAA-NNNNN` dans la grille pour les commandes issues de devis ; les commandes boutique sans numéro métier conservent une référence technique courte ;
- retrait des boutons de transition directe de la grille conformément à l'arbitrage du RP du 28 août 2026 : la grille dense affiche l'état et ouvre la fiche, les changements restent dans une interaction dédiée.

## Modules et API

- modèle de lecture principal : `orders`, enrichi par l'adaptateur `commercial-orders` ;
- composition workspace : contribution `orders.workspace.detail` ;
- API : `GET /api/v1/orders/{orderId}` dans la façade historique `/api/v1` ;
- persistance : `tenant_orders` et `tenant_order_items` sont les tables canoniques ; les projections API de compatibilité filtrent `order_origin`.

La route conserve temporairement le format direct de la façade historique, identifié par `x-legacy-facade` dans OpenAPI. Il s'agit d'un écart R5 déjà propre à cette façade ; le lot ne crée pas une seconde convention. Une migration future vers l'enveloppe API partagée devra traiter l'ensemble des routes historiques `orders` ensemble.

## Vérifications exécutées

- validation OpenAPI : réussie, 212 opérations ;
- génération des types OpenAPI : réussie ;
- typage modulaire `tsconfig.modular.json` : réussi ;
- tests PostgreSQL : 140 tests réussis sur une base isolée ;
- suite applicative : 3 165 tests réussis et 144 ignorés ; les 5 tests HTTP nécessitant un port local passent hors sandbox ;
- build Vite de production : réussi ;
- `git diff --check` : réussi.

Le test d'intégration PostgreSQL vérifie la migration, l'absence des deux anciennes tables, les deux origines, la conversion de devis, le TTC, les lignes, les documents, les fichiers, les exports et l'isolation entre tenants.

## Limites et travaux restants

- recette manuelle à effectuer avec la commande créée dans Atelier Lumière ;
- revue indépendante avant passage à `verified` ;
- les modifications de notes, coordonnées, lignes, quantités, configurations et montants restent à cadrer ;
- la base portable ne conserve pas `shop_orders` : les données reprises doivent exister dans `tenant_orders`. Une ancienne façade qui renverrait encore une ligne `legacy` dans la liste ne propose pas l'action « Ouvrir » ; sa limitation reste visible dans la liste ;
- la projection API commune paginée, les filtres serveur couvrant les deux origines et l'export commun restent à terminer dans E4.4b ;
- la numérotation métier des commandes boutique reste à arbitrer ; ce correctif n'invente pas rétroactivement des numéros comptables.

## Décision associée

Le lot applique [PD-2026-10-05-COMMANDES-UNIQUE](../../project/decisions/product/PD-2026-10-05-commandes-objet-unique.md) : un objet Commande, deux workflows d'entrée, une liste, une fiche et une persistance canoniques. Les routes `commercial-orders` restent temporairement des projections de compatibilité, sans tables concurrentes.
