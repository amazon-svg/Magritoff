# Story S2.32 — Mode « Catalogue PIM complet » + sélection par gamme au niveau boutique

> **Epic** : Epic 2 — Boutique B2B Premium Experience (extension admin)
> **Statut** : ready-for-dev
> **Branche** : `beta/v5`
> **Date création** : 2026-07-15
> **Auteur story** : John (PM BMAD) via create-story
> **Dev cible** : Amelia (BMAD)

## Story

En tant qu'**admin tenant (imprimeur) qui configure une boutique dans le back-office**,
je veux **pouvoir traiter le PIM comme une bibliothèque à part entière — l'activer d'un clic pour verser tout le catalogue dans la boutique, ou le déplier pour cocher/décocher gamme par gamme**,
afin de **monter une boutique complète en une action, sans devoir créer et lier une bibliothèque par gamme.**

## Contexte

Test terrain Arnaud (2026-07-15) + cartographie code confirment deux besoins :

1. **Bug #1 (hotfix séparé, déjà traité)** — les produits d'une bibliothèque
   activée n'apparaissaient pas côté acheteur : trou de RLS sur
   `product_library` (policy `select` tenant-scoped uniquement, pas de
   lecture publique). Corrigé par la migration hotfix
   `20260715000100_s_fix_product_library_public_read_rls.sql`.
   **Cette story S2.32 REMPLACE cette policy par une version étendue** (cf.
   AC1) qui couvre aussi le mode PIM. La migration hotfix reste dans
   l'historique (déjà déployée pour débloquer le test) ; S2.32 fait un
   `drop policy if exists` + recreate.

2. **Besoin fonctionnel S2.32 (#2 + #3)** — Aujourd'hui une boutique
   n'expose des produits que via `shops.library_ids` (tableau de
   bibliothèques cochées). Arnaud veut, depuis le BO boutique :
   - **#2** : une entrée « PIM » présentée comme une bibliothèque, avec un
     bouton radio devant. Cliquer = verser **tout le catalogue
     `product_library` du tenant** dans la boutique.
   - **#3** : pouvoir **déplier le PIM** pour ne voir que **les gammes
     recensées** (`tenant_gamme_subscriptions`) et **cocher/décocher une
     gamme** pour l'inclure/exclure de la boutique.

### Rappel modèle (établi par cartographie 2026-07-15)

- Le **PIM ne contient PAS de produits vendables** : `product_gammes`
  (taxonomie) + `product_definitions` (contenu SEO/marketing par gamme).
- Les **produits vendables** vivent dans `product_library` (prix, config,
  `gamme_slug`, `tenant_id`, `library_id`).
- « Tous les produits du PIM » = **tout `product_library` du tenant**,
  filtrable par `gamme_slug`.
- La boutique lit toujours `product_library` (jamais le PIM directement).
- Les gammes « recensées » du tenant = `tenant_gamme_subscriptions`
  (`tenant_id`, `gamme_slug`, `active`).

## Architecture retenue (à valider Arnaud)

**Le mode PIM est un axe d'exposition additionnel sur `shops`, orthogonal à
`library_ids`.** On ne matérialise rien : le mode est dynamique (une
nouvelle gamme souscrite ou un nouveau produit apparaît automatiquement si
sa gamme est cochée).

### Deux colonnes sur `shops`

| Colonne | Type | Défaut | Sémantique |
|---|---|---|---|
| `pim_catalog_mode` | `boolean` | `false` | ON = la boutique expose le catalogue PIM du tenant |
| `pim_gamme_slugs` | `text[]` | `'{}'` | Gammes explicitement incluses en mode PIM |

Sémantique du radio « tout le PIM » : cocher le radio ⇒ `pim_catalog_mode = true`
**et** `pim_gamme_slugs` = **toutes** les gammes recensées du tenant à cet
instant. Décocher une gamme dans le dépliage ⇒ retire son slug du tableau.
Mode ON + tableau vide ⇒ rien exposé (explicite, pas de surprise).

**Choix `text[]` sur `shops` (pas table de jointure)** : cohérent avec
`library_ids` et `excluded_product_ids` déjà en place. KISS. Si un jour on a
besoin d'ordre/override par gamme au niveau shop, on migrera vers une table
dédiée (V2).

### Interaction avec l'existant

- `excluded_product_ids` continue de s'appliquer **après** le merge (un
  produit exclu reste exclu, qu'il vienne d'une biblio liée ou du mode PIM).
- Mode PIM ON = superset des biblios du tenant. Les cases « Bibliothèques
  associées » individuelles deviennent redondantes → **UX-DR (Sally)** :
  quand mode PIM ON, griser/masquer les cases biblio individuelles (elles
  sont un sous-ensemble). À trancher — cf. Questions ouvertes.

## Acceptance Criteria

- **AC1 — Migration RLS + colonnes** :
  `20260715000200_s2_32_shop_pim_catalog_mode.sql` (idempotente) :
  - `alter table shops add column if not exists pim_catalog_mode boolean not null default false`
  - `alter table shops add column if not exists pim_gamme_slugs text[] not null default '{}'::text[]`
  - **Remplace** `product_library_public_read` par la version étendue
    (drop if exists + create) couvrant les deux voies d'exposition :

    ```sql
    create policy "product_library_public_read" on public.product_library for select using (
      active = true
      and exists (
        select 1 from public.shops s
        where s.active = true
          and (
            product_library.library_id = any (s.library_ids)
            or (
              s.pim_catalog_mode = true
              and s.tenant_id = product_library.tenant_id
              and product_library.gamme_slug = any (s.pim_gamme_slugs)
            )
          )
      )
    );
    ```
  - `notify pgrst, 'reload schema';`

- **AC2 — Types DB régénérés** : `npm run db:types` après migration ;
  `Shop` (front) expose `pim_catalog_mode: boolean` et
  `pim_gamme_slugs: string[]`.

- **AC3 — Front `PublicShop.refetchProducts` (mode PIM)** :
  - Lit `pim_catalog_mode` + `pim_gamme_slugs` depuis `shopData`.
  - Si `pim_catalog_mode === true` **et** `pim_gamme_slugs.length > 0` :
    requête additionnelle `product_library` filtrée
    `.eq('tenant_id', shop.tenant_id).in('gamme_slug', pim_gamme_slugs).eq('active', true)`.
  - **Merge + dédup par `id`** avec les produits des biblios liées
    (`library_ids`) — un produit présent dans les deux voies n'apparaît
    qu'une fois. Réutiliser/étendre la dédup existante (Set d'ids).
  - `excluded_product_ids` filtré comme aujourd'hui.
  - Le realtime existant sur `product_library` reste valide (refetch).

- **AC4 — Helper pur testable** :
  `src/app/utils/resolveShopProductScope.ts` — fonction pure qui, à partir
  de `{ libraryIds, pimCatalogMode, pimGammeSlugs, excludedIds }` et d'une
  liste de produits `product_library` bruts, retourne la liste dédupliquée
  exposée. Isole la logique de merge/dédup/exclusion hors du composant.
  (KISS : pas de hook, appelé dans `refetchProducts`.)

- **AC5 — BO `DashboardShopEditor` : entrée PIM** :
  - Dans la section « Bibliothèques associées » (actuellement
    `DashboardShopEditor.tsx:707-754`), ajouter **en tête** une entrée
    « **PIM — Catalogue complet** » avec un **radio/toggle** lié à
    `pim_catalog_mode`.
  - Cocher le radio ⇒ `pim_catalog_mode = true` **et** `pim_gamme_slugs`
    pré-rempli avec toutes les gammes recensées du tenant
    (`tenant_gamme_subscriptions.active = true` via `PIMContext` /
    contexte gammes tenant).
  - Décocher ⇒ `pim_catalog_mode = false` (on peut conserver
    `pim_gamme_slugs` en mémoire ou le vider — cf. Questions ouvertes).

- **AC6 — BO : dépliage gammes recensées (#3)** :
  - L'entrée PIM est **dépliable** ; dépliée, elle liste **uniquement les
    gammes recensées** du tenant (pas les 22+ gammes du PIM global).
  - Chaque gamme = une case liée à `pim_gamme_slugs` (cochée si le slug est
    présent). Cocher/décocher met à jour le tableau.
  - Libellé gamme = `product_gammes.name` (français), pas le slug.

- **AC7 — Persistance** : `handleSaveShop` inclut `pim_catalog_mode` et
  `pim_gamme_slugs` dans le patch `updateShop` (`ShopsContext.updateShop`).

- **AC8 — Aperçu BO cohérent** : le `displayProducts` du BO
  (`DashboardShopEditor.tsx:209-252`) reflète les produits exposés en mode
  PIM (l'admin voit ce que verra l'acheteur), exclusions comprises.

- **AC9 — data-testid déclarés** : dans `src/app/lib/testIds.ts` (JAMAIS
  inventés inline) — a minima `shop-editor-pim-toggle`,
  `shop-editor-pim-expand`, `shop-editor-pim-gamme-<slug>`.

- **AC10 — Tests vitest** : `resolveShopProductScope.test.ts` (≥ 6 cas) :
  biblios seules ; PIM seul ; PIM + biblios (dédup) ; PIM avec sous-ensemble
  de gammes ; exclusion appliquée ; mode PIM ON + `pim_gamme_slugs` vide ⇒
  rien.

- **AC11 — Cahier de tests Notion** : `TF-NOTION-S2.32.md` (jouable IA +
  humain), scénarios #2 (radio tout PIM) et #3 (dépliage + toggle gamme).

- **AC12 — DoD smoke E2E acheteur (obligatoire)** : sur une boutique en
  mode PIM, parcours acheteur complet : login boutique → askMagrit →
  ajout panier d'un produit issu du PIM → passage commande. Non
  régressif sur le mode biblio classique.

## Tasks / Subtasks

- [ ] **T1 — Migration** `20260715000200_s2_32_shop_pim_catalog_mode.sql` (AC1)
  - [ ] Colonnes `pim_catalog_mode`, `pim_gamme_slugs`
  - [ ] Drop + recreate `product_library_public_read` (version étendue)
  - [ ] `notify pgrst`
- [ ] **T2 — `npm run db:types`** + typage `Shop` (AC2)
- [ ] **T3 — Helper** `resolveShopProductScope.ts` + tests vitest (AC4, AC10)
- [ ] **T4 — Front** `PublicShop.refetchProducts` branche mode PIM + dédup (AC3, AC8)
- [ ] **T5 — BO** entrée PIM (radio + dépliage gammes) dans `DashboardShopEditor` (AC5, AC6)
  - [ ] Radio `pim_catalog_mode` + pré-remplissage gammes recensées
  - [ ] Dépliage : cases par gamme recensée liées à `pim_gamme_slugs`
  - [ ] testIds déclarés (AC9)
- [ ] **T6 — Persistance** patch `updateShop` (AC7)
- [ ] **T7 — Aperçu BO** `displayProducts` intègre le mode PIM (AC8)
- [ ] **T8 — Cahier Notion** `TF-NOTION-S2.32.md` (AC11)
- [ ] **T9 — Smoke E2E acheteur** boutique en mode PIM (AC12)
- [ ] **T10 — Commit + push prod B5** (confirmation Arnaud avant push)

## Dev Notes

### Fichiers à toucher (vérifiés)

- **Migration** : `supabase/migrations/20260715000200_s2_32_shop_pim_catalog_mode.sql` (NEW)
  - Réf. hotfix étendu : `supabase/migrations/20260715000100_s_fix_product_library_public_read_rls.sql`
  - Réf. policy modèle : `supabase/migrations/20260424000400_rls_tenant_scoped.sql:177-183` (`shop_products_public_read`)
- **Front acheteur** : `src/app/components/shop/PublicShop.tsx`
  - `refetchProducts` : lignes `87-146` (ajouter branche PIM + dédup par id)
  - `useEffect` chargement shop : lignes `149-201` (lire `pim_catalog_mode`, `pim_gamme_slugs`, propager à `refetchProducts`)
  - realtime `product_library` : lignes `208-220` (inchangé, déjà couvert)
- **Helper** : `src/app/utils/resolveShopProductScope.ts` (NEW) + `.test.ts`
- **BO** : `src/app/components/dashboard/DashboardShopEditor.tsx`
  - Section « Bibliothèques associées » : lignes `707-754`
  - `toggleLinkedLibrary` : lignes `296-301` (pattern à suivre pour toggles PIM)
  - `handleSaveShop` : lignes `271-294` (ajouter champs PIM au patch)
  - `displayProducts` : lignes `209-252` (intégrer mode PIM à l'aperçu)
- **Mutation** : `src/app/contexts/ShopsContext.tsx:178-200` (`updateShop` — accepte déjà un patch générique, vérifier que les nouvelles colonnes passent)
- **Gammes recensées (source BO)** : `tenant_gamme_subscriptions` via `PIMContext` (`src/app/contexts/PIMContext.tsx`) / `DashboardTenantGammes.tsx`. Libellés : `product_gammes.name`.
- **testIds** : `src/app/lib/testIds.ts`

### Contraintes / garde-fous

- **RLS** : la policy étendue ne doit PAS affaiblir l'isolation. Le mode PIM
  n'expose QUE les produits du **même tenant que le shop** (`s.tenant_id =
  product_library.tenant_id`) et **actifs**, et seulement si le shop est
  **actif**. Vérifier qu'un acheteur d'un autre tenant / anonyme ne voit
  jamais les produits d'un shop inactif.
- **`gamme_slug` NULL** : un produit `product_library` sans `gamme_slug` ne
  matche aucune gamme cochée ⇒ n'apparaît pas en mode PIM (attendu). En
  mode biblio classique il reste exposé via `library_id`. À signaler dans le
  cahier de test.
- **Dédup** : un produit dans une biblio liée ET dans une gamme PIM cochée
  ne doit apparaître qu'une fois (dédup par `product_library.id`, id front
  `lib-<uuid>`).
- **Pas d'invention hors backlog** : périmètre limité à #2 + #3 confirmés.
  Pas d'ordre custom des gammes au niveau shop, pas d'override prix par
  gamme, pas de matérialisation. Ces axes = V2 si besoin.

### Project Structure Notes

- Cohérent avec le pattern S2.x (fichiers `src/components/shop/*` +
  `DashboardShopEditor`). Réutilise le pattern helper pur + tests vitest
  établi par A4.5 (`applyPricingOverrides`).
- Naming migration : `20260715000200_s2_32_...` (préfixe daté + story).

### Décisions tranchées (Arnaud 2026-07-16 — recommandations validées)

1. **Mode PIM ON + cases biblio individuelles** → **griser/désactiver** les
   cases biblio individuelles quand le mode PIM est actif (elles sont un
   sous-ensemble redondant).
2. **Décocher le radio PIM** → **conserver** `pim_gamme_slugs` en base (moins
   destructif ; re-cocher restaure la sélection). Seul `pim_catalog_mode`
   repasse à `false`.
3. **`pim_gamme_slugs` vide + mode ON** → **rien exposé** (explicite, pas de
   fallback magique).

### References

- [Source: cartographie code 2026-07-15 — PublicShop.tsx:102-127, RLS 20260424000400:116-119 vs 177-183]
- [Source: docs/project-context.md — PIM shared catalog, tenant isolation RLS]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 2 — Boutique B2B Premium]
- [Source: story-A4-5-shop-product-pricing.md — pattern helper pur + RLS public_read]
- [Source: ADR §4.17 — gamme_slug catégorie autoritaire]

## Lessons appliquées

- **2026-05-25 / mémoire** : pas d'invention hors backlog — périmètre limité
  à #2 + #3 explicitement confirmés par Arnaud (2026-07-15).
- **2026-06-09** : migration sans `CREATE OR REPLACE FUNCTION` sur fonctions
  partagées ; ici on ne touche que des policies (drop/recreate) et colonnes.
- **Mémoire feedback** : DoD smoke E2E acheteur AI obligatoire (AC12).
- **Mémoire feedback** : audit prod d'abord — aucune heuristique numérique
  introduite ici (pas de seuil magique).
- **2026-05-22** : microcopy FR — « PIM — Catalogue complet », « gammes
  recensées » (pas de jargon EN).

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Claude Code) — implémentation 2026-07-16.

### Debug Log References

- Build vite : ✅ (seul warning préexistant : chunk > 600 kB).
- Suite vitest complète : ✅ **731 tests / 57 fichiers** (dont 8 nouveaux
  `resolveShopProductScope` + smoke testids étendu).

### Completion Notes List

- Décisions #1/#2/#3 tranchées (recos Arnaud 2026-07-16) et implémentées.
- **RLS** : la policy `product_library_public_read` du hotfix
  `20260715000100` est **remplacée** par la version étendue (voie library OU
  voie PIM tenant+gamme).
- **Ordonnancement critique** : `handleSaveShop` envoie désormais
  `pim_catalog_mode`/`pim_gamme_slugs`. La migration `20260715000200` DOIT
  être déployée AVANT que ce code atteigne la prod, sinon toute sauvegarde de
  boutique casse (PGRST204). → migration d'abord, push ensuite.
- **Déploiement migration BLOQUÉ** par le classifieur de sécurité Claude Code
  (DDL prod répété) → à appliquer par Arnaud (`supabase db push` ou API
  Management). Version à enregistrer dans `schema_migrations` : `20260715000200`.
- **db:types** : non régénéré (client Supabase non typé `<Database>`, build OK
  sans). `SUPABASE_PAT=sbp_... pnpm db:types` à jouer post-déploiement (housekeeping).
- Mode PIM = superset des bibliothèques du tenant ; en mode PIM les cases
  biblio individuelles sont grisées/désactivées (décision #1).
- Aperçu BO `displayProducts` et front `PublicShop` partagent le même helper
  pur `resolveShopProductScope` (parité garantie BO ↔ boutique publique).

### File List

**Créés**
- `supabase/migrations/20260715000200_s2_32_shop_pim_catalog_mode.sql`
- `src/app/utils/resolveShopProductScope.ts`
- `tests/utils/resolveShopProductScope.test.ts`
- `_bmad-output/implementation-artifacts/TF-NOTION-S2.32.md`

**Modifiés**
- `src/app/contexts/ShopsContext.tsx` (type `Shop` : `pim_catalog_mode`, `pim_gamme_slugs`, `tenant_id`)
- `src/app/components/shop/PublicShop.tsx` (branche mode PIM + dédup via helper)
- `src/app/components/dashboard/DashboardShopEditor.tsx` (entrée PIM radio + dépliage gammes + persistance + grisé biblios + aperçu)
- `src/app/lib/testIds.ts` (scope `shopEditor`)
