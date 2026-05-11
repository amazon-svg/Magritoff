---
id: R0
epic: EPIC-REFACTO-1
sprint: Refacto Sprint 1 (post-démo)
priority: P0
effort: M (2 j-Claude)
assignee: Claude code
depends_on: []
unblocks: [R1, R2, R3]
inputs:
  - _bmad-output/refacto-artifacts/refacto-plan-2026-05.md (ADR-R6)
  - _bmad-output/refacto-artifacts/review-adversarial-2026-05-11.md §1.1 B1+B2 + §4.1
  - _bmad-output/refacto-artifacts/audit-2026-05-11.md §6.3 zones froides critiques
status: pending
---

# R0 — Spikes garde-fous + TVA configurable + modal dupliquée

## Origine

Story de garde-fou pré-refacto issue de l'**Étape D Winston** ([refacto-plan-2026-05.md](_bmad-output/refacto-artifacts/refacto-plan-2026-05.md)) consolidant 3 risques détectés par l'**Étape C review adversariale** :
- Bug Critique B1 — TVA 20 % hardcodée 5+ fois (risque conformité fiscale DGFIP)
- Bug Critique B2 — `LibraryPickerModal` dupliquée dans ProductCard l. 621-639
- Risque R-1 plan Winston — refacto R1/R2 sans tests garde-fous = régression silencieuse maximale

## Contexte

3 zones froides critiques (audit §6.3) n'ont **aucun test direct** alors qu'elles sont consommées par toute la chaîne de valeur Magrit :
- [src/app/utils/priceResolver.ts](src/app/utils/priceResolver.ts) — hiérarchie `clariprint > library_cached > prix_marche > zero`
- [src/server/clariprint/ClariprintAdapter.ts](src/server/clariprint/ClariprintAdapter.ts) — pattern de validation Clariprint
- [src/app/contexts/CartContext.tsx](src/app/contexts/CartContext.tsx) — agrégation panier + total HT/TTC

Toute décomposition R1 (ProductCard) ou R2 (ChatInterface) sans harness préalable = régression silencieuse non détectable par vitest courant (162/162 verts mais coverage zones froides ≈ 0 %).

## User story

En tant que **Claude code futur exécutant R1-R8**, je veux disposer d'un harness vitest qui ancre les comportements critiques de `priceResolver`, `ClariprintAdapter` et `CartContext`, **plus** un utilitaire TVA centralisé qui supprime les 5+ duplications hardcodées, **plus** la suppression de la modale `LibraryPickerModal` dupliquée — afin de pouvoir refactorer ProductCard et ChatInterface sans risque de régression silencieuse et sans porter la dette fiscale.

## Critères d'acceptation

1. **Given** `src/app/utils/tax.ts` créé, **When** je query `getTaxRate(tenant)` pour un tenant FR métropole, **Then** retourne `0.20` ; pour un tenant DOM-TOM (Réunion par ex.), retourne `0.085` ; pour un tenant auto-entrepreneur franchise TVA, retourne `0` ; pour un tenant export hors UE, retourne `0`.
2. **Given** la migration `tenant.tax_regime` enum (`metropole_fr` / `dom_tom` / `franchise_tva` / `export_eu` / `export_world`) ajoutée, **When** je query `select tax_regime from tenants where id=<x>`, **Then** la colonne existe et la valeur default est `'metropole_fr'`.
3. **Given** les 5 callers TVA hardcodés (ProductCard:786, QuoteModal:173, CartButton:112, PublicShop:257, CartContext:52), **When** je grep `* 1.2` ou `* 0.2` dans `src/`, **Then** **0 occurrence** de TVA hardcodée (tous migrés vers `getTaxRate(tenant)` ou helper similaire).
4. **Given** `tests/utils/priceResolver.test.ts` créé, **When** je run `vitest`, **Then** au minimum **8 cas** couvrent la hiérarchie complète + edge cases (Clariprint null / library_cached miss / prix_marche négatif filtré / quantity rebate).
5. **Given** `tests/server/clariprint/ClariprintAdapter.test.ts` créé, **When** je run `vitest`, **Then** au minimum **6 cas** couvrent : payload valide, prix négatif filtré (`negative_price` error kind), undefined value filtré, produit manquant filtré, timeout 10s, retry success.
6. **Given** `tests/contexts/CartContext.test.ts` créé, **When** je run `vitest`, **Then** au minimum **5 cas** couvrent : ajout / retrait / vider / total HT-TTC selon `getTaxRate(tenant)` / mock isolation par tenant.
7. **Given** `ProductCard.tsx`, **When** je grep `<LibraryPickerModal`, **Then** **1 seule occurrence** (la 2e instance l. 621-639 supprimée).
8. **0 régression** : `vitest run` >= 162/162 (à 19+ nouveaux cas) tous verts. Build Vite OK.

## Spécifications API / data

- **Migration SQL** : `supabase/migrations/2026MMDD_01_R0_tenant_tax_regime.sql` ajoute colonne `tax_regime` à `tenants` avec enum + default `'metropole_fr'`.
- **Helper** : `src/app/utils/tax.ts` exporte `getTaxRate(tenant: Tenant): number` + `formatTax(amount, rate)`.
- **Migration callers** :
   - [src/app/components/ProductCard.tsx:786](src/app/components/ProductCard.tsx#L786) `priceHT * 1.2` → `priceHT * (1 + getTaxRate(currentTenant))`
   - [src/app/components/QuoteModal.tsx:173](src/app/components/QuoteModal.tsx#L173) idem
   - [src/app/components/CartButton.tsx:112](src/app/components/CartButton.tsx#L112) idem
   - [src/app/components/shop/PublicShop.tsx:257](src/app/components/shop/PublicShop.tsx#L257) idem
   - [src/app/contexts/CartContext.tsx:52](src/app/contexts/CartContext.tsx#L52) idem
- **Suppression** : [src/app/components/ProductCard.tsx:621-639](src/app/components/ProductCard.tsx#L621-L639) — supprimer la 2e instance `LibraryPickerModal` (la 1re reste).
- **Fixtures tests** : créer `tests/fixtures/tenants.ts` avec 3 tenants prototypes (metropole / dom_tom / franchise) pour les tests TVA.
- **Pas de modification testIds** (pas de nouveau composant UI).

## Dépendances

- Aucun prérequis bloquant (R0 = premier story du sprint refacto).
- **Bloque R1, R2, R3** : aucune décomposition de gros composant n'est autorisée avant que R0 ne soit merged + verte.

## Estimation

**M (2 j-Claude)**. 0,5 j Spike H TVA (migration + tax.ts + 5 callers) + 0,25 j Spike B2 modal + 1,25 j tests garde-fous (19+ cas vitest dont fixtures tenants).

## Plan de test

- **vitest** : 19+ nouveaux cas couvrant priceResolver / ClariprintAdapter / CartContext / tax.
- **TF Notion à créer** : *"TVA configurable par tax_regime — vérification montants par tenant prototype"*, parcours P05 ou P09, persona Owner tenant, P1, type SQL DB + IA Chrome. Hints DOM : assertion sur le total TTC affiché conforme au `tax_regime` du tenant.
- **Smoke prod** : query `SELECT tax_regime, count(*) FROM tenants GROUP BY tax_regime;` après migration pour confirmer le defaulting `metropole_fr` sur tenants existants.
- **Grep audit** : `grep -r "* 1\.2\|* 0\.2\|* 0\.20" src/` doit retourner **0 résultat hors `tax.ts`**.

## Définition de « terminé »

- Code merged sur `beta/v5`.
- Migration SQL appliquée en prod (Supabase B5).
- vitest run vert avec 19+ nouveaux cas.
- 0 occurrence TVA hardcodée hors `tax.ts` (grep verified).
- TF nouveau créé dans Notion et joué OK.
- Update `architecture.md` §X.X avec ADR-R6 tranchée.
- Story doc complété en clôture avec retour d'expérience (déviations vs plan, surprises).
