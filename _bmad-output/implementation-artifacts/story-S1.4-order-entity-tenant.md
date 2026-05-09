---
story_id: S1.4
epic: 1 — Stack Foundations
title: Order entity DB schema + RLS + tests vitest (tables tenant_orders/*)
status: livrée
delivered_at: 2026-05-09 (rename + apply 2026-05-10 par Arnaud via SQL Editor)
target_branch: beta/v5
agent: Dev (rétrofit document 2026-05-10)
size: M
commits: [1a29481, 4b2091c, 9d70e58]
---

# Story S1.4 — Order entity Tenant

## Story

**As a** dev Magrit
**I want** le schéma Order entity (orders, order_items, order_status_events) appliqué en migration Supabase avec RLS strict et 6 tests d'isolation
**So that** toute story aval Epic 3 (user-facing commandes) puisse s'appuyer sur des fondations DB sécurisées et anti-fuite cross-tenant.

## AC validés

**AC1** ✅ Migration `20260509_01_e1_orders_v1_1.sql` créée et **appliquée en prod** sur `ightkxebexuzfjdbpsdg` (via Dashboard SQL Editor le 2026-05-10)
**AC2** ✅ 3 tables créées : `tenant_orders`, `tenant_order_items`, `tenant_order_status_events`
**AC3** ✅ Enum `tenant_order_status` (7 valeurs : draft, validated, in_production, shipped, delivered, invoiced, cancelled)
**AC4** ✅ 5 indexes sur `tenant_id+shop_id`, `created_by`, `status`, `order_id`
**AC5** ✅ Hooks e-invoicing FR (NFR16) : colonnes nullable `invoice_number`, `invoice_status`, `pa_id`, `ppf_message_id` + `stripe_payment_intent_id`
**AC6** ✅ RLS strict : 8 policies (4 sur orders + 4 sur order_items + 2 sur order_status_events), helpers existants `current_user_can_access_shop` + `user_role_in_tenant` + `is_super_admin`
**AC7** ✅ RPC `update_tenant_order_status()` security definer avec matrice de transitions v1.1
**AC8** ✅ Trigger `trg_tenant_orders_updated_at` auto
**AC9** ✅ Tests vitest `tests/rls/orders_isolation.test.ts` — **6 cas** couverts
**AC10** ✅ Audit trail garanti (RPC seul peut insérer dans `order_status_events`, RLS bloque insert direct)

## Incidents et résolutions (parcours non-linéaire)

### Incident 1 — Policies RLS échouaient avec "column tenant_id does not exist"

**Cause** : `orders.tenant_id` qualifié dans une sous-requête EXISTS — Postgres ne résout pas la référence dans le contexte RLS.
**Fix** (commit `4b2091c`) : remplacer le pattern EXISTS manuel par le helper existant `public.user_role_in_tenant(tenant_id)` (déjà éprouvé par les policies tenants/tenant_members).

### Incident 2 — Migration toujours en erreur après le fix policies

**Cause découverte par debug** : **collision avec table legacy `public.orders`** créée par `20260418_user_data.sql` (user_id-based, mode démo) + `public.shop_orders` (shop-owner-based). Mon `create table if not exists public.orders` était **skipé silencieusement** → policies cherchaient `tenant_id` dans le schéma legacy qui ne l'a pas.

**Fix** (commit `9d70e58`) : **rename complet** des tables avec préfixe `tenant_*` :
- `orders` → `tenant_orders`
- `order_items` → `tenant_order_items`
- `order_status_events` → `tenant_order_status_events`
- enum `order_status` → `tenant_order_status`
- RPC `update_order_status` → `update_tenant_order_status`
- Trigger `trg_orders_updated_at` → `trg_tenant_orders_updated_at`

**Bénéfice :** ce naming aligne avec la convention existante (`tenant_members`, `tenant_invitations`, `tenant_member_events`, `tenant_slug_history`, `tenant_gamme_subscriptions`) — c'est en fait architecturalement plus propre.

## Décisions importantes

| Décision | Justification |
|---|---|
| **Préfixe `tenant_*`** sur toutes les nouvelles tables Order entity | Cohérence convention + évite collision legacy. Documenté en Architecture §4.1 (note explicite) + Epics S1.4. |
| **Snapshot `clariprint_options` JSONB dans `order_items`** | Immutabilité événementielle. Si Clariprint change ses options dans 3 mois, l'historique commande reste interprétable. |
| **`product_label` snapshot** | Même logique. |
| **`ON DELETE CASCADE` sur `tenants`** | RGPD droit à l'effacement (NFR10). |
| **`ON DELETE RESTRICT` sur `shops`** | Audit, on ne supprime pas une boutique tant qu'elle a des commandes. |
| **RPC seule peut insérer dans `order_status_events`** | Audit trail garanti (pattern E9.3). Policies RLS bloquent insert direct. |
| **Matrice transitions v1.1 limitée** (`draft → cancelled` ou `draft → validated`) | Workflow complet reporté V2+ (E4.2 complet). |

## Fichiers touchés

| Fichier | Modif |
|---|---|
| `supabase/migrations/20260509_01_e1_orders_v1_1.sql` (nouveau) | 277 lignes (final, après 2 fixes) |
| `tests/rls/orders_isolation.test.ts` (nouveau) | 326 lignes — 6 cas de test |

## Tests vitest — 6 cas

1. ✅ Cas 1 — cross-tenant SELECT bloqué
2. ✅ Cas 2 — cross-tenant INSERT bloqué
3. ✅ Cas 3 — cross-shop SELECT bloqué pour acheteur shop_only
4. ✅ Cas 4 — cancel sans permission bloqué
5. ✅ Cas 5 — superadmin Magrit bypass OK (avec warning si env n'expose pas via JWT)
6. ✅ Cas 6 — RPC `update_tenant_order_status` respecte la matrice (illegal rejected, legal OK + audit event créé)

**Note tests** : skipés automatiquement si `.env.test` absent (cf. `tests/rls/setup.ts`).

## Écarts vs PRD/Architecture

- **Naming** : tables `tenant_*` au lieu de `orders`/`order_items`/`order_status_events` (Architecture §4.1 spec initiale). **Mappé explicitement** dans Architecture §4.1 (note ajoutée 2026-05-09) et Epics S1.4.
- Le naming logique côté code (`Order`, `OrderItem`) reste inchangé — seul le mapping SQL est ajusté.

## Commits

- `1a29481` : `feat(v5): Order entity v1.1 schema RLS strict + 6 tests vitest (S1.4)` (initial)
- `4b2091c` : `fix(v5): policies orders utilisent helper user_role_in_tenant (S1.4 fix)` (fix 1)
- `9d70e58` : `fix(v5): prefixe tenant_* sur tables Order entity v1.1 pour eviter collision (S1.4)` (fix 2)

## Statut

✅ **Livrée et appliquée en prod** (Supabase project `ightkxebexuzfjdbpsdg`).
✅ **Tests vitest prêts**, à lancer en local avec `.env.test`.
⏳ **Cas TF Notion** : à créer pour la traçabilité humaine (cf. Action 2).
