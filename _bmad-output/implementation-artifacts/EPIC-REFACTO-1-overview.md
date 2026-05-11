---
id: EPIC-REFACTO-1
title: Stabilisation refacto post-démo Magrit (3 sprints)
sprint_window: post-démo 2026-05-23 → V1 septembre 2026
target_branch: beta/v5
total_effort: ≈ 21-22 j-Claude (3 sprints refacto)
inputs:
  - _bmad-output/refacto-artifacts/audit-2026-05-11.md
  - _bmad-output/refacto-artifacts/review-adversarial-2026-05-11.md
  - _bmad-output/refacto-artifacts/refacto-plan-2026-05.md
status: pending (post-démo)
---

# EPIC-REFACTO-1 — Stabilisation refacto post-démo Magrit

## Objectif

Capitaliser sur la dette identifiée en pré-BMAD (vibe-coding) pour livrer un socle stable, testable, sécurisé, sans dette structurelle bloquante pour la roadmap V1 (septembre 2026) et V1.x.

## Décisions structurantes actées

- **ADR-R1** : tenant_orders **V1.1 deferred** (R6 OUT). `shop_orders` legacy reste primaire. UI Order entity reportée à un sprint V1.1 dédié post-refacto.
- **ADR-R2** : `database.types.ts` généré + zod sélectif (Cart, Order, Clariprint, PIM).
- **ADR-R3** : reads = `from()` direct typé, writes + edges = `functions.invoke()` exclusivement.
- **ADR-R4** : décomposition gros composants — onglet-by-onglet pour ProductCard, extraction hooks pour ChatInterface.
- **ADR-R5** : tests Supabase — factory `createSupabaseMock()` (pas MSW).
- **ADR-R6** : TVA configurable via `tenant.tax_regime` enum + `src/app/utils/tax.ts`.
- **ADR-R7** : a11y light V1.2 (axe-core CI) + i18n V2.
- **ADR-R8** : bundle baseline — Lighthouse CI + bundle-visualizer + lazy modales.

## Backlog stories (9 stories, R6 OUT V1.1 deferred)

### Sprint refacto 1 (≈ 7 j) — Fondations + garde-fous

| Story | Effort | Description | Doc |
|---|:---:|---|---|
| **R0** | M (2 j) | Spikes garde-fous + TVA configurable + modal dupliquée | [story-R0](story-R0-refacto-spikes-garde-fous.md) |
| **R3** | S (1 j) | ClariprintAdapter enforcement (2 callers migrés) | [story-R3](story-R3-refacto-clariprint-adapter-enforcement.md) |
| **R1** | L (4 j) | ProductCard décomposition 5 onglets + PIM Fiche (G satellite) | [story-R1](story-R1-refacto-productcard-decomposition.md) |

### Sprint refacto 2 (≈ 9 j) — Décomposition Chat + types + Supabase

| Story | Effort | Description | Doc |
|---|:---:|---|---|
| **R2** | L (4 j) | ChatInterface décomposition + bugs B6/E4/E5 (dual source, billing banner, troncage 25 msg) | [story-R2](story-R2-refacto-chatinterface-decomposition.md) |
| **R4** | M (2 j) | Types DB partagés (`database.types.ts` + zod sélectif Cart/Order/Clariprint/PIM) | [story-R4](story-R4-refacto-types-db-partages.md) |
| **R5** | M (3 j) | Pattern Supabase unique (`functions.invoke()` exclusif edges) + fix race invitations B4 | [story-R5](story-R5-refacto-pattern-supabase-unique.md) |

### Sprint refacto 3 (≈ 4-5 j) — Performance + testabilité + a11y light

| Story | Effort | Description | Doc |
|---|:---:|---|---|
| **R7** | S (1 j) | Bundle baseline (Lighthouse CI + bundle-visualizer + lazy modales) | [story-R7](story-R7-refacto-bundle-baseline-lazy-modales.md) |
| **R8** | M (2-3 j) | Testabilité Supabase (factory `createSupabaseMock()` + coverage zones froides) | [story-R8](story-R8-refacto-testabilite-supabase.md) |
| **R9** | XS (0,5 j) | a11y light axe-core CI (3 pages critiques) | [story-R9](story-R9-refacto-a11y-light-axe-ci.md) |

## Graphe de dépendances (rappel)

```
R0 (bloque tout)
 ├─→ R1 ─→ R4 ─→ R5 ─→ R8
 │        ↓
 │        R7
 ├─→ R2 ─→ R7
 └─→ R3
        │
        └─→ R9 (dépend R1)
```

## Garde-fous non négociables

1. **Tests R0 sont des "test seeds"** : écrits avant R1/R2 et ne doivent JAMAIS régresser.
2. **1 story = 1 PR atomique** (convention Magrit).
3. **Vitest doit être vert avant merge** — bloquant.
4. **0 invention hors backlog** (règle dure `feedback_no_invent_hors_backlog.md`).
5. **PIM marketing reste dans onglet Fiche existant** (règle dure `feedback_pim_marketing_card.md`).
6. **Persona primaire = imprimeur Pro atelier** (mémoire `feedback_persona_primaire_imprimeur.md`).
7. **ClariprintAdapter pattern non négociable** (R3 enforced + tous les nouveaux callers).
8. **Hiérarchie prix conservée** : `clariprint > library_cached > prix_marche > zero`.
9. **Persona IA = Magrit** (pas Marguerite — migration testid opportuniste pendant R1/R2).

## Risques + atténuations (rappel synthétique)

- **Régression silencieuse** lors décomposition → R0 obligatoire avant R1/R2.
- **Scope creep PIM** (récidive 2026-05-10) → R1 story spec liste les 5 onglets en out-of-scope.
- **Migration types casse RLS** → R4 en deux temps avec `// TODO R4-cleanup`.
- **ADR-R1 retardée bloque équipe** → Tranchée Arnaud (V1.1 deferred) — R6 OUT, R0+R1+R3 démarrables immédiatement.
- **Bundle Lighthouse trop strict** → seuil permissif R7 (Performance >= 70) puis relevé en V1.x.
- **TVA H révèle bug prod** → audit R0 préventif (grep `* 1\.2` + factures historiques).

## Hors scope explicite

- Pas de React 19 / Tailwind v5 / Vite 7.
- Pas de migration React Query / SWR.
- Pas de barrel exports.
- Pas de réorganisation `pages/` vs `components/`.
- Pas de `formatEuro` dédupliqué en story dédiée (ramassé pendant R4/R5).
- Pas de refacto cluster `DashboardLibrary*` (V2).
- Pas de migration `marguerite-*` testid en story dédiée (opportuniste R1/R2).
- Pas d'infra `i18n` (V2 — ADR-R7 décidé).
- Pas de WCAG AA formel (V2 — ADR-R7 décidé).

## Métadonnées

- **Audit refacto** : 2026-05-11 ([audit-2026-05-11.md](../refacto-artifacts/audit-2026-05-11.md))
- **Review adversariale** : 2026-05-11 ([review-adversarial-2026-05-11.md](../refacto-artifacts/review-adversarial-2026-05-11.md))
- **Plan Winston** : 2026-05-11 ([refacto-plan-2026-05.md](../refacto-artifacts/refacto-plan-2026-05.md))
- **Backlog stories produit** : 2026-05-11 (cet epic + 9 story docs)
- **Date démarrage exécution** : ≥ 2026-05-23 (post-démo)
- **Arbitrages Arnaud actés** : ADR-R1 V1.1 deferred + ADR-R7 a11y light V1.2 + i18n V2

---

*Epic produit en Étape E du workflow refacto, en clôture du cycle Audit (A+B) → Review adversariale (C) → Plan Winston (D) → Backlog (E).*
