---
story_id: P0.8
epic: Sprint 4 — PIM-Boutique-Commandes (Phase 0 Préalables)
title: Parité complète resolveGamme backend pim-ingest avec front productEnrichment
status: livrée partiel (parité front portée, 3/5 mappings OK avec régression critique carte_visite_standard résolue)
delivered_at: 2026-05-17
deployment: pim-ingest v9 (2026-05-17 15:37)
follow_up: P0.9 (convention cm/mm robuste)
final_result: "ruleSpecificity + filterMatchesByProductName portés bit-identiques au front. Régression carte_visite_standard résolue (size_near prime sur etiquette size_range). Kakemono/banderole non résolus à cause du seuil toMm 50 insuffisant — couvert par P0.9"
target_branch: beta/v5
agent: Dev (Claude Code)
size: S (~45min — port de 2 mécanismes existants front, refacto resolveGamme)
depends_on: P0.7 (toMm porté, redeploy v8 livré — fix partiel 2/5)
unblocks: P0.4 finalisation E2E (5/5 mappings corrects), parité totale ingestion/rendu boutique
discovered_in: P0.7 v2 smoke test du 2026-05-17 — 3/5 toujours faux malgré toMm
---

# Story P0.8 — Parité resolveGamme back ↔ front

## Story (As / I want / So that)

**As an** architecte projet Magrit
**I want** que la fonction `resolveGamme()` côté backend `pim-ingest` ait une **parité fonctionnelle complète** avec la version frontend `productEnrichment.ts` (disambiguation par nom de produit + tri par spécificité des matching_rules)
**So that** le matching gamme soit identique en ingestion (création de fiche `product_definitions` pour les commandes) et en rendu boutique (badge gamme sur ShopProductCard), évitant un drift backend/frontend qui ferait que les fiches PIM soient mal taggées et les cards aussi.

## Contexte

Suite à P0.7 v2 (port `toMm` + redeploy v8), le smoke test P0.4 v2 a révélé **3 mappings sur 5 toujours faux** :

| ref_input | gamme_resolved | gamme attendue | Issue |
|---|---|---|---|
| Kakemono 80×200 (cm→ ???) | flyer | kakemono | toMm n'a pas converti 80 et 200 (≥50) → restent en mm → matche flyer max 300 |
| Étiquette 50×50 (cm→500mm) | etiquette | etiquette | ✅ |
| Banderole 120×30 (cm→ 30→300mm mais 120 reste 120) | affiche | banderole | toMm partial : 30→300 mais 120 reste 120 → maxDim 300 → matche affiche (≥297) |
| Dépliant DL 21×10 (cm→210×100) | depliant_plie_dl | depliant_plie_dl | ✅ |
| **Carte visite 8.5×5.5 (cm→85×55)** | **etiquette** | **carte_visite_standard** | toMm OK, mais tri display_order DESC met etiquette (37) avant carte_visite_standard (11) |

Le frontend a deux mécanismes complémentaires qui résolvent ces cas, **absents du backend** :

### Mécanisme 1 — `filterMatchesByProductName` (front lignes 91-121)

Disambiguation par mot-clé dans le nom du produit. Avant le tri final, si plusieurs gammes matchent les règles dimensionnelles, on filtre par discriminateur basé sur `productName.toLowerCase()`. Liste des 8 discriminateurs front :

```typescript
{ keyword: /\b(carte|carterie)\b/, gammePattern: /^(carterie|carte_)/ },
{ keyword: /\bflyer\b/, gammePattern: /^flyer/ },
{ keyword: /\baffiche|poster\b/, gammePattern: /^affiche/ },
{ keyword: /\bd[ée]pliant\b/, gammePattern: /^depliant/ },
{ keyword: /\bbrochure\b/, gammePattern: /^brochure/ },
{ keyword: /\b(kakemono|roll-?up)\b/, gammePattern: /^(kakemono|roll)/ },
{ keyword: /\b(banderole|banner)\b/, gammePattern: /^(banderole|banner)/ },
{ keyword: /\b[ée]tiquette|sticker\b/, gammePattern: /^(etiquette|sticker)/ },
```

→ Pour "Kakemono 80×200 test P0.4 v2", le keyword `\bkakemono\b` matche → ne garde que les gammes `kakemono*`. Résout 4/5 cas (Kakemono, Banderole, Étiquette, Carte de visite — Dépliant déjà OK par dimension).

### Mécanisme 2 — `ruleSpecificity` (front lignes 123-133)

Score de spécificité des matching_rules. Plus de règles précises = plus haut.

```typescript
size_near = 5  // plus précis (dimensions exactes)
binding_in = 4
folds = 3
size_range = 2
kind = 2 (string) / 1 (array)
pages_range = 2
```

Front trie par `ruleSpecificity` DESC, puis `display_order` ASC en tiebreaker. → `carte_visite_standard` (size_near, score 7) prime sur `etiquette` (size_range, score 4) → carte visite 85×55 mm → carte_visite_standard ✅.

Le backend trie **uniquement** par `display_order DESC` (ligne 184-186 pim-ingest) → comportement inverse pour les chevauchements.

## Acceptance Criteria

**AC1** — Fonction `ruleSpecificity(rules: Record<string, unknown>): number` ajoutée dans `pim-ingest/index.ts`, **bit-identique** au frontend (mêmes scores 5/4/3/2).

**AC2** — Fonction `filterMatchesByProductName(matches: Gamme[], productName: string): Gamme[]` ajoutée, **bit-identique** au frontend avec les 8 discriminateurs (cf. liste ci-dessus).

**AC3** — `resolveGamme()` refactoré en 4 phases (parité front) :
1. **Match phase** : itérer toutes les gammes, collecter celles dont `matching_rules` matchent (kind + size + binding + folds + pages)
2. **Disambiguation phase** : si `matches.length > 1` et `productName` (lu via `n.reference` ou `n.name`), appliquer `filterMatchesByProductName`
3. **Tri phase** : `sort by ruleSpecificity DESC, then display_order ASC`
4. **Return** : `matches[0]` ou `null` si aucun match

**AC4** — `productName` extrait via `n.reference` en priorité (champ standard pim_candidates), fallback `n.name` ou `n.title` si reference absent.

**AC5** — Aucun changement de comportement sur les 22 anciennes gammes (test de non-régression).

**AC6** — Edge function `pim-ingest` redéployée v9.

**AC7** — Re-INSERT 5 candidates "v3" (clean fresh test), Arnaud relance ingestion, vérification SQL : **5/5 mappings corrects** :
| ref_input | gamme attendue |
|---|---|
| Kakemono 80×200 test P0.4 v3 | `kakemono` (filterByName + size_range min_dim≥1500 mm après ×10 sur 80→800 et 200→2000) |
| Étiquette 50×50 test P0.4 v3 | `etiquette` (filterByName "etiquette") |
| Banderole 120×30 test P0.4 v3 | `banderole` (filterByName "banderole") |
| Dépliant DL 21×10 test P0.4 v3 | `depliant_plie_dl` (filterByName "depliant" + size_near) |
| Carte visite test P0.4 v3 (regression) | `carte_visite_standard` (filterByName "carte" + ruleSpecificity size_near > etiquette size_range) |

**AC8** — Aucun changement frontend `productEnrichment.ts` (le front est la source de vérité, on porte vers backend).

## Sub-issue identifiée — heuristique `toMm` insuffisante pour cm grands (Kakemono 80×200)

Le seuil `< 50` du front (`v < 50 ? v * 10 : v`) ne convertit pas 80 (cm) ni 200 (cm) à 800/2000 mm. C'est un **bug pré-existant aussi dans le front** : un kakémono 80×200 cm serait mal taggé en boutique aussi (matche flyer en rendu).

**Décision P0.8** : on garde l'heuristique seuil 50 (parité front), mais on **compense via `filterMatchesByProductName`** : le nom "Kakemono 80x200" est filtré par le keyword `\bkakemono\b` → ne garde que les gammes kakemono → match correct même si toMm n'a pas converti.

**Hors scope P0.8** : améliorer `toMm` pour mieux gérer les grands formats cm (>50). Pourrait être une story `S-FIX-CM-MM-LARGE` ultérieure si le pattern devient récurrent (kakemono, banderole, A0 vendus en cm…). Pour l'instant, `filterMatchesByProductName` compense.

## Décisions techniques

| Décision | Choix | Argument |
|---|---|---|
| Source `productName` | `raw_config.reference` prioritaire | Convention pim_candidates : "reference" = label produit usuel |
| Fallback `productName` | `n.name`, `n.title` | Robustesse si reference absent |
| Scores `ruleSpecificity` | Identiques au front | Évite drift, comportement prévisible |
| Discriminateurs `filterMatchesByProductName` | Identiques au front | Idem, parité stricte |
| Toucher `toMm` seuil ? | Non | Bug latent partagé front/back, hors scope P0.8 |
| Refacto `resolveGamme` style fonctionnel | Oui (filter + sort) | Plus lisible, parité front |
| Tests vitest | Non (Deno code, pas vitest direct) | Couverture via smoke test P0.4 v3 |

## Risques & mitigations

| Risque | Mitigation |
|---|---|
| Refacto resolveGamme casse autres flows ingestion existante | AC5 non-régression : tester avec un produit "Carte de visite standard 85×55mm" déjà ingéré historiquement → doit toujours matcher carte_visite_standard. Smoke test P0.4 v3 couvre. |
| Drift futur si front évolue sans porter au back | Documenter dans architecture.md (Step 5 conventions) que `pim-ingest:resolveGamme` doit rester en parité bit-identique avec `productEnrichment:resolveGamme`. À envisager pour P0.9 doc futur. |
| Performance dégradée (filter all then sort all) | Négligeable (27 gammes, opérations O(n) sur ≤50 items). |
| `productName` absent dans des candidates anciennes | Fallback vers tri spécificité+display_order. Comportement gracieux. |

## Procédure d'exécution

### Étape 1 — Cleanup P0.7 v2 (5 candidates polluées)
```sql
delete from public.product_definitions
where id in (
  select merged_into from public.pim_candidates
  where raw_config->>'_test_p0_4' = 'true' and merged_into is not null
);
delete from public.pim_candidates where raw_config->>'_test_p0_4' = 'true';
```

### Étape 2 — Fix code pim-ingest (Claude Code)
- Ajout `ruleSpecificity` (port front)
- Ajout `filterMatchesByProductName` (port front)
- Refacto `resolveGamme` en 4 phases (match → filter → sort → return)

### Étape 3 — Redeploy v9
```bash
supabase functions deploy pim-ingest --project-ref ightkxebexuzfjdbpsdg
```

### Étape 4 — Re-INSERT 5 candidates "v3" (référence "test P0.4 v3")
Reprise même SQL avec marker `_test_p0_4 = true`.

### Étape 5 — Arnaud relance ingestion via UI
`/t/imprimerie-ipa/dashboard/admin/pim` → "Lancer l'ingestion".

### Étape 6 — Vérification SQL (5/5 attendu)
Query identique à P0.7 step 6.

### Étape 7 — Cleanup final (optionnel)
Delete les 5 test definitions + candidates si on veut nettoyer la prod.

## Tests / Vérifications

1. **Code review** : `ruleSpecificity` et `filterMatchesByProductName` bit-identiques au front
2. **Smoke test** : 5/5 candidates avec bonne `gamme_slug` (AC7)
3. **Non-régression** : la carte de visite 8.5×5.5 cm doit résoudre `carte_visite_standard` (vs etiquette en P0.7 v2)

## TF Notion à créer en fin de story

- **TF "pim-ingest parite resolveGamme + filterByName + ruleSpecificity"** :
  - Parcours : P07 — Tracking consommation IA
  - Persona : Superadmin Magrit
  - Type : SQL DB + Manuel humain
  - Étapes : reprendre étapes 1-6 ci-dessus
  - Résultat attendu : 5 candidates `merged` avec gammes correctes (5/5)

## Notes

Cette story illustre l'importance du **refacto par extraction de helpers partagés** : si `resolveGamme` était dans un module `_shared/gammeMatcher.ts` consommé par les 2 environnements (front Vite + back Deno via npm), on n'aurait pas ce drift. À considérer pour le Sprint 5 (story `S-REFACTO-GAMMERESOLVER-SHARED`).

Phase 0 commence à dériver (P0.6 + P0.7 + P0.8 = 3 nouvelles stories de fix collatéral). Mais c'est exactement la valeur ajoutée de la méthode BMAD stricte : ces 3 bugs étaient en prod silencieusement depuis 1 semaine et auraient cassé la démo 23/05 ou les sprints suivants. Découverts grâce à 1 seul smoke test.
