---
story_id: S0.2 (E-NEW-CLARIPRINT-01)
epic: 0 — Pré-sprint Démo Readiness
title: Investigation provenance prix + sanitization Clariprint
status: livrée
delivered_at: 2026-05-09
target_branch: beta/v5
agent: Dev (rétrofit document 2026-05-10)
size: S → M (élargie en cours d'investigation)
commit: c929371
---

# Story S0.2 — Investigation prix + sanitization Clariprint

## Story (Given/When/Then)

**As an** architecte produit Magrit
**I want** comprendre toutes les sources de prix et infos produits affichées dans Magrit
**So that** l'architecture Order entity v1.1 ne soit pas bâtie sur des fondations opaques (anomalie connue : 2e prix de provenance inconnue + -1,2 € intermittent côté Clariprint).

## Contexte

Arnaud a relevé en session 2026-05-08 qu'au moins **2 prix différents** sont affichés dans l'UI Magrit sans qu'on sache d'où vient le second. Pré-condition obligatoire avant Epic 1 (Order entity ne peut être bâtie sur source de prix opaque).

**Investigation menée par subagent Explore (mode read-only)** — cf. PRICE_SOURCES.md livré.

## Findings clés (audit `docs/PRICE_SOURCES.md`)

| # | Constat | Sévérité |
|---|---|---|
| ✅ | **Pas d'hallucination LLM de prix** : Claude génère des suggestions `+€` pédagogiques uniquement | OK |
| 🔴 | **Le « 2e prix mystère » identifié** : `PricingPanel.tsx:26` affichait `product.price` brut sans hiérarchie | Critique |
| 🔴 | **Aucune validation des anomalies Clariprint** côté endpoint `clariprint-quote` (-1,2 €, NaN, undefined affichés tels quels) | Critique |

## Acceptance Criteria validés

**AC1** — Audit complet livré ✅
> Document `docs/PRICE_SOURCES.md` (~200 lignes) recense toutes les sources de prix par écran (9 composants audités), trace la provenance, identifie les outliers.

**AC2** — Sanitization défensive implémentée (C1) ✅
> Fonction `validateClariprintResponse()` ajoutée dans `src/app/utils/clariprintQuote.ts` filtre prix négatifs, NaN, undefined, costs.total invalide. Appel auto dans `fetchClariprintQuote()` (2e ligne de défense).

**AC3** — Validation côté endpoint (C2) ✅
> `supabase/functions/make-server-e3db71a4/index.ts` ligne 1212 (ex) : sanitization défensive avant `c.json()` retour. Anomalies bloquées côté serveur. Edge function **redéployée en prod** sur `ightkxebexuzfjdbpsdg`.

**AC4** — PricingPanel réparé (C3) ✅
> `src/app/components/PricingPanel.tsx:26` utilise désormais `resolvePrice(product, clariprintQuote)` au lieu de `product.price` brut. Badge "Estimation" si fallback (renommé "Prix marché" le 2026-05-09 dans le fix Prix marché).

**AC5** — Helper unique priceResolver (E1) ✅
> Nouveau module `src/app/utils/priceResolver.ts` — fonction `resolvePrice()` + `formatPrice()` exportées. Hiérarchie canonique : `clariprint > library_cached > prix_marche > zero`.

## Décisions techniques (validées avec Arnaud)

| Décision | Choix Arnaud |
|---|---|
| **Stratégie en cas anomalie Clariprint** | **C** — fallback `estimatedPrice` + badge (suppression à venir post-intégration Clariprint complète) |
| **Création helper `priceResolver` maintenant** | **OK** — Rule of Three respectée (3+ consommateurs identifiés) |
| **Sort de PricingPanel** | **A** — réparer (ne pas déprécier, sera remplacé par overlay S2.4 plus tard) |

## Fichiers touchés

| Fichier | Modification |
|---|---|
| `src/app/utils/clariprintQuote.ts` | +63 lignes : `validateClariprintResponse()` + appel auto dans `fetchClariprintQuote()` |
| `supabase/functions/make-server-e3db71a4/index.ts` | +49 lignes / -2 : sanitization avant retour `c.json()` |
| `src/app/components/PricingPanel.tsx` | +23 lignes / -2 : utilisation `resolvePrice` + badge UI |
| `src/app/utils/priceResolver.ts` (nouveau) | 130 lignes : helper canonique |
| `docs/PRICE_SOURCES.md` (nouveau) | ~200 lignes : audit complet |

## Tests à ajouter (cahiers Notion)

⏳ **À créer dans Notion** (Action 2 BMAD rétrofit) :
- TF S0.2-1 : Anomalie Clariprint -1,2 € → bannière erreur, pas de prix négatif affiché
- TF S0.2-2 : PricingPanel sans Clariprint → badge "Prix marché" (Estimation à l'origine)
- TF S0.2-3 : Sanitization endpoint serveur (test SQL DB sur `llm_usage_events`)

## Écarts vs PRD/Architecture

- **Pas d'écart de scope.** S0.2 est conforme à la spec PRD § Domain Requirements + Architecture §4.4 (ClariprintAdapter pattern préfiguré).
- **Évolution post-livraison** : la fonction `validateClariprintResponse` créée ici est **étendue par S1.2** (`ClariprintError` typée) sans perte de compatibilité.

## Commits

- `c929371` : `fix(v5): sanitization Clariprint et priceResolver unique (S0.2 / E-NEW-CLARIPRINT-01)`
- Edge function redéployée 2026-05-09 via `supabase functions deploy make-server-e3db71a4`

## Statut

✅ **Livrée et pushée sur `beta/v5`** (2026-05-09).
✅ **Edge function redéployée** en prod.
⏳ **Cas TF Notion** : à créer (cf. Action 2).
✅ **Document `PRICE_SOURCES.md`** livré.
