---
story_id: P0.10
epic: Sprint 4 — PIM-Boutique-Commandes (Phase 0 Préalables — découvert pre-flight Phase 1)
title: Trigger PIM enqueue_pim_candidates_on_tenant_order_item (parité shop_orders)
status: livrée
delivered_at: 2026-05-17
final_result: "trigger trg_enqueue_pim_tenant_order_item actif sur tenant_order_items (INSERT). Smoke check OK : 1 ligne dans information_schema.triggers. Test E2E sera fait via S-MIGRATION-ORDERS."
target_branch: beta/v5
agent: Dev (Claude Code) + Arnaud (validation application migration)
size: S (~0.5j, migration SQL + smoke check)
depends_on: P0.4 livrée (pipeline PIM fonctionnel)
unblocks: S-MIGRATION-ORDERS (bascule submitCart vers tenant_orders sans rompre PIM)
discovered_in: Pre-flight check 2 de S-MIGRATION-ORDERS — 2026-05-17
---

# Story P0.10 — Trigger PIM tenant_order_items

## Story (As / I want / So that)

**As an** architecte projet Magrit
**I want** qu'à chaque insertion d'une ligne `tenant_order_items` (post-bascule S-MIGRATION-ORDERS), un candidat PIM soit automatiquement créé dans `pim_candidates` (avec `source_tenant_id`, `source_user_id`, `raw_config`)
**So that** la bascule du modèle d'orders ne rompe pas le pipeline d'ingestion PIM (qui était précédemment branché sur `shop_orders.items` JSONB via le trigger `trg_enqueue_pim_shop_order`), et que l'enrichissement automatique des fiches produit continue de fonctionner sur les nouvelles commandes v1.1.

## Contexte

Pre-flight check 2 de S-MIGRATION-ORDERS (2026-05-17) a révélé :

```sql
-- Trigger sur shop_orders (legacy, INSERT) ✅ existe
-- Aucun trigger PIM sur tenant_orders ou tenant_order_items ❌
```

Après bascule submitCart → tenant_orders (S-MIGRATION-ORDERS), aucune ingestion PIM ne se déclenche → les nouvelles commandes ne créent plus de fiches `product_definitions`. Régression silencieuse.

Solution : porter le trigger sur `tenant_order_items` (cohérent avec le modèle relationnel où chaque item = 1 ligne, donc 1 candidat par INSERT item).

## Acceptance Criteria

**AC1** — Migration SQL `supabase/migrations/20260518_01_pim_candidates_on_tenant_order_items.sql` créée avec :
- Fonction `public.enqueue_pim_candidates_on_tenant_order_item()` (security definer, plpgsql)
- Trigger `trg_enqueue_pim_tenant_order_item` AFTER INSERT sur `tenant_order_items`
- Idempotent (`drop trigger if exists` + `create or replace function`)

**AC2** — La fonction trigger :
1. Récupère `tenant_id`, `created_by`, `shop_owner` via join `tenant_orders → shops` (sur `new.order_id`)
2. Si `tenant_id` null → return new sans créer candidat (shop legacy hors scope PIM)
3. INSERT dans `pim_candidates` :
   - `source_tenant_id` = tenant_id
   - `source_user_id` = `created_by` (acheteur authentifié) ou fallback `shop_owner_user_id`
   - `source_quote_id` = NULL
   - `raw_config` = `new.clariprint_options` JSONB si présent, sinon fallback `{name, quantity, price_ht}` depuis les colonnes
   - `suggested_kind` = `new.clariprint_options->>'kind'`
   - `suggested_gamme` = `new.clariprint_options->>'gamme_slug'`
   - `status` = `'pending'`

**AC3** — Migration appliquée sur Supabase B5 prod (`ightkxebexuzfjdbpsdg`) via `supabase db query --linked --file ...`.

**AC4** — Smoke check post-application :
```sql
-- Vérif trigger créé
select trigger_name, event_object_table from information_schema.triggers
  where event_object_table = 'tenant_order_items';
-- Attendu : 1 ligne avec trigger_name = trg_enqueue_pim_tenant_order_item, event_manipulation = INSERT
```

**AC5** — Test d'intégration manuelle (après S-MIGRATION-ORDERS livrée) :
- Passer une commande de test sur la boutique → 1 ligne `tenant_orders` + N lignes `tenant_order_items`
- Vérifier que N candidats apparaissent dans `pim_candidates` (1 par item) avec `source_tenant_id` correct

**AC6** — Aucune régression sur le trigger `trg_enqueue_pim_shop_order` legacy (qui reste sur `shop_orders` pour les commandes anciennes hypothétiques — ne devrait plus fire car submitCart bascule sur tenant_orders).

## Décisions techniques

| Décision | Choix | Argument |
|---|---|---|
| Granularité trigger | Par INSERT item (1 trigger fire = 1 candidat) | Aligne avec modèle relationnel tenant_order_items (vs JSONB legacy). |
| Source `tenant_id` | Join via tenant_orders → shops | Robuste : récupère tenant_id depuis l'order parent même si shop change ultérieurement. |
| Source `user_id` | `tenant_orders.created_by` prioritaire | Acheteur authentifié = audit trail explicite. Fallback shop_owner si null (cas dégénéré). |
| `raw_config` source | `clariprint_options` JSONB de l'item | Snapshot exact au moment du commit panier (immuable). |
| Fallback raw_config | `{name, quantity, price_ht}` depuis colonnes typées | Cohérent avec le pattern shop_orders existant. |

## Risques & mitigations

| Risque | Mitigation |
|---|---|
| Trigger échoue silencieusement (cascade INSERT bloqué) | Test exhaustif post-déploiement via S-MIGRATION-ORDERS smoke test. Logs Supabase si erreur. |
| `clariprint_options` malformée bloque l'insert | jsonb cast safe via `coalesce(new.clariprint_options, fallback_jsonb)`. |
| Doublons si retrigger / retry submitCart | RLS pim_candidates pas unique sur raw_config. Acceptable (pim-ingest a la déduplication via canonicalKey). |
| Performance dégradée si commande à 100 items | Probabilité quasi-nulle (max 10-20 items par commande B2B typique). Acceptable. |

## Procédure d'exécution

### Étape 1 — Créer migration SQL
Fichier `supabase/migrations/20260518_01_pim_candidates_on_tenant_order_items.sql` (cf. AC1+AC2).

### Étape 2 — Appliquer migration prod
```bash
supabase db query --linked --file supabase/migrations/20260518_01_pim_candidates_on_tenant_order_items.sql
```

### Étape 3 — Smoke check (AC4)
Vérification SQL trigger présent.

### Étape 4 — Test intégration différé
Après S-MIGRATION-ORDERS livrée, validation E2E via création commande test (AC5).

## TF Notion à créer en fin de story

- **TF "Trigger PIM sur tenant_order_items active automatiquement les candidats"** :
  - Parcours : P07 — Tracking consommation IA
  - Persona : Superadmin Magrit
  - Type : SQL DB
  - Étapes : INSERT tenant_orders + tenant_order_items via SQL CLI → vérifier `select count(*) from pim_candidates where created_at > now() - interval '1 minute'` → attendu = nombre d'items insérés
  - Résultat attendu : 1 candidat par item, raw_config = clariprint_options de l'item

## Notes

Story décharge S-MIGRATION-ORDERS d'une AC structurelle (trigger PIM). Livrée AVANT S-MIGRATION-ORDERS pour qu'au moment où submitCart bascule, le PIM continue de fonctionner sans interruption.
