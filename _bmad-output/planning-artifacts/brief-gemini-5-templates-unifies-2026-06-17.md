# Brief Gemini — Refonte unifiée des 5 templates restants (P17)

> **Émetteur** : Arnaud Mazon (PDG AGE Dvt., porteur Magrit IA)
> **Date** : 2026-06-17
> **Destinataire** : Gemini (génération SVG TypeScript Deno)
> **Status** : à coller dans Gemini après la livraison P16 (depliant + etiquette refondus)
> **Objectif** : aligner les 5 templates restants sur le style Gemini de P16

---

## Contexte (rappel)

Magrit est une plateforme web-to-print B2B augmentée par l'IA. Chaque produit imprimé d'une boutique B2B affiche un mockup PNG généré à la volée via une edge function Supabase (resvg-wasm). Les templates SVG TypeScript sont dans `supabase/functions/_shared/mockup/templates/`.

Tu as déjà refondu `depliant.ts` (3 volets ouvert plat) et `etiquette.ts` (ronde sticker découpé) en P16. La même direction artistique doit maintenant être appliquée aux 5 templates restants.

---

## ⚠️ Règle critique observée sur P16

Sur les smoke P16, on a observé que **les marguerites placées sur fond blanc n'affichaient que le cœur pollen** : les 18 pétales blancs sont invisibles par défaut de contraste.

**Règle absolue à respecter** : la marguerite (`daisyMagrit`) doit **TOUJOURS** être posée sur un fond **non-blanc**. Trois options acceptables :

1. Sur le tile bleu pastel `url(#magritTileGrad)` (pattern préféré, comme volet central du dépliant)
2. Sur un mini-médaillon circulaire bleu pastel (cercle de fond `fill="url(#magritTileGrad)"` derrière la marguerite)
3. Sur un fond `primaryColor` du shop avec opacity ≥ 0.10 (acceptable si la primaryColor est sombre)

**Jamais directement sur fond blanc ou sur tile très clair sans contour.**

---

## Helpers disponibles dans `_shared.ts` (à réutiliser)

```typescript
import {
  escapeXml,             // (s: string) => string — anti-injection XML
  truncate,              // (s: string, maxLen: number) => string — ellipsis
  photoRealisticDefs,    // (safeColor: string) => string — defs shadowDouble + paperHighlight + paperTexture
  photoRealisticProductRect, // (cx,cy,w,h,rx,safeColor) => string — rect produit photo-realistic
  daisyMagrit,           // (cx,cy,scale) => string — marguerite 18 pétales + cœur pollen
  magritGradientsDefs,   // () => string — defs magritPollen + magritTileGrad
} from "./_shared.ts";
```

Signature obligatoire de chaque template :

```typescript
export function <name>Svg(
  specs: { width: number; height: number; productName: string },
  theming: { primaryColor: string },
): string
```

- `viewBox="0 0 1024 1024"` systématique
- `xmlns="http://www.w3.org/2000/svg"` (pas de markdown auto-link cette fois !)
- `safeName = escapeXml(truncate(specs.productName, 32))` pour la référence modèle bas
- `safeColor = theming.primaryColor || "#B7D3F2"` pour le fond du viewBox

---

## Signature visuelle commune (immuable)

Chaque template DOIT contenir, dans cet ordre dans le SVG :

1. **Fond viewBox** : `<rect width="1024" height="1024" fill="url(#bgGrad)">` avec gradient en `primaryColor` opacity 0.05 → 0.16
2. **Bloc produit** : forme principale (rect, polygon, path) avec `filter="url(#shadowDouble)"` et `fill="#FFFFFF"`
3. **Highlight papier** : `<rect ... fill="url(#paperHighlight)">` sur le bloc produit
4. **Marguerite Magrit** via `daisyMagrit(cx, cy, scale)` **toujours sur fond tile bleu pastel ou médaillon bleu** (jamais sur blanc nu)
5. **"Magrit"** italic : `<text font-family="Inter" font-style="italic" font-weight="500" font-size="36-72" fill="#0F172A" letter-spacing="-0.025em">Magrit</text>`
6. **Tagline** : `<text font-family="Inter" font-weight="400" font-size="11-12" fill="#0F172A" letter-spacing="0.08em" opacity="0.55-0.6">IMPRIMERIE · IA</text>`
7. **Liseré pollen** : `<rect ... fill="#F5B529" rx="4">` (8px épais, position selon template — bas du bloc produit en général)
8. **Mock content** : placeholders gris discrets `#F1F5F9` (blocs) et `#E2E8F0` (lignes)
9. **Référence modèle** : `<text ... fill="#0F172A" opacity="0.40-0.45" font-size="11">${safeName}</text>` en bas (souvent text-anchor="end" coin bas-droit)

---

## Les 5 templates à produire

### A) `carteVisite.ts` — Carte de visite 85×55 (2D paysage)

**Mode** : 2D paysage, ratio 85/55.
**Composition** :
- Bloc carte cadré 800×515 centré dans viewBox 1024 (`x=112 y=255`)
- Split vertical 35/65 :
  - **Tile bleu pastel** à gauche (35% = 280px) : `fill="url(#magritTileGrad)"` avec `daisyMagrit(cx_tile, cy_tile, 1.0)` centrée
  - **Surface blanche** à droite (65% = 520px) : `fill="#FFFFFF"` avec mock content
- Sur la surface blanche : 4 lignes mock (`<rect>` 8px hauteur, `#E2E8F0`) simulant texte d'identité + 1 petit bloc carré 80×80 (`#F1F5F9`) en haut à gauche simulant logo client
- **"Magrit"** italic 36px sur la tile (sous la marguerite)
- **Tagline** sous "Magrit" (10-11px)
- **Liseré pollen** 8px en bas du bloc carte (`#F5B529`)
- **Référence modèle** opacity 0.45 sous le bloc (text-anchor end)

### B) `flyer.ts` — Flyer A5 148×210 (2D portrait)

**Mode** : 2D portrait, ratio 148/210.
**Composition** :
- Bloc flyer cadré 600×850 centré dans viewBox 1024 (`x=212 y=87`)
- 3 zones verticales :
  - **Zone haute (30%)** : tile bleu pastel `fill="url(#magritTileGrad)"` avec `daisyMagrit(cx, cy_haut, 1.4)` + **"Magrit"** italic 64px sous + tagline
  - **Zone milieu (50%)** : surface blanche avec 4 lignes mock content + 1 bloc carré gris 200×120 simulant visuel produit
  - **Zone basse (20%)** : surface blanche avec 2 lignes mock + liseré pollen 8px en bas
- **Référence modèle** sous le bloc flyer (text-anchor end opacity 0.45)

### C) `brochure.ts` — Brochure A4 210×297 (3D perspective 3/4)

**Mode** : **3D perspective 3/4** — couverture livret avec tranche de pages internes visible.
**Composition** :
- Couverture A4 portrait cadrée 540×765 avec `transform="skewY(-2.5)"` pour effet 3D léger
- **Pile de pages internes** à gauche : 5-6 rectangles fins horizontaux empilés (`fill="#E8E5DD"`, hauteur 6px chacun, décalés de 1-2px) simulant les pages multi-pages reliées (tranche)
- Couverture (fond blanc + filter shadowDouble) :
  - Tile bleu pastel haut 35% avec `daisyMagrit(cx, cy_haut, 1.6)` + **"Magrit"** italic 42px + tagline
  - Zone centrale blanche avec gros bloc carré gris 320×200 simulant visuel couverture + 3 lignes mock
  - Liseré pollen 8px en bas
- **Référence modèle** sous la couverture (text-anchor end opacity 0.45)

### D) `kakemono.ts` — Roll-up 850×2000 (2D vertical)

**Mode** : 2D vertical très portrait, ratio 850/2000.
**Composition** :
- Bloc kakémono cadré 380×900 centré dans viewBox 1024 (`x=322 y=62`) — très portrait
- 4 zones empilées :
  - **Bandeau haut (25%)** : tile bleu pastel + `daisyMagrit(cx, cy, 1.8)` + **"Magrit"** italic 72px sous + tagline 12px
  - **Corps (55%)** : surface blanche avec 5-6 lignes mock content + 2 blocs carrés gris (visuel + texte simulé)
  - **Pied bas (15%)** : zone gris foncé `#475569` simulant socle métallique du roll-up (rect fill plein)
  - **Liseré pollen** 8px juste au-dessus du pied (bord entre corps blanc et socle)
- **Référence modèle** sous le bloc (text-anchor end opacity 0.45)

### E) `packaging.ts` — Boîte kraft 200×150 (3D perspective 3/4)

**Mode** : **3D perspective 3/4** — boîte kraft ouverte avec rabats relevés.
**Composition** :
- Boîte en perspective : `<polygon>` 5 points pour face avant + face dessus + face latérale droite (vue 3/4 standard)
- Gradient kraft sur les 3 faces visibles :
  - Face avant : `linearGradient` 4 stops `#C8A87D → #D4B791 → #A87F4E → #7A5A35`
  - Face dessus : version plus claire
  - Face latérale : version plus sombre (ombrage)
- **2 rabats relevés** vers l'arrière (polygones triangulaires/trapézoïdaux) avec texture kraft + ombre interne
- **Médaillon Magrit** sur la face avant centré :
  - Cercle de fond `r=70` `fill="url(#magritTileGrad)"` (le médaillon nécessaire pour faire ressortir la marguerite)
  - `daisyMagrit(cx_face, cy_face, 1.0)` centrée dans le médaillon
  - **"Magrit"** italic 32px en dessous du médaillon sur la face avant
  - **Tagline** sous "Magrit" (10px)
- **Liseré pollen** 8px en bas de la face avant
- **Référence modèle** sous la boîte (text-anchor end opacity 0.45)

---

## Contraintes techniques (resvg-wasm 2.6.2)

- ✅ Inter font UNIQUEMENT (pour `font-family`) — toute autre font produit du texte vide dans le PNG
- ✅ SVG vectoriel pur : rect, polygon, path, ellipse, circle, line, text
- ✅ Gradients (`<linearGradient>`, `<radialGradient>`)
- ✅ Filters (`feDropShadow`, `feGaussianBlur`)
- ✅ Patterns (`<pattern>`)
- ✅ Transforms (`rotate`, `translate`, `scale`, `skewX/Y`)
- ❌ Pas de `<image>` externe (pas de fetch dans le SVG)
- ❌ Pas de `<animate>`, `<foreignObject>`, JavaScript inline
- ❌ Pas de `feImage` / `feFlood` avancés

---

# ═══════════════════════════════════════════════════════
# PROMPT COPY-PASTE PRÊT À COLLER DANS GEMINI
# ═══════════════════════════════════════════════════════

> Colle uniquement ce qui est entre les ``` ci-dessous dans Gemini, dans l'ordre indiqué. Tu obtiendras 5 fichiers TypeScript Deno à écrire dans `supabase/functions/_shared/mockup/templates/`.

```
Contexte : plateforme web-to-print B2B Magrit. Tu vas produire 5 templates SVG TypeScript Deno pour le rendu de mockups produits. Tu as déjà produit en P16 les templates `depliant.ts` et `etiquette.ts` qu'on a livrés. Je veux maintenant que tu refondes les 5 autres dans le même style visuel cohérent.

Helpers disponibles dans `./_shared.ts` (à importer) :
- escapeXml(s)
- truncate(s, n)
- photoRealisticDefs(safeColor) : retourne defs shadowDouble + paperHighlight + paperTexture
- photoRealisticProductRect(cx, cy, w, h, rx, safeColor)
- daisyMagrit(cx, cy, scale) : marguerite 18 pétales blancs + cœur pollen (référence l'id `magritPollen` défini par magritGradientsDefs)
- magritGradientsDefs() : retourne defs magritPollen + magritTileGrad

Signature obligatoire pour chaque template :
```typescript
export function <name>Svg(
  specs: { width: number; height: number; productName: string },
  theming: { primaryColor: string },
): string
```

Règles immuables à respecter dans CHAQUE template :
1. viewBox="0 0 1024 1024" et xmlns="http://www.w3.org/2000/svg"
2. Inclure dans <defs> : un linearGradient id="bgGrad" en theming.primaryColor opacity 0.05 à 0.16 + `${photoRealisticDefs(safeColor)}${magritGradientsDefs()}`
3. La marguerite (daisyMagrit) doit TOUJOURS être posée sur un fond non-blanc (tile bleu pastel via `fill="url(#magritTileGrad)"` ou cercle médaillon bleu pastel). Jamais sur fond blanc nu (les pétales blancs disparaîtraient).
4. Toujours inclure "Magrit" en italic 36-72px font-family="Inter" font-weight="500" letter-spacing="-0.025em" fill="#0F172A"
5. Toujours inclure une tagline "IMPRIMERIE · IA" font-family="Inter" font-weight="400" letter-spacing="0.08em" opacity 0.55-0.6
6. Toujours inclure un liseré pollen `<rect fill="#F5B529">` 8px de haut en bas de la zone produit
7. Toujours inclure en bas du SVG la référence modèle : `<text font-family="Inter" font-weight="500" font-size="11" fill="#0F172A" opacity="0.40-0.45">${safeName}</text>` (safeName = escapeXml(truncate(specs.productName, 32)))
8. Mock content via placeholders : blocs `#F1F5F9` et lignes `#E2E8F0` (jamais de texte simulé en chaîne, juste des rect arrondis discrets)
9. Police : Inter UNIQUEMENT (resvg-wasm rasterise vide tout autre font)
10. Pas d'<image> externe, pas d'<animate>, pas de foreignObject

Produis maintenant les 5 fichiers dans des blocs de code séparés, un fichier par bloc :

A) carteVisite.ts — 2D paysage 85×55. Bloc carte 800×515 centré viewBox. Split vertical 35/65 : tile bleu pastel à gauche avec marguerite scale 1.0 + Magrit italic 36 + tagline ; surface blanche à droite avec 4 lignes mock + 1 bloc carré 80×80 gris en haut à gauche. Liseré pollen 8px en bas du bloc carte. Reference modèle bas-droite.

B) flyer.ts — 2D portrait A5 148×210. Bloc flyer 600×850 centré viewBox. 3 zones verticales : tile bleu pastel haut 30% avec marguerite scale 1.4 + Magrit italic 64 + tagline ; surface blanche centre 50% avec 4 lignes mock + bloc 200×120 gris simulant visuel ; surface blanche bas 20% avec 2 lignes mock + liseré pollen 8px. Reference modèle bas-droite.

C) brochure.ts — 3D portrait A4 perspective 3/4. Couverture 540×765 avec transform="skewY(-2.5)" pour effet 3D léger. Pile pages internes à gauche : 5-6 rectangles fins #E8E5DD horizontaux empilés simulant tranche multi-pages. Couverture (fond blanc + shadowDouble) : tile bleu pastel haut 35% avec marguerite scale 1.6 + Magrit italic 42 + tagline ; zone blanche centre avec bloc 320×200 gris + 3 lignes mock ; liseré pollen 8px bas. Reference modèle bas-droite.

D) kakemono.ts — 2D très portrait 850×2000. Bloc kakémono 380×900 centré viewBox. 4 zones empilées : bandeau haut 25% tile bleu pastel avec marguerite scale 1.8 + Magrit italic 72 + tagline ; corps blanc 55% avec 5-6 lignes mock + 2 blocs carrés gris ; pied bas 15% gris foncé #475569 (socle métallique) ; liseré pollen 8px entre corps et pied. Reference modèle bas-droite.

E) packaging.ts — 3D boîte kraft perspective 3/4. Polygones pour face avant + dessus + latérale droite. Gradient kraft 4 stops #C8A87D → #D4B791 → #A87F4E → #7A5A35. 2 rabats relevés vers l'arrière (polygones trapézoïdaux) avec texture kraft. Sur la face avant : médaillon circulaire r=70 fill="url(#magritTileGrad)" avec daisyMagrit scale 1.0 dedans, Magrit italic 32 sous médaillon, tagline sous, liseré pollen 8px bas. Reference modèle sous la boîte (text-anchor end opacity 0.45).

Important : produis le code TypeScript complet de chaque fichier en mode strict (pas de TODO, pas de mock simplifié). Chaque fichier doit être directement utilisable. Ne réécris pas _shared.ts, je l'ai déjà.
```

# ═══════════════════════════════════════════════════════
# Spec interne — checklist Claude après livraison Gemini
# ═══════════════════════════════════════════════════════

Une fois les 5 fichiers Gemini reçus, Claude doit :

1. Vérifier que chaque fichier importe bien `daisyMagrit`, `magritGradientsDefs` et `photoRealisticDefs` depuis `./_shared.ts`
2. Vérifier que chaque fichier respecte la règle "marguerite jamais sur fond blanc nu"
3. Vérifier `xmlns="http://www.w3.org/2000/svg"` (sans coquille markdown link)
4. Écraser les 5 fichiers actuels :
   - `supabase/functions/_shared/mockup/templates/carteVisite.ts`
   - `supabase/functions/_shared/mockup/templates/flyer.ts`
   - `supabase/functions/_shared/mockup/templates/brochure.ts`
   - `supabase/functions/_shared/mockup/templates/kakemono.ts`
   - `supabase/functions/_shared/mockup/templates/packaging.ts`
5. Supprimer les 5 snapshots correspondants (régénération auto au test Deno)
6. Bumper `CACHE_VERSION_SUFFIX` `_v6 → _v7` dans 2 fichiers (sync front + edge)
7. Lancer vitest (le mapping kind → template ne change pas, seul le rendu visuel)
8. Lancer Deno tests (régénération snapshots automatique)
9. Re-deploy edge function `mockup-generator`
10. Smoke 5 PNG : `.design-handoff/smoke-p17-{carteVisite,flyer,brochure,kakemono,packaging}.png`
11. Validation visuelle Arnaud
12. Commit `feat(v5): P17 - 5 templates restants alignes style Gemini`
13. Mise à jour mémoire `project-visuels-mockups-p15-livres.md` → renommer ou pivoter vers P17

Anti-régression à valider :
- Le mapping `KIND_TO_TEMPLATE` + `inferTemplateFromText` ne change pas (les noms de templates restent identiques)
- Le type `MockupTemplate` reste identique
- La signature des fonctions reste identique (specs + theming)
- La CHECK constraint SQL reste valide (les noms de templates n'ont pas changé)
- Les UI catalog (`ShopCustomMockups` + `DashboardAdminMockups`) gardent les mêmes clés, juste descriptions à actualiser

---

## Annexe — Pourquoi un brief unique pour les 5

Plutôt qu'un brief par template (5 conversations Gemini séparées), ce brief unique permet :
- Une cohérence visuelle garantie entre les 5 (même prompt = même style)
- Une seule session Gemini = un seul cache contextuel
- Une seule passe de livraison côté Claude (1 commit, 1 deploy, 1 cache bump)

Si Gemini refuse de tout produire en une réponse (limite tokens) :
- Découpe en 2 prompts : (A+B+C) puis (D+E)
- Garde dans le 2e prompt le même contexte rappel (helpers + règles immuables)
