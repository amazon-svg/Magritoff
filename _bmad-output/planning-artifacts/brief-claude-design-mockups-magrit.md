# Brief Claude Design — Mockups visuels produits Magrit

> **Destinataire** : Claude design (génération de visuels produits SVG / 3D)
> **Date** : 2026-06-16
> **Émetteur** : Arnaud Mazon (PDG AGE Dvt., porteur Magrit IA)
> **Status** : référence canonique, à mettre à jour quand nouvelle gamme

---

## 1. Contexte Magrit

Magrit est une plateforme **web-to-print B2B augmentée par l'IA** (positionnement : équivalent Printoclock / Vistaprint mais avec couche IA conversationnelle pour les imprimeurs Pro).

Chaque boutique B2B affiche un catalogue de produits imprimés (cartes de visite, flyers, brochures, roll-ups, packaging, étiquettes, dépliants…). Pour chaque produit, on génère un **mockup visuel** qui doit :

1. **Représenter le produit** de façon réaliste (à quoi ressemble une carte de visite imprimée, une boîte kraft d'expédition, un roll-up monté…)
2. **Porter la marque Magrit** visiblement (logo marguerite + nom + tagline) — comme Printoclock affiche du contenu "Printoclock" sur ses cards produit
3. **Rester sobre et premium** — pas de couleurs criardes, pas d'emoji, pas de motifs cartoon

Référence visuelle : pages catalogue Printoclock / Vistaprint / Exaprint (chaque card montre un mockup imprimé avec contenu visible, pas un rectangle blanc).

---

## 2. Identité visuelle Magrit (charte stricte)

### 2.1 Logo Magrit — La Marguerite

Direction graphique "La vraie marguerite" — figée 2026-05.

- **18 pétales blancs** (ellipses rx=3.5 ry=16, rotate i × 20°)
- **Cœur pollen** central (radial gradient r=11)
  - `#FFE066` (centre clair pollen)
  - `#F5B529` (mid pollen)
  - `#C68708` (dark pollen)
- **Tile carrée bleu pastel** sous la marguerite (variant "tile" du logo)
  - Linear gradient 135° : `#E5F0FC → #B7D3F2`
  - Coins arrondis `rx=23`
- **Variants disponibles** :
  - `tile` : marguerite blanche + cœur pollen sur tile bleu pastel (= logo complet)
  - `plain` : marguerite blanche + cœur pollen, sans tile (pour intégration mockup)
  - `mono-dark` : silhouette ink (#0F172A) sur fond clair
  - `mono-light` : silhouette blanche sur fond sombre

Source du logo : [`src/app/components/brand/MagritLogo.tsx`](src/app/components/brand/MagritLogo.tsx)

### 2.2 Palette couleurs

| Token | Hex | Usage |
|---|---|---|
| `MAGRIT_TILE_FROM` | `#E5F0FC` | Tile bleu pastel — start gradient 135° |
| `MAGRIT_TILE_TO` | `#B7D3F2` | Tile bleu pastel — end gradient |
| `MAGRIT_POLLEN_LIGHT` | `#FFE066` | Cœur pollen — center radial |
| `MAGRIT_POLLEN_MID` | `#F5B529` | Pollen — mid + **liseré signature couleur** |
| `MAGRIT_POLLEN_DARK` | `#C68708` | Pollen — outer radial |
| `MAGRIT_INK` | `#0F172A` | Texte principal (slate-900) |
| Pétales | `#FFFFFF` | Toujours blanc |
| Kraft (packaging) | `#C8A87D` / `#D4B791` / `#A87F4E` / `#7A5A35` | 4 stops gradient boîte carton |
| Page edge (brochure) | `#E8E5DD` | Tranche pages internes |

**Couleur dynamique** : `primaryColor` du shop (paramètre `theming`) — utilisée pour fond gradient subtil (`opacity 0.06-0.16`) du viewBox et bord du rectangle produit. Les couleurs Magrit dominent visuellement, la `primaryColor` est un accent.

### 2.3 Typographie

- **Font unique : Inter** (Variable Latin Normal + Italic, embed WOFF2)
- **Magrit en signature** : toujours `font-family="Inter" font-style="italic" font-weight="500" letter-spacing="-0.025em"`
- **Tagline** : `IMPRIMERIE · IA` ou `IMPRIMERIE AUGMENTÉE PAR L'IA` en **uppercase letter-spacing 0.08em font-weight 400 opacity 0.55**
- **Référence modèle** (productName en bas) : `font-size 11 font-weight 500 opacity 0.40-0.50` (discret)
- Tailles "Magrit" italic selon template :
  - carteVisite : `56px`
  - flyer : `64px`
  - brochure / packaging : `40-42px`
  - étiquette : `48px`
  - kakémono : `72px`

⚠️ **Aucune autre font supportée** (resvg-wasm ne charge que Inter via WOFF2 embedded). Tout `<text>` avec une font différente sera rendu **vide** dans le PNG.

### 2.4 Liseré pollen — signature couleur

- Toujours présent en **bas de la zone produit** (8 px hauteur, fill `#F5B529`)
- Sert de **marqueur identitaire** Magrit (toutes les cards de la boutique partagent ce détail visuel)

### 2.5 Effets visuels

| Effet | Détail |
|---|---|
| **Ombre portée double** | `feDropShadow dx=0 dy=4 stdDeviation=6 flood-opacity=0.18` (close) + `dy=18 stdDeviation=24 flood-opacity=0.22` (far, en primaryColor) |
| **Highlight papier** | Linear gradient top→transparent (#FFFFFF 35% → 5% → 0%) appliqué en overlay |
| **Texture papier** | Pattern 6×6 px avec micro-points #e5e5e5 opacity 0.5 |
| **Coins arrondis** | `rx=8` (flyer) à `rx=32` (étiquette sticker) |

Helpers prêts à l'emploi : [`templates/_shared.ts`](supabase/functions/_shared/mockup/templates/_shared.ts)

---

## 3. Catalogue templates actuels (référence)

7 templates SVG paramétriques livrés en P15 (2026-06-16) :

| Template | Style | Dimensions cible | Mode |
|---|---|---|---|
| `carteVisite` | Paysage 85×55 mm | Split 35/65 (tile + surface papier) | 2D plat |
| `flyer` | Portrait A5 148×210 mm | 3 zones verticales (tile haut + textes + contact) | 2D plat |
| `brochure` | Portrait A4 210×297 mm | Couverture livret avec tranche pages visible | **3D perspective 3/4** |
| `depliant` | Portrait A4 210×297 mm | 3 volets côte à côte, central tile + 2 latéraux mock | 2D dépliée |
| `etiquette` | Compact 60×40 mm | Tile + bordure dashed marquée (effet sticker) | 2D + effet sticker |
| `kakemono` | Très portrait 850×2000 mm | Bandeau tile + Magrit XL + corps + pied gris | 2D vertical |
| `packaging` | Boîte variable | Boîte kraft 3D vue 3/4 ouverte avec rabats | **3D perspective** |

Aperçus visuels actuels : `.design-handoff/smoke-p15-*.png`

---

## 4. Gammes à ajouter / à raffiner (backlog)

### 4.1 Priorité 🔴 haute

| Famille | Kind Clariprint | Style requis | Notes |
|---|---|---|---|
| **Affiche grand format** | `poster`, `affiche` | 2D portrait (A2 / A1 / A0) avec mockup posé sur mur ou tenu | Actuellement = `flyer` (générique). Mériterait un template dédié avec contexte mural pro |
| **Banderole / Bâche** | `banderole`, `bache` | 2D paysage avec œillets visibles aux 4 coins | Actuellement = `kakemono` (vertical) mais devrait être paysage |
| **Enveloppe** | `enveloppe`, `dl`, `c5`, `c4` | 2D paysage ratio 220×110 (DL) — rabat ouvert visible | Pas de template aujourd'hui, fallback `flyer` |

### 4.2 Priorité 🟡 moyenne

| Famille | Kind Clariprint | Style requis | Notes |
|---|---|---|---|
| **Carte de vœux pliée** | `card_folded`, `voeux` | 3D perspective ouverte sur 2 panneaux | Mockup distinct de carteVisite (qui est paysage rigide) |
| **Sac kraft** | `bag` | 3D perspective avec poignées visibles | Variante du packaging |
| **Magnet / Aimant** | `magnet` | 2D petit format + effet brillance sticker | Variante de etiquette |
| **Stickers vinyl** | `vinyl_sticker` | 3D légèrement décollé (un coin relevé) | Plus marqué que etiquette |
| **Goodies imprimés** | `mug`, `tshirt`, `tote` | 3D objet selon support | Plus complexe — peut-être V2 |

### 4.3 Refontes éventuelles

Si besoin de plus de 3D / réalisme, ces templates peuvent être améliorés :
- **flyer** — actuellement très 2D plat. Pourrait passer en perspective légère.
- **carteVisite** — actuellement 2D paysage. Pourrait passer en stack de cartes 3D.
- **kakemono** — actuellement vertical 2D. Pourrait passer en perspective avec pied + base support.

---

## 5. Contraintes techniques

### 5.1 Format de sortie

- **SVG inline** généré via fonction TypeScript Deno :
  ```ts
  export function <templateName>Svg(specs: ProductSpecs, theming: ShopTheming): string
  ```
- **viewBox carré 1024×1024** systématique (adaptation au ratio du produit via dimensions calculées en interne)
- **String templating direct** — pas de svgdom, pas de manipulation DOM

### 5.2 Inputs disponibles

```ts
interface ProductSpecs {
  width: number;        // mm (ex: 148 pour A5 portrait)
  height: number;       // mm
  productName: string;  // nom commercial (escaped via escapeXml)
}
interface ShopTheming {
  primaryColor: string; // hex #RRGGBB (couleur shop tenant)
  view?: 'front' | 'back'; // optionnel, pour recto/verso (carteVisite + flyer)
}
```

### 5.3 Ce qui marche dans resvg-wasm 2.6.2

- ✅ Tout SVG vectoriel standard (rect, polygon, path, ellipse, circle, line, text)
- ✅ Gradients (linearGradient, radialGradient)
- ✅ Filters (feDropShadow, feGaussianBlur)
- ✅ Patterns
- ✅ ClipPath, mask
- ✅ Symbols + use (avec href local au document)
- ✅ Font Inter (Regular + Bold + Italic) via WOFF2 embedded
- ✅ Transforms (rotate, translate, scale, skewX/Y)

### 5.4 Ce qui NE marche PAS

- ❌ Autres fonts que Inter (Helvetica, Recoleta, Roboto, Playfair…) → texte rendu vide
- ❌ `<image>` externe via URL (pas de fetch dans le SVG)
- ❌ `<animate>` (pas d'animations)
- ❌ `<foreignObject>` HTML
- ❌ JavaScript inline
- ❌ Filtres feImage / feFlood avancés (limité)

### 5.5 Structure fichier attendue

```
supabase/functions/_shared/mockup/templates/
├── _shared.ts                # helpers escapeXml / truncate / photoRealisticDefs / photoRealisticProductRect
├── <newTemplate>.ts          # nouveau template TS
└── <newTemplate>.snapshot.svg # snapshot SVG de référence (généré via tests Deno)
```

### 5.6 Composition recommandée (cohérence Magrit)

Chaque template doit intégrer **dans cet ordre** :

1. `<defs>` :
   - Gradient background du viewBox (en `primaryColor` opacité 0.06-0.16)
   - Linear gradient tile Magrit (#E5F0FC → #B7D3F2) si surface tile
   - Radial gradient cœur pollen (#FFE066 → #F5B529 → #C68708)
   - ClipPath du produit si nécessaire
   - `photoRealisticDefs(safeColor)` (shadowDouble + paperHighlight + paperTexture)
2. **Fond viewBox** : `<rect fill="url(#bg)">`
3. **Forme du produit** : rectangle/polygone/path selon template
4. **Bandeau tile + marguerite Magrit** (variant `plain`) sur zone choisie
5. **Texte "Magrit"** en italic 40-72px selon template
6. **Tagline** "IMPRIMERIE · IA" en uppercase letter-spacing 0.08em
7. **Liseré pollen** (`#F5B529` 8px) en bas du produit
8. **Mock content** : 2-4 lignes simulées (rectangles gris) ou bandeau accent
9. **Référence modèle** (`safeName`) en très petit en bas (opacity 0.40-0.50)

### 5.7 Helpers prêts à l'emploi

```ts
import { escapeXml, truncate, photoRealisticDefs, photoRealisticProductRect } from "./_shared.ts";

// Marguerite Magrit standard (à inliner)
function daisyMagrit(cx: number, cy: number, scale: number, coreGradientId: string): string {
  const petals = Array.from({ length: 18 }, (_, i) => {
    const angle = i * 20;
    return `<ellipse cx="0" cy="${-26 * scale}" rx="${3.5 * scale}" ry="${16 * scale}" transform="rotate(${angle})"/>`;
  }).join("");
  return `<g transform="translate(${cx} ${cy})">
    <g fill="#FFFFFF">${petals}</g>
    <circle r="${11 * scale}" fill="url(#${coreGradientId})"/>
  </g>`;
}
```

---

## 6. Process d'intégration d'un nouveau template

1. **Concevoir le template** dans `templates/<name>.ts` en respectant la composition section 5.6
2. **Ajouter au type `MockupTemplate`** dans `types.ts`
3. **Importer + dispatcher** dans `renderer.ts` (switch case)
4. **Ajouter au `SUPPORTED_TEMPLATES`** array
5. **Étendre `KIND_TO_TEMPLATE`** dans `ShopProductCard.helpers.ts` avec les kinds Clariprint qui doivent mapper vers ce template
6. **Étendre `inferTemplateFromText`** avec les patterns regex (noms commerciaux fréquents)
7. **Étendre la migration `shop_template_mockups` CHECK constraint** pour autoriser le nouveau template_type dans les uploads custom
8. **Ajouter aux UI catalog admin** :
   - `ShopCustomMockups.tsx` (admin tenant) — ajouter au tableau `TEMPLATES`
   - `DashboardAdminMockups.tsx` (superadmin Magrit) — ajouter avec description
9. **Étendre type `MockupTemplateType`** dans `customMockup.helpers.ts`
10. **Régénérer snapshot** via `/tmp/regenerate-snapshots.ts` + ajouter au script si besoin
11. **Bumper `CACHE_VERSION_SUFFIX`** côté front + edge function (sync impératif)
12. **Tests vitest** pour `resolveMockupTemplate` (mapping kind + inférence name)
13. **Re-deploy edge function** : `supabase functions deploy mockup-generator --no-verify-jwt`
14. **Smoke test** : curl vers l'edge function avec specs représentatives → vérifier PNG visuel

---

## 7. 3D vs 2D — quand utiliser quoi

| Famille produit | Mode recommandé | Raison |
|---|---|---|
| Carte de visite / Carte commerciale | **2D plat** | Format rigide, pas de pliage, vue de face suffit |
| Flyer / Tract | **2D plat** | Feuille simple, pas de volume |
| Affiche grand format | **2D plat** ou **3D mur** | Mockup mur en perspective si possible |
| Étiquette / Sticker | **2D + effet sticker** | Bordure dashed découpe + ombre = effet 3D minimaliste suffisant |
| **Brochure (livret multi-pages)** | **3D perspective 3/4** ✅ | Volume des pages internes essentiel pour distinguer brochure d'un flyer |
| **Dépliant 3 volets** | 2D dépliée OU 3D perspective | Volets visibles côte à côte |
| **Roll-up / Kakémono** | 2D vertical OU 3D perspective | Pied du roll-up visible = ancrage produit |
| **Packaging / Boîte** | **3D perspective 3/4** ✅ | Volume cubique essentiel pour reconnaître "c'est une boîte" |
| Enveloppe | **3D rabat ouvert** | Volume du rabat ouvert distingue enveloppe d'un flyer |
| Sac kraft | **3D avec poignées** | Volume + poignées = identification immédiate |
| Magnet / Aimant | 2D + effet brillance | Petit format, suffit |
| Goodies (mug, t-shirt) | **3D objet réel** | Le produit n'est pas un papier, il faut le rendre 3D |

**Règle générale** : si le produit a un **volume non-trivial** (boîte, brochure, sac, mug, enveloppe ouverte), alors **3D recommandé**. Si le produit est essentiellement **plat** (carte, flyer, affiche posée), alors **2D plat** suffit.

---

## 8. Anti-patterns à éviter

- ❌ Texte du produit (`productName`) en hero de la card → **abandonné depuis P11 (2026-06-15)**. La référence modèle apparaît juste en petit (opacity 0.40-0.50) en bas, jamais en titre principal.
- ❌ Mockup blanc neutre sans branding (= rectangle vide qui ne dit pas Magrit)
- ❌ Couleurs criardes hors palette Magrit (rouge vif, vert fluo, etc.)
- ❌ Emoji ou pictos cartoon
- ❌ Plus de 3 lignes de mock content (sinon ça sature la composition)
- ❌ Marguerite agrandie au point de masquer la zone "produit"
- ❌ "Magrit" en gros et `productName` en gros (concurrence visuelle)
- ❌ Animations / effets vidéo (rendering PNG uniquement)
- ❌ Fonts autres que Inter (rendues vides en PNG)

---

## 9. Validation finale (par Arnaud)

Avant push prod, chaque nouveau template doit passer :

1. ✅ **Tests vitest** : `pnpm test` → tous verts (helpers + UI)
2. ✅ **Snapshot Deno** : `deno test --filter "snapshot string SVG"` → vert pour le nouveau template
3. ✅ **Smoke PNG** : curl + ouverture PNG dans Preview → visuel cohérent avec la charte
4. ✅ **Validation Arnaud** par screenshot avant commit + push final

---

## 10. Mémoire (lessons appliquées)

- **2026-05-25** §refonte non-cassante : aucun template existant en prod ne doit être cassé silencieusement → toujours bumper le cache version + tester avant deploy
- **2026-06-15 P11** : retrait définitif du `productName` du visuel hero (décision Arnaud après itération abandonnée). La référence modèle reste en très discret bas-droite.
- **2026-06-16 P15** : packaging + dépliant ajoutés (template distincts de brochure). Le `kind=folded` redirige désormais vers `depliant` (pas brochure).
- **2026-06-16** : la **font Inter Variable WOFF2** est embedée via `fontBuffers` dans Resvg config. Sans cela, tous les `<text>` sont rendus vides.

---

## 11. Référence rapide pour Claude design

**Si tu dois proposer un nouveau template** :

1. Demande la **famille produit** ciblée + le **kind Clariprint** correspondant
2. Demande le **mode visuel** souhaité (2D plat / 3D perspective / 3D objet)
3. Produis 2-3 esquisses ASCII / mockup HTML d'inspiration
4. Une fois validé : génère le `template.ts` + snapshot SVG + extension `KIND_TO_TEMPLATE` + extension `inferTemplateFromText` + tests + migration CHECK extension + extension UI catalog
5. Bumper `CACHE_VERSION_SUFFIX` (synchro front + edge function)
6. Smoke + validation visuelle

**Si tu dois refondre un template existant** :

1. Demande le **problème observé** (trop zoomé, design trop pauvre, etc.)
2. Préserve la signature Magrit (marguerite + Magrit italic + tagline + liseré pollen)
3. Bumper le `CACHE_VERSION_SUFFIX` pour invalider les PNG cached
4. Snapshot Deno régénéré
5. Tests vitest doivent rester verts

---

## Annexe — Fichiers de référence

- Logo : [`src/app/components/brand/MagritLogo.tsx`](src/app/components/brand/MagritLogo.tsx)
- Helpers SVG : [`supabase/functions/_shared/mockup/templates/_shared.ts`](supabase/functions/_shared/mockup/templates/_shared.ts)
- 7 templates actuels : [`supabase/functions/_shared/mockup/templates/`](supabase/functions/_shared/mockup/templates/)
- Renderer : [`supabase/functions/_shared/mockup/renderer.ts`](supabase/functions/_shared/mockup/renderer.ts)
- Mapping kind→template : [`src/app/components/shop/ShopProductCard.helpers.ts`](src/app/components/shop/ShopProductCard.helpers.ts)
- UI admin tenant (upload custom) : [`src/app/components/dashboard/ShopCustomMockups.tsx`](src/app/components/dashboard/ShopCustomMockups.tsx)
- UI superadmin (galerie référence) : [`src/app/components/dashboard/DashboardAdminMockups.tsx`](src/app/components/dashboard/DashboardAdminMockups.tsx)
- Aperçus visuels actuels : [`.design-handoff/smoke-p15-*.png`](.design-handoff/)
