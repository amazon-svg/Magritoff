# Story A4.1 — Bannière hero + tagline boutique

> **Sprint** : A4 mini-sprint personnalisation (post-démo Magrit Core)
> **Statut** : in_progress
> **Branche** : `beta/v5`
> **Date démarrage** : 2026-06-15
> **Dev** : Amelia (BMAD)

## Contexte

Le CR WM#090626 §A4 demande d'étendre la personnalisation des boutiques B2B
au-delà des couleurs/logo actuelles. Cartographie 2026-06-15 a identifié
3 axes prioritaires : bannière hero, palette élargie + fonts, tarif custom
per-shop. Cette story livre **l'axe 1 — bannière hero + tagline**.

## Objectif

Permettre à un admin tenant de poser une **bannière visuelle** en tête de
boutique publique (`/shop/:slug`) avec :
- Une **image hero** (URL externe — pas d'upload pour MVP)
- Un **tagline** court (max 120 caractères) affiché en overlay

L'imprimeur Pro peut ainsi donner une identité visuelle forte à chaque
boutique sans toucher au logo ni au thème.

## Acceptance criteria

- **AC1** — `shops.hero_image_url` (text, nullable) et `shops.tagline`
  (text, nullable) ajoutés en DB via migration idempotente.
- **AC2** — Type TS `Shop` étendu avec `hero_image_url: string | null` et
  `tagline: string | null`.
- **AC3** — Section « Bannière hero » dans `DashboardShopEditor` avec :
  - 1 input URL (placeholder `https://...`)
  - 1 textarea tagline (rows=2, maxLength=120, compteur visible)
  - Aperçu live (mini-thumbnail 280×80 avec tagline overlay)
- **AC4** — `handleSaveShop` persiste les 2 nouveaux champs.
- **AC5** — `ShopLayout` (chassis prod `/shop/:slug`) affiche la bannière
  hero **avant le header sticky** si `hero_image_url` est non vide :
  - Hauteur 200px desktop / 140px mobile
  - Background `cover` + `center`
  - Tagline en overlay (text-paper, drop-shadow, padding bottom 24px)
  - Aucun rendu si `hero_image_url` vide (état actuel inchangé)
- **AC6** — TestIds : `shop.heroBanner` + `shop.heroTagline` +
  `dashboard.shopHeroUrlInput` + `dashboard.shopTaglineInput`.
- **AC7** — Tests vitest : helper `shouldRenderHeroBanner(shop)` +
  rendering ShopLayout sans/avec hero (smoke).
- **AC8** — Smoke E2E manuel via chrome-devtools MCP : éditer une boutique
  test, ajouter hero, voir la bannière apparaître sur le portail public.

## Tasks

### T1 — Migration SQL `20260615000100_shops_hero_tagline.sql`

```sql
alter table public.shops
  add column if not exists hero_image_url text,
  add column if not exists tagline text;

notify pgrst, 'reload schema';
```

Push prod B5 via `supabase db push --linked --include-all` (PAT keychain).

### T2 — Type Shop dans `src/app/contexts/ShopsContext.tsx`

- Ajouter `hero_image_url: string | null` et `tagline: string | null` à
  l'interface `Shop`.
- Étendre `NewShopInput` avec ces 2 champs optionnels.
- Dans `createShop`, INSERT les valeurs `null` par défaut.

### T3 — UI section « Bannière hero » dans `DashboardShopEditor.tsx`

Insérer une nouvelle `<section>` entre **Informations** et **Apparence** :
- Header `<h3>Bannière hero</h3>` + helper texte « Image affichée en tête
  de votre boutique. Laisser vide pour ne rien afficher. »
- Input URL `hero_image_url`
- Textarea tagline (maxLength=120) + compteur `{tagline.length}/120`
- Aperçu live (rendering simplifié — `<div>` avec background-image
  inline + tagline overlay)

Étendre `handleSaveShop` pour persister `hero_image_url` + `tagline`.

### T4 — Rendu hero dans `src/app/components/shop/ShopLayout.tsx`

Insérer entre la balise `<div>` racine et `<header>` :

```tsx
{shop.hero_image_url && (
  <div
    data-testid={TEST_IDS.shop.heroBanner}
    className="relative w-full h-[140px] md:h-[200px] bg-cover bg-center"
    style={{ backgroundImage: `url(${shop.hero_image_url})` }}
  >
    {shop.tagline && (
      <div
        data-testid={TEST_IDS.shop.heroTagline}
        className="absolute inset-x-0 bottom-0 px-5 lg:px-9 pb-6 pt-12 bg-gradient-to-t from-black/60 via-black/30 to-transparent"
      >
        <p className="text-paper text-base md:text-lg font-medium max-w-3xl drop-shadow-md">
          {shop.tagline}
        </p>
      </div>
    )}
  </div>
)}
```

### T5 — TestIds dans `src/app/lib/testIds.ts`

- Sous `shop` : `heroBanner: 'shop-hero-banner'`,
  `heroTagline: 'shop-hero-tagline'`
- Pas de scope `dashboard` dédié (pattern existant : les inputs admin
  tenant ne sont pas tagés sauf besoin Notion cahier).

### T6 — Tests vitest

- Nouveau fichier `tests/components/shop/ShopLayout.hero.test.tsx`
  (ou helper si pattern courant) :
  - Render `ShopLayout` sans `hero_image_url` → `shop-hero-banner` absent
  - Render avec `hero_image_url` non vide → `shop-hero-banner` présent
  - Render avec hero + tagline → texte tagline visible
  - Render avec hero seul → tagline absent

### T7 — Smoke E2E

Via chrome-devtools MCP sur `http://localhost:5177` :
1. Login admin tenant test
2. Naviguer `/dashboard/shops/:id`
3. Coller une URL d'image hero + tagline
4. Save
5. Ouvrir `/shop/:slug` dans nouvel onglet → vérifier hero visible

### T8 — Commit

```
feat(v5): A4.1 baniere hero + tagline boutique (migration + UI + tests)

- Migration shops.hero_image_url + shops.tagline (idempotent)
- Section "Banniere hero" DashboardShopEditor (URL + textarea 120 char + apercu)
- Rendu conditionnel hero dans ShopLayout avant header sticky
- TestIds shop.heroBanner + shop.heroTagline
- Tests vitest rendering conditionnel
```

## Lessons appliquées

- **2026-05-25** Jamais d'identifiant technique en UI : on n'expose pas
  le slug/uuid à l'imprimeur, juste le nom boutique.
- **2026-05-22** Microcopy FR : « Bannière hero » (pas « hero banner »),
  « Aperçu » (pas « Preview »).
- **2026-06-01** Tests E2E = ma responsabilité ; pas de demande à Arnaud.
- **2026-05-23** Mode auto-validation Sprint 5+ : enchaînement
  dev → migration → smoke sans confirmation. Confirmation push final.
