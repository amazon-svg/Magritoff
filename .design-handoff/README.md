# Handoff — Magrit v2 (Design → Claude Code)

Refonte complète de la couche présentation de **Magrit**, copilot IA
web-to-print B2B (marché FR). Direction visuelle **AI-native premium**,
à appliquer aux 3 surfaces produit + portail B2B corporate.

---

## 1. Contexte & livrable

### Ce dossier contient
- `designs/` — **6 fichiers HTML de référence** (maquettes hi-fi). Ce
  sont des **références visuelles**, pas du code prod à coller. L'objectif
  est de **recréer ces écrans dans le repo existant**
  (`amazon-svg/Magritoff`, branche `design/v2`) en utilisant **la stack
  imposée** — on ne refait PAS de zéro, on redécore l'existant.
- `tokens/tokens.css` — tokens CSS (couleurs, radius, shadows, typo)
  prêts à importer dans `src/styles/tokens.css` du repo.
- `tokens/tailwind.config.ts` — extension Tailwind v4 qui expose les
  tokens comme utilitaires (`text-ink`, `bg-paper`, `border-line`, etc.).
  À merger avec le `tailwind.config.ts` existant.
- `screenshots/` — captures JPEG de chaque écran, pour consultation
  rapide sans ouvrir les HTML.

### Fidélité
**Hi-fi.** Les couleurs, typographies, espacements, radii et shadows
doivent être reproduits précisément via les tokens fournis. Les
proportions (grilles, largeurs de sidebar, gaps) sont indicatives mais à
respecter à ±5%.

### Stack imposée (non négociable)
- React 18 + TypeScript + **Tailwind v4** + react-router v7
- **shadcn/ui** — ne pas remplacer, étendre par composition
- **lucide-react** — `strokeWidth={1.5}` par défaut, **jamais filled**
- **motion** (Framer Motion) — animations discrètes uniquement
- **recharts** — pour sparklines et graphs admin
- **sonner** — toasts en bas-droite, épurés
- CSS custom properties (`tokens.css`) pour le theming boutique

### Interdits
- Pas de nouvelle dépendance UI sans accord
- **Pas de refonte de la logique métier** (ConversationContext, hooks,
  fetch Supabase, edge functions)
- Pas de migration Next.js / autre framework
- Pas de CSS-in-JS additionnel (emotion, styled-components…)
- **Pas d'emoji** comme élément de design (SVG inline uniquement)
- Pas d'animation agressive (bounce, spin rapide, shake)
- Pas d'effet parallaxe ou scroll-triggered lourd

---

## 2. Direction visuelle — principes

### Ambiance générale
Référence : **Perplexity.ai** + **Linear** + **Stripe Dashboard**.
- Typo sans-serif géométrique, **graisses fines** (300-400 courant,
  500-600 pour hiérarchie). Stack par défaut `Helvetica Neue` →
  system-ui (Inter/Geist acceptable si le repo en dépend déjà).
- Letter-spacing **négatif** sur les titres (−0.015em à −0.03em).
  Voir `tokens.css` → `--tracking-*`.
- **Pas de noir pur sur blanc pur** : `--ink: #0A0A0A` sur
  `--bg: #FAFAFA` ou `--paper: #FFF`.
- Whitespace généreux.
- **Bordures 1px** en `--line: #ECECEC` plutôt que fonds colorés
  pour délimiter.
- Radius modérés (cards 10px, boutons 6-8px, modales 12px).
- **Shadows subtiles** Vercel/Linear-style — `--shadow-md`. Jamais
  `shadow-lg` Tailwind par défaut.
- **Accent unique** : `--accent: #0F172A` (slate-900). Un accent
  fonctionnel vert `--ok-fg: #0E8F5A` pour confirmations / remises.
- **Scrollbars fines** (déjà stylées dans `tokens.css`).
- **Icônes lucide-react en 1.5px stroke**, jamais filled.

### Typographie
Echelle complète dans `tokens.css` (`--fs-xs` à `--fs-5xl`). Cas d'usage :

| Cas | Size | Weight | Tracking |
|---|---|---|---|
| H1 page admin | 48px | 400 | −0.03em |
| H2 section | 28-34px | 400 | −0.025em |
| H3 sous-titre | 20-24px | 500 | −0.015em |
| H4 card titre | 14-14.5px | 500 | −0.005em |
| Body courant | 13.5-14.5px | 400 | −0.005em |
| Meta / muted | 12-13px | 400 | 0 |
| Label mono uppercase | 10.5-11px | 500 | 0.08em |
| KPI chiffre | 24-28px | 500 (mono) | −0.015em |

Le **mono** (`JetBrains Mono`) est utilisé pour : prix, quantités, dates,
IDs, labels uppercase, et compteurs/badges — **jamais pour le body**.

### Palette — voir `tokens/tokens.css`
Tous les tokens sont en CSS vars, exposés via Tailwind (`text-ink`,
`bg-paper`, `border-line-2`, `shadow-md`, etc.). La classe
`[data-theme="dark"]` sur `<html>` bascule en dark (variables
overridées).

---

## 3. Écrans — mapping composants repo → fichiers de réf

| Écran design | Fichier HTML | Composant(s) repo à refaire |
|---|---|---|
| **00 — Typographie** | `designs/00 - Typographie.html` | spécimens, à appliquer partout |
| **01 — Boutique publique** | `designs/01 - Boutique publique.html` | `src/app/components/shop/PublicShop.tsx` |
| **02 — ProductCard** | `designs/02 - ProductCard.html` | `src/app/components/ProductCard.tsx` |
| **03 — Chat copilot** | `designs/03 - Chat copilot.html` | `src/app/components/ChatInterface.tsx` |
| **04 — Admin dashboard** | `designs/04 - Admin dashboard.html` | `src/app/components/dashboard/DashboardLayout.tsx` + sous-pages |
| **05 — Portail B2B** *(optionnel)* | `designs/05 - Portail B2B.html` | nouvelle surface — Home, Catalogue IA, Fiche, Panier+N+1 |

### Priorités
- **P1** : PublicShop (01) + ProductCard (02)
- **P2** : Chat (03)
- **P3** : Dashboard (04) + PIM Admin

Le portail B2B (05) est une 4ᵉ surface optionnelle — à n'implémenter que
si le périmètre commercial est confirmé.

---

## 4. Détails par écran

### 01 — Boutique publique `/shop/:slug`
**Références** : Mixam.co.uk, Exaprint.fr, Moo.com.
Thémable par client via `--shop-primary`, `--shop-accent`, `--shop-radius`.

**Layout à appliquer** :
- **Header sticky** : logo boutique + nav minimale + recherche ⌘K +
  panier (icône + badge compte).
- **Hero** : visuel produit **en situation** (pas mockup isolé) — stack
  d'impressions, main qui tient, setup bureau. À défaut, pattern SVG
  print-themed (cartes empilées, tranche dorée, textures papier). Éviter
  le gradient grossier.
- **Pilules catégories** horizontales scrollables, style Moo :
  radius full, border 1px, padding 8-14px, active = `bg-accent
  text-accent-ink`.
- **Grille produit 4-col** desktop → 2-col tablet → 1-col mobile.
  - Card : visuel dominant (aspect 4/3) + titre 14px/500 + meta ligne
    discrète + prix (mono 16px) + CTA **"Personnaliser"** (pas "Acheter
    maintenant"). CTA en **hover reveal** sur desktop.
  - Visuel : SVG isométrique ou pattern, jamais emoji.
  - **Badges trust** (FSC, PEFC, Éco, "Fabriqué en France",
    "Livraison 48h") en petits outlined `border-line` / `text-muted`,
    **jamais vert criard**.
- **Modale détail** : slide-up subtil, close sur ⎋, `rounded-xl`
  (12px), `shadow-lg`, overlay `bg-black/40`.
- **Drawer panier** : slide depuis la droite, width 420px desktop,
  full-width mobile. Résumé lignes + CTA "Commander".
- **Checkout modale** : 2 steps (livraison / paiement), progress
  discret en top.
- **Footer** minimaliste : 3-4 colonnes liens + logos labels FSC/PEFC +
  mentions légales, type-only.
- **Mobile-first impeccable** — hero qui reste lisible, pilules
  scroll-x, CTA tap-target 44px min.

**Interdits spécifiques** :
- Pas de promo rouge clignotant, pas de "COMMANDEZ AVANT MINUIT".
- Pas de carrousel agressif.

### 02 — ProductCard (composant pivot)
**2 variants** à exposer :
- `variant="default"` — utilisé dans la grille 2 colonnes du chat
- `variant="compact"` — utilisé dans la grille 3-4 colonnes du chat ou
  en modale détail

**Hiérarchie visuelle** (remplace les 5 onglets actuels Fiche / Prix /
Mockup / Éditer / Debug) :
1. **Visuel produit** (aspect 4/3, radius 10px)
2. **Titre** 14.5px/500 + dim secondaire en gris
3. **Spécifs clés** (3 max, en ligne, mono 11px)
4. **Prix** (mono 16px) + petit `/ qty` muted + éventuel `−X%` en vert
5. **Actions** : CTA principal "Personnaliser" + icône menu (…)
6. **Enrichissement PIM déplié** en **accordéon Framer Motion** (pas
   onglets) — sections : fiche complète, mockup, édition, debug (dev
   only). Expand/collapse avec `motion.div` + `AnimatePresence`,
   duration 180ms, ease `out-soft`.

### 03 — Chat copilot `/`
**Références** : Perplexity + Claude.ai + ChatGPT Canvas.

**Layout** :
- **Side panel historique gauche** (collapsible, 260px ouvert / 56px
  fermé) :
  - Bouton "Nouvelle conversation" pin en haut (icône + label).
  - Liste conversations : icône + titre tronqué 1 ligne, hover reveal
    full title (tooltip shadcn).
  - Groupes temporels : "Aujourd'hui", "Cette semaine", "Plus ancien"
    (labels mono uppercase 10.5px).
  - Footer panel : avatar user + menu ⋯.
- **Canvas principal central** :
  - Empty state : logo centré + input + 4 suggestions en dessous
    (voir `02 - ProductCard.html` et `03 - Chat copilot.html` pour le
    visuel).
  - Flux de messages :
    - User : texte aligné droite, **sans bulle** (juste padding + fine
      border optionnelle), avatar 24px minimaliste.
    - Assistant : flux continu sans bulle, **sections typographiques**
      pour réponses longues (h3 500/14.5px, listes aérées, inline code
      en mono).
    - **ProductCards inline** dans le flux, pas en grille isolée — style
      Perplexity generative UI (cards qui apparaissent en ligne entre le
      texte).
  - **États de chargement** : pulse très léger sur skeleton `bg-line`
    (animation shimmer douce), ou curseur qui clignote sur le texte en
    construction. **Pas de bounce balls Tailwind**.
- **Input chat** : une seule zone bien mise en valeur en bas :
  - Textarea auto-grow, `rounded-xl`, `border-line-2`, `shadow-md`.
  - Boutons contextuels à gauche : attacher (paperclip lucide),
    suggestions (sparkle), slash commands.
  - Bouton envoyer à droite, toujours visible, avec kbd `↵`.
- **Command palette ⌘K** (shadcn `command`) : ouvre un dialog centré
  avec 3 sections — Navigation, Rechercher une conversation, Actions
  rapides.

### 04 — Admin dashboard `/dashboard`
**Références** : Linear, Stripe Dashboard, Vercel Dashboard.

**Layout** :
- **Sidebar** dense, 220px, sections groupées (Catalogue, Clients,
  Boutiques, Bibliothèques, PIM Admin, Paramètres). Items = icône 16px
  + label 13px + count mono muted à droite.
- **Breadcrumbs** en top, discrets, mono 11px, pas de fond.
- **Cards KPI** en grille responsive `grid-cols-4 gap-4` desktop :
  une seule métrique par card (28px mono), label mono uppercase
  au-dessus, sparkline recharts en bas (hauteur 32px, stroke 1.5).
- **Tables avancées** :
  - Lignes 44px, border-b 1px `line`.
  - Tri clic header (chevron lucide).
  - Filtres inline (popover shadcn).
  - Pagination discrète en bas : "Précédent · 1-20 sur 142 · Suivant".
  - Actions row : **hover reveal** (edit, delete, duplicate) en icônes
    16px à droite.
  - Multi-select + bulk actions barre qui slide-up en bas.
- **Modales** : slide-up subtil ou fade (150ms), fermeture ⎋,
  `rounded-xl`.
- **Toasts** (sonner) : position bottom-right, style épuré.
- **États vides** : illustration SVG inline (pas d'emoji), titre
  explicite, CTA primaire.

### 05 — Portail B2B (optionnel)
Parcours acheteur corporate avec catalogue restreint, budget par centre
de coût, workflow N+1 → Achats → Magrit. Voir
`designs/05 - Portail B2B.html` — 4 écrans :
- **F1 Home** : raccourcis + réabonnement + validations en cours
- **F2 Catalogue** : **recherche conversationnelle AI-native** avec
  chips filtres parsés par l'IA (pas de sidebar catégories classique)
- **F3 Fiche produit** + configurateur template brandé
- **F4 Panier + workflow N+1** : stepper validation 4 étapes

---

## 5. UX patterns à intégrer partout

- **Inline editing** : clic sur champ texte → input, save au blur.
- **Command palette ⌘K** : shadcn `command` component.
- **Optimistic UI** : update instantané + rollback si erreur (déjà
  partiellement en place dans `ConversationContext`, à harmoniser).
- **Keyboard shortcuts visibles** : `<kbd>` dans l'UI (⌘K, ↵, ⎋).
- **Hover reveal** pour actions secondaires (edit/delete d'une row).
- **Tooltips contextuels** sur les icônes (shadcn `tooltip`).
- **Skeleton loaders** type Perplexity : barres `bg-line` très fines,
  pulse lent.
- **Empty states** : SVG discret + CTA.
- **Multi-select + bulk actions** harmonisés tables admin + chat.

---

## 6. Accessibilité

Niveau **WCAG AA minimum**.
- **Focus visible** : ring 2px `accent` offset 2px (déjà dans
  `tokens.css`).
- `aria-label` sur tout bouton icon-only.
- Navigation clavier complète (Tab, Shift+Tab, Enter, Esc).
- Contrastes vérifiés **y compris en dark mode** sur la boutique.
- Target tap 44px min sur mobile.
- `prefers-reduced-motion` respecté pour toutes les animations
  Framer Motion.

---

## 7. Itérations de livraison suggérées

### Itération A — Foundations (1-2j)
- Merger `tokens/tokens.css` dans `src/styles/tokens.css`.
- Étendre `tailwind.config.ts` avec les keys fournies.
- Vérifier que shadcn/ui continue de fonctionner (theme vars héritées).
- Refactorer 1 écran hero par surface (PublicShop + Chat + Dashboard)
  avec mock data.

### Itération B — Composants (branche `design/v2`)
- Nouveau `ProductCard.tsx` (2 variants).
- Nouveau `PublicShop.tsx` complet.
- Nouveau `ChatInterface.tsx` (side panel + canvas + ⌘K).
- Nouveau `DashboardLayout.tsx` + 2 pages admin (Boutiques, Clients).

### Itération C — Polish
- Skeletons fluides partout.
- Toasts sonner harmonisés.
- Micro-animations Framer Motion (expand accordéon, slide modales).
- États vides SVG.
- Responsive mobile vérifié sur les 3 surfaces.

---

## 8. Design tokens — récap rapide

| Token | Valeur | Usage |
|---|---|---|
| `--ink` | `#0A0A0A` | Texte principal |
| `--ink-2` | `#2A2A2D` | Texte secondaire |
| `--muted` | `#52525B` | Texte tertiaire |
| `--mute-2` | `#8A8A93` | Labels mono, compteurs |
| `--line` | `#ECECEC` | Border fine |
| `--line-2` | `#D4D4D8` | Border appuyée |
| `--bg` | `#FAFAFA` | Background app |
| `--paper` | `#FFF` | Surface card |
| `--accent` | `#0F172A` | Accent sobre |
| `--ok-fg` | `#0E8F5A` | Confirmation / remise |
| radius cards | 10px | |
| radius boutons | 6-8px | |
| radius modales | 12px | |
| shadow cards | `0 1px 2px rgba(0,0,0,.04), 0 8px 24px rgba(0,0,0,.06)` | |

---

## 9. Fichiers du bundle

```
design_handoff_magrit_v2/
├── README.md                       ← ce fichier
├── tokens/
│   ├── tokens.css                  ← CSS vars à coller dans src/styles/
│   └── tailwind.config.ts          ← extension Tailwind v4 à merger
├── designs/
│   ├── index.html                  ← index de navigation entre écrans
│   ├── 00 - Typographie.html
│   ├── 01 - Boutique publique.html
│   ├── 02 - ProductCard.html
│   ├── 03 - Chat copilot.html
│   ├── 04 - Admin dashboard.html
│   ├── 05 - Portail B2B.html
│   └── Logo.html                   ← exploration logo Magrit
└── screenshots/
    ├── 00-typographie.jpg
    ├── 01-boutique-publique.jpg
    ├── 02-productcard.jpg
    ├── 03-chat-copilot.jpg
    ├── 04-admin-dashboard.jpg
    └── 05-portail-b2b.jpg
```

---

## 10. Points d'attention pour Claude Code

1. **Ne PAS toucher** aux contextes, hooks, fetch Supabase, edge
   functions. Couche présentation uniquement.
2. **shadcn/ui est déjà en place** dans le repo : étendre, pas
   remplacer. Les tokens sont compatibles avec les CSS vars shadcn
   (voir `tokens.css`).
3. **Branche Git** : travailler sur `design/v2`.
4. **Boutique thémable** : respecter les vars `--shop-primary`,
   `--shop-accent`, `--shop-radius` — elles sont overridées par le
   contexte de slug, ne pas les hardcoder.
5. **Ouvrir les HTML dans un navigateur** avant de commencer —
   chaque fichier contient plusieurs écrans référencés avec des specs
   inline (bande "spec" sous chaque card de référence).
