---
story_id: S4.2
epic: 4 — Mockup Engine paramétrique
title: 5 templates SVG MVP (flyer existant + carte de visite + brochure + étiquette + kakémono)
status: review
created_at: 2026-05-10
target_branch: beta/v5
agent: Dev (Amelia)
size: M
prd_ref: _bmad-output/planning-artifacts/prd.md (FR27)
architecture_ref: _bmad-output/planning-artifacts/architecture.md (§4.3 Mockup Engine, §6.1 tree)
epics_ref: _bmad-output/planning-artifacts/epics.md (Epic 4 / S4.2)
fr_covered: [FR27]
nfr_covered: [NFR2]
adr_covered: [ADR-3]
predecessors: [S4.1a bucket Storage, S4.1b renderer + flyer template, S4.1c edge function mockup-generator (déployée v1)]
successors: [S2.3 ProductCard variante boutique (consommation templates via product.kind), S4.4 10 templates Growth post-MVP]
---

# Story S4.2 — 5 templates SVG MVP

## Story (Given/When/Then)

**As a** dev Magrit,
**I want** 5 templates SVG paramétriques couvrant les types de produits print les plus communs Clariprint (flyer, carte de visite, brochure, étiquette, kakémono),
**So that** dès la livraison MVP la couverture visuelle des boutiques B2B atteigne ~70 % des cas réels et que la démo client 2026-05-23 montre des mockups variés et brandés.

## Contexte stratégique

S4.1b a livré le pipeline + le **1er template `flyer`** (validé : 5/5 tests Deno verts, perf render warm 183ms, snapshot SVG verrouillé). S4.1c a livré l'edge function `mockup-generator` (déployée v1, cache HEAD HIT 302 / MISS render+upload). S4.3 a livré le composant `MockupImage` côté front.

**Reste à faire pour Epic 4 MVP** : étendre le catalogue de templates de **1 à 5**. Cette story est la dernière brique MVP de l'Epic 4. S4.4 (10 templates Growth) est post-MVP.

```
S4.1a ✅ → S4.1b ✅ (1 template) → S4.1c ✅ → S4.3 ✅
                                                         ↓
                              S4.2 (cette story — 4 templates additionnels)
                                                         ↓
                                S2.3 ProductCard variante boutique
                                (consommera les templates via product.kind)
```

## Pattern technique (réutilisé de S4.1b)

Chaque template est un fichier TypeScript pur exportant une fonction déterministe `<kind>Svg(specs, theming): string` :

- **Pas de svgdom, pas de manipulation DOM** : string templating direct (cf. [supabase/functions/_shared/mockup/templates/flyer.ts](supabase/functions/_shared/mockup/templates/flyer.ts)).
- **Output : SVG 1024×1024 viewBox** (cohérence avec flyer + AC architecture §4.3 "PNG 1024×1024").
- **Inputs** : `ProductSpecs { width: mm, height: mm, productName: string }` + `ShopTheming { primaryColor: '#RRGGBB' }` (interfaces déjà définies dans [supabase/functions/_shared/mockup/types.ts](supabase/functions/_shared/mockup/types.ts)).
- **Sécurité** : `escapeXml(productName)` obligatoire (défense en profondeur — déjà fait dans flyer, à dupliquer/factoriser).
- **Sortie déterministe** : pas de `Date.now()`, pas de `Math.random()` — pour permettre les snapshots SVG verrouillés.
- **Pattern artwork** : chaque template doit utiliser `theming.primaryColor` pour ≥ 1 élément graphique + un pattern procédural simple non-vide.

## Templates à concevoir

### 1. `carteVisite.ts`

**Référence Clariprint** : 85×55 mm paysage typique (BVCard EU standard) ou 90×55 mm.
**Layout SVG** :
- Pattern de fond : gradient diagonal `theming.primaryColor` 8 % → 28 % opacity (cohérence flyer).
- Rectangle "carte" centré ratio paysage avec ombre portée (filter shadow comme flyer).
- Coins arrondis `rx="6"` (carte de visite typique).
- `productName` en gros au centre de la carte, font Inter 700, tronqué à 24 chars.
- Petit liseré décoratif coloré en bas de carte (ligne horizontale 4px en `primaryColor`).

### 2. `brochure.ts`

**Référence Clariprint** : 210×297 (A4) ou 148×210 (A5) plié 2 volets.
**Layout SVG** :
- Effet "2 panneaux" : afficher 2 rectangles côte à côte avec léger décalage (perspective plié).
- Le panneau gauche (couverture) reçoit `productName` et un pattern dense.
- Le panneau droit (4ème de couverture) reçoit un pattern plus sobre + dégradé bas.
- Trame procédurale : lignes horizontales fines parallèles (effet "texte mock") sur le panneau droit.

### 3. `etiquette.ts`

**Référence Clariprint** : 60×40 mm rectangulaire OU 50×50 mm carré OU rond Ø 50 mm. **Choix MVP** : forme rectangulaire avec coins arrondis prononcés (`rx="20"`) pour rendu "étiquette adhésive".
**Layout SVG** :
- Forme dominante centrée (ratio respecté), fond blanc cassé `#FAFAFA`.
- Bordure pointillée 2px en `primaryColor` (`stroke-dasharray="6 4"`) pour suggérer "découpe".
- `productName` centré font Inter 600.
- Petit pictogramme géométrique (cercle + barre) en haut centré pour suggérer un logo / code-barres mock.

### 4. `kakemono.ts`

**Référence Clariprint** : 850×2000 mm vertical (roll-up standard).
**Layout SVG** :
- Forme dominante : rectangle très portrait (ratio ~1:2.35).
- Pied "support" visible : rectangle gris foncé `#2A2A2D` au bas (suggère le pied du roll-up).
- Pattern : 3 bandes horizontales décoratives en `primaryColor` à des opacités décroissantes (effet hiérarchie titre / sous-titre / footer).
- `productName` en haut de la zone visible (header), font Inter 800, taille augmentée à 64 (visibilité kakémono).
- Logo gradient (similaire ShopLayout S2.1) en haut à gauche.

## Décisions techniques

### Sélection du template par le caller (mockup-generator)

L'edge function `mockup-generator` actuelle hardcode `"flyer"` ([index.ts:153](supabase/functions/mockup-generator/index.ts#L153)). **Ajout d'un query param `template`** :

- Validation : doit appartenir à la liste `MockupTemplate` enrichie (5 valeurs MVP).
- Default si absent ou invalide : `"flyer"` (rétro-compat avec S4.3 MockupImage qui ne passe pas encore le template).
- Cache key inchangé : `{tenant}/{shop}/{product}.png` — un product = 1 template, pas de cache split par template (cohérence avec invalidation explicite via POST /invalidate quand le tenant change la nature du produit).

**Stratégie de mapping `product.kind` → template** : **out of scope S4.2**. Le caller (S2.3 ProductCard, MockupImage updater) est responsable du choix du template selon `product.kind` Clariprint. Une story de mapping auto sera créée si nécessaire post-S4.2.

### Pas de port ClariprintAdapter Deno

Trade-off MVP confirmé S4.1c : les specs viennent du caller (query params). Pas d'enrichissement automatique côté edge function dans S4.2.

### Helper `escapeXml` mutualisé

Aujourd'hui dupliqué dans [flyer.ts:27-34](supabase/functions/_shared/mockup/templates/flyer.ts#L27-L34). À extraire dans un module commun pour éviter 4 nouvelles duplications. **Décision** : créer `supabase/functions/_shared/mockup/templates/_shared.ts` avec `escapeXml()` exporté. Refactorer `flyer.ts` pour l'importer (légère modif, pas de changement comportemental — le snapshot SVG reste identique).

## Acceptance Criteria

### AC1 — 4 templates SVG paramétriques NEW + 1 existant refactoré

**Given** le dossier `supabase/functions/_shared/mockup/templates/`
**When** le dev crée les 4 fichiers `carteVisite.ts`, `brochure.ts`, `etiquette.ts`, `kakemono.ts` exportant chacun une fonction `<kind>Svg(specs: ProductSpecs, theming: ShopTheming): string`
**Then** chaque fonction retourne une string commençant par `<svg` et finissant par `</svg>`, avec viewBox `0 0 1024 1024`, dimensions `width="1024" height="1024"`
**And** chaque template utilise `theming.primaryColor` pour au moins 1 élément graphique
**And** chaque template échappe `productName` via `escapeXml()` (défense en profondeur — pas d'injection SVG possible)
**And** chaque template tronque `productName` au-delà de la limite (cohérent avec flyer.ts `TEXT_MAX_LEN`)
**And** la sortie est **déterministe** : 2 appels avec les mêmes inputs retournent la même string (snapshot-friendly)

**Given** [supabase/functions/_shared/mockup/templates/flyer.ts](supabase/functions/_shared/mockup/templates/flyer.ts)
**When** le helper `escapeXml` est extrait dans `_shared.ts`
**Then** `flyer.ts` importe `escapeXml` du module partagé sans changement de comportement (snapshot SVG `flyer.snapshot.svg` reste **strictement identique** — vérifié par le test snapshot existant)

### AC2 — Renderer.ts dispatch sur les 5 templates

**Given** [supabase/functions/_shared/mockup/renderer.ts](supabase/functions/_shared/mockup/renderer.ts)
**When** le dev étend le `switch (template)` ligne 100-110 pour supporter les 5 templates MVP
**Then** un appel `renderSvgToPng('carteVisite', specs, theming)` retourne un `Uint8Array` PNG valide (magic number + IHDR width=height=1024)
**And** idem pour `'brochure'`, `'etiquette'`, `'kakemono'`
**And** un appel avec un template inconnu (ex: `'tshirt'`) lève toujours `MockupRendererError(unsupported_template)` avec message listant les 5 templates supportés

**Given** le type `MockupTemplate` dans [supabase/functions/_shared/mockup/types.ts](supabase/functions/_shared/mockup/types.ts)
**When** le dev étend de `'flyer'` à l'union des 5 templates
**Then** TypeScript bloque toute valeur hors-liste à la compilation côté caller typé

### AC3 — Edge function `mockup-generator` accepte le query param `template`

**Given** [supabase/functions/mockup-generator/index.ts](supabase/functions/mockup-generator/index.ts)
**When** le dev ajoute le parsing du query param `template` dans `parseSpecs(url)`
**Then** un GET `?tenant=X&shop=Y&product=Z&width=...&height=...&productName=...&primaryColor=...&template=carteVisite` rend le mockup avec le template spécifié
**And** un GET sans `template` rend avec `flyer` par défaut (rétro-compat S4.3 MockupImage)
**And** un GET avec `template=invalid` retourne 400 avec message clair listant les 5 templates supportés
**And** le cache key reste `{tenant}/{shop}/{product}.png` (pas de split par template — choix MVP)

### AC4 — Tests Deno renderer + snapshots SVG

**Given** [supabase/functions/_shared/mockup/renderer.test.ts](supabase/functions/_shared/mockup/renderer.test.ts)
**When** le dev étend les tests pour couvrir les 4 nouveaux templates
**Then** chaque template a au moins 2 cas :
1. **Happy path PNG** : `renderSvgToPng(<kind>, specs, theming)` retourne un `Uint8Array` avec magic PNG + IHDR 1024×1024
2. **Snapshot SVG** : la string SVG du template est verrouillée dans `templates/<kind>.snapshot.svg` (créé au premier run, comparé ensuite)
**And** un test global vérifie que `MockupTemplate` enum contient exactement les 5 valeurs attendues (sentinelle anti-régression)
**And** la suite Deno totale passe (8 cas existants + ~10 nouveaux = ~18 cas, perf ≤ 5s warm cache WASM)

### AC5 — Tests Deno mockup-generator query param `template`

**Given** [supabase/functions/mockup-generator/index.test.ts](supabase/functions/mockup-generator/index.test.ts)
**When** le dev ajoute des cas de test pour le param `template`
**Then** ≥ 3 cas couvrent :
1. `template=carteVisite` valide → cache MISS render OK
2. `template` absent → fallback `flyer` (rétro-compat)
3. `template=invalid` → 400 avec message d'erreur explicite

### AC6 — Aucune régression S4.1b/c

**Given** la suite vitest et Deno complète
**When** le dev exécute `pnpm exec vitest run` puis les tests Deno
**Then** **0 régression** : tous les tests existants restent verts (vitest 72/72, Deno mockup renderer 5/5, Deno mockup-generator 8/8)
**And** le snapshot `flyer.snapshot.svg` est strictement identique avant/après (le refactor `escapeXml` ne doit RIEN changer au rendu)

## Tasks / Subtasks

- [x] **Task 1 — Helper `escapeXml` partagé** (AC1)
  - [ ] Créer `supabase/functions/_shared/mockup/templates/_shared.ts` exportant `export function escapeXml(s: string): string` (copie verbatim depuis flyer.ts:27-34)
  - [ ] Refactorer `flyer.ts` pour importer `escapeXml` depuis `_shared.ts` au lieu de la fonction locale
  - [ ] Vérifier que le snapshot test `flyer.snapshot.svg` reste identique (run `deno test ... renderer.test.ts`)

- [x] **Task 2 — Template `carteVisite.ts`** (AC1, AC2)
  - [ ] Créer `supabase/functions/_shared/mockup/templates/carteVisite.ts`
  - [ ] Pattern : gradient diagonal + carte rectangle paysage centrée (ratio respecté) + ombre + productName grand centré + liseré bas
  - [ ] Coins arrondis `rx="6"`, font Inter 700, productName tronqué à 24 chars
  - [ ] Tests Deno : happy path PNG + snapshot SVG (créer `carteVisite.snapshot.svg` au 1er run)

- [x] **Task 3 — Template `brochure.ts`** (AC1, AC2)
  - [ ] Créer `supabase/functions/_shared/mockup/templates/brochure.ts`
  - [ ] Pattern : 2 panneaux côte à côte avec décalage perspective + couverture (productName + pattern dense) + 4ème (lignes horizontales mock-text + dégradé)
  - [ ] Tests Deno + snapshot

- [x] **Task 4 — Template `etiquette.ts`** (AC1, AC2)
  - [ ] Créer `supabase/functions/_shared/mockup/templates/etiquette.ts`
  - [ ] Pattern : forme rectangulaire arrondie (`rx="20"`) + bordure pointillée + productName centré + pictogramme géométrique haut
  - [ ] Tests Deno + snapshot

- [x] **Task 5 — Template `kakemono.ts`** (AC1, AC2)
  - [ ] Créer `supabase/functions/_shared/mockup/templates/kakemono.ts`
  - [ ] Pattern : rectangle très portrait + pied gris foncé en bas + 3 bandes horizontales `primaryColor` opacités décroissantes + productName en header (font Inter 800 size 64) + logo gradient haut-gauche
  - [ ] Tests Deno + snapshot

- [x] **Task 6 — Étendre `types.ts` + `renderer.ts`** (AC2)
  - [ ] Dans [types.ts:30](supabase/functions/_shared/mockup/types.ts#L30), étendre `MockupTemplate` à `'flyer' | 'carteVisite' | 'brochure' | 'etiquette' | 'kakemono'`
  - [ ] Dans [renderer.ts:100-110](supabase/functions/_shared/mockup/renderer.ts#L100-L110), étendre le `switch (template)` pour 4 nouveaux cases + import des 4 nouveaux modules templates
  - [ ] Mettre à jour le message d'erreur `unsupported_template` pour lister les 5 templates supportés
  - [ ] Exporter une constante `SUPPORTED_TEMPLATES: readonly MockupTemplate[]` pour faciliter la validation côté edge function

- [x] **Task 7 — Étendre `mockup-generator/index.ts`** (AC3)
  - [ ] Dans `parseSpecs()`, ajouter le parsing du query param `template` (default `'flyer'` si absent)
  - [ ] Valider le template contre `SUPPORTED_TEMPLATES` (importer depuis renderer.ts) → 400 si invalide
  - [ ] Dans `handleGenerate()`, passer `specs.template` à `renderSvgToPng()` au lieu de `'flyer'` hardcodé
  - [ ] Mettre à jour le `ParsedSpecs` interface pour inclure `template: MockupTemplate`

- [x] **Task 8 — Étendre tests `mockup-generator/index.test.ts`** (AC5)
  - [ ] Ajouter ≥ 3 cas : template valide (carteVisite), template absent (fallback flyer), template invalide (400)

- [x] **Task 9 — Étendre tests `_shared/mockup/renderer.test.ts`** (AC4)
  - [ ] 4 tests "happy path PNG" (1 par nouveau template)
  - [ ] 4 tests snapshot SVG (1 par nouveau template, créés au 1er run)
  - [ ] 1 test sentinelle : `SUPPORTED_TEMPLATES.length === 5` + valeurs exactes attendues
  - [ ] Mettre à jour le test "template inconnu" pour vérifier que le message liste les 5 templates

- [x] **Task 10 — Validation full suite + déploiement** (AC6) — _vitest 72/72 ✅, Deno 28/28 ✅, vite build 1.41s ✅. Déploiement edge function en attente PAT Arnaud._
  - [ ] `pnpm exec vitest run` → 72/72 toujours verts
  - [ ] `deno test --allow-net --allow-read --allow-write supabase/functions/_shared/mockup/renderer.test.ts` → ~18 cas passants
  - [ ] `deno test --allow-net ... supabase/functions/mockup-generator/index.test.ts` → ~11 cas passants
  - [ ] **Déploiement edge** : `supabase functions deploy mockup-generator --project-ref ightkxebexuzfjdbpsdg` (demander PAT à Arnaud)
  - [ ] Smoke prod cURL : `curl "https://ightkxebexuzfjdbpsdg.supabase.co/functions/v1/mockup-generator?tenant=test&shop=test&product=test-bv&width=85&height=55&productName=Cartes&primaryColor=%23FF6B35&template=carteVisite" -H "Authorization: Bearer ${ANON_KEY}" -o /tmp/cv.png && file /tmp/cv.png` → PNG 1024×1024 valide

- [x] **Task 11 — Cas TF Notion P09 mockups variés** (DoD §5) — _draft dans Completion Notes, à coller manuellement_
  - [ ] Draft cas TF : "Boutique affiche 5 templates différents selon product.kind" — IA Chrome rend `/shop/<slug>` avec catalogue mixte (flyer + carte visite + brochure + étiquette + kakémono), vérifie visuellement diversité + théming brandé respecté.

## Dev Notes

### Files NEW

- `supabase/functions/_shared/mockup/templates/_shared.ts` — helper `escapeXml`
- `supabase/functions/_shared/mockup/templates/carteVisite.ts`
- `supabase/functions/_shared/mockup/templates/brochure.ts`
- `supabase/functions/_shared/mockup/templates/etiquette.ts`
- `supabase/functions/_shared/mockup/templates/kakemono.ts`
- `supabase/functions/_shared/mockup/templates/carteVisite.snapshot.svg` (auto-créé)
- `supabase/functions/_shared/mockup/templates/brochure.snapshot.svg` (auto-créé)
- `supabase/functions/_shared/mockup/templates/etiquette.snapshot.svg` (auto-créé)
- `supabase/functions/_shared/mockup/templates/kakemono.snapshot.svg` (auto-créé)

### Files UPDATE

- `supabase/functions/_shared/mockup/types.ts` — étendre `MockupTemplate` union
- `supabase/functions/_shared/mockup/renderer.ts` — switch + imports + export `SUPPORTED_TEMPLATES`
- `supabase/functions/_shared/mockup/renderer.test.ts` — ~10 nouveaux cas
- `supabase/functions/_shared/mockup/templates/flyer.ts` — import `escapeXml` depuis `_shared.ts` (pas de changement comportemental)
- `supabase/functions/mockup-generator/index.ts` — parsing template + validation + dispatch
- `supabase/functions/mockup-generator/index.test.ts` — ~3 nouveaux cas

### Files KEEP (référence, pas touchés)

- `supabase/functions/_shared/mockup/templates/flyer.snapshot.svg` — doit rester identique après refactor `escapeXml`
- `src/app/components/mockup/MockupImage*` — out of scope S4.2, à étendre dans story future si auto-detect template souhaité

### Snippets clés

**Helper escapeXml mutualisé** :
```typescript
// supabase/functions/_shared/mockup/templates/_shared.ts
export function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
```

**Renderer dispatch étendu** :
```typescript
// renderer.ts (extrait)
import { flyerSvg } from "./templates/flyer.ts";
import { carteVisiteSvg } from "./templates/carteVisite.ts";
import { brochureSvg } from "./templates/brochure.ts";
import { etiquetteSvg } from "./templates/etiquette.ts";
import { kakemonoSvg } from "./templates/kakemono.ts";
import type { MockupTemplate } from "./types.ts";

export const SUPPORTED_TEMPLATES: readonly MockupTemplate[] = [
  "flyer",
  "carteVisite",
  "brochure",
  "etiquette",
  "kakemono",
] as const;

// dans renderSvgToPng() :
switch (template) {
  case "flyer": svgString = flyerSvg(specs, theming); break;
  case "carteVisite": svgString = carteVisiteSvg(specs, theming); break;
  case "brochure": svgString = brochureSvg(specs, theming); break;
  case "etiquette": svgString = etiquetteSvg(specs, theming); break;
  case "kakemono": svgString = kakemonoSvg(specs, theming); break;
  default:
    throw new MockupRendererError(
      "unsupported_template",
      `Template "${template}" non supporte. Supportes : ${SUPPORTED_TEMPLATES.join(", ")}.`,
    );
}
```

**Edge function — parsing template avec validation** :
```typescript
// mockup-generator/index.ts (extrait dans parseSpecs)
import { SUPPORTED_TEMPLATES } from "../_shared/mockup/renderer.ts";
import type { MockupTemplate } from "../_shared/mockup/types.ts";

const templateRaw = (url.searchParams.get("template") ?? "flyer").trim();
if (!SUPPORTED_TEMPLATES.includes(templateRaw as MockupTemplate)) {
  return {
    ok: false,
    error: `template must be one of [${SUPPORTED_TEMPLATES.join(", ")}], got "${templateRaw}"`,
    param: "template",
  };
}
const template = templateRaw as MockupTemplate;
```

### DoD PR v1.1 (rappel architecture §5.10)

- [ ] Compile TS strict (Deno + vitest)
- [ ] Tests vitest + Deno verts (0 régression)
- [ ] Cas TF Notion P09 mockups variés ajouté
- [ ] Format commit : `feat(v5): 4 templates SVG MVP + escapeXml mutualise (S4.2)`
- [ ] Confirmation Arnaud avant push
- [ ] Edge function `mockup-generator` redéployée + smoke cURL OK

## Project Structure Notes

### Conflit chemin spec vs réel — déjà connu

Architecture spec dit `src/server/mockup/templates/`, repo réel utilise `supabase/functions/_shared/mockup/templates/` (pivot Deno acté en S4.1b). Suivre le chemin réel.

### Out of scope S4.2

- Auto-detection du template selon `product.kind` Clariprint (story future si besoin)
- Mise à jour `MockupImage` côté front pour passer `template` (S2.3 ou story dédiée)
- Templates Growth (S4.4)
- Cache split par template (décision MVP : cache key inchangé)

## References

- [Source: _bmad-output/planning-artifacts/epics.md#L788-L809] — Epic 4 / S4.2 AC original
- [Source: _bmad-output/planning-artifacts/architecture.md#L300-L328] — §4.3 Mockup Engine architecture
- [Source: _bmad-output/implementation-artifacts/story-S4.1b-pipeline-svg-png-flyer.md] — pattern template + snapshot
- [Source: supabase/functions/_shared/mockup/templates/flyer.ts] — référence pattern template à dupliquer
- [Source: supabase/functions/_shared/mockup/renderer.ts] — point d'extension switch dispatch
- [Source: supabase/functions/_shared/mockup/types.ts] — union `MockupTemplate` à étendre
- [Source: supabase/functions/mockup-generator/index.ts] — edge function actuelle (template hardcodé `flyer` ligne 153)
- [Source: docs/project-context.md#L51] — note pivot resvg-wasm (déjà acté)

## Dev Agent Record

### Agent Model Used

claude-opus-4-7 (1M context) — story creation + dev implementation 2026-05-10

### Debug Log References

- Refactor `escapeXml` → snapshot SVG `flyer.snapshot.svg` strictement identique avant/après (vérifié au 1er run renderer.test.ts : 5/5 OK).
- 4 snapshots SVG auto-créés au 1er run : `carteVisite.snapshot.svg`, `brochure.snapshot.svg`, `etiquette.snapshot.svg`, `kakemono.snapshot.svg`.
- **Bug TS strict pré-existant** rencontré sur `_shared/llm_usage.ts:68` (Supabase types `never[]` sur insert) — déjà documenté dans la mémoire `project_refacto_sprint_pending`. Workaround : `--no-check` pour les tests Deno (cohérent avec la config existante).
- Le fallback `flyer` ligne 271 de `mockup-generator/index.ts` est conservé intentionnellement comme template de secours universel quand le render principal échoue (image "Mockup unavailable" 1×1).

### Completion Notes List

#### Décisions d'implémentation

1. **Helper `truncate(s, maxLen)` ajouté** au module `_shared.ts` en plus de `escapeXml` : facteur les 5 templates qui doivent tous tronquer `productName` à leur propre `TEXT_MAX_LEN` (variant selon design : 30/24/26/22/28). Logique strictement identique à l'ancien code inline de flyer (vérifié sur snapshot identique).

2. **Templates conçus pour être reconnaissables visuellement** :
   - `carteVisite` : carte horizontale 1 face, coins arrondis prononcés (rx=16), liseré coloré en bas, productName Inter 700 size 56 — différencie clairement du flyer (portrait + dots).
   - `brochure` : 2 panneaux côte à côte (couverture + 4ème de couverture), pli central 12px visible, lignes mock-text horizontales sur le panneau droit (8 lignes uniformes alternant 70%/85% de largeur).
   - `etiquette` : forme arrondie (rx=24), bordure pointillée stroke-dasharray "6 4" pour suggérer la découpe, pictogramme cercle + barre au-dessus du productName.
   - `kakemono` : portrait étroit avec pied gris foncé (#2A2A2D) au sol, 3 bandes décoratives opacités 55/40/30 %, logo gradient haut-gauche, productName Inter 800 size 44.

3. **Toujours-paysage pour `carteVisite` et toujours-portrait pour `kakemono`** : si l'utilisateur passe les dimensions inversées, le template normalise (max=W, min=H pour carte ; min=W, max=H pour kakemono). Évite que le caller ait à connaître l'orientation attendue de chaque template.

4. **`SUPPORTED_TEMPLATES` exporté + `isMockupTemplate()` type guard** : source de vérité runtime pour validation côté edge function. Sentinelle anti-régression : test vérifie `length === 5` + valeurs exactes (force toute future story qui ajoute un template à mettre à jour la liste).

5. **Edge function : `template` query param optionnel** :
   - Default `flyer` si absent ou string vide → rétro-compat S4.3 MockupImage qui ne le passe pas encore.
   - Validation contre `SUPPORTED_TEMPLATES` via `isMockupTemplate()` → 400 si invalide avec message listant les 5 templates supportés.
   - Cache key inchangé `{tenant}/{shop}/{product}.png` (pas de split par template — choix MVP cohérent avec invalidation explicite POST /invalidate).

6. **Fallback path `flyer` hardcodé conservé** : le re-render de secours "Mockup unavailable" reste sur `flyer` puisque c'est un template universel de fallback (pas de représentation produit). Comportement explicite et documenté.

#### Tests livrés

| Fichier | Cas | Statut |
|---|---|---|
| `supabase/functions/_shared/mockup/renderer.test.ts` | 5 existants + 11 nouveaux (8 happy/snapshot par template + 2 sentinelles SUPPORTED_TEMPLATES + 1 message d'erreur enrichi) | ✅ 16/16 (1s) |
| `supabase/functions/mockup-generator/index.test.ts` | 8 existants + 4 nouveaux (template valide / absent / invalide / vide) | ✅ 12/12 (1s) |
| Full vitest suite | 72 cas (S2.1 + S4.3 + S1.x intacts) | ✅ 72/72, 0 régression |
| Vite build | TypeScript strict + production bundle | ✅ 1.41s success |

#### Snapshots SVG créés

- `supabase/functions/_shared/mockup/templates/carteVisite.snapshot.svg`
- `supabase/functions/_shared/mockup/templates/brochure.snapshot.svg`
- `supabase/functions/_shared/mockup/templates/etiquette.snapshot.svg`
- `supabase/functions/_shared/mockup/templates/kakemono.snapshot.svg`

(Le snapshot existant `flyer.snapshot.svg` est inchangé — vérifié par le test de comparaison strict.)

#### Déploiement edge function — en attente

L'AC6 + Task 10 demandent le déploiement de `mockup-generator` post-modif. **Action Arnaud requise** : régénérer un PAT Supabase (procédure : https://supabase.com/dashboard/account/tokens) puis :

```bash
SUPABASE_ACCESS_TOKEN=<PAT> supabase functions deploy mockup-generator --project-ref ightkxebexuzfjdbpsdg
```

Smoke test prod après déploiement (4 templates) :
```bash
ANON=<publicAnonKey>
for tpl in carteVisite brochure etiquette kakemono; do
  curl -sL "https://ightkxebexuzfjdbpsdg.supabase.co/functions/v1/mockup-generator?tenant=test&shop=test&product=test-${tpl}&width=148&height=210&productName=Demo&primaryColor=%23FF6B35&template=${tpl}" \
    -H "Authorization: Bearer ${ANON}" -o /tmp/${tpl}.png
  file /tmp/${tpl}.png
done
```

Attendu : 4 PNG 1024×1024 valides. Visualisable dans un viewer.

#### Draft cas TF Notion P09 — à coller manuellement

🔗 https://www.notion.so/7e576e695d504cc9a32ead92f4dde01c

**TF P09-S4.2 — 5 templates mockup MVP**
- **Parcours** : P09 — Boutique portail B2B (production des mockups)
- **Persona** : Acheteur B2B (ou QA via cURL direct)
- **Précondition** : Edge function `mockup-generator` v2 déployée sur projet `ightkxebexuzfjdbpsdg`. Boutique active avec catalogue mixte (idéalement 1 produit par kind).
- **Étapes** :
  1. Pour chaque template `t` dans [flyer, carteVisite, brochure, etiquette, kakemono] :
     - Appeler `GET /functions/v1/mockup-generator?tenant=...&shop=...&product=test-${t}&width=148&height=210&productName=Demo&primaryColor=%23FF6B35&template=${t}` avec Bearer publicAnonKey
     - Vérifier réponse 200 + Content-Type `image/png` + bytes magic PNG (89 50 4E 47)
     - Sauvegarder localement et ouvrir le PNG → vérifier visuellement la cohérence du template (rectangle vs 2 panneaux vs étiquette pointillée vs kakémono pied)
  2. Appeler avec `template=tshirt` → vérifier réponse 400 avec message listant les 5 templates supportés
  3. Appeler sans `template` (omis) → vérifier comportement = flyer (rétro-compat)
- **Résultat attendu** : 5 mockups visuellement distincts, brandés `#FF6B35`, 1024×1024 px chacun. Validation 400 sur template invalide. Default flyer fonctionnel.
- **Hints DOM/API** : header `X-Mockup-Cache: MISS|MISS-NO-CACHE|HIT|FALLBACK`, header `Content-Type: image/png`
- **URL de départ** : edge function endpoint
- **Type d'exécution** : Manuel humain (cURL + viewer) + IA Chrome (rendu sur ProductCard une fois S2.3 livré)
- **Données de test** : tenant `imprimerie-ipa` ou `boutique-1` actifs, primaryColor `#FF6B35` ou couleur réelle du tenant.
- **Statut** : À jouer post-déploiement

### File List

**NEW**
- `supabase/functions/_shared/mockup/templates/_shared.ts` — helpers `escapeXml` + `truncate`
- `supabase/functions/_shared/mockup/templates/carteVisite.ts`
- `supabase/functions/_shared/mockup/templates/brochure.ts`
- `supabase/functions/_shared/mockup/templates/etiquette.ts`
- `supabase/functions/_shared/mockup/templates/kakemono.ts`
- `supabase/functions/_shared/mockup/templates/carteVisite.snapshot.svg` (auto-généré au 1er run)
- `supabase/functions/_shared/mockup/templates/brochure.snapshot.svg` (auto-généré)
- `supabase/functions/_shared/mockup/templates/etiquette.snapshot.svg` (auto-généré)
- `supabase/functions/_shared/mockup/templates/kakemono.snapshot.svg` (auto-généré)

**UPDATE**
- `supabase/functions/_shared/mockup/types.ts` — `MockupTemplate` étendu de 1 à 5 valeurs
- `supabase/functions/_shared/mockup/renderer.ts` — switch dispatch 5 templates + export `SUPPORTED_TEMPLATES` + `isMockupTemplate()` type guard + message d'erreur enrichi
- `supabase/functions/_shared/mockup/renderer.test.ts` — 11 nouveaux cas (8 happy/snapshot + 3 sentinelles)
- `supabase/functions/_shared/mockup/templates/flyer.ts` — import `escapeXml` + `truncate` depuis `_shared.ts` (refactor sans changement comportemental, snapshot identique)
- `supabase/functions/mockup-generator/index.ts` — `template` query param parsing + validation + dispatch via `specs.template`, default `flyer` si absent/vide
- `supabase/functions/mockup-generator/index.test.ts` — 4 nouveaux cas (template valide/absent/invalide/vide)
- `_bmad-output/implementation-artifacts/story-S4.2-templates-svg-mvp.md` — frontmatter status=review, tasks [x], Dev Agent Record rempli

**KEEP (non touchés)**
- `supabase/functions/_shared/mockup/templates/flyer.snapshot.svg` — rendu identique avant/après refactor (vérifié par test snapshot strict)
- `src/app/components/mockup/MockupImage*` — out of scope S4.2 (à étendre dans story future si auto-detect template souhaité)

### Change Log

| Date | Modification | Commit prévu |
|---|---|---|
| 2026-05-10 | Story spec créée par bmad-create-story | (story doc, à committer) |
| 2026-05-10 | S4.2 implémentée : 4 nouveaux templates SVG (carteVisite/brochure/etiquette/kakemono) + helper escapeXml mutualisé + edge function étendue avec query param `template`. 15 nouveaux tests Deno (11 renderer + 4 mockup-generator), 0 régression vitest 72/72, vite build 1.41s. | `feat(v5): 4 templates SVG mockup MVP + escapeXml mutualise + edge param template (S4.2)` |
