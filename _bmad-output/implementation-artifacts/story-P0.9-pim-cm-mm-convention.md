---
story_id: P0.9
epic: Sprint 4 — PIM-Boutique-Commandes (Phase 0 Préalables)
title: Convention cm/mm robuste (string=cm LLM, number=mm) partagée front+back
status: livrée
delivered_at: 2026-05-17
deployment: pim-ingest v10 (2026-05-17 16:03)
final_result: "5/5 mappings corrects validés en prod : kakemono→roll_up_80x200, etiquette→etiquette, banderole→banderole, depliant→depliant_plie_dl, carte_visite→carte_visite_standard. Convention `string=cm, number=mm` portée bit-identique front/back. 301 tests vitest verts (+11 nouveaux)"
target_branch: beta/v5
agent: Dev (Claude Code)
size: S (~30min, change limité mais touche 2 fichiers)
depends_on: P0.8 (parité resolveGamme déjà portée, plus que toMm à fixer)
unblocks: P0.4 finalisation E2E (5/5), résolution définitive matching cm/mm
discovered_in: P0.8 v3 smoke test — 3/5 OK mais kakemono/banderole toujours faux (toMm seuil 50 insuffisant pour grands formats cm)
---

# Story P0.9 — Convention cm/mm robuste partagée

## Story (As / I want / So that)

**As an** architecte projet Magrit
**I want** que la conversion cm→mm dans `toMm()` soit basée sur la **convention de typage** (string = LLM Clariprint cm, number = admin/code mm) au lieu d'une heuristique de seuil numérique fragile
**So that** les grands formats cm (kakemono 80×200, banderole 120×30, A0 84.1×118.9) soient correctement convertis sans casser les petits formats mm directs (carte de visite 85×55), de manière déterministe et auditable.

## Contexte — Validation par audit prod

Audit SQL prod (2026-05-17) sur `product_definitions` :
```sql
select count(*) from public.product_definitions
where (variation_filter->>'width') ~ '^[0-9]+(\.[0-9]+)?$'
  and (variation_filter->>'width')::numeric between 50 and 250;
```
**Résultat : 2 records seulement** — qui sont mes candidates P0.4 v3 ratées (kakemono PVC + banderole PVC). **Aucun produit historique** n'a width en string ≥ 50. Toutes les valeurs strings observées en prod sont des cm LLM (< 50 ou alors les 2 anomalies test).

→ La convention "**typeof string = cm LLM, typeof number = mm admin**" est **safe** : elle ne casse aucun produit existant tout en résolvant le bug kakemono/banderole.

## Acceptance Criteria

**AC1** — Refacto `toMm()` côté **frontend** [productEnrichment.ts:165-170](src/app/utils/productEnrichment.ts#L165-L170) :
- Signature change : `toMm(v: unknown): number` au lieu de `toMm(v: number): number`
- Convention :
  - `typeof v === 'number'` → reste mm (return v si valide)
  - `typeof v === 'string'` → parseFloat puis ×10 (cm → mm)
  - Autres types → 0

**AC2** — Le caller front (`resolveGamme` ligne 153-170) passe `field(config, 'width')` brut à `toMm` (avant parseFloat), pas `parseFloat(field(...))`. Idem height.

**AC3** — Refacto `toMm()` côté **backend** [pim-ingest/index.ts:187-190](supabase/functions/pim-ingest/index.ts#L187-L190) avec la **même logique bit-identique** que front.

**AC4** — Caller backend (`resolveGamme` ligne 195-196) passe `n.width` brut à `toMm`, pas `Number(n.width)` pré-converti.

**AC5** — Tests vitest ajoutés dans `tests/utils/productEnrichment.test.ts` (ou créé si absent) :
- `toMm(85)` (number mm) → 85
- `toMm("8.5")` (string cm) → 85
- `toMm("80")` (string cm grand format) → 800
- `toMm("200")` (string cm) → 2000
- `toMm(0)` → 0
- `toMm(null)` → 0
- `toMm(undefined)` → 0

**AC6** — Edge function `pim-ingest` redéployée v10.

**AC7** — Re-INSERT 5 candidates "v4", Arnaud relance ingestion, **5/5 mappings corrects** :
- Kakemono 80×200 → `kakemono` ou `roll_up_80x200` ✅
- Étiquette 50×50 → `etiquette` ✅
- Banderole 120×30 → `banderole` ✅
- Dépliant DL 21×10 → `depliant_plie_dl` ✅
- Carte de visite 8.5×5.5 → `carte_visite_standard` ✅

**AC8** — Aucune régression front : tests vitest existants passent (290 baseline). Test manuel sur boutique avec un produit carte de visite existant → matching `carte_visite_standard` (rendu badge OK).

## Décisions techniques

| Décision | Choix | Argument |
|---|---|---|
| Convention typage | `string=cm, number=mm` | Audit prod safe + cohérent avec convention LLM Clariprint observée (cf. logs Arnaud 17/05) |
| Seuil de sécurité | Aucun (convention pure) | Plus déterministe que `< 50` ou `< 300`. Pas de zone grise. |
| Fallback `dimensions: { width: 85, height: 55 }` (admin saisi en number nested) | `typeof number` → reste mm | Cohérent atelier deviseur (parseConfigsToProducts emet number) |
| Suppression `Math.round` | Oui à conserver | Évite des décimaux résiduels (85.99999 → 86) |
| Compat ascendante front | Modifier resolveGamme caller pour passer raw au lieu de parsed | Adapt 2 lignes max |

## Risques & mitigations

| Risque | Mitigation |
|---|---|
| Produit historique admin saisi en string mm | Audit prod confirme **0 cas**. Si découvert plus tard : ajouter le record en explicite via migration. |
| Régression sur cartes de visite déjà ingérées | Test smoke : carte visite v4 cm "8.5"/"5.5" → carte_visite_standard. ✅ |
| Convention non documentée diverge à terme | AC ajout commentaire JSDoc explicite "LLM string=cm, admin number=mm" dans les 2 fichiers |
| Front et back drift à nouveau | AC1 et AC3 disent "bit-identique". Story future `S-REFACTO-SHARED-RESOLVER` pour extraire en module commun (mais hors scope P0.9) |

## Procédure d'exécution

### Étape 1 — Cleanup v3 candidates polluées
```sql
delete from public.product_definitions
where id in (
  select merged_into from public.pim_candidates
  where raw_config->>'_test_p0_4' = 'true' and merged_into is not null
);
delete from public.pim_candidates where raw_config->>'_test_p0_4' = 'true';
```

### Étape 2 — Fix code front productEnrichment.ts (Claude Code)
- Refacto `toMm()` lignes 165-170 → signature `(v: unknown)` + convention typage
- Caller `resolveGamme` lignes 153-170 → passer raw au lieu de parsed

### Étape 3 — Fix code back pim-ingest/index.ts (Claude Code)
- Refacto `toMm()` lignes 187-190 → même logique bit-identique
- Caller `resolveGamme` lignes 195-196 → passer raw

### Étape 4 — Tests vitest (Claude Code)
- Ajout 6+ cas dans `tests/utils/productEnrichment.test.ts` (ou créé)

### Étape 5 — Redeploy v10
```bash
supabase functions deploy pim-ingest --project-ref ightkxebexuzfjdbpsdg
```

### Étape 6 — Re-INSERT 5 candidates v4 + Arnaud relance ingestion

### Étape 7 — Vérification SQL 5/5 + cleanup final

## TF Notion à créer en fin de story

- **TF "Convention toMm cm string vs mm number partagée front+back"** :
  - Parcours : P07 — Tracking consommation IA + P08/P09 (matching boutique)
  - Persona : Superadmin Magrit + Dev
  - Type : SQL DB + Manuel humain + IA Chrome
  - Étapes : reprendre 1-7 ci-dessus

## Notes

Convention choisie après audit prod prouvant 0 régression. Phase 0 du sprint atteint 9 stories (P0.1-P0.9) au lieu de 5 initialement prévues, mais c'est la **valeur ajoutée de la méthode BMAD stricte** : 4 bugs prod (pim-ingest deploy obsolete + 3 bugs matching cm/mm) découverts et fixés AVANT la démo 23/05 qui aurait silencieusement créé des PIM mal taggés.
