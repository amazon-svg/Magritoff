---
id: AF5
epic: EPIC-8-API-FIRST
priority: P0
status: in-progress
branch: refactor/api-first-foundation
depends_on: [AF4]
---

# AF5 — Commandes Orders atomiques

## Objectif

Déplacer les écritures Orders derrière `/api/v1`, avec transactions SQL, autorisations serveur, audit et clés d idempotence rejouables.

## Critères d acceptation

1. Une transition statut + audit est une seule transaction.
2. Rejouer une commande avec la même clé retourne le premier résultat sans répéter la mutation ni la notification.
3. Les refus métier sont exposés en Problem Details 403/404/409.
4. La création checkout insère entête + lignes atomiquement et ne nécessite plus de rollback compensatoire front.
5. L édition d un draft met à jour lignes + total dans une transaction et refuse un statut non draft.
6. Aucun composant Orders ne déclenche directement une RPC ou une fonction Supabase.

## Avancement AF5.1 — transitions

- wrapper SQL `api_transition_tenant_order_status` sérialisé par clé ;
- receipts privées par acteur et commande ;
- matrice, autorisation et audit réutilisent la RPC métier existante ;
- endpoint `POST /api/v1/orders/{orderId}/transitions` ;
- notification workflow déplacée côté serveur et supprimée du navigateur ;
- `DashboardOrders` et `PortalOrders` n importent plus Supabase ;
- baseline : 38 fichiers importeurs et 163 références directes.

## Reste AF5.2

- commande atomique de création checkout ;
- lecture et commande atomique d édition de brouillon ;
- migration des callers `PublicShop` et `PortalOrderEditor` ;
- smoke checkout et édition puis passage en review.

## Validation AF5.1

- migration complète locale : réussie ;
- transition draft → validated : 200 ;
- replay avec la même clé : 200, `replayed=true` ;
- typecheck modulaire, contrats et build : réussis.

## Correctif AF5.1a — actions owner/admin visibles

Les tenants créés après la migration initiale des rôles avaient leurs presets mais aucune assignation fonctionnelle Owner/Admin. Le serveur autorisait la transition via le membership, alors que l UI masquait les boutons. Une migration synchronise et backfill les assignations privilégiées, avec révocation lors d une dégradation de rôle. Le dashboard utilise également le membership owner/admin comme fallback cohérent avec l autorisation serveur.

Smoke navigateur local : bouton « Démarrer la production » visible, transition `validated → in_production` réussie, bouton suivant « Marquer expédiée » affiché.
