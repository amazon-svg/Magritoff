---
story_id: S-FIX-LARGE-CM-FORMATS
epic: 0 — Foundations / Dette technique
title: Heuristique cm/mm pour grands formats > 3m (suite convention P0.9)
status: spec-ready (post Phase 0.10 cadrage qualité, 2026-05-22)
created_at: 2026-05-22
target_branch: beta/v5
agent: TBD (Dev hat, Sprint 8)
size: S (0.5j)
prd_ref: _bmad-output/planning-artifacts/architecture.md
predecessors: [P0.9 convention toMm string=cm/number=mm livré 2026-05-18]
successors: []
sprint_cible: Sprint 8 (roadmap qualité-first, dette technique)
context_origin: SPRINT_HANDOFF.md §12 "Hors scope Sprint 4 — Stories futures tracées"
---

# Story S-FIX-LARGE-CM-FORMATS — Grands formats cm/mm > 3m

## Contexte

Le 2026-05-18 (Sprint 4 Phase 0), la story P0.9 a établi la **convention canonique** `toMm` dans le pipeline PIM :
> *"string = cm, number = mm"*

Cette convention est déterministe et safe pour le parc actuel (audit SQL prod confirmé 0 produit historique en string ≥ 50). Mais elle laisse un trou résiduel sur les **grands formats** :

### Cas problématique

Un kakémono 4m × 1m vendu en boutique :
- LLM Clariprint renvoie probablement `width: "400"`, `height: "100"` (string, cm) selon convention
- `toMm("400")` → renvoie `400` (interprété comme cm) → `4000mm` ✅ correct
- `toMm("100")` → renvoie `1000` (interprété comme cm) → `1000mm` ✅ correct

**Donc le cas string est OK.** Le problème est ailleurs.

### Vrai cas à risque : le helper front `isLikelyCm`

[ProductOverlay.helpers.ts:140](../../src/app/components/shop/ProductOverlay.helpers.ts) contient un helper différent :

```typescript
function isLikelyCm(width: number, height: number): boolean {
  return width > 0 && height > 0 && width < 100 && height < 100;
}
```

Ce helper, hérité du hotfix 17/05 (bug volet édition ProductCard atelier), utilise un **seuil numérique <100** différent de la convention P0.9 (string=cm) et différent du seuil pim-ingest <50 initial. Pour un kakémono LLM 400 × 100 (en cm), le helper renvoie `false` → **garde les valeurs en cm dans l'UI ateliers**, qui les affiche `400 × 100 mm` (faux par un facteur ×10).

**Donc la dette est dans `isLikelyCm` front, pas dans `toMm` back.**

## Story (user story)

**As an** imprimeur Pro utilisateur de l'atelier Magrit,
**I want** que les grands formats (kakémonos > 100cm, banderoles > 200cm, panneaux signalétique > 300cm) soient correctement reconnus et convertis cm → mm dans le volet d'édition ProductCard atelier,
**So that** les dimensions affichées et envoyées au calcul de devis Clariprint correspondent à la réalité du produit, et que je n'ai pas à corriger manuellement les valeurs après chaque ouverture du volet.

## Acceptance Criteria

### AC1 — Audit prod préalable (principe DoD #4)

**Given** un audit SQL sur les produits actuels en prod
**When** on examine les dimensions
**Then** un rapport produit :
- Nombre total de produits avec `clariprintData.width` / `height` renseignés
- Distribution des valeurs `width` par tranche : `<50`, `50-100`, `100-300`, `300-500`, `>500` (en supposant unité homogène)
- Identification des **produits ambigus** : ceux dont `width` est entre `100` et `999` (cas border-line cm vs mm)
- Liste de 10 produits réels grands formats (kakémono, banderole, panneau) avec leurs valeurs raw

**And** le rapport est sauvé dans `_bmad-output/implementation-artifacts/audit-large-cm-formats-2026-XX-XX.md`.

### AC2 — Refonte `isLikelyCm` : convention typage cohérente avec P0.9

**Given** l'helper `isLikelyCm(width: number, height: number)` actuel ligne 140
**When** la story est livrée
**Then** l'helper est refactoré pour **cohérence avec la convention canonique P0.9** :

```typescript
/**
 * Reconnaissance unité cm/mm depuis raw value LLM Clariprint.
 *
 * Convention canonique Magrit (P0.9, 2026-05-18) :
 *   - typeof raw === 'string' → unité cm (toujours)
 *   - typeof raw === 'number' → unité mm (toujours)
 *
 * Cet helper accepte AUSSI les number en entrée pour les cas legacy front
 * où la valeur a déjà été normalisée. Dans ce cas, on considère que
 * width < 30 = cas suspect (kakémono < 30 mm = impossible), à logger.
 *
 * @param rawWidth, rawHeight — peuvent être string (cm) ou number (mm)
 * @returns { width_mm, height_mm, source: 'string_cm' | 'number_mm' | 'suspect_low' }
 */
export function normalizeDimensions(
  rawWidth: string | number,
  rawHeight: string | number,
): { width_mm: number; height_mm: number; source: 'string_cm' | 'number_mm' | 'suspect_low' } {
  // Cas 1 : string → cm → ×10
  if (typeof rawWidth === 'string' && typeof rawHeight === 'string') {
    const wCm = parseFloat(rawWidth);
    const hCm = parseFloat(rawHeight);
    return { width_mm: wCm * 10, height_mm: hCm * 10, source: 'string_cm' };
  }

  // Cas 2 : number → mm direct
  if (typeof rawWidth === 'number' && typeof rawHeight === 'number') {
    // Sentinel : si number < 30 → suspect (< 3cm = produit invraisemblable)
    if (rawWidth < 30 || rawHeight < 30) {
      console.warn('[normalizeDimensions] valeurs suspectes < 30mm, à investiguer', { rawWidth, rawHeight });
      return { width_mm: rawWidth, height_mm: rawHeight, source: 'suspect_low' };
    }
    return { width_mm: rawWidth, height_mm: rawHeight, source: 'number_mm' };
  }

  // Cas 3 : mixte → invalide, fallback safe
  throw new Error(`normalizeDimensions: types incohérents (${typeof rawWidth} / ${typeof rawHeight})`);
}
```

**And** l'ancienne fonction `isLikelyCm` (seuil <100) est **supprimée** du codebase. Tous ses call sites migrent vers `normalizeDimensions`.

**And** le seuil <30 mm pour le warning "suspect_low" est documenté dans le code (commentaire pourquoi 30 et pas 10 ou 50 : 30mm = 3cm = plus petit format réaliste imprimé, en deçà = bug data ou cas hors scope qu'on log mais qu'on ne corrige pas automatiquement).

### AC3 — Migration call sites + tests vitest

**Given** `isLikelyCm` est appelé dans `ProductOverlay.helpers.ts:389`
**When** la story est livrée
**Then** :
- Le call site migre vers `normalizeDimensions`
- Tous les autres call sites éventuels (audit `grep -rn "isLikelyCm"`) sont migrés
- Tests vitest existants (12 cas hotfix 17/05 dans `ProductOverlay.helpers.test.ts` selon SPRINT_HANDOFF §11) sont mis à jour
- 8 nouveaux cas ajoutés couvrant grands formats :
  - kakémono 400 × 100 (string cm) → 4000 × 1000 mm ✅
  - banderole 800 × 60 (string cm) → 8000 × 600 mm ✅
  - panneau 1000 × 500 (string cm) → 10000 × 5000 mm ✅
  - kakémono 4000 × 1000 (number mm) → 4000 × 1000 mm ✅
  - format 85 × 55 mm carte de visite (number mm) → 85 × 55 mm ✅
  - flyer A4 210 × 297 (number mm) → 210 × 297 mm ✅
  - cas suspect 5 × 5 (number mm) → suspect_low warning ⚠️
  - mixte (string + number) → throw ❌

### AC4 — Audit `pim-ingest` côté backend (suite P0.9 cohérence)

**Given** P0.9 a déjà appliqué la convention dans `pim-ingest` (toMm helper, ligne 189)
**When** la story est livrée
**Then** :
- Vérification que `pim-ingest/index.ts:189` est cohérent avec `normalizeDimensions` front (mêmes seuils et conventions)
- Si divergence détectée, harmonisation (par exemple, ajouter le warning `suspect_low` aussi côté back si pas présent)
- Test cross-side (vitest front + Deno back) sur un dataset commun de 10 cas confirmant que `normalizeDimensions` front et `toMm` back produisent les mêmes résultats

### AC5 — TF Notion (3+ cas)

- "Volet édition ProductCard atelier — kakémono 400×100cm s'affiche correctement 4000×1000mm" (Parcours P08, Persona Imprimeur Pro atelier)
- "Volet édition ProductCard atelier — A4 210×297mm reste 210×297mm" (Parcours P08, non-régression carte visite/flyer)
- "Volet édition ProductCard atelier — banderole 800×60cm s'affiche 8000×600mm" (Parcours P08)

## Out of scope

- ❌ UI atelier pour saisir manuellement l'unité (cm/mm radio) → ergonomie V2+ si pertinent
- ❌ Validation côté Clariprint que les dimensions sont dans la plage acceptable du moteur → couvert par `validateClariprintResponse` (S0.2)
- ❌ Refactor complet du flow LLM Clariprint pour qu'il renvoie toujours en mm → trop invasif, hors scope dette
- ❌ Migration data prod des produits avec dimensions ambiguës → cas particulier, à arbitrer dans audit AC1 si majoritaire

## Tasks

- [ ] Task 1 — Audit prod SQL préalable + rapport `audit-large-cm-formats-*.md`
- [ ] Task 2 — Refacto `normalizeDimensions` dans `ProductOverlay.helpers.ts` (remplace `isLikelyCm`)
- [ ] Task 3 — Migrer call site `ProductOverlay.helpers.ts:389` + audit autres call sites
- [ ] Task 4 — Tests vitest : 8 nouveaux cas grands formats + cas régression existants
- [ ] Task 5 — Vérification cohérence cross-side avec `pim-ingest/index.ts:189` (toMm back)
- [ ] Task 6 — Tests cross-side dataset commun 10 cas
- [ ] Task 7 — 3 TF Notion AC5
- [ ] Task 8 — Update doc `docs/project-context.md` §3.6 si pertinent (convention dimensions documentée publiquement)

## DoD spécifique

- [ ] Audit prod préalable (principe #4)
- [ ] Story doc écrit AVANT démarrage (principe #9)
- [ ] Story atomique 0.5j (principe #7 ✅)
- [ ] TF Notion 3+ en parallèle (principe #8)
- [ ] Pas de Sally UX requis (refacto helper, UI inchangée)
- [ ] Pas d'a11y nouveau (pas de nouvelle route)
- [ ] Smoke E2E acheteur AI confirme aucune régression sur ouverture volet édition kakémono (principe #3)

## Cohérence cross-roadmap

Bundle Sprint 8 pertinent avec [S-FIX-LIBRARY-UUID](story-S-FIX-LIBRARY-UUID-normalisation.md) (les 2 stories sont 0.5j, agnostiques l'une de l'autre, peuvent être livrées dans le même mini-batch dette technique).

## References

- [Source: ProductOverlay.helpers.ts:140] — `isLikelyCm` actuel à refactorer
- [Source: ProductOverlay.helpers.ts:389] — call site
- [Source: pim-ingest/index.ts:189] — `toMm` back canonical P0.9
- [Source: story-P0.9-pim-cm-mm-convention.md] — décision convention
- [Source: SPRINT_HANDOFF.md §11 + §12] — historique hotfix 17/05 + story tracée
- [Source: project-context.md §3.6] — anomalies Clariprint
- [Source: roadmap-v1.1-qualite-first-2026-05-21.md] — Sprint 8
