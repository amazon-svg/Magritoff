---
id: R9
epic: EPIC-REFACTO-1
sprint: Refacto Sprint 3 (post-démo)
priority: P0 (engagement V1.2)
effort: XS (0,5 j-Claude)
assignee: Claude code
depends_on: [R1]
unblocks: []
inputs:
  - _bmad-output/refacto-artifacts/refacto-plan-2026-05.md (ADR-R7 décidé Arnaud)
status: pending
---

# R9 — a11y light : axe-core CI sur 3 pages critiques

## Origine

Story refacto livrée suite à l'arbitrage **ADR-R7 décidé Arnaud 2026-05-11** : a11y light V1.2 + i18n V2.

## Contexte

Audit §3.6 mentionne 25-27 % de densité conditionnelle dans les composants UI. Sprint 4 livre 2 corrections a11y ponctuelles (`E_A11Y.shop-pills-and-drawer` : `aria-pressed` pill-all + `aria-modal` drawer). Aucun garde-fou CI ne bloque la dérive a11y future.

Engagement V1.2 (post-refacto) : ajouter `axe-core` à la CI pour bloquer toute régression a11y de niveau **Critical** sur 3 pages critiques.

## User story

En tant que **Acheteur shop_only** utilisateur de lecteur d'écran (NVDA, JAWS, VoiceOver) **OU** mainteneur Claude code futur, je veux qu'une CI axe-core scan automatiquement 3 pages critiques (atelier, boutique, login) à chaque PR, afin que toute régression a11y de niveau Critical soit bloquée avant merge.

## Critères d'acceptation

1. **Given** R9 livré, **When** je liste `.github/workflows/`, **Then** un fichier `a11y.yml` existe avec un job `axe-core-scan` qui tourne sur PR `beta/v5`.
2. **Given** la CI active, **When** un PR introduit une violation Critical (ex : bouton sans label aria), **Then** le PR est **bloqué** automatiquement avec un rapport listant les violations.
3. **Given** les 3 pages critiques scannées, **When** je liste la config axe, **Then** elle inclut : `/login`, `/t/imprimerie-ipa/atelier`, `/shop/xyfjjo-q6kekm`.
4. **Given** le scan initial sur HEAD `beta/v5`, **When** je run axe manuellement, **Then** **0 violation Critical** (les Critical issues révélées sont fixées dans la PR R9 ou notées en story dédiée si trop importantes).
5. **Given** le scan tolère les niveaux **Moderate / Minor** sans bloquer, **When** je consulte le rapport, **Then** les niveaux non-Critical sont listés pour visibilité mais ne font pas échouer la CI (engagement WCAG AA reporté V2).
6. **0 régression mesurable** : vitest run vert. Build Vite OK. Pas de slowdown notable de la CI (< +5 min).

## Spécifications API / data

- **Installation** :
  - `pnpm add -D @axe-core/cli playwright`
- **GitHub Action** : `.github/workflows/a11y.yml`
  - Jobs : `setup` (node + pnpm install) → `build` (pnpm build + serve dist) → `axe-scan` (scan 3 routes via @axe-core/cli + playwright).
- **Configuration axe** : `.axe-config.json` avec :
  - `rules` : standard WCAG 2.1 AA
  - `runOnly` (tags) : `wcag2a`, `wcag2aa` (scope V1.2)
  - `resultsTypes` : `violations` filtrées sur `impact === 'critical'` pour le seuil bloquant.
- **Rapport** : output JSON committé en artifact GitHub Actions, accessible pour audit.
- **Pas de changement de code production** (sauf si le scan initial révèle des violations Critical à fixer dans la même PR R9 — à scoper en début de story).

## Dépendances

- **Prérequis** : R1 mergé (la décomposition ProductCard influence le scan atelier — souhaitable d'avoir la nouvelle structure avant la baseline a11y).
- **Pas de dépendance externe.**

## Estimation

**XS (0,5 j-Claude)**. 0,25 j install + config axe + action GitHub ; 0,25 j scan initial + fix éventuels Critical révélés (à scoper en début si > 1-2 violations).

## Plan de test

- **GitHub Action a11y.yml** : doit tourner OK sur PR R9 elle-même.
- **vitest** : aucun cas requis (test de CI).
- **TF nouveau à créer** : *"a11y light axe-core CI — 0 violation Critical sur atelier / boutique / login"*, parcours P00 + P05 + P09, persona Acheteur shop_only + Owner tenant, P1, type CI report.
- **Smoke humain** : Arnaud examine le rapport axe sur le scan initial pour confirmer absence de violation Critical.

## Définition de « terminé »

- Code merged sur `beta/v5`.
- Action GitHub `.github/workflows/a11y.yml` active.
- Scan initial HEAD `beta/v5` : 0 violation Critical sur les 3 routes.
- vitest run vert.
- TF nouveau créé et joué OK.
- Update `architecture.md` §X.X avec ADR-R7 tranchée + engagement WCAG AA reporté V2.
- `SPRINT_HANDOFF.md` mis à jour avec l'engagement a11y V1.2.
