# Story A4.2 — Palette élargie + fonts par pairings curated

> **Sprint** : A4 mini-sprint personnalisation (post-démo Magrit Core)
> **Statut** : in_progress
> **Branche** : `beta/v5`
> **Date démarrage** : 2026-06-15
> **Dev** : Amelia (BMAD)

## Contexte

A4.1 a livré la bannière hero. A4.2 enrichit l'identité visuelle d'une
boutique avec :
- **3 couleurs supplémentaires** : secondaire (highlights), texte
  (override gris ink), fond (override page)
- **1 pairing de fonts curated** parmi 5 (système / moderne /
  éditorial / luxe / technique)

Pas de free font picker (complexité loader + risque visuel). 5 pairings
préchargés via Google Fonts dans `index.html`.

## Acceptance criteria

- **AC1** — Type `ShopTheme` étendu avec `secondaryColor?`, `textColor?`,
  `bgColor?`, `fontPairing?` (tous optionnels pour backward-compat des
  boutiques existantes en JSONB sans ces champs).
- **AC2** — Constante `FONT_PAIRINGS` (clé + label + heading + body)
  dans un nouveau module `src/app/components/shop/fontPairings.ts`.
- **AC3** — `DEFAULT_THEME` étendu avec valeurs par défaut sensibles
  (secondaryColor `#6b7280`, textColor `#0f172a`, bgColor `#ffffff`,
  fontPairing `'system'`).
- **AC4** — Section "Apparence" `DashboardShopEditor` étendue avec :
  - 3 inputs color (Secondaire / Texte / Fond) — pattern identique
    aux 2 existants
  - 1 dropdown `<select>` pour le fontPairing (5 options : labels FR)
- **AC5** — `resolveShopBrandStyle` étendu pour exposer
  `--shop-secondary`, `--shop-text`, `--shop-bg`, `--shop-font-heading`,
  `--shop-font-body` quand définis.
- **AC6** — `<link>` Google Fonts préchargé dans `index.html` (Inter,
  Lora, Playfair Display, Lato, Roboto, Roboto Slab) — `display=swap`
  pour LCP.
- **AC7** — TestIds non requis (le pattern admin tenant n'en utilise
  pas — pas de Notion TF sur cette story dans le pipeline immédiat).
- **AC8** — Tests vitest étendus :
  - `resolveShopBrandStyle` expose les nouvelles CSS vars quand définies
  - Omission propre quand champ manquant (backward-compat JSONB)
  - Nouveau helper `resolveFontPairing(shop)` retourne le pairing actif
    ou `'system'` par défaut

## Pairings curated

| Clé | Label UI | Heading | Body | Use case |
|---|---|---|---|---|
| `system` | Système (par défaut) | `system-ui, sans-serif` | `system-ui, sans-serif` | Boutique sans branding fort |
| `modern` | Moderne | `Inter` | `Inter` | Tech / corporate moderne |
| `editorial` | Éditorial | `Lora` | `Inter` | Lecture longue, magazine |
| `luxury` | Luxe | `Playfair Display` | `Lato` | Cosmétique, prestige |
| `technical` | Technique | `Roboto Slab` | `Roboto` | Industriel, B2B technique |

## Tasks

### T1 — Type `ShopTheme` (ShopsContext.tsx)

Ajouter les 4 champs optionnels + étendre `DEFAULT_THEME`.

### T2 — Module `fontPairings.ts`

Export `FONT_PAIRINGS` (array) + `resolveFontPairing(key)` qui retourne
le pairing actif ou le pairing `system` par défaut.

### T3 — UI section Apparence étendue

3 inputs color identiques + 1 select fontPairing.

### T4 — Helper `resolveShopBrandStyle`

Étendre pour exposer 5 nouvelles CSS vars (3 colors + 2 fonts).

### T5 — `index.html`

Ajouter `<link rel="preconnect">` Google Fonts + `<link>` CSS avec les
6 familles utilisées par les 4 pairings non-system.

### T6 — Tests vitest

Étendre `ShopLayout.helpers.test.ts` avec cas palette élargie +
résolution font pairing.

### T7 — Commit

```
feat(v5): A4.2 palette elargie + fonts curated par pairing
```

## Lessons appliquées

- **2026-05-22** Microcopy FR : "Système", "Éditorial", "Technique" (pas
  d'anglais), labels descriptifs (pas juste "Modern" mais "Moderne").
- **2026-05-25** Backward-compat : les boutiques existantes en JSONB
  doivent continuer à fonctionner (champs absents → fallback default).
- **2026-06-08** Pas d'invention hors backlog : 5 pairings cadrés,
  pas de free font picker.
