---
id: AF13.1
epic: EPIC-8-API-FIRST
priority: P0
status: done
branch: refactor/api-first-foundation
depends_on: [AF12.2]
---

# AF13.1 — Administrer les boutiques via l’API Magrit

## Résultat livré

- module `shops` avec contrats HTTP, client, service et port repository ;
- repository Supabase réservé au serveur et exécuté avec le JWT utilisateur ;
- liste tenant et commandes de création, modification et suppression ;
- lecture et commandes sur les produits manuels `shop_products` ;
- identité du propriétaire dérivée de la session lors de la création ;
- conservation du garde historique : modification et suppression d’une
  boutique limitées à son `owner_user_id` ;
- migration de `ShopsContext` vers `ShopsApiClient` ;
- adaptation de l’éditeur pour adresser un produit dans sa boutique et son
  tenant, au lieu d’une suppression globale par identifiant seul.

## Frontières du lot

AF13.1 couvre les opérations authentifiées du contexte partagé. La lecture
publique de `PublicShop`, son garde d’accès, le catalogue PIM et le temps réel
restent dans AF13.2. Le stockage des logos/heros et les prix négociés encore
présents dans `DashboardShopEditor` restent dans AF13.3.

## Sécurité

1. `tenantId`, `shopId` et `productId` sont validés par la façade HTTP.
2. `ownerUserId` fourni par le navigateur est ignoré ; l’acteur provient du
   JWT.
3. Toutes les requêtes produit sont bornées par tenant et boutique.
4. La RLS demeure la dernière barrière du repository serveur.

## Mesures et validation

- baseline UI : **30 → 29** fichiers importeurs Supabase ;
- références directes : **114 → 106** ;
- tests du client, des routes et des frontières d’architecture ;
- typecheck modulaire, suite complète et build de production.
