---
story_id: S-MIGRATION-ORDERS
epic: Sprint 4 — PIM-Boutique-Commandes (Phase 1 Bascule orders)
title: Bascule submitCart → tenant_orders + tenant_order_items (ADR-ORDERS-1)
status: draft
target_branch: beta/v5
agent: Dev (Claude Code)
size: M (~1.5-2j)
depends_on: P0.5 (ADR-ORDERS-1 documentée §4.10), P0.4 (pipeline PIM E2E validé)
unblocks: S-DUAL-READ (lecture côté PortalOrders), S3.x lifecycle commandes
adr_ref: architecture.md §4.10 ADR-ORDERS-1
ux_consultation: NON requise (backend pur, pas de change UI utilisateur immédiat)
---

# Story S-MIGRATION-ORDERS — Bascule submitCart vers tenant_orders

## Story (As / I want / So that)

**As an** acheteur B2B qui valide son panier sur une boutique Magrit
**I want** que ma commande soit enregistrée dans le modèle Order entity v1.1 (`tenant_orders` + `tenant_order_items` + audit trail) au lieu du modèle legacy `shop_orders` (JSONB inline, sans audit, sans scope cross-tenant)
**So that** les commandes Magrit aient une structure relationnelle propre, des hooks pré-câblés pour les features V2+ (e-invoicing NFR16, Stripe E4.3, Canva S5.2), un audit trail garanti via RPC, et une RLS cross-tenant stricte conforme NFR6 — sans casser la rétrocompatibilité de l'historique legacy.

## Contexte

Suite à ADR-ORDERS-1 livrée en P0.5 (cf. [architecture.md §4.10](_bmad-output/planning-artifacts/architecture.md)), on bascule le code applicatif d'insertion de commandes du modèle legacy `shop_orders` vers le modèle v1.1 `tenant_orders` (livré S1.4 le 09/05 mais inutilisé jusqu'à présent).

**État actuel** : [PublicShop.tsx:255-314 submitCart()](src/app/components/shop/PublicShop.tsx#L255-L314) :
- INSERT dans `shop_orders` avec items JSONB inline
- `shop_id`, `customer_name/email/phone`, `items[]`, `total_ht/ttc`, `status='pending'`, `notes`
- Pas de `tenant_id`, pas d'audit trail, pas d'enum statuts
- Trigger `enqueue_pim_candidates_on_shop_order` consomme les inserts pour PIM ingestion (préservé via Phase 0)

**État cible** : INSERT dans `tenant_orders` + `tenant_order_items` :
- 1 ligne `tenant_orders` avec `tenant_id`, `shop_id`, `created_by`, `status='draft'`, `total_ht`, `currency='EUR'`, `notes`, hooks NFR16/E4.3/S5.2 nullables
- N lignes `tenant_order_items` avec `order_id`, `product_id`, `product_label`, `clariprint_options` JSONB snapshot, `quantity`, `unit_price_ht`, `line_total_ht`
- Trigger PIM à adapter pour le nouveau modèle (sub-issue déléguée à story future si trigger ne fire pas sur tenant_orders)

## Pre-flight checks

### Check 1 — `shops.tenant_id` doit exister
La migration tenant_orders v1.1 a FK `tenant_orders.tenant_id → tenants(id)`. Pour insérer, on a besoin du `tenant_id` du shop. Vérifier que `shops.tenant_id` existe via :
```sql
select column_name from information_schema.columns where table_name = 'shops' and column_name = 'tenant_id';
```
Si absent : la story doit ajouter un fetch séparé `shops → tenants` ou repenser le scoping. Probabilité haute qu'il existe (les shops sont déjà scoped par tenant en RLS).

### Check 2 — Trigger `enqueue_pim_candidates_on_shop_order`
Le trigger fire sur INSERT `shop_orders`. Si on bascule vers `tenant_orders`, le trigger ne fire plus → l'ingestion PIM est rompue. **Décision** : à valider en pré-flight. Soit :
- Adapter le trigger pour fire aussi sur `tenant_order_items` (migration SQL séparée)
- Créer un trigger frère `enqueue_pim_candidates_on_tenant_order_items`
- Ou laisser le trigger sur shop_orders (cas legacy) et fire PIM manuel post-insert tenant_orders

→ **Pre-flight obligatoire** avant le code. Si trigger doit être adapté, c'est une **story P0.10** dépendante de cette story.

### Check 3 — Cleanup auto-PIM côté tenant_orders
Si on adapte le trigger pour tenant_order_items, attention aux doubles ingestions si la story ré-tourne sur `shop_orders` historiquement. **Décision** : nouveau trigger spécifique `tenant_orders`, ne touche pas `shop_orders` legacy (qui reste figé désormais).

## Acceptance Criteria

**AC1** — Pre-flight check 1 effectué : `shops.tenant_id` présent et non-null en prod. Documenter résultat dans la story doc.

**AC2** — Pre-flight check 2 + 3 effectué : décision sur le trigger PIM. Soit nouveau trigger sur `tenant_order_items` (migration séparée P0.10), soit accepter ingestion PIM manuelle pendant Phase 1 (à reprendre Phase 3).

**AC3** — `submitCart()` dans `PublicShop.tsx` modifié :
1. INSERT 1 ligne `tenant_orders` avec :
   - `tenant_id` = `shop.tenant_id` (depuis prop ou fetch)
   - `shop_id` = `shop.id`
   - `created_by` = `user?.id` (NULL accepté pour acheteur anonyme — à vérifier RLS si possible)
   - `status` = `'draft'`
   - `total_ht`, `currency='EUR'`, `notes=''`
2. Récupère l'`order.id` retourné
3. INSERT N lignes `tenant_order_items` (1 par cart line) avec :
   - `order_id` = `order.id`
   - `product_id` = `lib.product.id` si UUID valide, sinon NULL
   - `product_label` = `l.product.name` (snapshot)
   - `clariprint_options` = `l.product.config` JSONB (snapshot)
   - `quantity` = `l.qty`
   - `unit_price_ht` = `l.product.price_ht`
   - `line_total_ht` = `l.product.price_ht * l.qty`
4. En cas d'échec items (transaction partielle) : tentative rollback (DELETE l'order créé) + alerte utilisateur. Documenter clairement les limites.

**AC4** — Validation `tenantOrderInsertSchema` Zod ajoutée dans `src/schemas/` (cohérent avec pattern `shopOrderInsertSchema` existant).

**AC5** — Anciennes lignes `shop_orders` ne sont **plus jamais écrites** par le code applicatif après cette story (cohérent ADR-ORDERS-1 pattern "do/don't"). `shop_orders` reste lisible en legacy.

**AC6** — Trigger PIM (selon AC2) :
- Si adapté : nouvelle migration `20260518_01_pim_candidates_on_tenant_order_items.sql` + tests
- Si reporté : ingestion PIM manuelle documentée, story P0.4-bis à créer pour Phase 3

**AC7** — Tests vitest étendus :
- 1 test "submitCart insère bien dans tenant_orders + tenant_order_items pour un panier non vide"
- 1 test régression "shop_orders n'est plus inséré"
- Pas de test E2E supabase (test unit avec mock du client supabase)

**AC8** — Test manuel : passer une commande sur localhost:5177 → vérifier SQL prod que la ligne est dans `tenant_orders` avec statut `draft` et items correspondants dans `tenant_order_items`.

**AC9 (NEW — Pre-flight check 3 du 2026-05-17, décision Arnaud B2)** — La RLS `tenant_orders_insert` exige `created_by = auth.uid()`. Le `submitCart()` modifié doit :
1. Vérifier `user?.id` présent AVANT de tenter l'insert
2. Si non authentifié : afficher une UI de demande de connexion (modal ou redirect vers `/login?return=/shop/{slug}`) plutôt que de tenter un insert qui échouera
3. Une fois authentifié, retry submitCart automatiquement (ou guide explicite "Cliquez à nouveau Passer commande")
4. Cohérence : la convention v1.1 acheteur B2B = compte créé par admin tenant (pas d'anonyme en v1.1, hors scope `/shop/:slug` public)

**AC10 (NEW — Pre-flight check 2)** — Trigger PIM ingestion : couvert par story **P0.10 livrée** le 17/05 (migration `20260518_01_pim_candidates_on_tenant_order_items.sql`). Aucune action additionnelle dans S-MIGRATION-ORDERS. Test E2E AC8 valide aussi que P0.10 fire correctement.

## Décisions techniques

| Décision | Choix | Argument |
|---|---|---|
| Transaction items | 2 inserts séparés (order puis batch items) avec cleanup compensatoire en cas d'échec partiel | Plus simple que RPC SQL transactionnel pour MVP démo. Risque rollback partiel = acceptable car submitCart est synchrone et user feedback immédiat. Story future `S-RPC-CREATE-ORDER-TRANSACTIONAL` pour V2. |
| `created_by` pour acheteur anonyme | NULL si pas authentifié | RLS `tenant_orders` doit accepter `created_by=null` pour les boutiques publiques. À vérifier via SQL en pre-flight. Sinon : générer un UUID anonyme stocké en localStorage. |
| `clariprint_options` snapshot | `cart.product.config` JSONB tel quel | Cohérent avec le modèle "snapshot" des items (immuable post-validation). |
| Fallback `currency` | `'EUR'` hard-coded | Hors scope multi-currency v1.1. |
| Pattern Zod | Schema `tenantOrderInsertSchema` + `tenantOrderItemInsertSchema` | Cohérent avec convention `src/schemas/` (cf. `shopOrder.schema.ts` existant). |
| Trigger PIM adaptation | À décider en pre-flight | Si bloquant, story P0.10 dédiée. |

## Risques & mitigations

| Risque | Mitigation |
|---|---|
| Pre-flight Check 1 fail (shops.tenant_id absent) | Bloque la story. Discussion avec Arnaud. Option : ajouter colonne via migration P0.10b. |
| RLS bloque INSERT anonyme | Pre-flight SQL test avec `auth.uid()=null`. Si bloque, ajouter policy spécifique ou exiger auth pour valider panier (UX impact). |
| Rollback partiel échoue (items insertés mais cleanup order échoue) | Log + alerte utilisateur explicite. Cleanup admin manuel possible via SQL. Acceptable MVP. |
| Trigger PIM rompu silencieusement | Tester en post-déploiement : passer commande de test, vérifier `pim_candidates` peuplé. Si pas, créer story P0.10. |
| ID `lib-...` non UUID dans cart items | Code existant `submitCart` ligne 281-294 a déjà la défense UUID_RE. Réutiliser. |

## Procédure d'exécution

### Étape 1 — Pre-flight checks (Claude Code via SQL CLI)
```sql
-- Check 1 : shops.tenant_id existe + populated
select count(*) as shops_total, count(tenant_id) as shops_with_tenant from public.shops;

-- Check 2 : triggers actuels sur shop_orders et tenant_orders/items
select trigger_name, event_manipulation, event_object_table from information_schema.triggers
  where event_object_table in ('shop_orders', 'tenant_orders', 'tenant_order_items')
  order by event_object_table;

-- Check 3 : RLS policy INSERT tenant_orders, voir si created_by null accepté
select polname, polqual, polwithcheck from pg_policy
  where polrelid = 'public.tenant_orders'::regclass;
```

### Étape 2 — Décision GO/NO-GO sur trigger PIM (Arnaud)
Selon Check 2 + 3, soit on adapte le trigger soit on reporte (story P0.10 séparée).

### Étape 3 — Code submitCart()
Refacto en suivant AC3 + AC4. Zod schema + 2 inserts + rollback compensatoire.

### Étape 4 — Tests vitest
2 nouveaux cas (AC7).

### Étape 5 — Test manuel (Arnaud)
Passer une commande de test sur localhost:5177, vérifier SQL.

### Étape 6 — Cleanup test order (Arnaud + Claude Code)
```sql
delete from public.tenant_order_items where order_id in (
  select id from public.tenant_orders where notes like '%test S-MIGRATION%'
);
delete from public.tenant_orders where notes like '%test S-MIGRATION%';
```

## TF Notion à créer en fin de story

- **TF "submitCart() insère dans tenant_orders + items au lieu de shop_orders"** :
  - Parcours : P09 — Boutique portail B2B
  - Persona : Acheteur shop_only
  - Type : Manuel humain + IA Chrome + SQL DB
  - URL départ : http://localhost:5177/shop/{slug}
  - Étapes : sélectionner produit → ajouter au panier → ouvrir drawer → valider → vérifier en SQL prod `select * from tenant_orders order by created_at desc limit 1`
  - Résultat attendu : ligne dans tenant_orders avec `status='draft'`, `tenant_id` set, items dans tenant_order_items

## Notes

Story prerequis à S-DUAL-READ. Si pre-flight check 1 ou 2 échoue, S-DUAL-READ est aussi bloquée.
