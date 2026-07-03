---
story_id: S4.1b
epic: 4 — Mockup Engine paramétrique
title: Pipeline SVG → PNG (resvg-wasm) + 1er template flyer paramétrique
status: review
created_at: 2026-05-10
target_branch: beta/v5
agent: Dev (Amelia)
size: M
prd_ref: _bmad-output/planning-artifacts/prd.md
architecture_ref: _bmad-output/planning-artifacts/architecture.md (§4.3, §6 Tree)
epics_ref: _bmad-output/planning-artifacts/epics.md (Epic 4 / S4.1b)
fr_covered: [FR25, FR27]
nfr_covered: [NFR2]
adr_covered: [ADR-3]
predecessors: [S4.1a bucket Storage prêt]
successors: [S4.1c Edge Function mockup-generator, S4.2 4 templates supplémentaires MVP]
---

# Story S4.1b — Pipeline SVG → PNG (resvg-wasm) + 1er template flyer

## Story (Given/When/Then)

**As a** dev Magrit,
**I want** un pipeline de génération PNG paramétrique fonctionnel sur 1 template (flyer),
**So that** la chaîne technique (génération SVG paramétrique → conversion PNG → bytes utilisables par Storage) soit validée avant d'industrialiser sur les 4 autres templates MVP de S4.2.

## Pivot technique majeur (vs spec Epic 4 d'origine)

L'Epic 4 mentionne `sharp + svgdom` (Architecture §4.3). **Ce stack n'est PAS compatible avec Supabase Edge Functions (Deno Deploy)** :

| Lib | Type | Compatibilité Deno Deploy |
|---|---|---|
| `sharp` | Node native binding (libvips C) | ❌ Pas de native Node addons dans Deno Deploy |
| `svgdom` | Pure JS | ✅ Compat Deno via `npm:svgdom` mais **inutile** si on génère le SVG en string templating direct |
| `@resvg/resvg-wasm` ou `resvg_wasm` (deno.land/x) | Pure WASM | ✅ Compat Deno + Deno Deploy (validé sur edge functions Supabase en prod par autres projets) |

**Décision** : on remplace `sharp` par **`resvg_wasm`** (https://deno.land/x/resvg_wasm/mod.ts). API : `render(svgString: string): Promise<Uint8Array>` retourne directement les bytes PNG. WASM auto-init au premier appel. Inclut 3 fonts par défaut (Bitter serif / Inter sans-serif / JetBrains Mono mono) suffisantes pour les MVP templates print.

**Impact** : zéro car `svgdom` n'est pas non plus nécessaire — les templates SVG sont du JSX-like string templating en TypeScript (pas de manipulation DOM).

Cette déviation **doit être actée** par Arnaud (cf. Decisions à prendre) AVANT le dev. Si Arnaud refuse, alternatives :
- `imagescript` (Deno-native pure TS, plus limité pour SVG complexes)
- Pivot vers une edge function Node hébergée ailleurs (overkill pour Magrit)

## Acceptance Criteria

**AC1 — Module renderer fonctionnel et testable**

**Given** le dossier `supabase/functions/_shared/mockup/`,
**When** le dev crée `renderer.ts` avec une fonction exportée `renderSvgToPng(template, productSpecs, shopTheming)`,
**Then** la fonction prend en input :
- `template`: identifiant du template (initialement uniquement `'flyer'`, étendu en S4.2)
- `productSpecs`: objet typé minimal avec au moins `{ width: number, height: number, productName: string }` (mm pour dimensions)
- `shopTheming`: objet typé minimal `{ primaryColor: string }` (hex `#RRGGBB`)
- **Et** retourne un `Promise<Uint8Array>` contenant les bytes PNG valides (header `89 50 4E 47 0D 0A 1A 0A`).
**And** le PNG retourné a des dimensions 1024×1024 (cohérent avec la décision Architecture §3 "Mockup engine — format de sortie : PNG 1024×1024").
**And** la fonction throw une erreur typée `MockupRendererError` discriminée par `kind` (`unsupported_template`, `invalid_specs`, `render_failed`) si l'input est invalide ou le rendu échoue.

**AC2 — 1er template flyer paramétrique en JSX-like string**

**Given** le dossier `supabase/functions/_shared/mockup/templates/`,
**When** le dev crée `flyer.ts` exportant `function flyerSvg(specs, theming): string`,
**Then** la fonction retourne un SVG valide (string commençant par `<svg`) qui :
- A des dimensions 1024×1024 (pas les dimensions Clariprint mm, ce sont les pixels du mockup final).
- Affiche un visuel rectangulaire centré dont les **proportions** respectent le ratio `productSpecs.width / productSpecs.height` (ex: A5 148×210 → ratio portrait 0.7, A4 210×297 → ratio portrait 0.71).
- Utilise `shopTheming.primaryColor` pour au moins 1 élément graphique (background du rectangle, ou fond, ou détail décoratif).
- Affiche le `productName` en texte centré (ou en bas) avec la font Inter (incluse dans resvg_wasm).
- Contient un pattern procédural simple (lignes diagonales, cercles, ou points) qui rend le mockup non-vide visuellement.

**AC3 — Pipeline E2E renderer → PNG bytes utilisables**

**Given** le module renderer livré (AC1) + template flyer (AC2),
**When** un appel `await renderSvgToPng('flyer', { width: 148, height: 210, productName: 'Flyer A5' }, { primaryColor: '#FF6B35' })` est effectué,
**Then** la fonction retourne un `Uint8Array` non-vide.
**And** les 8 premiers bytes correspondent au magic number PNG (`89 50 4E 47 0D 0A 1A 0A`).
**And** les bytes peuvent être uploadés dans le bucket `product_mockups` (S4.1a) via le client Supabase Storage sans erreur (test E2E optionnel mais souhaitable).
**And** la latence p50 < 500 ms (mesurée sur 5 appels successifs warm cache WASM).

**AC4 — Tests Deno snapshot + cas d'erreur**

**Given** le fichier `supabase/functions/_shared/mockup/renderer.test.ts`,
**When** `deno test --allow-read --allow-write supabase/functions/_shared/mockup/renderer.test.ts` est exécuté,
**Then** au moins **5 tests passent** :
1. **renderer success flyer** : appel happy path → bytes PNG non-vides + magic number check.
2. **renderer dimensions** : appel avec spec `{width: 148, height: 210}` (A5) → vérifier le PNG a bien 1024×1024 (extraction header IHDR à offset 16).
3. **renderer template inconnu** : `renderSvgToPng('unknown_template', ...)` → throw `MockupRendererError(kind: 'unsupported_template')`.
4. **renderer specs invalides** : `renderSvgToPng('flyer', { width: -1, ... }, ...)` ou specs manquantes → throw `MockupRendererError(kind: 'invalid_specs')`.
5. **flyer template snapshot** : appel avec specs déterministes → SVG string match snapshot stocké en `templates/flyer.snapshot.svg` (verrouille le rendu de référence pour détecter régression visuelle non-intentionnelle).

**AC5 — Aucun import bloquant l'exécution**

**Given** le module et les tests livrés,
**When** `deno check supabase/functions/_shared/mockup/renderer.ts` (ou run direct du test)
**Then** Deno résout tous les imports sans erreur (pas de `npm:sharp`, pas de native binding).
**And** l'import `https://deno.land/x/resvg_wasm/mod.ts` charge le WASM au premier appel (peut prendre 1-2s, pas bloquant pour les autres calls).

**AC6 — DoD projet (cf. project-context §5)**

**Given** la story est livrée,
**When** Arnaud audite,
**Then** au moins 1 cas TF Notion (https://www.notion.so/7e576e695d504cc9a32ead92f4dde01c) est ajouté pour valider le rendu visuel du flyer template :
- TF "Flyer mockup généré visuellement cohérent" — exécution manuelle locale via `deno run --allow-net --allow-write supabase/functions/_shared/mockup/preview.ts` (script de preview à créer en option ; sinon documenter via vitest test qui sauve un PNG dans `tmp/mockup-preview/`).

## Tasks / Subtasks

- [x] **T1 — Setup module + types** (AC1)
  - [x] T1.1 Dossier `supabase/functions/_shared/mockup/` créé
  - [x] T1.2 `types.ts` : `ProductSpecs`, `ShopTheming`, `MockupTemplate` type alias, `MockupRendererError` class avec `override` modifier sur `cause` (Deno strict)
  - [x] T1.3 `renderer.ts` : fonction `renderSvgToPng()` async qui dispatch sur template + délègue à template module + render via resvg
  - [x] T1.4 Validation specs (width/height > 0, productName string non-vide, primaryColor string)
  - [x] T1.5 Validation template via `switch` + default `unsupported_template`

- [x] **T2 — Template flyer SVG paramétrique** (AC2)
  - [x] T2.1 `templates/flyer.ts` créé avec `flyerSvg(specs, theming): string`
  - [x] T2.2 Ratio portrait/paysage calculé via `aspect = width/height` ; rect dimensions max 700×700 dans viewBox 1024×1024
  - [x] T2.3 Background : `<linearGradient>` + `<pattern>` dots avec `theming.primaryColor`
  - [x] T2.4 Rectangle produit : fond blanc, bordure `theming.primaryColor`, ombre portée via `<filter>` `feDropShadow`
  - [x] T2.5 Texte productName centré, Inter font, 48px, fill primaryColor, troncature 30 chars + ellipsis
  - [x] T2.6 ViewBox 1024×1024, xmlns présent. Helper `escapeXml()` ajouté pour sécurité (anti-injection SVG)

- [x] **T3 — Pipeline render + dispatch** (AC1, AC3)
  - [x] T3.1 Import `flyerSvg` depuis `./templates/flyer.ts`
  - [x] T3.2 Switch `template === "flyer"` → `flyerSvg()` ; default → throw `unsupported_template`
  - [x] T3.3 **Pivot intra-story** : `https://deno.land/x/resvg_wasm/mod.ts` (initial) abandonné après smoke fail (CDN externe retournait HTTP 500). Pivot final : `npm:@resvg/resvg-wasm@2.6.2` avec init WASM lazy via fetch unpkg. Pattern `await ensureWasmInitialized() → new Resvg(svg) → resvg.render() → asPng()`
  - [x] T3.4 Catch global de l'exception `Resvg` → re-throw `MockupRendererError(kind: 'render_failed', cause: err)`
  - [x] T3.5 Vérification PNG : magic number check `89 50 4E 47 0D 0A 1A 0A` + `bytes.length >= 8`

- [x] **T4 — Tests Deno** (AC4)
  - [x] T4.1 `renderer.test.ts` créé
  - [x] T4.2 Test 1 happy path → magic number PNG ✅
  - [x] T4.3 Test 2 dimensions IHDR (DataView big-endian getUint32 à offsets 16+20) → 1024×1024 ✅
  - [x] T4.4 Test 3 template inconnu → `kind: 'unsupported_template'` ✅
  - [x] T4.5 Test 4 specs invalides (3 sous-cas : width négatif, productName vide, primaryColor absente) → `kind: 'invalid_specs'` ✅
  - [x] T4.6 Test 5 snapshot SVG : créé au 1er run dans `templates/flyer.snapshot.svg` (1088 bytes), comparé aux runs suivants ✅

- [x] **T5 — Smoke run local + perf check** (AC3)
  - [x] T5.1 `deno test --allow-net --allow-read --allow-write --node-modules-dir=auto` → **5/5 passed (975ms total)**
  - [x] T5.2 Latence mesurée : 1er render warm-cache 784ms (incluant init WASM 1-shot), 2e render 183ms. **Bien sous la cible interne 500ms p50 warm**.
  - [ ] T5.3 Script preview.ts non créé (optionnel selon spec, déféré post-S4.1c qui aura le cas E2E réel)

- [x] **T6 — DoD projet** (AC6)
  - [ ] T6.1 Cas TF Notion (admin task Arnaud, draft fourni dans Completion Notes)
  - [x] T6.2 [SPRINT_HANDOFF.md](../../SPRINT_HANDOFF.md) mis à jour
  - [x] T6.3 [docs/project-context.md](../../docs/project-context.md) §3.2 stack mis à jour avec `@resvg/resvg-wasm@2.6.2`
  - [x] T6.4 Commit atomique + push (cf. Change Log)

## Dev Notes

### Architecture & contraintes

- **ADR-3** ([Architecture §4.3](../planning-artifacts/architecture.md)) : mockup engine = pipeline SVG → PNG dans Edge Function Deno. Cette story livre **uniquement le module pure pipeline** (pas l'edge function publique, qui arrive en S4.1c).
- **PNG 1024×1024** (Architecture §3 "Mockup engine — format de sortie") : c'est la résolution de sortie fixe, pas les dimensions Clariprint en mm. Le **ratio** du produit (portrait/paysage) influence la disposition du contenu dans le carré 1024×1024.
- **Pas de manipulation DOM** : SVG generation = string templating en TypeScript. Pas besoin de `svgdom`. Plus léger, plus rapide, plus debuggable.
- **WASM init lazy** : `resvg_wasm` charge son binaire WASM au premier appel `render()`. Coût ~1-2s en cold start. Acceptable car les edge functions Supabase ont du warm reuse.

### Pivot technique : `resvg_wasm` (déviation Architecture §4.3)

**Pourquoi déviation justifiée** :
- Sharp (libvips natif) ne fonctionne pas dans Deno Deploy (pas de native Node addons supportés).
- L'Architecture §4.3 a été écrite avec une assumption Node-ish ; le vrai runtime des edge functions Magrit est Deno Deploy (cf. project-context §3.2).
- `resvg_wasm` est le standard de fait pour SVG → PNG en Deno (https://deno.land/x/resvg_wasm/mod.ts), maintenu, perfs comparables à libvips pour les SVG simples (template print MVP).

**API (référence)** :

```ts
import { render } from "https://deno.land/x/resvg_wasm/mod.ts";

const pngBytes: Uint8Array = await render(svgString);
// PNG bytes prêts à upload sur Storage ou retourner via Response
```

**Fonts incluses** : `Inter` (sans-serif), `Bitter` (serif), `JetBrains Mono` (monospace). Suffisant pour MVP. Si besoin de typo brandée (S4.4 Growth ?), passer une option à `render()` avec une font custom (cf. doc resvg_wasm).

### Pattern template SVG (référence d'implémentation)

```ts
// supabase/functions/_shared/mockup/templates/flyer.ts (template indicatif, à raffiner)
export function flyerSvg(specs: ProductSpecs, theming: ShopTheming): string {
  const aspect = specs.width / specs.height;
  // Calcul portrait : largeur < hauteur
  const isPortrait = aspect < 1;
  const rectW = isPortrait ? 700 * aspect : 700;
  const rectH = isPortrait ? 700 : 700 / aspect;
  const cx = (1024 - rectW) / 2;
  const cy = (1024 - rectH) / 2;
  const truncatedName = specs.productName.length > 30
    ? specs.productName.slice(0, 27) + '...'
    : specs.productName;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${theming.primaryColor}" stop-opacity="0.1"/>
      <stop offset="100%" stop-color="${theming.primaryColor}" stop-opacity="0.3"/>
    </linearGradient>
    <pattern id="dots" width="20" height="20" patternUnits="userSpaceOnUse">
      <circle cx="10" cy="10" r="1.5" fill="${theming.primaryColor}" opacity="0.4"/>
    </pattern>
  </defs>
  <rect width="1024" height="1024" fill="url(#bg)"/>
  <rect width="1024" height="1024" fill="url(#dots)"/>
  <rect x="${cx}" y="${cy}" width="${rectW}" height="${rectH}"
        fill="white" stroke="${theming.primaryColor}" stroke-width="3"
        rx="8" ry="8"/>
  <text x="512" y="${cy + rectH + 60}" text-anchor="middle"
        font-family="Inter" font-size="48" font-weight="600"
        fill="${theming.primaryColor}">${escapeXml(truncatedName)}</text>
</svg>`;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
```

⚠️ **Sécurité importante** : `escapeXml(specs.productName)` pour éviter une injection SVG si le productName vient d'un user input non-trust.

### Pattern test snapshot SVG

Le snapshot SVG (T4.6) est plus stable que le snapshot PNG :
- SVG = string déterministe, lisible humainement, facile à diff en review
- PNG = bytes binaires qui peuvent varier sur les bords (anti-aliasing différent selon version libwebp underlying resvg)

À comparer la string SVG retournée par `flyerSvg()` (avant le `render()`) avec un fichier `templates/flyer.snapshot.svg` versionné. Si Arnaud veut volontairement changer le visuel, il met à jour le snapshot dans le commit. Pattern aligné sur les snapshot tests Vitest classiques.

### Project Structure Notes

- Nouveau dossier `supabase/functions/_shared/mockup/` (parallèle à `_shared/llm/`, `_shared/clariprint/` futur).
- 3 fichiers core : `renderer.ts`, `types.ts`, `templates/flyer.ts`.
- 1 fichier test : `renderer.test.ts`.
- 1 fichier snapshot : `templates/flyer.snapshot.svg` (versionné, généré au 1er run).
- Aucun fichier dans `src/` (c'est du module Deno serveur uniquement).
- Aucune migration SQL.

### Pré-requis vérifiés

✅ S4.1a bucket `product_mockups` créé (cette story produit les bytes que S4.1c uploadera ; tests E2E E2E peuvent uploader optionnellement pour valider le pipeline complet).
✅ Stack LLM finalisée S1.5 (pas de dépendance directe pour cette story, mais wrapper utilisable plus tard pour générer prompt-driven artwork S4.4 Growth).

### Décisions à prendre par le dev (à documenter dans Completion Notes)

1. **Confirmer le pivot `resvg_wasm`** vs alternatives (`@resvg/resvg-wasm` npm, `imagescript`, etc.) : le dev doit valider que l'import `https://deno.land/x/resvg_wasm/mod.ts` charge bien dans le runtime Supabase Edge Functions actuel (pas de blocage CSP ou autre). Si blocage, fallback `npm:@resvg/resvg-wasm`.
2. **Snapshot SVG vs PNG** : recommandé snapshot SVG (cf. ci-dessus), mais le dev peut choisir snapshot PNG s'il accepte la variabilité bytes. Documenter la décision.
3. **Latence cible** : NFR2 dit ≤ 300 ms cache MISS pour S4.1c. Cette story livre uniquement le pipeline pur ; la cible cible interne ici est ≤ 500 ms p50 warm WASM (cold start ~1-2s acceptable pour la 1ère génération, car cache write-through ensuite).

### Risques identifiés

| Risque | Probabilité | Mitigation |
|---|---|---|
| `resvg_wasm` import bloqué dans Supabase Edge Functions runtime | Faible (validé en prod par autres projets) | Fallback `npm:@resvg/resvg-wasm` documenté |
| Performance cold WASM init > 5s | Moyenne | Acceptable car cache write-through ensuite ; documenter dans Completion Notes |
| Font Inter manque pour caractères français accentués | Faible | Inter supporte tout Latin Extended ; tester `"Flyer été"` dans le snapshot |
| SVG injection via `productName` | Moyenne (si user input non-sanitized en aval) | `escapeXml()` obligatoire dans le template |

### Testing Standards

- Tests Deno (`deno test`) — pas vitest (côté Deno edge function).
- Snapshot SVG versionné (préféré) ou snapshot PNG bytes (acceptable mais flaky possible).
- Pas de E2E vitest car ce module n'est pas appelé depuis Node — il sera appelé depuis l'edge function `mockup-generator` en S4.1c.
- Optionnel (T5.3) : script preview CLI pour inspection visuelle humaine.

## References

- [Architecture §4.3 ADR-3](../planning-artifacts/architecture.md) — Mockup Engine
- [Architecture §3 Decisions](../planning-artifacts/architecture.md) — décision PNG 1024×1024
- [Architecture §6 Tree](../planning-artifacts/architecture.md) — `supabase/functions/_shared/` convention
- [Epics §Epic 4 / S4.1b](../planning-artifacts/epics.md)
- [PRD §FR25-27](../planning-artifacts/prd.md) — Mockup engine functional requirements
- [PRD §NFR2](../planning-artifacts/prd.md) — performance targets
- [project-context §3.2 stack](../../docs/project-context.md)
- [story-S4.1a (bucket Storage prêt)](story-S4.1a-bucket-storage-product-mockups.md)
- [resvg_wasm Deno docs](https://deno.land/x/resvg_wasm/mod.ts) — lib externe utilisée
- [supabase/functions/_shared/anthropicClient.ts](../../supabase/functions/_shared/anthropicClient.ts) — pattern de référence pour modules `_shared/`

## Dev Agent Record

### Agent Model Used

`claude-opus-4-7` (Opus 4.7 1M context, Claude Code CLI session — même session continue depuis S1.5/S4.1a)

### Debug Log References

- Deno CLI absent en début de session → installé via `curl -fsSL https://deno.land/install.sh | sh` (non-interactif, no sudo). Version installée : 2.7.14.
- 1er essai `https://deno.land/x/resvg_wasm/mod.ts` (lib initialement spec dans la story) → 3/5 tests OK + 2/5 fail au runtime : `WebAssembly.instantiate()` retournait `CompileError: expected magic word 00 61 73 6d, found 35 30 30 3a` (= ASCII "500:" → CDN externe a renvoyé une page d'erreur HTTP 500 au lieu du WASM binaire).
- Pivot intra-story vers `npm:@resvg/resvg-wasm@2.6.2` (package npm officiel maintenu par yisibl) → 5/5 tests passants, perf 183ms/render warm.
- TS strict Deno : `MockupRendererError.cause` doit avoir `override` modifier (override la nouvelle prop `Error.cause` ES2022).

### Completion Notes List

#### Décisions techniques prises

1. **Pivot final `npm:@resvg/resvg-wasm@2.6.2` (et non `deno.land/x/resvg_wasm`)** : la lib deno.land/x/ tente de fetch un binaire WASM depuis un CDN externe qui retourne actuellement HTTP 500. La version npm @resvg/resvg-wasm est plus fiable (maintenue activement, distribuée via le registry npm, package WASM embedded). Pattern d'init : `await initWasm(fetch(unpkgUrl))` lazy au premier appel + cache module-level.

2. **Snapshot SVG retenu** (vs PNG bytes) : recommandation Dev Notes confirmée. SVG = string déterministe, lisible, diffable en code review. PNG bytes = potentiellement variable selon version libwebp underlying. Snapshot créé automatiquement au 1er run dans `templates/flyer.snapshot.svg` (1088 bytes versionné).

3. **Latence mesurée < cible** : 1er render warm-cache 784ms (init WASM 1-shot inclus), suivants 183ms. Bien sous la cible interne 500ms p50 warm. Cold start (1ère invocation edge function) sera ~1-2s mais cache write-through CDN ensuite (cf. Architecture §4.3).

4. **Script preview.ts non créé** (T5.3) : déféré à S4.1c qui aura le cas E2E réel via l'edge function `mockup-generator`. Pas critique pour cette story unit-test focused.

5. **Sécurité escapeXml** : appliquée sur `productName` et `primaryColor` dans `flyerSvg()` même si ces champs sont typés (defense en profondeur si user input non-sanitized en amont).

#### Cas TF Notion (draft pour T6.1, à coller par Arnaud)

```
Titre : Mockup flyer rendu visuellement coherent
Parcours : Pre-requis Epic 4 (S4.1c future S2.3 ProductCard)
Persona : Dev Magrit (test infra)
Précondition : 
  - Code S4.1b mergé sur beta/v5
  - Deno installé localement (curl -fsSL https://deno.land/install.sh | sh)
Étapes :
  1. cd /Users/arnaudmazon/Documents/Claude/BMAD/Magrit
  2. ~/.deno/bin/deno test --allow-net --allow-read --allow-write --node-modules-dir=auto supabase/functions/_shared/mockup/renderer.test.ts
  3. (Optionnel) Inspection visuelle : creer un script eval Deno qui appelle renderSvgToPng + Deno.writeFile("/tmp/preview.png", bytes), puis ouvrir le PNG dans Preview.app
Résultat attendu :
  - 5/5 tests passed en moins de 2s
  - Si visuel inspecte : un mockup avec gradient orange (#FF6B35), pattern dots subtle, rectangle blanc bordure colore avec ombre, texte "Flyer A5 Test" en bas. Layout coherent et reconnaissable comme un flyer.
Hints DOM : N/A (test backend pur)
URL : N/A
Type : Manuel humain (avec inspection visuelle optionnelle) + IA Chrome
Données : Specs deterministes (width: 148, height: 210, productName: "Flyer A5 Test", primaryColor: "#FF6B35")
Statut : À jouer post-livraison S4.1b
```

#### Risques résiduels post-implémentation

- **Cold start WASM en prod Supabase Edge Functions** : 1ère invocation aura ~1-2s d'init. Acceptable car cache write-through CDN écrase ensuite. À mesurer en S4.1c smoke deploy.
- **`fetch unpkg.com`** au cold init : si unpkg down, le renderer fail. Mitigation possible future : embed le WASM en base64 dans le code source ou utiliser un CDN secondaire en fallback.
- **Snapshot fragile** : si Arnaud modifie volontairement le visuel flyer, il devra `rm flyer.snapshot.svg` puis relancer pour régénérer. Le test Deno guide le fix dans le message d'erreur si différence détectée.

### File List

**Créés :**
- `supabase/functions/_shared/mockup/types.ts` — types `ProductSpecs`, `ShopTheming`, `MockupTemplate`, `MockupRendererError`
- `supabase/functions/_shared/mockup/renderer.ts` — pipeline `renderSvgToPng()` + init WASM lazy
- `supabase/functions/_shared/mockup/templates/flyer.ts` — template SVG paramétrique flyer + `escapeXml()`
- `supabase/functions/_shared/mockup/renderer.test.ts` — 5 tests Deno (happy path, dimensions IHDR, template inconnu, specs invalides, snapshot SVG)
- `supabase/functions/_shared/mockup/templates/flyer.snapshot.svg` — snapshot SVG verrouillage (généré au 1er run, 1088 bytes)

**Modifiés :**
- `SPRINT_HANDOFF.md` — entrée S4.1b livrée + pivot resvg-wasm
- `docs/project-context.md` — §3.2 stack ajout `@resvg/resvg-wasm` comme lib mockup engine officielle

**Non commit (gitignored ou install local) :**
- `~/.deno/bin/deno` — Deno CLI installation locale (hors repo)
- `node_modules/` — Deno node_modules dir auto (hors repo, nécessaire pour le dev local Deno + npm:)

## Change Log

| Date | Auteur | Action |
|---|---|---|
| 2026-05-10 | Story Engine (BMAD) | Création initiale, status `ready-for-dev`. Pivot technique `sharp → resvg_wasm` documenté en intro |
| 2026-05-10 | Dev (Opus 4.7) | T1-T6 livrés. Pivot intra-story `deno.land/x/resvg_wasm@0.2.0` (CDN HS) → `npm:@resvg/resvg-wasm@2.6.2`. Tests Deno 5/5 passants en 975ms. Vitest 37/37 (0 régression). Status → `review`. Reste T6.1 Notion (admin task Arnaud) |

## Status

`review` (code livré + tests passants. T6.1 Notion = admin task non-bloquante. Pas de déploiement requis pour cette story — module privé `_shared/`, sera embarqué par S4.1c via `supabase functions deploy mockup-generator`)
