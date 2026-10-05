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
- aucun nouveau droit, aucune migration et aucune mutation des lignes ou des prix.

## Modules et API

- modèle de lecture principal : `orders`, enrichi par l'adaptateur `commercial-orders` ;
- composition workspace : contribution `orders.workspace.detail` ;
- API : `GET /api/v1/orders/{orderId}` dans la façade historique `/api/v1` ;
- persistance : `PostgresOrdersRepository.getOrderDetail` sur `tenant_orders` et `tenant_order_items`.

La route conserve temporairement le format direct de la façade historique, identifié par `x-legacy-facade` dans OpenAPI. Il s'agit d'un écart R5 déjà propre à cette façade ; le lot ne crée pas une seconde convention. Une migration future vers l'enveloppe API partagée devra traiter l'ensemble des routes historiques `orders` ensemble.

## Vérifications exécutées

- validation OpenAPI : réussie, 212 opérations ;
- génération des types OpenAPI : réussie ;
- typage modulaire `tsconfig.modular.json` : réussi ;
- tests ciblés : 52 tests réussis dans `orders-service`, `orders-routes` et le registre de contributions ;
- build Vite de production : réussi ;
- `git diff --check` : réussi.

Le test d'intégration PostgreSQL a été étendu pour vérifier la projection, le TTC, les lignes et l'isolation entre tenants. Il nécessite `MAGRIT_POSTGRES_INTEGRATION=1` et une stack PostgreSQL locale ; il n'a pas été exécuté dans ce passage.

Le typage global `tsconfig.json` reste en échec sur des erreurs préexistantes réparties dans d'autres modules et tests. Le contrôle modulaire, qui couvre les fichiers de production modifiés, est vert.

## Limites et travaux restants

- recette manuelle à effectuer avec la commande créée dans Atelier Lumière ;
- revue indépendante avant passage à `verified` ;
- les modifications de notes, coordonnées, lignes, quantités, configurations et montants restent à cadrer ;
- la base portable ne conserve pas `shop_orders` : les données reprises doivent exister dans `tenant_orders`. Une ancienne façade qui renverrait encore une ligne `legacy` dans la liste ne propose pas l'action « Ouvrir » ; sa limitation reste visible dans la liste ;
- la convergence physique de `tenant_orders` et `commercial_orders` reste à traiter par une migration dédiée ; le produit n'expose plus cette séparation comme deux objets.

## Décision associée

Le lot applique [PD-2026-10-05-COMMANDES-UNIQUE](../../project/decisions/product/PD-2026-10-05-commandes-objet-unique.md) : un objet Commande, deux workflows d'entrée, une liste et une fiche back-office. Les adaptateurs d'écriture et les tables restent temporairement distincts afin de ne pas perdre les contraintes propres aux devis, aux clients CRM, aux lignes tarifaires, aux documents et aux historiques.
