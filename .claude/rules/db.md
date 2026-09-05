---
paths:
  - "supabase/migrations/**"
---

# Conventions base de données — Sprint 5 Gestion commerciale

- Montants : `numeric(12,2)`. Taux : `numeric(6,4)`. Jamais de `float`/`double precision` sur un prix ou un taux.
- Dates : `timestamptz` en UTC ; date seule en `date` (`YYYY-MM-DD`).
- Identifiants : `uuid` (v4) en clé primaire. Les numéros métier (`DEV-2026-00042`, `CMD-2026-00017`) sont des colonnes, jamais des clés.
- Une migration = une story. Réversible (bloc `down` explicite ou migration inverse documentée si l'outillage ne le permet pas nativement).
- RLS obligatoire sur toute table portant `tenant_id`, **et testée** — un test qui vérifie qu'un tenant A ne lit/écrit jamais les lignes d'un tenant B, pas seulement que `enable row level security` est présent dans la migration.
- Tables d'audit et d'historique en append-only : `revoke update, delete on <table> from authenticated, anon;` (garder `insert`/`select` selon le besoin). Aucune ligne d'audit n'est éditée ni supprimée par l'application.
- Style à reprendre (déjà en place, ex. `20260824000200_um1_admin_shop_guards.sql`, `20260816000100_shop_customer_accounts.sql`, `20260808000100_gescom_price_rules.sql`) :
  - `drop policy if exists "<table>_select" on <table>;` avant chaque `create policy` (idempotence) ;
  - policies nommées `"<table>_select"` / `"<table>_write"` ;
  - filtrage par `tenant_id in (select public.current_user_tenant_ids())`, échappatoire `is_super_admin()` en tête de `using (...)` ;
  - écriture réservée aux rôles habilités via `exists (select 1 from public.tenant_members tm where tm.tenant_id = ... and tm.user_id = auth.uid() and tm.role in (...))` ;
  - `revoke all on table/function ... from public, anon[, authenticated];` par défaut, exposition via fonctions `security definer` préfixées `api_*` quand nécessaire ;
  - contraintes de cohérence par `check (...)` plutôt que validation applicative seule.
- Avant d'écrire une nouvelle table pour une notion qui pourrait déjà exister (ex. entité Client, règles de prix), vérifier `docs/api/CONVENTIONS.md` et les migrations déjà présentes — plusieurs briques Sprint 5 (`client_price_rules`, `client_groups`, `shop_customer_accounts`, `access_scope`) existent déjà et ne doivent pas être dupliquées sous un autre nom.
- Aucune modification manuelle en base : tout passe par une migration versionnée dans `supabase/migrations/`.
