# Story S7.11 — Schéma + RPC self-signup (Epic 7, Sprint V2-C)

> **Statut** : en cours — 2026-07-26
> **Agent** : Amelia (bmad-dev-story)
> **ADR** : §4.20 ADR-CHECKOUT-1 (points 2-3) — `shops.access_mode` +
> `self_register_shop_buyer` SECURITY DEFINER, allow-list stricte.

## Décisions d'implémentation

1. **Migration `20260726000100_s7_11_shop_access_mode_self_signup.sql`** :
   - `shops.access_mode text NOT NULL DEFAULT 'invite_only'
     CHECK IN ('invite_only','self_signup')` — rétro-compat totale (toutes
     les boutiques existantes restent privées).
   - RPC `self_register_shop_buyer(p_shop_id uuid) RETURNS jsonb`
     SECURITY DEFINER, `GRANT EXECUTE TO authenticated` uniquement :
     (a) vérifie `auth.uid()` ; (b) vérifie boutique `active` ET
     `access_mode='self_signup'` (sinon `shop_not_open`) ; (c) idempotente si
     déjà membre (`already_member`, ajoute la boutique aux allowed_shop_ids
     si manquante) ; (d) INSERT `tenant_members` **allow-list stricte**
     (lesson 2026-05-27) : role `member`, `access_scope='shop_only'`,
     `allowed_shop_ids=[p_shop_id]`, permissions `{can_order, can_quote}` ;
     (e) assigne le preset « Acheteur » du tenant (`tenant_role_definitions`
     name='Acheteur' → `tenant_role_assignments`, best-effort si le preset
     manque).
2. **Déploiement prod B5** via Management API (PAT Keychain) + `db:types`.
3. **Toggle BO** : select « Accès boutique » (Sur invitation / Inscription
   libre) dans `DashboardShopEditor`, champ `access_mode` sur le type `Shop`.
4. **Tests** : `tests/rpc/self_register_shop_buyer.test.ts` — utilisateur
   éphémère (admin API service role) : refus invite_only, succès self_signup
   (membre shop_only + rôle Acheteur), idempotence, refus anonyme.

## Acceptance Criteria

- **AC1** : migration appliquée prod B5 ; boutiques existantes toutes
  `invite_only` ; RPC visible dans les types générés.
- **AC2** : RPC refuse boutique invite_only/inactive/anonyme ; crée le membre
  `shop_only` + rôle Acheteur sur boutique self_signup ; idempotente.
- **AC3** : jamais d'accès magrit_full ni multi-boutiques par cette voie.
- **AC4** : toggle BO persiste `access_mode` ; 0 régression.

## TF Notion — créé directement dans la DB (TF-S7.11, type SQL DB + IA Chrome)
