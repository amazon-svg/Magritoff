---
id: R4
epic: EPIC-REFACTO-1
sprint: Refacto Sprint 2 (post-démo)
priority: P0
effort: M (2 j-Claude)
assignee: Claude code
depends_on: [R1]
unblocks: [R5]
inputs:
  - _bmad-output/refacto-artifacts/refacto-plan-2026-05.md (ADR-R2)
  - _bmad-output/refacto-artifacts/review-adversarial-2026-05-11.md §1.2 M5 + §1.3 E2
  - _bmad-output/refacto-artifacts/audit-2026-05-11.md §7.1 + §7.2 + §8.1 D
status: pending
---

# R4 — Types DB partagés (`database.types.ts` + zod sélectif)

## Origine

Story refacto P0 issue de l'**Étape D Winston ADR-R2** sur priorité **D**.

## Contexte

Audit §7.2 : **pas de `database.types.ts` côté front**. Types DB ré-écrits manuellement dans 14 callers `from()` + 8 fetch direct edge. `CartContext.tsx:5` typé `product: any`. `ShopProduct` (`ShopsContext.tsx:36`) ne reflète pas la colonne `tenant_id` ajoutée par migration `20260424_02_tenant_id_on_data.sql`. **`zod` absent côté front** (présent seulement côté `supabase/functions/_shared/productsSchema.ts` 1908 L).

Risque actuel : tout changement de schéma DB (ex : `tenant_orders` migration `20260509_01`) = 5-15 corrections front non détectées TS, dérive silencieuse possible.

Décision Winston (ADR-R2) : `database.types.ts` généré via Supabase CLI **+** couche zod **sélective** pour chemins critiques (Cart, Order, Clariprint, PIM). Pas de zod systématique (over-engineering).

## User story

En tant que **développeur Claude code futur** travaillant sur Magrit, je veux disposer de types DB générés automatiquement depuis Supabase + schemas zod sur les chemins critiques, afin que toute dérive de schéma DB soit bloquée à la compilation TS et que la validation runtime des payloads Clariprint / Cart / Order soit centralisée.

## Critères d'acceptation

1. **Given** R4 livré, **When** je liste `src/types/`, **Then** `database.types.ts` existe, généré par `supabase gen types typescript --project-id ightkxebexuzfjdbpsdg --schema public > src/types/database.types.ts`.
2. **Given** un script `pnpm db:types` ajouté au `package.json`, **When** je le lance, **Then** il régénère `database.types.ts` (commande documentée dans `SPRINT_HANDOFF.md`).
3. **Given** R4 livré, **When** je grep `: any` dans `src/app/contexts/`, **Then** **0 occurrence** (ex : `CartContext.tsx:5` `product: any` migré vers `Tables<'shop_products'>` ou type approprié).
4. **Given** les zod schemas sélectifs, **When** je liste `src/schemas/`, **Then** au minimum 4 fichiers : `cartItem.schema.ts`, `clariprintPayload.schema.ts`, `productDefinition.schema.ts`, `shopOrder.schema.ts`. Chacun avec parsing + `infer<Type>` exporté.
5. **Given** un payload Clariprint reçu d'un caller migré (R3), **When** il passe par `clariprintPayloadSchema.parse(data)`, **Then** les prix négatifs / NaN / undefined sont rejetés à la limite zod (refactor de `validateClariprintResponse()`).
6. **Given** les 14 callers `from()` audit §7.1, **When** je les liste après R4, **Then** **au moins 8 utilisent `Tables<'...'>`** (les chemins critiques shop_orders / tenant_members / product_definitions / shop_products / library_products / quote_templates / tenant_invitations / llm_usage_events).
7. **Given** `tenant_orders` schéma livré DB (S1.4), **When** je grep `Tables<'tenant_orders'>` dans `src/`, **Then** au moins 1 fichier l'importe (préparation V1.1 deferred — type prêt même si UI non développée encore).
8. **0 régression** : `tsc --noEmit` doit passer vert. `vitest run` doit rester vert.

## Spécifications API / data

- **Outil** : Supabase CLI `npx supabase gen types typescript --project-id ightkxebexuzfjdbpsdg --schema public`.
- **Fichier généré** : [src/types/database.types.ts](src/types/database.types.ts) — committé tel quel (pas de modif manuelle).
- **Helpers zod** : 4 fichiers minimum dans `src/schemas/` (cf. CA 4).
- **Stratégie de migration des 14 callers** :
  - Phase A R4 : générer types + migrer 8 chemins critiques (priorité shop_orders / tenant_orders / product_definitions / cart).
  - Phase B (story future ou cleanup R8) : migrer les 6 callers restants au fil de la stabilisation V1.1.
- **`as unknown as Tables<>`** transitoires autorisés avec commentaire `// TODO R4-cleanup` si zod parse trop strict — à résoudre dans une PR de cleanup ultérieure.
- **Pas de modification edge functions** (zod déjà côté backend via `_shared/productsSchema.ts`).
- **package.json** : ajouter script `"db:types": "supabase gen types typescript --project-id ightkxebexuzfjdbpsdg --schema public > src/types/database.types.ts"`.

## Dépendances

- **Prérequis** : R1 mergé (le pattern des hooks extraits R1 ProductCard donne la cible architecturale à généraliser).
- **Débloque** : R5 (pattern Supabase unique peut s'appuyer sur les types pour `supabase.functions.invoke<TBody, TResp>()` typé).

## Estimation

**M (2 j-Claude)**. 0,25 j génération + commit `database.types.ts` ; 0,5 j installation zod + 4 schemas critiques ; 1 j migration des 8 callers critiques ; 0,25 j tests + tsc verification.

## Plan de test

- **vitest** : 4 tests sur les schemas zod (parsing OK + parsing rejet valeurs aberrantes).
- **`tsc --noEmit`** : doit passer vert après migration. Erreurs TS révélées en cours de migration = bugs latents découverts → à fixer dans la même PR ou à tagger `TODO R4-cleanup`.
- **TF Notion à créer** : *"Types DB partagés — `database.types.ts` synchronisé + zod sélectif sur 4 chemins critiques"*, P00/P09, persona Superadmin Magrit, P1, type Manuel + SQL DB.
- **Smoke** : run `pnpm db:types` + vérifier diff vs version committée = 0 (idempotent).

## Définition de « terminé »

- `src/types/database.types.ts` généré et committé.
- `pnpm db:types` script ajouté + documenté dans SPRINT_HANDOFF.md.
- 4 schemas zod sélectifs livrés.
- 8+ callers `from()` migrés vers `Tables<'...'>`.
- 0 `: any` dans `src/app/contexts/` (grep verified).
- `tsc --noEmit` vert.
- vitest run vert (200+ cas attendus à ce stade).
- TF nouveau créé et joué OK.
- Update `architecture.md` §6.X avec ADR-R2 tranchée.
