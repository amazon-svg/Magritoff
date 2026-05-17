---
story_id: P0.2
epic: Sprint 4 — PIM-Boutique-Commandes (Phase 0 Préalables)
title: Migration SQL — extension du catalogue de gammes PIM (+5 gammes)
status: livrée
applied_at: 2026-05-17
target_branch: beta/v5
agent: Dev (Claude Code)
size: S (~0.5j, livrée en ~0.2j)
migration_file: supabase/migrations/20260517_01_pim_gammes_extension.sql
commit: P0.2 migration (cf. git log)
depends_on: P0.1 (ADR PIM RLS documentée — pas bloquant)
unblocks: P0.3 (livrée, H1 confirmé aucun code), P0.4 (smoke test ingestion)
prod_smoke_check:
  - "count(product_gammes) = 27 ✅"
  - "5 nouveaux slugs présents avec display_order 35/36/37/38/41 ✅"
  - "parent_slugs corrects (kakemono/etiquette/banderole root, roll_up_80x200 sous kakemono, depliant_plie_dl sous depliant) ✅"
---

# Story P0.2 — Extension catalogue gammes PIM (+5)

## Story (As / I want / So that)

**As an** acheteur B2B sur une boutique Magrit qui commande un kakémono, une étiquette, une banderole ou un dépliant plié
**I want** que la card de la boutique affiche un libellé métier correct (ex: "Kakémono / Roll-up") au lieu du badge générique "LEAFLET"
**So that** je puisse identifier rapidement le type de produit et que la boutique paraisse professionnelle au lieu d'exposer la nomenclature technique Clariprint.

## Contexte

L'audit Gammes du 2026-05-17 a identifié 5 familles de produits **détectables dans le code applicatif** (`src/app/utils/productEnrichment.ts` lignes 97-106 + PRD mockup MVP/Growth) mais **absentes du seed `product_gammes`** :

1. `kakemono` (roll-up vertical grand format)
2. `roll_up_80x200` (variante standard 80×200 cm sous kakemono)
3. `etiquette` (petit format ≤ 100mm, mockup MVP cible)
4. `banderole` (grand format intermédiaire 1000-1500mm)
5. `depliant_plie_dl` (dépliant 3 volets format DL 210×100)

Sans ces gammes, `resolveGamme()` retourne `null` pour ces produits → `enrichProduct()` retombe sur la `category` brute du produit Clariprint (`"leaflet"` / `"folded"`) → la card affiche "LEAFLET" en uppercase CSS sur tous ces produits (cf. bug `S-FIX-2` 11/05 qui avait déjà corrigé ce symptôme pour les gammes existantes, mais sans étendre le catalogue).

## Acceptance Criteria

**AC1** — Migration SQL `supabase/migrations/20260517_01_pim_gammes_extension.sql` créée avec 5 INSERT idempotents (`ON CONFLICT (slug) DO UPDATE`).

**AC2** — Les 5 gammes respectent la convention `matching_rules` JSONB (cf. header 20260420_pim.sql) :
- `kind` ∈ {leaflet, folded, book}
- `size_range` { min_dim?, max_dim? } borne sur max(width, height)
- `size_near` { width, height, tol } match précis
- `display_order` numérique pour ordre d'affichage wizard

**AC3** — Mappings retenus :

| slug | name | parent | kind | matching_rules |
|---|---|---|---|---|
| `kakemono` | Kakémonos / Roll-ups | (root) | leaflet | size_range min_dim ≥ 1500 |
| `roll_up_80x200` | Roll-up standard 80×200 cm | kakemono | leaflet | size_near 800×2000 tol 50 |
| `etiquette` | Étiquettes / Stickers | (root) | leaflet | size_range max_dim ≤ 100 |
| `banderole` | Banderoles | (root) | leaflet | size_range min_dim 1000-1500 |
| `depliant_plie_dl` | Dépliant plié DL (3 volets) | depliant | folded | size_near 210×100 tol 5 |

**AC4** — Display orders : kakemono=35, roll_up_80x200=36, etiquette=37, banderole=38, depliant_plie_dl=41 (s'insèrent entre affiche_a0=34 et l'ancien depliant=40, en cohérence avec la hiérarchie existante).

**AC5** — Migration appliquée sur le projet Supabase prod B5 `ightkxebexuzfjdbpsdg` (procédure Dashboard SQL Editor, cf. CLAUDE.md — PAT temporaire requise auprès d'Arnaud).

**AC6** — Smoke check après application :
```sql
select count(*) from public.product_gammes;  -- attendu : 27 (22 legacy + 5 nouvelles)
select slug, name, parent_slug, display_order
  from public.product_gammes
  where slug in ('kakemono','roll_up_80x200','etiquette','banderole','depliant_plie_dl')
  order by display_order;  -- attendu : 5 lignes ordonnées 35..41
```

**AC7** — Aucune régression sur les 22 gammes existantes : matching_rules inchangés, slugs inchangés, count avant migration = 22, count après = 27.

## Décisions techniques

| Décision | Choix | Argument |
|---|---|---|
| `kakemono` kind | `leaflet` (pas `folded`) | Un kakémono est imprimé à plat puis posé sur structure roll-up — Clariprint le traite comme leaflet vertical grand format |
| `banderole` kind | `leaflet` | Même rationale : grand format imprimé à plat sur PVC/bâche, kind Clariprint = leaflet |
| `roll_up_80x200` sous-gamme | Sous `kakemono` (pas root) | Cohérence hiérarchique avec carte_visite_standard < carterie, flyer_a4 < flyer |
| Suffixe `_80x200` | Conservé | Précision dimensionnelle pour permettre d'autres variantes futures (`roll_up_85x200`, `roll_up_100x250`) |
| `depliant_plie_dl` sous-gamme | Sous `depliant` existant | Cohérence avec `flyer_dl` sous `flyer` |
| Tolérances `tol` | 50mm pour roll_up, 5mm pour dépliant DL | 50mm = absorbe les variantes 80×195 / 80×205 ; 5mm = strict pour DL |

## Risques & mitigations

| Risque | Mitigation |
|---|---|
| Chevauchement matching avec carte_visite (max_dim 100) pour très petit format | display_order : carterie=10, etiquette=37 → carte_visite prime (spécificité size_near > size_range), comportement souhaité |
| Chevauchement kakemono / banderole sur formats 1500mm | kakemono `min_dim ≥ 1500`, banderole `min_dim 1000-1500` (max_dim 1500) → mutuellement exclusifs |
| Chevauchement banderole / affiche_a0 (1189×841) | banderole `min_dim ≥ 1000`, affiche_a0 `size_near 841×1189` → A0 plus spécifique (size_near > size_range), A0 prime |
| Wizard onboarding doit absorber 11 parents (vs 6) | Traité dans la story dédiée P0.3 (préalable bloquant) |

## Fichiers touchés

- `supabase/migrations/20260517_01_pim_gammes_extension.sql` : nouveau (~50 lignes)
- Aucun code applicatif (RLS publique, productEnrichment.ts reconnait déjà ces matching_rules format)

## Tests / Vérifications

1. **Pre-migration** : `select count(*) from public.product_gammes;` → 22
2. **Appliquer migration** via Dashboard SQL Editor
3. **Post-migration count** : 27
4. **Validation 5 nouveaux slugs** : retourne 5 lignes (AC6)
5. **Smoke test ingestion** : couvert par story P0.4 (commande kakémono → candidate → matching résolu kakemono)
6. **Régression wizard onboarding** : couvert par story P0.3

## TF Notion à créer en fin de story

- **TF "Catalogue gammes PIM élargi à 27 (5 nouvelles : kakémono, étiquette, banderole, etc.)"** :
  - Parcours : P00 ou P01 (création/onboarding tenant)
  - Persona : Owner tenant
  - Type : SQL DB + Manuel humain
  - URL départ : Dashboard Supabase `https://supabase.com/dashboard/project/ightkxebexuzfjdbpsdg/sql/new`
  - Étapes : exécuter les 2 queries de l'AC6
  - Résultat attendu : count=27, 5 nouvelles gammes affichées avec display_order ordonnés

## Notes

La migration SQL a déjà été drafted en amont (`20260517_01_pim_gammes_extension.sql` créé dans le working tree mais **non commité**) lors de la session de planification. Ce story doc formalise la spec ; l'implémentation est triviale (5 INSERT). Le vrai travail réside dans (a) la cohérence des `matching_rules`, (b) l'application Dashboard SQL, (c) le smoke check post-application.
