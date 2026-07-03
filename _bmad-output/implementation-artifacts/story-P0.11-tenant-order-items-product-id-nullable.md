---
story_id: P0.11
epic: Sprint 4 — PIM-Boutique-Commandes (Phase 0 Préalables — découvert post S-MIGRATION-ORDERS test manuel)
title: Migration ALTER tenant_order_items.product_id DROP NOT NULL
status: livrée (DB migrée, attente test E2E Arnaud)
delivered_at: 2026-05-18
final_result: "ALTER COLUMN DROP NOT NULL appliqué prod. Smoke check is_nullable=YES confirmé."
target_branch: beta/v5
agent: Dev (Claude Code) + Arnaud (validation application migration)
size: XS (~10min)
depends_on: rien
unblocks: S-MIGRATION-ORDERS test manuel E2E (bloque tant que la contrainte NOT NULL persiste)
discovered_in: S-MIGRATION-ORDERS test manuel Arnaud 2026-05-18 — erreur "null value in column product_id violates not-null constraint"
---

# Story P0.11 — Tenant_order_items product_id nullable

## Story (As / I want / So that)

**As an** acheteur B2B qui valide un panier contenant des items library (`lib-...` non-UUID, héritage v3)
**I want** que la validation du panier réussisse même si certains items n'ont pas de `product_id` UUID valide (en stockant `null` pour ces items)
**So that** la bascule submitCart → tenant_orders (S-MIGRATION-ORDERS) fonctionne sur tous les types de produits du panier sans bloquer les commandes avec un mix UUID + lib-...

## Contexte

S-MIGRATION-ORDERS test manuel Arnaud 2026-05-18 : panier validé avec une "Carte de visite standard 350g couche mat" → erreur Supabase :

```
null value in column "product_id" of relation "tenant_order_items" violates not-null constraint.
```

Cause racine : la migration S1.4 ([`20260509_01_e1_orders_v1_1.sql:71`](supabase/migrations/20260509_01_e1_orders_v1_1.sql)) déclare :
```sql
product_id      uuid not null,
```

Mais le code applicatif (submitCart S-MIGRATION-ORDERS) reproduit le pattern legacy shop_orders.items où certains produits ont un `id` non-UUID (préfixe `lib-...` pour les items library, cf. defense ligne 281 de l'ancienne implémentation : `UUID_RE.test(l.product.id)` pour détecter UUID valide). Le code Zod côté front accepte déjà `product_id.nullable().optional()` mais la DB n'autorise pas null.

**Décision** : assouplir la contrainte DB pour aligner sur le code (pragmatique MVP). La traçabilité produit reste assurée pour les vrais produits (UUID référence) ; les items library legacy peuvent rester sans référence (snapshot `product_label` + `clariprint_options` JSONB suffisent).

## Acceptance Criteria

**AC1** — Migration SQL `supabase/migrations/20260518_02_tenant_order_items_product_id_nullable.sql` créée avec :
```sql
alter table public.tenant_order_items
  alter column product_id drop not null;
```

**AC2** — Migration appliquée sur Supabase B5 prod (`ightkxebexuzfjdbpsdg`) via `supabase db query --linked < ...sql`.

**AC3** — Smoke check post-application :
```sql
select column_name, is_nullable from information_schema.columns
  where table_name = 'tenant_order_items' and column_name = 'product_id';
-- Attendu : is_nullable = YES
```

**AC4** — Test E2E S-MIGRATION-ORDERS (Arnaud sur localhost:5177) :
- Panier avec mix UUID + lib-... items
- Cliquer "Passer commande"
- Vérifier success + ligne dans `tenant_orders` + N items dans `tenant_order_items` (avec product_id = UUID ou null selon source)
- Vérifier trigger PIM P0.10 fire (1 candidat par item)

**AC5** — Code applicatif inchangé : le code Zod actuel (`uuidString.nullable().optional()`) reste correct. Aucun changement front nécessaire.

## Décisions techniques

| Décision | Choix | Argument |
|---|---|---|
| Approche | ALTER COLUMN DROP NOT NULL | Simple, idempotent, aligne avec code Zod actuel. Pas de nouvelle colonne. |
| Traçabilité produit pour items library | Conservée via `product_label` + `clariprint_options` JSONB snapshot | Suffisant MVP. Une migration future S-FIX-LIBRARY-UUID pourra normaliser product_library en UUID. |
| Trigger PIM P0.10 robustesse | Trigger lit `new.clariprint_options` + fallback colonnes — `product_id` n'est pas utilisé | Aucun impact sur le PIM ingestion. |
| Hooks NFR16/E4.3/S5.2 | Inchangés | product_id null impacte juste la requête JOIN avec product_library (rare cas d'analytics post-livraison V2+). |

## Risques & mitigations

| Risque | Mitigation |
|---|---|
| Code futur qui assume product_id NOT NULL | Tous les fetches existants doivent gérer null. Pattern Zod déjà permet (cf. PortalOrders.helpers.ts.tenant_order_items est typé sans product_id requis). |
| Traçabilité produit perdue pour items library | Documentation dans le commit + story future S-FIX-LIBRARY-UUID si besoin. Pour MVP, snapshot suffit. |

## Procédure d'exécution

1. Créer le fichier `supabase/migrations/20260518_02_tenant_order_items_product_id_nullable.sql`
2. Appliquer via `supabase db query --linked < ...sql`
3. Smoke check AC3
4. Test E2E S-MIGRATION-ORDERS par Arnaud
5. Commit + push

## TF Notion

Couvert par le TF S-MIGRATION-ORDERS déjà créé. Pas de TF dédié pour cette migration (interne).

## Notes

Story P0.11 = 11ème story Phase 0 du Sprint 4 (déjà 5 prévues initialement → 11 effectives). 6 bugs prod silencieux découverts au total grâce à la méthode BMAD stricte.
