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
- restauration du numéro `CDE-AAAA-NNNNN` dans la grille pour les commandes issues de devis ; les commandes boutique sans numéro métier conservent une référence technique courte ; la référence ouvre la commande et le nom du client ouvre sa fiche CRM lorsqu'elle existe ;
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
- les coordonnées, la livraison, les lignes, quantités, configurations et montants restent hors du contrat d'édition approuvé ;
- la base portable ne conserve pas `shop_orders` : les données reprises doivent exister dans `tenant_orders`. Une ancienne façade qui renverrait encore une ligne `legacy` dans la liste ne propose pas l'action « Ouvrir » ; sa limitation reste visible dans la liste ;
- la projection API commune paginée, les filtres serveur et l'export commun sont achevés par E4.4b ;
- la numérotation métier des commandes boutique reste à arbitrer ; ce correctif n'invente pas rétroactivement des numéros comptables.

## Décision associée

Le lot applique [PD-2026-10-05-COMMANDES-UNIQUE](../../project/decisions/product/PD-2026-10-05-commandes-objet-unique.md) : un objet Commande, deux workflows d'entrée, une liste, une fiche et une persistance canoniques. Les routes `commercial-orders` restent temporairement des projections de compatibilité, sans tables concurrentes.

## Tranche d'édition du 6 octobre 2026

Le périmètre approuvé ajoute la modification de la référence client et des
notes depuis la fiche commune. Le contrat canonique
`PATCH /api/v1/order-summaries/{orderId}` :

- est réservé à un utilisateur disposant de `can_modify` ;
- exige l'`ETag` lu sous forme d'`If-Match` et refuse une version périmée ;
- n'accepte aucun champ de ligne, de quantité, de configuration ou de prix ;
- renvoie la commande commune mise à jour et son nouvel `ETag` ;
- journalise les anciennes et nouvelles valeurs avec l'auteur et la date dans
  `tenant_order_metadata_events`.

Le même formulaire est composé dans la fiche boutique et dans la fiche issue
d'un devis. Les tests PostgreSQL isolés vérifient les deux origines, le gel des
données financières, l'isolation tenant, le droit `can_modify`, le conflit
concurrent et la restitution de l'événement dans l'historique.

## Fichiers et liens de dépôt sur la fiche commune

La recette du 6 octobre a montré que les panneaux existants restaient propres
à la présentation historique des commandes issues d'un devis. Leur composition
est remontée dans `UnifiedOrderDetailPage` : une commande boutique comme une
commande issue d'un devis affiche maintenant ses fichiers et ses liens publics
de dépôt. Le panneau de fichiers reçoit les lignes de la projection commune,
permet de rattacher un nouveau fichier à l'une d'elles via `order_line_id` et
rend cette association dans la liste. Le bouton historique `order_line` a été
retiré de la fiche commerciale, car il appelait la ressource générique des
fichiers commerciaux qui ne persiste que les pièces de `project_item`.

Vérifications : typage modulaire réussi, 78 tests ciblés de contrats et de
helpers réussis, et recette Playwright réussie sur les deux origines avec les
panneaux de fichiers, le choix de ligne et les liens de dépôt visibles.

## Vue de détail unique

`UnifiedOrderDetailPage` ne branche plus vers deux présentations selon
`origin`. Il monte une seule `UnifiedOrderDetailView`, qui normalise les lignes
boutique et devis vers le même tableau et conserve une hiérarchie identique :
en-tête, informations modifiables, identité, lignes, totaux, fichiers, bon de
commande, liens de dépôt et actions. Les absences propres à une provenance sont
affichées dans les mêmes champs (« Non renseignée », « Non applicable »).

Les anciens `OrderDetailPage` des modules `orders` et `commercial-orders`,
ainsi que le hook commercial dédié, ont été supprimés. Un test d'architecture
interdit leur retour et la recette Playwright compare les titres de section des
deux provenances. Le typage, le build et les tests d'architecture passent ; le
build conserve uniquement l'avertissement Rollup déjà connu autour de
`CheckoutPage`.
