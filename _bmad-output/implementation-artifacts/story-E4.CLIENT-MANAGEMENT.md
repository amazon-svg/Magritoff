# E4.CLIENT-MANAGEMENT — preuve d’implémentation

Source : [story canonique](../../project/backlog/stories/E4.CLIENT-MANAGEMENT.md).
Branche : `codex/gestion-clients-boutique`, dans le dossier habituel.
Spécification en brouillon ; validation produit/revue humaine non revendiquées.

## Modules et API

`shop-customers` possède contrat, client HTTP, service, fiche et hooks. Adaptateur
PostgreSQL existant étendu ; composition workspace ajoute sa route de fiche.
`roles` résout la capacité produit vers `can_manage_shop_customers` pour permettre
l’accès des gestionnaires habilités sans rôle admin. Layout : libellé de fil d’Ariane.

Contrat : `openapi/magrit-core.v1.yaml`, types générés, schémas Zod partagés.
Sous `/api/v1/tenants/{tenantId}/shops/{shopId}/customers` :

- GET `/page` : 20 comptes par défaut, taille 1–100, curseur opaque.
- GET `/{customerId}` : informations, nombre de commandes, CA HT par devise.
- GET `/{customerId}/orders` : historique paginé avec mêmes paramètres.
- PATCH `/{customerId}` : nom et/ou état enabled.

Pagination keyset sur date de création et identifiant décroissants, précision
microseconde conservée dans le curseur. Les requêtes lisent taille + 1 lignes.
CA agrégé en SQL avec montants décimaux transmis en texte, jamais calculé depuis
la page chargée. Périmètre tenant/boutique/compte explicitement filtré, contrôle de
capacité serveur et RLS existante. Les statuts brouillon/annulé sont exclus du CA.

Désactivation atomique : verrouillage du compte, suspension et révocation des
sessions privées. L’interlocuteur et les commandes sont conservés. Réactivation
selon activated_at ; une ancienne session révoquée ne redevient pas valide.
Le nom en cours de saisie est conservé lors d’une modification d’accès.
Migration 0096 : deux index pour listes clients et commandes par compte.
Appliquée à la base locale ; aucun client/commande modifié par cette migration.

## Vérifications

Six tests PostgreSQL réels passent dans une base temporaire supprimée après
recette : création/delegation/lien existants et nouveaux parcours pagination,
CA/isolation/permissions, suspension/réactivation/sessions.
Tests API partagés client/serveur : limites/cursor invalides, montant décimal et
commande PATCH sans changement d’email. Architecture, surfaces et contrat passent.
Régression générale : 3 151 tests réussis et 178 ignorés ; test supplémentaire de
capacité gestionnaire ajouté et vérifié séparément. Typage modulaire et build passent.

Huit tests Chromium pour boutiques et clients, trois largeurs (375/768/1280),
erreurs/reprises, sauvegarde, confirmations, pagination et scans axe ciblés. Les
sessions et mutations sont simulées ; aucun compte réel créé. Captures relues.
Suite ajoutée au workflow a11y, exécution CI non revendiquée.
Reproduction : [recette](../../docs/testing/shop-customer-management.md).

## Limites et opérations

L’email de connexion reste en lecture seule ; aucune extension CRM/facturation.
Le CA est un total de commandes HT, pas un état de factures encaissées. L’API
historique non paginée reste pour compatibilité, sans usage dans la nouvelle UI ;
ce maintien ne constitue pas une dérogation sur du code nouveau. Aucune dérogation R5.
Les scans ciblés ne constituent pas un audit exhaustif d’accessibilité.
Aucun serveur lancé, aucun push, fusion ou déploiement.
